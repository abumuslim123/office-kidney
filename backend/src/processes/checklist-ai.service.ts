import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { AppSetting } from '../settings/entities/app-setting.entity';
import {
  PROCESS_POLZA_API_KEY,
  PROCESS_POLZA_BASE_URL,
  PROCESS_POLZA_MODEL,
} from './process-polza-settings.constants';

export type ChecklistSuggestedItem = { title: string; assignee?: string };

const DEFAULT_BASE_URL = 'https://api.polza.ai';
const DEFAULT_MODEL = 'gpt-4o-mini';

@Injectable()
export class ChecklistAiService {
  private readonly logger = new Logger(ChecklistAiService.name);

  constructor(
    @InjectRepository(AppSetting)
    private readonly settingsRepo: Repository<AppSetting>,
  ) {}

  private async getSetting(key: string): Promise<string | null> {
    const row = await this.settingsRepo.findOne({ where: { key } });
    return row?.value?.trim() || null;
  }

  async getPolzaConfig(): Promise<{ apiKey: string | null; baseUrl: string; model: string }> {
    const apiKey =
      (await this.getSetting(PROCESS_POLZA_API_KEY)) || process.env.POLZA_API_KEY || null;
    const baseUrlRaw =
      (await this.getSetting(PROCESS_POLZA_BASE_URL)) || process.env.POLZA_BASE_URL || DEFAULT_BASE_URL;
    const baseUrl = baseUrlRaw.replace(/\/$/, '');
    const model =
      (await this.getSetting(PROCESS_POLZA_MODEL)) || process.env.POLZA_MODEL || DEFAULT_MODEL;
    return { apiKey, baseUrl, model };
  }

  async isConfigured(): Promise<boolean> {
    const { apiKey } = await this.getPolzaConfig();
    return !!apiKey;
  }

  async suggestChecklists(text: string): Promise<ChecklistSuggestedItem[]> {
    const { apiKey, baseUrl, model } = await this.getPolzaConfig();
    if (!apiKey) {
      this.logger.warn('Polza API key not set (settings or env), returning empty checklist');
      return [];
    }
    const systemPrompt = `Ты — помощник по анализу текста процессов и регламентов. На основе текста предложи чек-лист действий для причастных лиц. 
Ответь строго в формате JSON, без markdown и пояснений, только валидный JSON:
{"items":[{"title":"краткое название пункта","assignee":"роль или должность ответственного (опционально)"}]}
Пункты должны быть конкретными и выполнимыми. assignee указывай только если из текста ясно, кто отвечает.`;
    const userPrompt = `Проанализируй текст и предложи чек-лист:\n\n${text.slice(0, 30000)}`;

    try {
      const response = await axios.post(
        `${baseUrl}/v1/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 60000,
        },
      );
      const content = response.data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        this.logger.warn('Empty or invalid Polza response');
        return [];
      }
      const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(jsonStr) as { items?: Array<{ title?: string; assignee?: string }> };
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      return items
        .filter((i) => i && typeof i.title === 'string' && i.title.trim())
        .map((i) => ({ title: (i.title as string).trim(), assignee: typeof i.assignee === 'string' ? i.assignee.trim() : undefined }));
    } catch (err) {
      this.logger.error('Polza.ai suggest checklists failed', err instanceof Error ? err.message : err);
      throw err;
    }
  }
}
