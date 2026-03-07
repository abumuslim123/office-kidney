import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { AppSetting } from '../../settings/entities/app-setting.entity';

const HH_AUTH_URL = 'https://hh.ru/oauth/authorize';
const HH_TOKEN_URL = 'https://hh.ru/oauth/token';
const HH_API_URL = 'https://api.hh.ru';

const KEY_ACCESS_TOKEN = 'hh_access_token';
const KEY_REFRESH_TOKEN = 'hh_refresh_token';
const KEY_TOKEN_EXPIRES_AT = 'hh_token_expires_at';

@Injectable()
export class HhService {
  constructor(
    @InjectRepository(AppSetting)
    private settingsRepo: Repository<AppSetting>,
  ) {}

  private get clientId(): string {
    return process.env.HH_CLIENT_ID || '';
  }

  private get clientSecret(): string {
    return process.env.HH_CLIENT_SECRET || '';
  }

  private get redirectUri(): string {
    return process.env.HH_REDIRECT_URI || '';
  }

  getAuthorizationUrl(): string {
    if (!this.clientId || !this.redirectUri) {
      throw new BadRequestException('HH OAuth не настроен (отсутствуют HH_CLIENT_ID / HH_REDIRECT_URI)');
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
    });
    return `${HH_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<void> {
    try {
      const { data } = await axios.post(HH_TOKEN_URL, new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code,
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });
      await this.saveTokens(data.access_token, data.refresh_token, data.expires_in);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error_description || err.response?.data?.error || err.message;
        throw new BadRequestException(`Ошибка авторизации hh.ru: ${msg}`);
      }
      throw err;
    }
  }

  async refreshAccessToken(): Promise<string> {
    const refreshToken = await this.getSetting(KEY_REFRESH_TOKEN);
    if (!refreshToken) {
      throw new BadRequestException('hh.ru не подключён');
    }
    try {
      const { data } = await axios.post(HH_TOKEN_URL, new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });
      await this.saveTokens(data.access_token, data.refresh_token, data.expires_in);
      return data.access_token;
    } catch (err) {
      await this.clearTokens();
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error_description || err.response?.data?.error || err.message;
        throw new BadRequestException(`Ошибка обновления токена hh.ru: ${msg}`);
      }
      throw err;
    }
  }

  async getStatus(): Promise<{ connected: boolean }> {
    const token = await this.getSetting(KEY_ACCESS_TOKEN);
    return { connected: !!token };
  }

  async disconnect(): Promise<void> {
    await this.clearTokens();
  }

  async getMe(): Promise<unknown> {
    return this.apiGet('/me');
  }

  async getVacancies(params?: { page?: number; per_page?: number }): Promise<unknown> {
    const me = (await this.apiGet('/me')) as { employer?: { id: string } };
    const employerId = me?.employer?.id;
    if (!employerId) {
      throw new BadRequestException('Не удалось определить работодателя');
    }
    const query = new URLSearchParams({
      page: String(params?.page ?? 0),
      per_page: String(params?.per_page ?? 20),
    });
    return this.apiGet(`/employers/${employerId}/vacancies/active?${query.toString()}`);
  }

  async getVacancy(id: string): Promise<unknown> {
    return this.apiGet(`/vacancies/${id}`);
  }

  async getVacancyStats(id: string): Promise<unknown> {
    return this.apiGet(`/vacancies/${id}/stats`);
  }

  async getNegotiations(params?: { page?: number; per_page?: number }): Promise<unknown> {
    const me = (await this.apiGet('/me')) as { employer?: { id: string } };
    const employerId = me?.employer?.id;
    if (!employerId) {
      throw new BadRequestException('Не удалось определить работодателя');
    }
    const query = new URLSearchParams({
      page: String(params?.page ?? 0),
      per_page: String(params?.per_page ?? 20),
    });
    return this.apiGet(`/negotiations/response?${query.toString()}`);
  }

  // --- internal helpers ---

  private async apiGet(path: string): Promise<unknown> {
    let token = await this.getValidToken();
    try {
      const { data } = await axios.get(`${HH_API_URL}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'HH-User-Agent': 'KidneyOffice/1.0 (api@kidney-office.srvu.ru)',
        },
        timeout: 15000,
      });
      return data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        // token might be expired, try refresh
        token = await this.refreshAccessToken();
        const { data } = await axios.get(`${HH_API_URL}${path}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'HH-User-Agent': 'KidneyOffice/1.0 (api@kidney-office.srvu.ru)',
          },
          timeout: 15000,
        });
        return data;
      }
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const msg = err.response?.data?.description || err.response?.data?.error || err.message;
        throw new BadRequestException(`hh.ru API ошибка (${status}): ${msg}`);
      }
      throw err;
    }
  }

  private async getValidToken(): Promise<string> {
    const token = await this.getSetting(KEY_ACCESS_TOKEN);
    if (!token) {
      throw new BadRequestException('hh.ru не подключён. Пройдите авторизацию.');
    }
    const expiresAt = await this.getSetting(KEY_TOKEN_EXPIRES_AT);
    if (expiresAt && Date.now() >= parseInt(expiresAt, 10)) {
      return this.refreshAccessToken();
    }
    return token;
  }

  private async saveTokens(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    const expiresAt = String(Date.now() + expiresIn * 1000 - 60000); // 1 min buffer
    await this.setSetting(KEY_ACCESS_TOKEN, accessToken);
    await this.setSetting(KEY_REFRESH_TOKEN, refreshToken);
    await this.setSetting(KEY_TOKEN_EXPIRES_AT, expiresAt);
  }

  private async clearTokens(): Promise<void> {
    await this.settingsRepo.delete({ key: KEY_ACCESS_TOKEN });
    await this.settingsRepo.delete({ key: KEY_REFRESH_TOKEN });
    await this.settingsRepo.delete({ key: KEY_TOKEN_EXPIRES_AT });
  }

  private async getSetting(key: string): Promise<string | null> {
    const row = await this.settingsRepo.findOne({ where: { key } });
    return row?.value?.trim() || null;
  }

  private async setSetting(key: string, value: string): Promise<void> {
    await this.settingsRepo.save({ key, value });
  }
}
