import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import { Repository } from 'typeorm';
import { AppSetting } from '../settings/entities/app-setting.entity';
import {
  CALLS_AUDIO_API_KEY,
} from './calls-settings.constants';
import {
  PROCESS_POLZA_API_KEY,
  PROCESS_POLZA_BASE_URL,
} from '../processes/process-polza-settings.constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FormData = require('form-data');

const DEFAULT_POLZA_BASE = 'https://api.polza.ai';
const AITUNNEL_BASE = 'https://api.aitunnel.ru/v1';

/** Модели транскрипции — gpt-4o-transcribe значительно лучше whisper-1 для шумного/телефонного аудио */
const POLZA_MODEL = 'openai/gpt-4o-transcribe';
const AITUNNEL_MODEL = 'gpt-4o-transcribe';

/** Модели диаризации */
const POLZA_DIARIZE_MODEL = 'openai/gpt-4o-transcribe';
const AITUNNEL_DIARIZE_MODEL = 'gpt-4o-transcribe-diarize';

/** Подсказка для модели — улучшает распознавание медицинских терминов и русской речи */
const TRANSCRIPTION_PROMPT =
  'Телефонный разговор колл-центра детской клиники «Кидней» (Kidney Clinic), Махачкала. ' +
  'Частная многопрофильная клиника для детей и взрослых: педиатрия, урология, хирургия, ЛОР, ' +
  'гинекология, эндокринология, неврология, офтальмология, кардиология, ортопедия, УЗИ, рентген. ' +
  'Услуги: чек-апы, анализы, ЭКГ, холтер, вакцинация, запись на приём. ' +
  'Участники: оператор контакт-центра и пациент/собеседник. Русский язык.';

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

  /** Транскрипция с автоматическим fallback: Polza → AITunnel */
  async transcribeAudio(filePath: string, originalName?: string) {
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

  /** Транскрипция с диаризацией (определение спикеров по голосу). Fallback: Polza → AITunnel */
  async transcribeWithDiarize(filePath: string, originalName?: string) {
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
