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

export type ChecklistSection = { title: string; items: string[] };
export type ChecklistByRole = { role: string; sections: ChecklistSection[] };
export type SuggestedChecklistsResponse = { checklists: ChecklistByRole[] };

const DEFAULT_BASE_URL = 'https://api.polza.ai';
const DEFAULT_MODEL = 'gpt-4o-mini';

const EXAMPLE_STRUCTURE = `Чек-лист — Оператор контакт-центра
Приём заявки
• Принять входящий звонок
• Уточнить ФИО и контактные данные
Сбор данных
• Запросить необходимые документы
• Проверить полноту данных
Подсчёт анализов
• Внести показатели в систему
• Сформировать отчёт`;

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

  async suggestChecklists(
    text: string,
    exampleText?: string,
  ): Promise<SuggestedChecklistsResponse> {
    const { apiKey, baseUrl, model } = await this.getPolzaConfig();
    if (!apiKey) {
      this.logger.warn('Polza API key not set (settings or env), returning empty checklists');
      return { checklists: [] };
    }
    const example = (exampleText ?? '').trim() || EXAMPLE_STRUCTURE;
    const systemPrompt = `Ты — помощник по анализу текста процессов и регламентов. На основе текста предложи чек-листы по ролям/должностям в структурированном виде.

Эталон формата и стиля (воспроизводи такую же структуру):
---
${example}
---

Ответь строго в формате JSON, без markdown и пояснений, только валидный JSON:
{"checklists":[{"role":"название роли/должности","sections":[{"title":"заголовок секции","items":["пункт 1","пункт 2"]}]}]}
Требования: определи целевые роли по тексту; сгруппируй пункты по смысловым секциям (как в примере); пункты — конкретные и выполнимые.`;
    const userPrompt = `Проанализируй текст и предложи чек-листы по ролям в указанном формате:\n\n${text.slice(0, 30000)}`;

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
        return { checklists: [] };
      }
      const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(jsonStr) as {
        checklists?: Array<{ role?: string; sections?: Array<{ title?: string; items?: string[] }> }>;
        items?: Array<{ title?: string; assignee?: string }>;
      };
      if (Array.isArray(parsed?.checklists) && parsed.checklists.length > 0) {
        const checklists: ChecklistByRole[] = parsed.checklists
          .filter((c) => c && typeof c.role === 'string' && (c.role as string).trim())
          .map((c) => ({
            role: (c.role as string).trim(),
            sections: (Array.isArray(c.sections) ? c.sections : [])
              .filter((s) => s && typeof s.title === 'string')
              .map((s) => ({
                title: (s.title as string).trim(),
                items: (Array.isArray(s.items) ? s.items : [])
                  .filter((i) => typeof i === 'string' && (i as string).trim())
                  .map((i) => (i as string).trim()),
              }))
              .filter((s) => s.items.length > 0 || s.title),
          }))
          .filter((c) => c.sections.length > 0);
        return { checklists };
      }
      if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
        const items = parsed.items
          .filter((i) => i && typeof i.title === 'string' && (i.title as string).trim())
          .map((i) => ({ title: (i.title as string).trim(), assignee: typeof i.assignee === 'string' ? i.assignee.trim() : undefined }));
        return {
          checklists: [
            {
              role: 'Чек-лист',
              sections: [{ title: 'Пункты', items: items.map((i) => i.title) }],
            },
          ],
        };
      }
      return { checklists: [] };
    } catch (err) {
      this.logger.error('Polza.ai suggest checklists failed', err instanceof Error ? err.message : err);
      throw err;
    }
  }
}
