import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import { Repository } from 'typeorm';
import { AppSetting } from '../settings/entities/app-setting.entity';
import {
  CALLS_AUDIO_API_BASE,
  CALLS_AUDIO_API_KEY,
  CALLS_AUDIO_MODEL,
  CALLS_AUDIO_PATH,
  CALLS_POLZA_API_BASE,
  CALLS_POLZA_API_KEY,
  CALLS_POLZA_AUDIO_MODEL,
  CALLS_POLZA_AUDIO_PATH,
} from './calls-settings.constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FormData = require('form-data');

@Injectable()
export class AitunnelAudioService {
  constructor(
    private config: ConfigService,
    @InjectRepository(AppSetting)
    private settingsRepo: Repository<AppSetting>,
  ) {}

  private async getSettingValue(key: string): Promise<string | null> {
    const row = await this.settingsRepo.findOne({ where: { key } });
    const value = row?.value?.trim() || '';
    return value ? value : null;
  }

  private async getSettingOrEnv(key: string, envKey: string): Promise<string | null> {
    const stored = await this.getSettingValue(key);
    if (stored) return stored;
    const env = (this.config.get<string>(envKey) || '').trim();
    return env || null;
  }


  async transcribeAudio(filePath: string, originalName?: string) {
    const apiKey = await this.getSettingOrEnv(CALLS_AUDIO_API_KEY, 'AITUNNEL_API_KEY');
    if (!apiKey) throw new BadRequestException('API ключ не задан');
    const base =
      (await this.getSettingOrEnv(CALLS_AUDIO_API_BASE, 'AITUNNEL_API_BASE')) ||
      'https://api.aitunnel.ru/v1';
    const pathPart =
      (await this.getSettingOrEnv(CALLS_AUDIO_PATH, 'AITUNNEL_AUDIO_PATH')) ||
      '/audio/transcriptions';
    const model =
      (await this.getSettingOrEnv(CALLS_AUDIO_MODEL, 'AITUNNEL_AUDIO_MODEL')) ||
      'whisper-1';

    const url = `${base.replace(/\/+$/, '')}${pathPart.startsWith('/') ? pathPart : `/${pathPart}`}`;

    const form = new FormData();
    const fileName = originalName || path.basename(filePath) || 'audio.wav';
    form.append('file', fs.createReadStream(filePath), { filename: fileName });
    form.append('model', model);
    if (model.includes('diarize')) {
      form.append('chunking_strategy', 'auto');
    }

    try {
      const res = await axios.post(url, form, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 120_000,
      });
      return res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;
        const detail = data && typeof data === 'object'
          ? JSON.stringify(data)
          : typeof data === 'string'
            ? data
            : err.message;
        throw new BadRequestException(`AITunnel error${status ? ` (${status})` : ''}: ${detail}`);
      }
      throw err;
    }
  }
}
