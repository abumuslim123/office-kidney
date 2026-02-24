import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { AppSetting } from '../settings/entities/app-setting.entity';

const WEBHOOK_SETTING_KEY = 'bitrix24_webhook_url';
const IBLOCK_TYPE_ID = 'lists';

@Injectable()
export class Bitrix24Service {
  constructor(
    @InjectRepository(AppSetting)
    private settingsRepo: Repository<AppSetting>,
  ) {}

  private async getWebhookUrl(): Promise<string | null> {
    const row = await this.settingsRepo.findOne({ where: { key: WEBHOOK_SETTING_KEY } });
    const url = row?.value?.trim() || null;
    if (!url) return null;
    return url.endsWith('/') ? url : url + '/';
  }

  async getSettings(): Promise<{ webhookConfigured: boolean; webhookUrlMask?: string }> {
    const url = await this.getWebhookUrl();
    if (!url) return { webhookConfigured: false };
    try {
      const u = new URL(url);
      const pathParts = u.pathname.split('/').filter(Boolean);
      const mask = pathParts.length >= 3
        ? `${u.origin}/rest/.../.../`
        : `${u.origin}/rest/.../`;
      return { webhookConfigured: true, webhookUrlMask: mask };
    } catch {
      return { webhookConfigured: true, webhookUrlMask: undefined };
    }
  }

  async setWebhookUrl(webhookUrl: string): Promise<void> {
    const trimmed = webhookUrl?.trim() || '';
    if (!trimmed) {
      await this.settingsRepo.delete({ key: WEBHOOK_SETTING_KEY }).catch(() => {});
      return;
    }
    const normalized = trimmed.endsWith('/') ? trimmed : trimmed + '/';
    await this.settingsRepo.save({ key: WEBHOOK_SETTING_KEY, value: normalized });
  }

  async updateSettings(body: { webhookUrl?: string }): Promise<{ webhookConfigured: boolean }> {
    if (body.webhookUrl !== undefined) {
      await this.setWebhookUrl(body.webhookUrl);
    }
    const s = await this.getSettings();
    return { webhookConfigured: s.webhookConfigured };
  }

  private async callBitrix<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    const base = await this.getWebhookUrl();
    if (!base) {
      throw new BadRequestException('Вебхук Битрикс24 не настроен');
    }
    const url = base + method;
    try {
      const { data } = await axios.post<{ result?: T; error?: string; error_description?: string }>(
        url,
        params,
        { timeout: 30000, headers: { 'Content-Type': 'application/json' } },
      );
      if (data?.error) {
        const msg = data.error_description || data.error;
        throw new BadRequestException(msg || 'Ошибка Битрикс24');
      }
      return data?.result as T;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as unknown;
        if (data && typeof data === 'object') {
          const obj = data as { error?: string; error_description?: string };
          const msg = obj.error_description || obj.error;
          if (msg) throw new BadRequestException(msg);
        }
        throw new BadRequestException(`Ошибка Битрикс24: ${err.message}`);
      }
      throw err;
    }
  }

  private normalizeElementsResult(
    result: Record<string, unknown>[] | Record<string, unknown> | unknown,
  ): unknown[] {
    if (Array.isArray(result)) return result;
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const obj = result as Record<string, unknown>;
      if ('result' in obj && Array.isArray(obj.result)) return obj.result;
      const numericKeys = Object.keys(obj).filter((k) => /^\d+$/.test(k));
      if (numericKeys.length) {
        const sorted = numericKeys.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        return sorted.map((k) => obj[k]).filter((v) => v != null && typeof v === 'object');
      }
      const values = Object.values(obj).filter((v) => v != null && typeof v === 'object' && !Array.isArray(v));
      if (values.length) return values;
    }
    return [];
  }

  async getListElements(
    listId: string,
    options?: { start?: number; limit?: number; search?: string },
  ): Promise<{ elements: unknown[]; total: number }> {
    const start = Math.max(0, options?.start ?? 0);
    const limit = Math.min(250, Math.max(1, options?.limit ?? 50));
    const search = options?.search?.trim();

    const params: Record<string, unknown> = {
      IBLOCK_TYPE_ID,
      IBLOCK_ID: parseInt(listId, 10) || listId,
      start,
      limit,
      SORT_BY1: 'ID',
      SORT_ORDER1: 'DESC',
    };

    if (search) {
      params['FILTER'] = { '%NAME': search };
    }

    const base = await this.getWebhookUrl();
    if (!base) throw new BadRequestException('Вебхук Битрикс24 не настроен');
    const url = base + 'lists.element.get';
    try {
      const { data } = await axios.post<{
        result?: Record<string, unknown>[] | Record<string, unknown>;
        total?: number;
        error?: string;
        error_description?: string;
      }>(url, params, { timeout: 30000, headers: { 'Content-Type': 'application/json' } });
      if (data?.error) {
        const msg = data.error_description || data.error;
        throw new BadRequestException(msg || 'Ошибка Битрикс24');
      }
      const elements = this.normalizeElementsResult(data?.result ?? []);
      const total = typeof data?.total === 'number' && data.total >= 0
        ? data.total
        : start + elements.length;
      return { elements, total };
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const resp = err.response?.data as unknown;
        if (resp && typeof resp === 'object') {
          const obj = resp as { error?: string; error_description?: string };
          const msg = obj.error_description || obj.error;
          if (msg) throw new BadRequestException(msg);
        }
        throw new BadRequestException(`Ошибка Битрикс24: ${err.message}`);
      }
      throw err;
    }
  }

  async addListElement(
    listId: string,
    fields: Record<string, unknown> & { NAME?: string },
  ): Promise<unknown> {
    const ELEMENT_CODE = 'el_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const result = await this.callBitrix<unknown>('lists.element.add', {
      IBLOCK_TYPE_ID,
      IBLOCK_ID: parseInt(listId, 10) || listId,
      ELEMENT_CODE,
      FIELDS: fields,
    });
    return result;
  }

  async deleteListElement(listId: string, elementId: string): Promise<boolean> {
    const id = parseInt(elementId, 10) || elementId;
    const result = await this.callBitrix<boolean>('lists.element.delete', {
      IBLOCK_TYPE_ID,
      IBLOCK_ID: parseInt(listId, 10) || listId,
      ELEMENT_ID: id,
    });
    return result === true;
  }
}
