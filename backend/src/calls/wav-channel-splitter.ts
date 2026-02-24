import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WavDecoder = require('wav-decoder');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WavEncoder = require('wav-encoder');

/**
 * Конвертирует MP3 в стерео WAV через ffmpeg (должен быть установлен в системе).
 * @returns путь к временному WAV-файлу или null при ошибке
 */
export function convertMp3ToWav(mp3Path: string): Promise<string | null> {
  const prefix = `kidney-call-${process.pid}-${Date.now()}`;
  const wavPath = path.join(os.tmpdir(), `${prefix}-stereo.wav`);

  return new Promise((resolve) => {
    const ff = spawn(
      'ffmpeg',
      ['-y', '-i', mp3Path, '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', wavPath],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    ff.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    ff.on('error', () => {
      resolve(null);
    });
    ff.on('close', (code) => {
      if (code === 0) resolve(wavPath);
      else resolve(null);
    });
  });
}

/**
 * Соглашение: канал 0 (левый, left) = оператор, канал 1 (правый, right) = абонент (собеседник).
 * Разбивает стерео WAV или MP3 на два моно WAV (левый и правый каналы).
 * Для MP3 используется ffmpeg для конвертации в WAV, затем разделение по каналам.
 * @returns пути к левому и правому моно WAV или null, если не стерео / ошибка
 */
export async function splitStereoAudioToMonoFiles(audioPath: string): Promise<{ leftPath: string; rightPath: string } | null> {
  const ext = path.extname(audioPath).toLowerCase();
  let wavPath: string | null = null;

  if (ext === '.mp3') {
    wavPath = await convertMp3ToWav(audioPath);
    if (!wavPath) return null;
    try {
      const result = await splitStereoWavToMonoFiles(wavPath);
      await fs.unlink(wavPath).catch(() => {});
      return result;
    } catch {
      await fs.unlink(wavPath).catch(() => {});
      return null;
    }
  }

  if (ext === '.wav') {
    return splitStereoWavToMonoFiles(audioPath);
  }

  return null;
}

/**
 * Соглашение: канал 0 (левый, left) = оператор, канал 1 (правый, right) = абонент (собеседник).
 * Разбивает стерео WAV на два моно-файла во временной директории.
 * @returns пути к левому и правому моно WAV или null, если файл не стерео / не WAV / ошибка декода
 */
export async function splitStereoWavToMonoFiles(audioPath: string): Promise<{ leftPath: string; rightPath: string } | null> {
  const ext = path.extname(audioPath).toLowerCase();
  if (ext !== '.wav') return null;

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(audioPath);
  } catch {
    return null;
  }

  let audioData: { sampleRate: number; channelData: Float32Array[] };
  try {
    audioData = await WavDecoder.decode(buffer);
  } catch {
    return null;
  }

  if (!audioData?.channelData || audioData.channelData.length < 2) return null;

  const prefix = `kidney-call-${process.pid}-${Date.now()}`;
  const leftPath = path.join(os.tmpdir(), `${prefix}-operator.wav`);
  const rightPath = path.join(os.tmpdir(), `${prefix}-abonent.wav`);

  const leftMono = {
    sampleRate: audioData.sampleRate,
    channelData: [audioData.channelData[0]],
  };
  const rightMono = {
    sampleRate: audioData.sampleRate,
    channelData: [audioData.channelData[1]],
  };

  try {
    const leftBuf = await WavEncoder.encode(leftMono);
    const rightBuf = await WavEncoder.encode(rightMono);
    await fs.writeFile(leftPath, Buffer.from(leftBuf));
    await fs.writeFile(rightPath, Buffer.from(rightBuf));
  } catch {
    await fs.unlink(leftPath).catch(() => {});
    await fs.unlink(rightPath).catch(() => {});
    return null;
  }

  return { leftPath, rightPath };
}
