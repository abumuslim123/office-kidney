import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { Repository } from 'typeorm';
import { AppSetting } from '../settings/entities/app-setting.entity';
import {
  CALLS_AUDIO_API_KEY,
  CALLS_SPEECHKIT_API_KEY,
  CALLS_SPEECHKIT_FOLDER_ID,
  CALLS_PROVIDER,
} from './calls-settings.constants';
import {
  PROCESS_POLZA_API_KEY,
  PROCESS_POLZA_BASE_URL,
} from '../processes/process-polza-settings.constants';
import { splitAudioIntoChunks } from './wav-channel-splitter';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FormData = require('form-data');

const DEFAULT_POLZA_BASE = 'https://api.polza.ai';
const AITUNNEL_BASE = 'https://api.aitunnel.ru/v1';
const SPEECHKIT_STT_URL = 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize';

/** Модели транскрипции: Whisper — оптимален для коротких телефонных вызовов с промптом-словарём */
const POLZA_MODEL = 'openai/whisper-1';
const AITUNNEL_MODEL = 'whisper-1';

/** Модели диаризации (whisper не поддерживает диаризацию — оставляем gpt-4o-transcribe) */
const POLZA_DIARIZE_MODEL = 'openai/gpt-4o-transcribe';
const AITUNNEL_DIARIZE_MODEL = 'gpt-4o-transcribe-diarize';

/**
 * Промпт-словарь для Whisper: список характерных слов и фраз клиники.
 * Whisper использует его как «предыдущий фрагмент транскрипции» — это «затравливает»
 * модель нужной лексикой и помогает правильно распознать редкие термины.
 */
const TRANSCRIPTION_PROMPT =
  'Клиника Кидней, Kidney Clinic, Махачкала. ' +
  'Педиатрия, урология, детская хирургия, ЛОР, гинекология, эндокринология, неврология, офтальмология, кардиология, ортопедия. ' +
  'УЗИ, рентген, ЭКГ, холтер-мониторинг, чек-ап, вакцинация, анализы крови, общий анализ мочи, биохимия. ' +
  'ОРВИ, ротавирус, цистит, пиелонефрит, аденоиды, тонзиллит, аппендицит, паховая грыжа, сколиоз, дисплазия. ' +
  'Гипотиреоз, сахарный диабет, ЗПРР, задержка речевого развития, атопический дерматит, энурез, фимоз, синдром Дауна. ' +
  'Записаться на приём, стоимость консультации, педиатр, уролог, хирург, ЛОР-врач. ' +
  'Здравствуйте, клиника Кидней, чем могу помочь? Хотела бы записаться на приём к педиатру. ' +
  'Спасибо, до свидания, пожалуйста.';

/** GPT-4o-mini для коррекции терминологии после транскрипции */
const POLZA_CORRECTION_MODEL = 'openai/gpt-4o-mini';
const AITUNNEL_CORRECTION_MODEL = 'gpt-4o-mini';

const CORRECTION_SYSTEM_PROMPT =
  'Ты корректор транскрипций звонков клиники «Кидней» (Kidney Clinic, Махачкала). ' +
  'Исправь ошибки распознавания речи: медицинские термины, названия процедур, имена собственные. ' +
  'Не изменяй смысл, стиль и структуру текста. Не добавляй ничего лишнего. ' +
  'Специальности: педиатр, уролог, хирург, ЛОР, гинеколог, эндокринолог, невролог, офтальмолог, кардиолог, ортопед. ' +
  'Процедуры: УЗИ, рентген, ЭКГ, холтер, анализы, вакцинация, чек-ап. ' +
  'Диагнозы: ОРВИ, цистит, пиелонефрит, аденоиды, тонзиллит, гипотиреоз, сахарный диабет, ЗПРР, энурез, фимоз, сколиоз. ' +
  'Верни только исправленный текст, без пояснений и комментариев.';

@Injectable()
export class AitunnelAudioService {
  private readonly logger = new Logger(AitunnelAudioService.name);

  constructor(
    @InjectRepository(AppSetting)
    private settingsRepo: Repository<AppSetting>,
  ) {}

  private async getSettingValue(key: string): Promise<string | null> {
    const row = await this.settingsRepo.findOne({ where: { key } });
    const value = row?.value?.trim() || '';
    return value ? value : null;
  }

  private async getProvider(): Promise<'aitunnel' | 'yandex'> {
    const val = await this.getSettingValue(CALLS_PROVIDER);
    return val === 'yandex' ? 'yandex' : 'aitunnel';
  }

  private async getPolzaConfig() {
    const apiKey = await this.getSettingValue(PROCESS_POLZA_API_KEY);
    if (!apiKey) return null;
    const baseRaw = (await this.getSettingValue(PROCESS_POLZA_BASE_URL)) || DEFAULT_POLZA_BASE;
    const base = baseRaw.replace(/\/+$/, '');
    return { apiKey, url: `${base}/v1/audio/transcriptions` };
  }

  private async getAitunnelConfig() {
    const apiKey = await this.getSettingValue(CALLS_AUDIO_API_KEY);
    if (!apiKey) return null;
    return { apiKey, url: `${AITUNNEL_BASE}/audio/transcriptions` };
  }

  private async getSpeechKitConfig() {
    const apiKey = await this.getSettingValue(CALLS_SPEECHKIT_API_KEY);
    const folderId = await this.getSettingValue(CALLS_SPEECHKIT_FOLDER_ID);
    if (!apiKey || !folderId) return null;
    return { apiKey, folderId };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildForm(filePath: string, originalName: string | undefined, model: string, diarize: boolean): any {
    const form = new FormData();
    const fileName = originalName || path.basename(filePath) || 'audio.wav';
    form.append('file', fs.createReadStream(filePath), { filename: fileName });
    form.append('model', model);
    form.append('language', 'ru');
    if (diarize) {
      form.append('chunking_strategy', 'auto');
      form.append('response_format', 'diarized_json');
    } else {
      form.append('prompt', TRANSCRIPTION_PROMPT);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'segment');
      form.append('timestamp_granularities[]', 'word');
    }
    return form;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sendRequest(form: any, apiKey: string, url: string) {
    const res = await axios.post(url, form, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 180_000,
    });
    return res.data;
  }

  /**
   * Транскрибирует файл через Yandex SpeechKit (синхронный REST v1).
   * Аудио нарезается на 24-секундные чанки (лимит API — 30 сек / 1 МБ).
   * Возвращает объект { text } для совместимости с остальным pipeline.
   */
  private async transcribeAudioWithSpeechKit(filePath: string): Promise<{ text: string }> {
    const cfg = await this.getSpeechKitConfig();
    if (!cfg) throw new BadRequestException('Yandex SpeechKit: API ключ или Folder ID не настроены.');

    const chunks = await splitAudioIntoChunks(filePath, 24);
    if (!chunks.length) {
      // Fallback: отправить целиком (файл короткий или ffmpeg недоступен)
      chunks.push(filePath);
    }

    this.logger.log(`SpeechKit: ${chunks.length} chunk(s), folderId=${cfg.folderId.slice(0, 6)}...`);

    const parts: string[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = chunks[i];
        const data = await fsp.readFile(chunkPath);
        this.logger.log(`SpeechKit chunk ${i + 1}/${chunks.length}: ${data.length} bytes`);
        try {
          const res = await axios.post(
            `${SPEECHKIT_STT_URL}?lang=ru-RU&topic=general&folderId=${cfg.folderId}`,
            data,
            {
              headers: {
                Authorization: `Api-Key ${cfg.apiKey}`,
                'Content-Type': 'audio/x-wav',
              },
              timeout: 60_000,
            },
          );
          const result = res.data?.result;
          if (typeof result === 'string' && result.trim()) {
            parts.push(result.trim());
          }
        } catch (err) {
          const msg = axios.isAxiosError(err)
            ? `${err.response?.status} ${JSON.stringify(err.response?.data)}`
            : String(err);
          this.logger.error(`SpeechKit chunk ${i + 1} failed: ${msg}`);
          throw new BadRequestException(`Yandex SpeechKit ошибка: ${msg}`);
        }
      }
    } finally {
      for (const chunkPath of chunks) {
        if (chunkPath !== filePath) {
          await fsp.unlink(chunkPath).catch(() => {});
        }
      }
    }

    const text = parts.join(' ');
    if (!text) throw new BadRequestException('Yandex SpeechKit вернул пустой результат.');
    this.logger.log(`SpeechKit transcription succeeded: ${chunks.length} chunk(s)`);
    return { text };
  }

  /** Транскрипция с автоматическим fallback: Polza → AITunnel (или SpeechKit) */
  async transcribeAudio(filePath: string, originalName?: string) {
    const provider = await this.getProvider();

    if (provider === 'yandex') {
      return this.transcribeAudioWithSpeechKit(filePath);
    }

    const polza = await this.getPolzaConfig();
    const aitunnel = await this.getAitunnelConfig();
    if (!polza && !aitunnel) {
      throw new BadRequestException('API ключ не задан (ни Polza.ai, ни AITunnel). Настройте в разделе Настройки.');
    }

    // 1) Пробуем Polza
    if (polza) {
      try {
        const form = this.buildForm(filePath, originalName, POLZA_MODEL, false);
        const result = await this.sendRequest(form, polza.apiKey, polza.url);
        this.logger.log('Transcription via Polza.ai succeeded');
        return result;
      } catch (err) {
        const msg = axios.isAxiosError(err) ? `${err.response?.status} ${JSON.stringify(err.response?.data)}` : String(err);
        this.logger.warn(`Polza.ai transcription failed: ${msg}`);
      }
    }

    // 2) Fallback: AITunnel
    if (aitunnel) {
      try {
        const form = this.buildForm(filePath, originalName, AITUNNEL_MODEL, false);
        const result = await this.sendRequest(form, aitunnel.apiKey, aitunnel.url);
        this.logger.log('Transcription via AITunnel succeeded (fallback)');
        return result;
      } catch (err) {
        const msg = axios.isAxiosError(err) ? `${err.response?.status} ${JSON.stringify(err.response?.data)}` : String(err);
        throw new BadRequestException(`Транскрипция не удалась. AITunnel: ${msg}`);
      }
    }

    throw new BadRequestException('Polza.ai недоступна, AITunnel ключ не задан.');
  }

  /**
   * Исправляет медицинскую терминологию и имена собственные в транскрипции через LLM.
   * WAV → Whisper → текст → correctMedicalTranscript() → итоговый текст.
   * При ошибке возвращает исходный текст без изменений.
   */
  async correctMedicalTranscript(text: string): Promise<string> {
    if (!text || text.trim().length < 20) return text;

    const messages = [
      { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ];

    const polza = await this.getPolzaConfig();
    if (polza) {
      try {
        const chatUrl = polza.url.replace('/audio/transcriptions', '/chat/completions');
        const res = await axios.post(
          chatUrl,
          { model: POLZA_CORRECTION_MODEL, messages, max_tokens: 4096, temperature: 0.1 },
          {
            headers: { Authorization: `Bearer ${polza.apiKey}`, 'Content-Type': 'application/json' },
            timeout: 60_000,
          },
        );
        const content: unknown = res.data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) {
          this.logger.log('LLM correction via Polza.ai succeeded');
          return content.trim();
        }
      } catch (err) {
        const msg = axios.isAxiosError(err) ? `${err.response?.status} ${JSON.stringify(err.response?.data)}` : String(err);
        this.logger.warn(`LLM correction via Polza.ai failed: ${msg}`);
      }
    }

    const aitunnel = await this.getAitunnelConfig();
    if (aitunnel) {
      try {
        const res = await axios.post(
          `${AITUNNEL_BASE}/chat/completions`,
          { model: AITUNNEL_CORRECTION_MODEL, messages, max_tokens: 4096, temperature: 0.1 },
          {
            headers: { Authorization: `Bearer ${aitunnel.apiKey}`, 'Content-Type': 'application/json' },
            timeout: 60_000,
          },
        );
        const content: unknown = res.data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) {
          this.logger.log('LLM correction via AITunnel succeeded');
          return content.trim();
        }
      } catch (err) {
        const msg = axios.isAxiosError(err) ? `${err.response?.status} ${JSON.stringify(err.response?.data)}` : String(err);
        this.logger.warn(`LLM correction via AITunnel failed: ${msg}`);
      }
    }

    return text;
  }

  /** Транскрипция с диаризацией (определение спикеров по голосу). Fallback: Polza → AITunnel */
  async transcribeWithDiarize(filePath: string, originalName?: string) {
    const provider = await this.getProvider();

    // Yandex SpeechKit v1 не поддерживает диаризацию — используем обычную транскрипцию
    if (provider === 'yandex') {
      return this.transcribeAudioWithSpeechKit(filePath);
    }

    const polza = await this.getPolzaConfig();
    const aitunnel = await this.getAitunnelConfig();
    if (!polza && !aitunnel) {
      throw new BadRequestException('API ключ не задан (ни Polza.ai, ни AITunnel). Настройте в разделе Настройки.');
    }

    // 1) Пробуем Polza
    if (polza) {
      try {
        const form = this.buildForm(filePath, originalName, POLZA_DIARIZE_MODEL, true);
        const result = await this.sendRequest(form, polza.apiKey, polza.url);
        this.logger.log('Diarize transcription via Polza.ai succeeded');
        return result;
      } catch (err) {
        const msg = axios.isAxiosError(err) ? `${err.response?.status} ${JSON.stringify(err.response?.data)}` : String(err);
        this.logger.warn(`Polza.ai diarize failed: ${msg}`);
      }
    }

    // 2) Fallback: AITunnel
    if (aitunnel) {
      try {
        const form = this.buildForm(filePath, originalName, AITUNNEL_DIARIZE_MODEL, true);
        const result = await this.sendRequest(form, aitunnel.apiKey, aitunnel.url);
        this.logger.log('Diarize transcription via AITunnel succeeded (fallback)');
        return result;
      } catch (err) {
        const msg = axios.isAxiosError(err) ? `${err.response?.status} ${JSON.stringify(err.response?.data)}` : String(err);
        throw new BadRequestException(`Диаризация не удалась. AITunnel: ${msg}`);
      }
    }

    throw new BadRequestException('Polza.ai недоступна, AITunnel ключ не задан.');
  }
}
