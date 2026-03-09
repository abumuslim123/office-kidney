import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { AppSetting } from '../settings/entities/app-setting.entity';
import {
  CALLS_TRITECH_CLIENT_ID,
  CALLS_TRITECH_CLIENT_SECRET,
  CALLS_TRITECH_USERNAME,
  CALLS_TRITECH_PASSWORD,
} from './calls-settings.constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FormData = require('form-data');

const TRITECH_BASE = 'https://3i-vox.ru';
const TOKEN_URL = `${TRITECH_BASE}/oauth/token`;
const STORAGE_URL = `${TRITECH_BASE}/api/v1/storage/files`;
const ASR_TASKS_URL = `${TRITECH_BASE}/api/v1/asr/tasks`;
const SPEAKERS_MODELS_URL = `${TRITECH_BASE}/api/v1/speakers/models`;
const SPEAKERS_TASKS_URL = `${TRITECH_BASE}/api/v1/speakers/tasks`;

const TOKEN_KEY = 'tritech_access_token';
const TOKEN_EXPIRES_KEY = 'tritech_token_expires_at';

export type TritechSentiment = {
  operator: string | null;
  abonent: string | null;
  perTurn: { speaker: 'operator' | 'abonent'; sentiment: string; confidence?: number }[] | null;
};

export type TritechTranscribeResult = {
  text: string;
  operatorText: string | null;
  abonentText: string | null;
  turns: { speaker: 'operator' | 'abonent'; text: string; start?: number; end?: number }[] | null;
  words: { word: string; start: number; end: number; speaker: 'operator' | 'abonent' }[] | null;
  duration: number;
  speechDuration: number;
  silenceDuration: number;
  sentiment: TritechSentiment | null;
};

@Injectable()
export class TritechAudioService {
  private readonly logger = new Logger(TritechAudioService.name);

  constructor(
    @InjectRepository(AppSetting)
    private settingsRepo: Repository<AppSetting>,
  ) {}

  private async getSetting(key: string): Promise<string | null> {
    const row = await this.settingsRepo.findOne({ where: { key } });
    const value = row?.value?.trim() || '';
    return value || null;
  }

  private async saveSetting(key: string, value: string): Promise<void> {
    await this.settingsRepo.save({ key, value });
  }

  async isConfigured(): Promise<boolean> {
    const [clientId, clientSecret, username, password] = await Promise.all([
      this.getSetting(CALLS_TRITECH_CLIENT_ID),
      this.getSetting(CALLS_TRITECH_CLIENT_SECRET),
      this.getSetting(CALLS_TRITECH_USERNAME),
      this.getSetting(CALLS_TRITECH_PASSWORD),
    ]);
    return Boolean(clientId && clientSecret && username && password);
  }

  private async getToken(): Promise<string> {
    // Check cached token
    const cached = await this.getSetting(TOKEN_KEY);
    const expiresAt = await this.getSetting(TOKEN_EXPIRES_KEY);
    if (cached && expiresAt && Date.now() < Number(expiresAt) - 60_000) {
      return cached;
    }

    const clientId = await this.getSetting(CALLS_TRITECH_CLIENT_ID);
    const clientSecret = await this.getSetting(CALLS_TRITECH_CLIENT_SECRET);
    const username = await this.getSetting(CALLS_TRITECH_USERNAME);
    const password = await this.getSetting(CALLS_TRITECH_PASSWORD);
    if (!clientId || !clientSecret || !username || !password) {
      throw new BadRequestException('3iTech: credentials не настроены. Укажите в настройках звонков.');
    }

    try {
      const res = await axios.post(
        TOKEN_URL,
        new URLSearchParams({
          grant_type: 'password',
          username,
          password,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 30_000,
        },
      );

      const { access_token, expires_in } = res.data;
      if (!access_token) throw new Error('No access_token in response');

      const expiresAtMs = String(Date.now() + (expires_in || 3600) * 1000);
      await this.saveSetting(TOKEN_KEY, access_token);
      await this.saveSetting(TOKEN_EXPIRES_KEY, expiresAtMs);

      this.logger.log('3iTech token obtained successfully');
      return access_token;
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? `${err.response?.status} ${JSON.stringify(err.response?.data)}`
        : String(err);
      throw new BadRequestException(`3iTech авторизация не удалась: ${msg}`);
    }
  }

  private async uploadFile(filePath: string): Promise<string> {
    const token = await this.getToken();
    const form = new FormData();
    // 3iTech API requires 'parameters' multipart field BEFORE 'file'
    form.append('parameters', JSON.stringify({}), {
      contentType: 'application/json',
      filename: 'parameters.json',
    });
    form.append('file', fs.createReadStream(filePath), {
      filename: path.basename(filePath),
    });

    try {
      const res = await axios.post(STORAGE_URL, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 120_000,
      });
      const fileId = res.data?.id;
      if (!fileId) throw new Error('No file id in response');
      this.logger.log(`3iTech file uploaded: ${fileId}`);
      return fileId;
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? `${err.response?.status} ${JSON.stringify(err.response?.data)}`
        : String(err);
      throw new BadRequestException(`3iTech загрузка файла не удалась: ${msg}`);
    }
  }

  private async createAsrTask(fileId: string): Promise<string> {
    const token = await this.getToken();

    try {
      const res = await axios.post(
        ASR_TASKS_URL,
        {
          file_id: fileId,
          diarization: true,
          enable_automatic_punctuation: true,
          word_to_number: true,
          sentiment_analysis: true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        },
      );
      const taskId = res.data?.id;
      if (!taskId) throw new Error('No task id in response');
      this.logger.log(`3iTech ASR task created: ${taskId}, status: ${res.data?.status}`);
      return taskId;
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? `${err.response?.status} ${JSON.stringify(err.response?.data)}`
        : String(err);
      throw new BadRequestException(`3iTech создание задачи не удалось: ${msg}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async pollTaskResult(taskId: string, maxAttempts = 60, intervalMs = 3000): Promise<any> {
    const token = await this.getToken();
    const tsUrl = `${ASR_TASKS_URL}/${taskId}?result=true&output_format=timestamps`;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await axios.get(tsUrl, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30_000,
        });

        const status = res.data?.status;
        if (status === 'complete') {
          this.logger.log(`3iTech task ${taskId} complete after ${i + 1} poll(s)`);

          // Also fetch text format (with punctuation)
          try {
            const textUrl = `${ASR_TASKS_URL}/${taskId}?result=true&output_format=text`;
            const textRes = await axios.get(textUrl, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 30_000,
            });
            res.data._textResult = textRes.data?.result;
          } catch {
            this.logger.warn('3iTech: не удалось получить текстовый формат для пунктуации');
          }

          return res.data;
        }
        if (status === 'error') {
          throw new BadRequestException(`3iTech задача завершилась с ошибкой (task ${taskId})`);
        }
        if (status === 'deleted') {
          throw new BadRequestException(`3iTech задача была удалена (task ${taskId})`);
        }

        // status === 'process' — wait and retry
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        const msg = axios.isAxiosError(err)
          ? `${err.response?.status} ${JSON.stringify(err.response?.data)}`
          : String(err);
        this.logger.warn(`3iTech poll attempt ${i + 1} failed: ${msg}`);
        if (i === maxAttempts - 1) {
          throw new BadRequestException(`3iTech: не удалось получить результат задачи: ${msg}`);
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    this.logger.error(`3iTech polling timeout: taskId=${taskId}, attempts=${maxAttempts}`);
    throw new BadRequestException(`3iTech: таймаут ожидания результата распознавания (task ${taskId})`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseResult(taskData: any): TritechTranscribeResult {
    const metrics = taskData.metrics || {};
    const duration = Number(metrics.duration || taskData.duration) || 0;
    const speechDuration = Number(metrics.overall_speech) || 0;
    const silenceDuration = Number(metrics.overall_silence) || 0;

    const result = taskData.result;

    const greetingPattern =
      /здравствуйте|добрый\s*(день|вечер|утро)|чем\s*(могу|можем)\s*помочь|клиника|кидней|kidney|слушаю\s*вас|алл[её]/i;

    // 3iTech returns array of words: { word, begin, end, channel, phrase_id, speaker_id, confidence }
    // Group words into phrases by phrase_id, then determine speaker by channel
    type Phrase = { channel: string; text: string; start: number; end: number };
    const phrases: Phrase[] = [];

    if (Array.isArray(result) && result.length > 0 && result[0]?.word !== undefined) {
      // Word-level result — group by phrase_id
      const phraseMap = new Map<number, { words: string[]; channel: string; start: number; end: number }>();
      for (const w of result) {
        if (!w || typeof w !== 'object' || !w.word) continue;
        const phraseId = Number(w.phrase_id ?? 0);
        const existing = phraseMap.get(phraseId);
        const ch = String(w.channel ?? w.speaker_id ?? '0');
        const begin = Number(w.begin) || 0;
        const end = Number(w.end) || 0;
        if (existing) {
          existing.words.push(String(w.word));
          if (begin < existing.start) existing.start = begin;
          if (end > existing.end) existing.end = end;
        } else {
          phraseMap.set(phraseId, { words: [String(w.word)], channel: ch, start: begin, end });
        }
      }
      // Sort phrases by start time
      const sorted = [...phraseMap.entries()].sort((a, b) => a[1].start - b[1].start);
      for (const [, p] of sorted) {
        phrases.push({ channel: p.channel, text: p.words.join(' '), start: p.start / 1000, end: p.end / 1000 });
      }
    } else if (Array.isArray(result)) {
      // Segment-level result
      for (const item of result) {
        if (!item || typeof item !== 'object') continue;
        const text = String(item.text || item.word || '');
        if (!text) continue;
        phrases.push({
          channel: String(item.channel ?? item.speaker ?? item.speaker_id ?? '0'),
          text,
          start: (Number(item.begin || item.start) || 0) / 1000,
          end: (Number(item.end) || 0) / 1000,
        });
      }
    } else if (result && typeof result === 'object' && result.text) {
      phrases.push({ channel: '0', text: String(result.text), start: 0, end: duration });
    } else if (typeof result === 'string') {
      phrases.push({ channel: '0', text: result, start: 0, end: duration });
    }

    if (!phrases.length) {
      throw new BadRequestException('3iTech: результат распознавания пуст — речь не обнаружена');
    }

    // Determine which channel is operator
    const uniqueChannels = [...new Set(phrases.map((p) => p.channel))];

    // Find operator channel
    let operatorChannel = phrases[0]?.channel || '0';
    if (uniqueChannels.length >= 2) {
      for (const p of phrases.slice(0, 5)) {
        if (greetingPattern.test(p.text)) {
          operatorChannel = p.channel;
          break;
        }
      }
    }

    let turns: { speaker: 'operator' | 'abonent'; text: string; start?: number; end?: number }[];

    if (uniqueChannels.length >= 2) {
      turns = phrases.map((p) => ({
        speaker: p.channel === operatorChannel ? 'operator' as const : 'abonent' as const,
        text: p.text,
        start: p.start,
        end: p.end,
      }));
    } else {
      // Single channel — all operator
      turns = phrases.map((p) => ({
        speaker: 'operator' as const,
        text: p.text,
        start: p.start,
        end: p.end,
      }));
    }

    // Extract word-level timestamps
    let words: { word: string; start: number; end: number; speaker: 'operator' | 'abonent' }[] | null = null;
    if (Array.isArray(result) && result.length > 0 && result[0]?.word !== undefined) {
      words = [];
      for (const w of result) {
        if (!w || typeof w !== 'object' || !w.word) continue;
        const ch = String(w.channel ?? w.speaker_id ?? '0');
        const speaker = ch === operatorChannel ? 'operator' as const : 'abonent' as const;
        words.push({
          word: String(w.word),
          start: (Number(w.begin) || 0) / 1000,
          end: (Number(w.end) || 0) / 1000,
          speaker,
        });
      }
      if (!words.length) words = null;
    }

    // Merge punctuation from text format into word tokens
    const textResult = taskData._textResult;
    if (words && textResult) {
      const punctuatedText = this.extractPunctuatedText(textResult);
      if (punctuatedText) {
        this.applyPunctuation(words, punctuatedText);
      }
    }

    // Merge consecutive turns from the same speaker
    const merged: typeof turns = [];
    for (const turn of turns) {
      const last = merged[merged.length - 1];
      if (last && last.speaker === turn.speaker) {
        last.text += ' ' + turn.text;
        if (turn.end !== undefined) last.end = turn.end;
      } else {
        merged.push({ ...turn });
      }
    }

    // Rebuild turn text from punctuated words (if available)
    if (words && textResult) {
      for (const turn of merged) {
        const turnWords = words.filter(
          (w) => w.speaker === turn.speaker && w.start >= (turn.start || 0) - 0.05 && w.start < (turn.end || Infinity) + 0.05,
        );
        if (turnWords.length > 0) {
          turn.text = turnWords.map((w) => w.word).join(' ');
        }
      }
    }

    const operatorText = merged.filter((t) => t.speaker === 'operator').map((t) => t.text).join(' ').trim() || null;
    const abonentText = merged.filter((t) => t.speaker === 'abonent').map((t) => t.text).join(' ').trim() || null;

    const text =
      (operatorText ? `Оператор:\n${operatorText}` : '') +
      (operatorText && abonentText ? '\n\n' : '') +
      (abonentText ? `Собеседник:\n${abonentText}` : '');

    // Parse sentiment from metrics (channels_info may contain per-channel sentiment)
    let sentiment: TritechSentiment | null = null;
    const channelsInfo = metrics.channels_info;
    if (Array.isArray(channelsInfo)) {
      const perTurn: TritechSentiment['perTurn'] = [];
      for (const ch of channelsInfo) {
        if (ch?.sentiment || ch?.emotion) {
          const speaker = this.isOperatorChannel(ch.channel, merged) ? 'operator' as const : 'abonent' as const;
          perTurn.push({
            speaker,
            sentiment: String(ch.sentiment || ch.emotion),
            confidence: ch.sentiment_confidence || ch.emotion_confidence,
          });
        }
      }
      if (perTurn.length) {
        sentiment = {
          operator: perTurn.find(s => s.speaker === 'operator')?.sentiment || null,
          abonent: perTurn.find(s => s.speaker === 'abonent')?.sentiment || null,
          perTurn,
        };
      }
    }

    // Also check word-level sentiment (3iTech may include sentiment per word/phrase)
    if (!sentiment && Array.isArray(result)) {
      const wordSentiments = result.filter((w: any) => w?.sentiment && w.sentiment !== 'neutral');
      if (wordSentiments.length > 0) {
        // Aggregate sentiments by channel
        const channelSentiments = new Map<string, string[]>();
        for (const w of wordSentiments) {
          const ch = String(w.channel ?? '0');
          if (!channelSentiments.has(ch)) channelSentiments.set(ch, []);
          channelSentiments.get(ch)!.push(String(w.sentiment));
        }
        const perTurn: TritechSentiment['perTurn'] = [];
        for (const [ch, sentiments] of channelSentiments) {
          const speaker = this.isOperatorChannel(ch, merged) ? 'operator' as const : 'abonent' as const;
          // Most frequent sentiment
          const freq = new Map<string, number>();
          sentiments.forEach(s => freq.set(s, (freq.get(s) || 0) + 1));
          const dominant = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
          perTurn.push({ speaker, sentiment: dominant });
        }
        if (perTurn.length) {
          sentiment = {
            operator: perTurn.find(s => s.speaker === 'operator')?.sentiment || null,
            abonent: perTurn.find(s => s.speaker === 'abonent')?.sentiment || null,
            perTurn,
          };
        }
      }
    }

    // Log sentiment data for initial testing
    if (taskData.sentiment_analysis) {
      this.logger.log(`3iTech sentiment_analysis enabled, sentiment result: ${JSON.stringify(sentiment)}`);
    }

    return {
      text: text || merged.map((t) => t.text).join('\n'),
      operatorText,
      abonentText,
      turns: merged.length > 0 ? merged : null,
      words,
      duration,
      speechDuration,
      silenceDuration,
      sentiment,
    };
  }

  /**
   * Extract full punctuated text from the text-format result.
   * The text result can be a string, array of strings, or array of objects with text/channel.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractPunctuatedText(textResult: any): string | null {
    if (typeof textResult === 'string') return textResult;
    if (Array.isArray(textResult)) {
      // Array of objects with text field, or array of strings
      const parts = textResult.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item?.text) return String(item.text);
        if (item?.word) return String(item.word);
        return '';
      }).filter(Boolean);
      return parts.join(' ') || null;
    }
    if (textResult?.text) return String(textResult.text);
    return null;
  }

  /**
   * Align punctuated text with word tokens and apply punctuation marks.
   * Uses a simple sequential alignment: strip punctuation from text words,
   * match to raw word tokens, then copy trailing punctuation.
   */
  private applyPunctuation(
    words: { word: string; start: number; end: number; speaker: string }[],
    punctuatedText: string,
  ): void {
    // Split punctuated text into tokens (keeping punctuation attached)
    const textTokens = punctuatedText.split(/\s+/).filter(Boolean);
    const strip = (s: string) => s.toLowerCase().replace(/[.,!?;:…—–\-"""''«»()\[\]]/g, '');

    let ti = 0; // text token index
    for (let wi = 0; wi < words.length && ti < textTokens.length; wi++) {
      const rawClean = strip(words[wi].word);
      if (!rawClean) continue;

      // Try to find matching text token (allow small skip for misalignment)
      for (let look = 0; look < 3 && ti + look < textTokens.length; look++) {
        const ttClean = strip(textTokens[ti + look]);
        if (ttClean === rawClean || ttClean.includes(rawClean) || rawClean.includes(ttClean)) {
          words[wi].word = textTokens[ti + look];
          ti = ti + look + 1;
          break;
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isOperatorChannel(channel: any, merged: { speaker: 'operator' | 'abonent' }[]): boolean {
    // Check if the first merged turn for this channel is operator
    return merged.length > 0 && merged[0].speaker === 'operator';
  }

  async transcribeAudio(filePath: string): Promise<TritechTranscribeResult> {
    this.logger.log(`3iTech transcription started for: ${path.basename(filePath)}`);

    const fileId = await this.uploadFile(filePath);
    const taskId = await this.createAsrTask(fileId);
    const taskData = await this.pollTaskResult(taskId);
    const result = this.parseResult(taskData);

    this.logger.log(
      `3iTech transcription complete: ${result.turns?.length || 0} turns, ` +
        `duration=${result.duration}s, speech=${result.speechDuration}s`,
    );

    return result;
  }

  // --- Speaker Verification ---

  async getSpeakerModels(): Promise<{ id: string; name: string; ready: boolean; description?: string }[]> {
    const token = await this.getToken();
    try {
      const res = await axios.get(SPEAKERS_MODELS_URL, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30_000,
      });
      return (res.data?.data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        ready: m.ready ?? m.training_info?.status === 'ready',
        description: m.description,
      }));
    } catch (err) {
      const msg = axios.isAxiosError(err) ? `${err.response?.status} ${JSON.stringify(err.response?.data)}` : String(err);
      throw new BadRequestException(`3iTech: не удалось получить модели дикторов: ${msg}`);
    }
  }

  async createSpeakerModel(fileId: string, name: string, description?: string): Promise<{ id: string; name: string; ready: boolean }> {
    const token = await this.getToken();
    try {
      const res = await axios.post(
        SPEAKERS_MODELS_URL,
        { file_id: fileId, name, description: description || '' },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 30_000 },
      );
      return {
        id: res.data?.id,
        name: res.data?.name,
        ready: res.data?.ready ?? false,
      };
    } catch (err) {
      const msg = axios.isAxiosError(err) ? `${err.response?.status} ${JSON.stringify(err.response?.data)}` : String(err);
      throw new BadRequestException(`3iTech: не удалось создать модель диктора: ${msg}`);
    }
  }

  async deleteSpeakerModel(modelId: string): Promise<void> {
    const token = await this.getToken();
    try {
      await axios.delete(`${SPEAKERS_MODELS_URL}/${modelId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30_000,
      });
    } catch (err) {
      const msg = axios.isAxiosError(err) ? `${err.response?.status} ${JSON.stringify(err.response?.data)}` : String(err);
      throw new BadRequestException(`3iTech: не удалось удалить модель диктора: ${msg}`);
    }
  }

  async identifySpeaker(fileId: string, modelIds: string[]): Promise<{
    detectedModels: { id: string; speakerName: string }[];
    segments: { begin: number; end: number; channel: number; modelId: string; confidence: number }[];
  }> {
    const token = await this.getToken();
    try {
      const res = await axios.post(
        SPEAKERS_TASKS_URL,
        { file_id: fileId, model_ids: modelIds },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 30_000 },
      );
      const taskId = res.data?.id;
      if (!taskId) throw new Error('No task id');

      // Poll for result
      for (let i = 0; i < 30; i++) {
        const taskRes = await axios.get(`${SPEAKERS_TASKS_URL}/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30_000,
        });
        if (taskRes.data?.status === 'ready') {
          const result = taskRes.data?.result || {};
          return {
            detectedModels: (result.detected_models || []).map((m: any) => ({ id: m.id, speakerName: m.speaker_name })),
            segments: (result.segments || []).map((s: any) => ({
              begin: s.begin, end: s.end, channel: s.channel, modelId: s.model_id, confidence: s.confidence,
            })),
          };
        }
        if (taskRes.data?.status === 'error') {
          throw new Error('Speaker identification task failed');
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      throw new Error('Speaker identification timeout');
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const msg = axios.isAxiosError(err) ? `${err.response?.status} ${JSON.stringify(err.response?.data)}` : String(err);
      throw new BadRequestException(`3iTech: ошибка идентификации диктора: ${msg}`);
    }
  }

  // Upload file and return file_id (public wrapper for speaker model creation)
  async uploadFilePublic(filePath: string): Promise<string> {
    return this.uploadFile(filePath);
  }
}
