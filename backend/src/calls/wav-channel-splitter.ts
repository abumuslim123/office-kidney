import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';

/**
 * Запускает ffmpeg с заданными аргументами.
 */
function runFfmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    ff.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    ff.on('error', () => resolve({ code: 1, stderr: 'ffmpeg not found' }));
    ff.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });
}

/**
 * Проверяет количество каналов в аудиофайле через ffprobe.
 */
function getAudioChannels(audioPath: string): Promise<number> {
  return new Promise((resolve) => {
    const ff = spawn(
      'ffprobe',
      ['-v', 'quiet', '-print_format', 'json', '-show_streams', audioPath],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    ff.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    ff.on('error', () => resolve(0));
    ff.on('close', () => {
      try {
        const data = JSON.parse(stdout) as { streams?: { codec_type?: string; channels?: number }[] };
        const audio = data.streams?.find((s) => s.codec_type === 'audio');
        resolve(audio?.channels ?? 0);
      } catch {
        resolve(0);
      }
    });
  });
}

/**
 * Цепочка фильтров для телефонного аудио, оптимизированная под Whisper:
 * - highpass: убирает низкочастотный гул и DC-смещение (< 200 Гц)
 * - lowpass:  телефонный диапазон (< 3400 Гц)
 * - afftdn:   спектральное шумоподавление (AI-фильтр, требует ffmpeg >= 4.0)
 * - dynaudnorm: нормализация громкости (тихий оператор / громкий абонент)
 */
const AF_FULL = 'highpass=f=200,lowpass=f=3400,afftdn=nf=-20,dynaudnorm=p=0.9:s=5';

/** Запасная цепочка без afftdn (для старых версий ffmpeg) */
const AF_BASIC = 'highpass=f=200,lowpass=f=3400,dynaudnorm=p=0.9:s=5';

/**
 * Запускает ffmpeg с фильтрами; при неудаче пробует упрощённую цепочку.
 * @returns true если хотя бы один вариант успешен
 */
async function runFfmpegWithFallback(
  fullArgs: string[],
  basicArgs: string[],
): Promise<boolean> {
  const res = await runFfmpeg(fullArgs);
  if (res.code === 0) return true;
  const res2 = await runFfmpeg(basicArgs);
  return res2.code === 0;
}

/**
 * Возвращает длительность аудиофайла в секундах через ffprobe.
 */
export function getAudioDurationSeconds(audioPath: string): Promise<number> {
  return new Promise((resolve) => {
    const ff = spawn(
      'ffprobe',
      ['-v', 'quiet', '-print_format', 'json', '-show_format', audioPath],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    ff.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    ff.on('error', () => resolve(0));
    ff.on('close', () => {
      try {
        const data = JSON.parse(stdout) as { format?: { duration?: string } };
        resolve(parseFloat(data.format?.duration ?? '0') || 0);
      } catch {
        resolve(0);
      }
    });
  });
}

/**
 * Нарезает аудио на чанки по N секунд для синхронных API (Yandex SpeechKit).
 * Каждый чанк — 16 кГц моно PCM WAV. Возвращает пути к временным файлам.
 */
export async function splitAudioIntoChunks(
  audioPath: string,
  chunkSeconds = 24,
): Promise<string[]> {
  const duration = await getAudioDurationSeconds(audioPath);
  if (duration <= 0) return [];

  const prefix = `kidney-call-${process.pid}-${Date.now()}`;
  const total = Math.ceil(duration / chunkSeconds);

  const paths: string[] = [];
  const tasks = Array.from({ length: total }, (_, i) => {
    const start = i * chunkSeconds;
    const outPath = path.join(os.tmpdir(), `${prefix}-chunk${i}.wav`);
    paths.push(outPath);
    return runFfmpeg([
      '-y', '-i', audioPath,
      '-ss', String(start), '-t', String(chunkSeconds),
      '-ar', '16000', '-ac', '1', '-acodec', 'pcm_s16le',
      outPath,
    ]);
  });

  const results = await Promise.all(tasks);
  return paths.filter((_, i) => results[i].code === 0);
}

/**
 * Предобрабатывает моноаудио для оптимальной транскрипции:
 * шумоподавление + нормализация + ресемплирование в 16 кГц.
 * @returns путь к временному WAV-файлу или null при ошибке
 */
export async function preprocessAudioForTranscription(audioPath: string): Promise<string | null> {
  const ext = path.extname(audioPath).toLowerCase();
  if (!['.wav', '.mp3'].includes(ext)) return null;

  const outPath = path.join(
    os.tmpdir(),
    `kidney-call-${process.pid}-${Date.now()}-clean.wav`,
  );

  const ok = await runFfmpegWithFallback(
    ['-y', '-i', audioPath, '-af', AF_FULL, '-ar', '16000', '-ac', '1', '-acodec', 'pcm_s16le', outPath],
    ['-y', '-i', audioPath, '-af', AF_BASIC, '-ar', '16000', '-ac', '1', '-acodec', 'pcm_s16le', outPath],
  );

  if (!ok) {
    await fs.unlink(outPath).catch(() => {});
    return null;
  }
  return outPath;
}

/**
 * Разбивает стерео WAV/MP3 на два моно WAV с предобработкой:
 * шумоподавление + нормализация + ресемплирование в 16 кГц.
 *
 * Соглашение: левый канал (c0) = оператор, правый (c1) = абонент.
 *
 * @returns пути к двум моно WAV или null (моно файл / нет ffmpeg / ошибка)
 */
export async function splitStereoAudioToMonoFiles(
  audioPath: string,
): Promise<{ leftPath: string; rightPath: string } | null> {
  const ext = path.extname(audioPath).toLowerCase();
  if (!['.wav', '.mp3'].includes(ext)) return null;

  const channels = await getAudioChannels(audioPath);
  if (channels < 2) return null;

  const prefix = `kidney-call-${process.pid}-${Date.now()}`;
  const leftPath = path.join(os.tmpdir(), `${prefix}-left.wav`);
  const rightPath = path.join(os.tmpdir(), `${prefix}-right.wav`);

  const makeArgs = (ch: string, af: string, out: string) => [
    '-y', '-i', audioPath,
    '-af', `pan=mono|c0=${ch},${af}`,
    '-ar', '16000', '-acodec', 'pcm_s16le',
    out,
  ];

  const [leftOk, rightOk] = await Promise.all([
    runFfmpegWithFallback(
      makeArgs('c0', AF_FULL, leftPath),
      makeArgs('c0', AF_BASIC, leftPath),
    ),
    runFfmpegWithFallback(
      makeArgs('c1', AF_FULL, rightPath),
      makeArgs('c1', AF_BASIC, rightPath),
    ),
  ]);

  if (!leftOk || !rightOk) {
    await fs.unlink(leftPath).catch(() => {});
    await fs.unlink(rightPath).catch(() => {});
    return null;
  }

  return { leftPath, rightPath };
}
