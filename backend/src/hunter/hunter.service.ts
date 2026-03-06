import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { AppSetting } from '../settings/entities/app-setting.entity';

const HH_CLIENT_ID = 'hh_client_id';
const HH_CLIENT_SECRET = 'hh_client_secret';
const HH_REDIRECT_URI = 'hh_redirect_uri';
const HH_ACCESS_TOKEN = 'hh_access_token';
const HH_REFRESH_TOKEN = 'hh_refresh_token';
const HH_TOKEN_EXPIRES_AT = 'hh_token_expires_at';
const HH_EMPLOYER_ID = 'hh_employer_id';
const HH_EMPLOYER_NAME = 'hh_employer_name';

const DEFAULT_CLIENT_ID = 'NGDEGHUMNLUL64USKVHKUQDD98H9U599GOE9UQCSNNBP1E6G8QVKJVQIMALE4R3V';
const DEFAULT_CLIENT_SECRET = 'N4TUT2L38FQJI3QTF9ARM5S0O0D5EQPJSTNNOSFM14B6DKP4IFTSBUCAM1F9D6F2';
const DEFAULT_REDIRECT_URI = 'https://kidney-office.srvu.ru/';

@Injectable()
export class HunterService {
  constructor(
    @InjectRepository(AppSetting)
    private settingsRepo: Repository<AppSetting>,
  ) {}

  private async getSetting(key: string): Promise<string | null> {
    const row = await this.settingsRepo.findOne({ where: { key } });
    const value = row?.value?.trim() || '';
    return value || null;
  }

  private async setSetting(key: string, value: string): Promise<void> {
    await this.settingsRepo.save({ key, value });
  }

  private async deleteSetting(key: string): Promise<void> {
    await this.settingsRepo.delete({ key });
  }

  private async getClientId(): Promise<string> {
    return (await this.getSetting(HH_CLIENT_ID)) || DEFAULT_CLIENT_ID;
  }

  private async getClientSecret(): Promise<string> {
    return (await this.getSetting(HH_CLIENT_SECRET)) || DEFAULT_CLIENT_SECRET;
  }

  private async getRedirectUri(): Promise<string> {
    return (await this.getSetting(HH_REDIRECT_URI)) || DEFAULT_REDIRECT_URI;
  }

  async getAuthUrl(): Promise<{ url: string }> {
    const clientId = await this.getClientId();
    const redirectUri = await this.getRedirectUri();
    const url =
      `https://hh.ru/oauth/authorize?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return { url };
  }

  async exchangeCode(code: string): Promise<{ success: boolean }> {
    const clientId = await this.getClientId();
    const clientSecret = await this.getClientSecret();
    const redirectUri = await this.getRedirectUri();

    try {
      const { data } = await axios.post(
        'https://api.hh.ru/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        },
      );

      const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
      await this.setSetting(HH_ACCESS_TOKEN, data.access_token);
      if (data.refresh_token) {
        await this.setSetting(HH_REFRESH_TOKEN, data.refresh_token);
      }
      await this.setSetting(HH_TOKEN_EXPIRES_AT, expiresAt);

      // Fetch employer info
      try {
        const me = await this.callHH<{ employer?: { id: string; name: string } }>('GET', '/me');
        if (me.employer) {
          await this.setSetting(HH_EMPLOYER_ID, String(me.employer.id));
          await this.setSetting(HH_EMPLOYER_NAME, me.employer.name);
        }
      } catch {
        // non-critical
      }

      return { success: true };
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error_description || err.response?.data?.error || err.message;
        throw new BadRequestException(`hh.ru OAuth ошибка: ${msg}`);
      }
      throw err;
    }
  }

  async getStatus(): Promise<{
    connected: boolean;
    employerName?: string;
    employerId?: string;
  }> {
    const token = await this.getSetting(HH_ACCESS_TOKEN);
    if (!token) return { connected: false };
    const employerName = (await this.getSetting(HH_EMPLOYER_NAME)) || undefined;
    const employerId = (await this.getSetting(HH_EMPLOYER_ID)) || undefined;
    return { connected: true, employerName, employerId };
  }

  async disconnect(): Promise<{ success: boolean }> {
    const keys = [
      HH_ACCESS_TOKEN,
      HH_REFRESH_TOKEN,
      HH_TOKEN_EXPIRES_AT,
      HH_EMPLOYER_ID,
      HH_EMPLOYER_NAME,
    ];
    for (const key of keys) {
      await this.deleteSetting(key);
    }
    return { success: true };
  }

  private async ensureToken(): Promise<string> {
    const token = await this.getSetting(HH_ACCESS_TOKEN);
    if (!token) throw new BadRequestException('hh.ru не подключен');

    const expiresAt = await this.getSetting(HH_TOKEN_EXPIRES_AT);
    if (expiresAt && new Date(expiresAt) < new Date()) {
      await this.refreshToken();
      const newToken = await this.getSetting(HH_ACCESS_TOKEN);
      if (!newToken) throw new BadRequestException('Не удалось обновить токен hh.ru');
      return newToken;
    }
    return token;
  }

  private async refreshToken(): Promise<void> {
    const refreshToken = await this.getSetting(HH_REFRESH_TOKEN);
    if (!refreshToken) throw new BadRequestException('Refresh токен hh.ru отсутствует');

    try {
      const { data } = await axios.post(
        'https://api.hh.ru/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        },
      );

      const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
      await this.setSetting(HH_ACCESS_TOKEN, data.access_token);
      if (data.refresh_token) {
        await this.setSetting(HH_REFRESH_TOKEN, data.refresh_token);
      }
      await this.setSetting(HH_TOKEN_EXPIRES_AT, expiresAt);
    } catch (err: unknown) {
      // Token refresh failed — disconnect
      await this.disconnect();
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error_description || err.response?.data?.error || err.message;
        throw new BadRequestException(`Ошибка обновления токена hh.ru: ${msg}`);
      }
      throw err;
    }
  }

  private async callHH<T = unknown>(method: string, path: string, params?: Record<string, string>): Promise<T> {
    const token = await this.ensureToken();
    const url = `https://api.hh.ru${path}`;
    try {
      const { data } = await axios.request<T>({
        method,
        url,
        params,
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'KidneyOffice/1.0 (kidney-office.srvu.ru)',
        },
        timeout: 15000,
      });
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        // Try refreshing token once
        try {
          await this.refreshToken();
          const newToken = await this.ensureToken();
          const { data } = await axios.request<T>({
            method,
            url,
            params,
            headers: {
              Authorization: `Bearer ${newToken}`,
              'User-Agent': 'KidneyOffice/1.0 (kidney-office.srvu.ru)',
            },
            timeout: 15000,
          });
          return data;
        } catch {
          throw new BadRequestException('Сессия hh.ru истекла. Переподключитесь.');
        }
      }
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.description || err.response?.data?.error || err.message;
        throw new BadRequestException(`Ошибка hh.ru API: ${msg}`);
      }
      throw err;
    }
  }

  async getVacancies(): Promise<unknown> {
    const employerId = await this.getSetting(HH_EMPLOYER_ID);
    if (!employerId) throw new BadRequestException('employer_id не определён');
    return this.callHH('GET', `/employers/${employerId}/vacancies/active`, {
      per_page: '50',
    });
  }

  async getVacancyNegotiations(vacancyId: string): Promise<unknown> {
    return this.callHH('GET', '/negotiations', {
      vacancy_id: vacancyId,
      per_page: '50',
    });
  }

  async getDashboard(): Promise<{
    vacancies: { total: number; items: unknown[] };
    negotiations: { totalNew: number; byVacancy: Record<string, number> };
  }> {
    const employerId = await this.getSetting(HH_EMPLOYER_ID);
    if (!employerId) throw new BadRequestException('employer_id не определён');

    // Fetch active vacancies
    const vacanciesData = await this.callHH<{
      found: number;
      items: Array<{
        id: string;
        name: string;
        counters?: { responses?: number; unread_responses?: number };
        area?: { name: string };
        salary?: { from?: number; to?: number; currency?: string };
        created_at?: string;
      }>;
    }>('GET', `/employers/${employerId}/vacancies/active`, { per_page: '50' });

    const items = vacanciesData.items || [];
    let totalNew = 0;
    const byVacancy: Record<string, number> = {};

    for (const v of items) {
      const unread = v.counters?.unread_responses || 0;
      totalNew += unread;
      byVacancy[v.id] = unread;
    }

    return {
      vacancies: { total: vacanciesData.found || items.length, items },
      negotiations: { totalNew, byVacancy },
    };
  }
}
