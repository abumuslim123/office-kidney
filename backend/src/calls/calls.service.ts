import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Call } from './entities/call.entity';
import { CallTranscript } from './entities/call-transcript.entity';
import { CallTopic } from './entities/call-topic.entity';
import { CallTopicMatch } from './entities/call-topic-match.entity';
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
import { AitunnelAudioService } from './aitunnel-audio.service';

type CallFilters = {
  from?: Date;
  to?: Date;
  employees?: string[];
  topics?: string[];
};

type UploadCallPayload = {
  file: Express.Multer.File;
  employeeName?: string;
  clientName?: string;
  callAt?: string;
  durationSeconds?: string;
};

@Injectable()
export class CallsService {
  private readonly audioDir: string;

  constructor(
    @InjectRepository(Call)
    private callRepo: Repository<Call>,
    @InjectRepository(CallTranscript)
    private transcriptRepo: Repository<CallTranscript>,
    @InjectRepository(CallTopic)
    private topicRepo: Repository<CallTopic>,
    @InjectRepository(CallTopicMatch)
    private matchRepo: Repository<CallTopicMatch>,
    @InjectRepository(AppSetting)
    private settingsRepo: Repository<AppSetting>,
    private config: ConfigService,
    private audioProvider: AitunnelAudioService,
  ) {
    const base = this.config.get<string>('CALLS_AUDIO_DIR') || path.join(process.cwd(), 'uploads', 'calls');
    this.audioDir = path.isAbsolute(base) ? base : path.join(process.cwd(), base);
  }

  private applyFilters(qb: SelectQueryBuilder<Call>, filters: CallFilters) {
    if (filters.from) qb.andWhere('c."callAt" >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('c."callAt" <= :to', { to: filters.to });
    if (filters.employees?.length) {
      qb.andWhere('c."employeeName" IN (:...employees)', { employees: filters.employees });
    }
    if (filters.topics?.length) {
      qb.innerJoin(CallTopicMatch, 'm', 'm."callId" = c."id" AND m."topicId" IN (:...topicIds)', {
        topicIds: filters.topics,
      });
      qb.distinct(true);
    }
  }

  private normalizeKeywords(input?: string[] | string): string[] {
    const raw = Array.isArray(input) ? input : input ? input.split(',') : [];
    const normalized = raw
      .map((k) => k.trim())
      .filter(Boolean)
      .map((k) => k.replace(/\s+/g, ' '));
    const seen = new Set<string>();
    return normalized.filter((k) => {
      const key = k.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private countOccurrences(text: string, keyword: string): number {
    const regex = new RegExp(this.escapeRegExp(keyword), 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }

  private async getAudioPathByCall(call: Call): Promise<string | null> {
    const stored = call.audioPath;
    if (!stored) return null;
    if (!stored.startsWith(call.id + path.sep) && !stored.startsWith(call.id + '/')) return null;
    const fullPath = path.join(this.audioDir, stored);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      return null;
    }
  }

  async getAudioPath(callId: string): Promise<string | null> {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) return null;
    return this.getAudioPathByCall(call);
  }

  async uploadCall(payload: UploadCallPayload): Promise<Call> {
    if (!payload.file?.buffer) throw new BadRequestException('Файл не загружен');
    const employeeName = payload.employeeName?.trim() || 'Неизвестно';
    const clientName = payload.clientName?.trim() || null;
    const callAt = payload.callAt ? new Date(payload.callAt) : new Date();
    const durationSeconds = payload.durationSeconds ? Math.max(0, parseInt(payload.durationSeconds, 10)) : 0;

    const call = this.callRepo.create({
      employeeName,
      clientName,
      callAt: Number.isNaN(callAt.getTime()) ? new Date() : callAt,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
      speechDurationSeconds: 0,
      silenceDurationSeconds: 0,
      audioPath: '',
      status: 'uploaded',
    });
    const saved = await this.callRepo.save(call);

    const ext = path.extname(payload.file.originalname || '') || '.wav';
    const safeExt = /^\.\w+$/.test(ext) ? ext : '.wav';
    const dir = path.join(this.audioDir, saved.id);
    await fs.mkdir(dir, { recursive: true });
    const fileName = `audio${safeExt}`;
    const fullPath = path.join(dir, fileName);
    await fs.writeFile(fullPath, payload.file.buffer);
    saved.audioPath = `${saved.id}/${fileName}`;
    return this.callRepo.save(saved);
  }

  async listCalls(filters: CallFilters) {
    const qb = this.callRepo.createQueryBuilder('c');
    this.applyFilters(qb, filters);
    qb.orderBy('c."callAt"', 'DESC');
    const calls = await qb.getMany();
    if (!calls.length) return [];

    const callIds = calls.map((c) => c.id);
    const transcripts = await this.transcriptRepo.find({ where: { callId: In(callIds) } });
    const transcriptMap = new Map(transcripts.map((t) => [t.callId, t]));

    const matchRows = await this.matchRepo
      .createQueryBuilder('m')
      .leftJoin(CallTopic, 't', 't.id = m."topicId"')
      .select('m."callId"', 'callId')
      .addSelect('m."topicId"', 'topicId')
      .addSelect('t.name', 'topicName')
      .addSelect('m.keyword', 'keyword')
      .addSelect('m.occurrences', 'occurrences')
      .where('m."callId" IN (:...callIds)', { callIds })
      .orderBy('t.name', 'ASC')
      .getRawMany<{ callId: string; topicId: string; topicName: string; keyword: string; occurrences: string }>();

    const matchesMap = new Map<string, { topicId: string; topicName: string; keyword: string; occurrences: number }[]>();
    matchRows.forEach((row) => {
      const list = matchesMap.get(row.callId) || [];
      list.push({
        topicId: row.topicId,
        topicName: row.topicName,
        keyword: row.keyword,
        occurrences: parseInt(row.occurrences, 10) || 0,
      });
      matchesMap.set(row.callId, list);
    });

    return calls.map((call) => ({
      ...call,
      transcript: transcriptMap.get(call.id) || null,
      matches: matchesMap.get(call.id) || [],
    }));
  }

  async getStats(filters: CallFilters) {
    const idsQb = this.callRepo.createQueryBuilder('c').select('c."id"', 'id');
    this.applyFilters(idsQb, filters);
    const callIds = (await idsQb.getRawMany<{ id: string }>()).map((r) => r.id);
    if (!callIds.length) {
      return {
        totalCalls: 0,
        totalEmployees: 0,
        totalClients: 0,
        totalDurationSeconds: 0,
        avgDurationSeconds: 0,
        avgSpeechDurationSeconds: 0,
        avgSilenceDurationSeconds: 0,
        employees: [],
        topics: [],
      };
    }

    const totals = await this.callRepo
      .createQueryBuilder('c')
      .select('COUNT(*)', 'totalCalls')
      .addSelect('COUNT(DISTINCT c."employeeName")', 'totalEmployees')
      .addSelect('COUNT(DISTINCT c."clientName")', 'totalClients')
      .addSelect('COALESCE(SUM(c."durationSeconds"), 0)', 'totalDurationSeconds')
      .addSelect('COALESCE(AVG(c."durationSeconds"), 0)', 'avgDurationSeconds')
      .addSelect('COALESCE(AVG(c."speechDurationSeconds"), 0)', 'avgSpeechDurationSeconds')
      .addSelect('COALESCE(AVG(c."silenceDurationSeconds"), 0)', 'avgSilenceDurationSeconds')
      .where('c."id" IN (:...callIds)', { callIds })
      .getRawOne<{
        totalCalls: string;
        totalEmployees: string;
        totalClients: string;
        totalDurationSeconds: string;
        avgDurationSeconds: string;
        avgSpeechDurationSeconds: string;
        avgSilenceDurationSeconds: string;
      }>();

    const employees = await this.callRepo
      .createQueryBuilder('c')
      .select('c."employeeName"', 'employeeName')
      .addSelect('COUNT(*)', 'callsCount')
      .addSelect('COUNT(DISTINCT c."clientName")', 'clientsCount')
      .addSelect('COALESCE(SUM(c."durationSeconds"), 0)', 'totalDurationSeconds')
      .addSelect('COALESCE(AVG(c."durationSeconds"), 0)', 'avgDurationSeconds')
      .where('c."id" IN (:...callIds)', { callIds })
      .groupBy('c."employeeName"')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{
        employeeName: string;
        callsCount: string;
        clientsCount: string;
        totalDurationSeconds: string;
        avgDurationSeconds: string;
      }>();

    const topics = await this.matchRepo
      .createQueryBuilder('m')
      .leftJoin(CallTopic, 't', 't.id = m."topicId"')
      .select('t.id', 'topicId')
      .addSelect('t.name', 'topicName')
      .addSelect('COUNT(DISTINCT m."callId")', 'callsCount')
      .addSelect('COALESCE(SUM(m."occurrences"), 0)', 'occurrences')
      .where('m."callId" IN (:...callIds)', { callIds })
      .groupBy('t.id')
      .addGroupBy('t.name')
      .orderBy('SUM(m."occurrences")', 'DESC')
      .getRawMany<{ topicId: string; topicName: string; callsCount: string; occurrences: string }>();

    const toNumber = (value?: string) => (value ? Number(value) : 0);

    return {
      totalCalls: toNumber(totals?.totalCalls),
      totalEmployees: toNumber(totals?.totalEmployees),
      totalClients: toNumber(totals?.totalClients),
      totalDurationSeconds: toNumber(totals?.totalDurationSeconds),
      avgDurationSeconds: toNumber(totals?.avgDurationSeconds),
      avgSpeechDurationSeconds: toNumber(totals?.avgSpeechDurationSeconds),
      avgSilenceDurationSeconds: toNumber(totals?.avgSilenceDurationSeconds),
      employees: employees.map((row) => ({
        employeeName: row.employeeName,
        callsCount: toNumber(row.callsCount),
        clientsCount: toNumber(row.clientsCount),
        totalDurationSeconds: toNumber(row.totalDurationSeconds),
        avgDurationSeconds: toNumber(row.avgDurationSeconds),
      })),
      topics: topics.map((row) => ({
        topicId: row.topicId,
        topicName: row.topicName,
        callsCount: toNumber(row.callsCount),
        occurrences: toNumber(row.occurrences),
      })),
    };
  }

  async listTopics(): Promise<CallTopic[]> {
    return this.topicRepo.find({ order: { createdAt: 'DESC' } });
  }

  private async getSetting(key: string): Promise<string | null> {
    const row = await this.settingsRepo.findOne({ where: { key } });
    const value = row?.value?.trim() || '';
    return value ? value : null;
  }

  async getSettings(): Promise<{
    apiKeyConfigured: boolean;
    apiKeyMask?: string;
    apiBase?: string;
    audioPath?: string;
    model?: string;
  }> {
    const apiKey = await this.getSetting(CALLS_AUDIO_API_KEY);
    const apiBaseRaw = await this.getSetting(CALLS_AUDIO_API_BASE);
    const apiBase = apiBaseRaw && apiBaseRaw.includes('polza.ai') ? null : apiBaseRaw;
    const audioPath = await this.getSetting(CALLS_AUDIO_PATH);
    const model = await this.getSetting(CALLS_AUDIO_MODEL);

    let apiKeyMask: string | undefined;
    if (apiKey) {
      apiKeyMask = apiKey.length > 8
        ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
        : '***';
    }

    return {
      apiKeyConfigured: Boolean(apiKey),
      apiKeyMask,
      apiBase: apiBase || (this.config.get<string>('AITUNNEL_API_BASE') || '').trim() || 'https://api.aitunnel.ru/v1',
      audioPath: audioPath || (this.config.get<string>('AITUNNEL_AUDIO_PATH') || '').trim() || '/audio/transcriptions',
      model: model || (this.config.get<string>('AITUNNEL_AUDIO_MODEL') || '').trim() || 'whisper-1',
    };
  }

  async updateSettings(data: {
    apiKey?: string;
    apiBase?: string;
    audioPath?: string;
    model?: string;
  }) {
    const updates: Array<{ key: string; value: string | null }> = [];

    if (data.apiKey !== undefined) {
      const value = data.apiKey.trim();
      updates.push({ key: CALLS_AUDIO_API_KEY, value: value || null });
    }
    if (data.apiBase !== undefined) {
      const value = data.apiBase.trim();
      updates.push({ key: CALLS_AUDIO_API_BASE, value: value || null });
    }
    if (data.audioPath !== undefined) {
      const value = data.audioPath.trim();
      updates.push({ key: CALLS_AUDIO_PATH, value: value || null });
    }
    if (data.model !== undefined) {
      const raw = data.model.trim();
      const normalized = raw.includes('/') ? raw.split('/').pop() || '' : raw;
      updates.push({ key: CALLS_AUDIO_MODEL, value: normalized || null });
    }

    await Promise.all(
      updates.map(async ({ key, value }) => {
        if (!value) {
          await this.settingsRepo.delete({ key }).catch(() => {});
          return;
        }
        await this.settingsRepo.save({ key, value });
      }),
    );
    await this.settingsRepo.delete({ key: CALLS_POLZA_API_BASE }).catch(() => {});
    await this.settingsRepo.delete({ key: CALLS_POLZA_AUDIO_PATH }).catch(() => {});
    await this.settingsRepo.delete({ key: CALLS_POLZA_AUDIO_MODEL }).catch(() => {});

    return this.getSettings();
  }

  async createTopic(data: { name: string; keywords?: string[] | string; isActive?: boolean }) {
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Название тематики обязательно');
    const keywords = this.normalizeKeywords(data.keywords);
    const topic = this.topicRepo.create({
      name,
      keywords,
      isActive: data.isActive ?? true,
    });
    return this.topicRepo.save(topic);
  }

  async updateTopic(id: string, data: { name?: string; keywords?: string[] | string; isActive?: boolean }) {
    const topic = await this.topicRepo.findOne({ where: { id } });
    if (!topic) throw new NotFoundException('Тематика не найдена');
    if (data.name !== undefined) {
      const name = data.name?.trim();
      if (!name) throw new BadRequestException('Название тематики обязательно');
      topic.name = name;
    }
    if (data.keywords !== undefined) {
      topic.keywords = this.normalizeKeywords(data.keywords);
    }
    if (data.isActive !== undefined) {
      topic.isActive = data.isActive;
    }
    return this.topicRepo.save(topic);
  }

  async deleteTopic(id: string) {
    const topic = await this.topicRepo.findOne({ where: { id } });
    if (!topic) throw new NotFoundException('Тематика не найдена');
    await this.topicRepo.remove(topic);
  }

  async transcribeCall(callId: string) {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Звонок не найден');

    const audioPath = await this.getAudioPathByCall(call);
    if (!audioPath) throw new NotFoundException('Аудиофайл не найден');

    call.status = 'transcribing';
    await this.callRepo.save(call);

    try {
      const response = await this.audioProvider.transcribeAudio(audioPath, path.basename(audioPath));
      const text =
        response?.text ||
        response?.data?.text ||
        response?.transcript ||
        response?.result?.text ||
        '';
      if (!text || typeof text !== 'string') {
        throw new BadRequestException('Не удалось получить текст транскрибации');
      }

      const language = response?.language || response?.data?.language || null;
      const durationRaw =
        response?.duration ||
        response?.data?.duration ||
        response?.audio_duration ||
        response?.meta?.duration;
      const speechRaw =
        response?.speech_duration_seconds ||
        response?.data?.speech_duration_seconds ||
        response?.meta?.speech_duration_seconds;
      const silenceRaw =
        response?.silence_duration_seconds ||
        response?.data?.silence_duration_seconds ||
        response?.meta?.silence_duration_seconds;

      const durationSeconds = Number(durationRaw);
      const speechSeconds = Number(speechRaw);
      const silenceSeconds = Number(silenceRaw);

      let transcript = await this.transcriptRepo.findOne({ where: { callId } });
      if (!transcript) {
        transcript = this.transcriptRepo.create({
          callId,
          text,
          language,
          provider: 'aitunnel',
        });
      } else {
        transcript.text = text;
        transcript.language = language;
        transcript.provider = 'aitunnel';
      }
      await this.transcriptRepo.save(transcript);

      await this.matchRepo.delete({ callId });
      const topics = await this.topicRepo.find({ where: { isActive: true } });
      const matchesToSave: Partial<CallTopicMatch>[] = [];
      topics.forEach((topic) => {
        (topic.keywords || []).forEach((keyword) => {
          const trimmed = keyword.trim();
          if (!trimmed) return;
          const occurrences = this.countOccurrences(text, trimmed);
          if (occurrences > 0) {
            matchesToSave.push({
              callId,
              topicId: topic.id,
              keyword: trimmed,
              occurrences,
            });
          }
        });
      });
      if (matchesToSave.length) {
        await this.matchRepo.insert(matchesToSave);
      }

      if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        call.durationSeconds = Math.round(durationSeconds);
      }
      if (Number.isFinite(speechSeconds) && speechSeconds > 0) {
        call.speechDurationSeconds = Math.round(speechSeconds);
      }
      if (Number.isFinite(silenceSeconds) && silenceSeconds >= 0) {
        call.silenceDurationSeconds = Math.round(silenceSeconds);
      }

      call.status = 'transcribed';
      await this.callRepo.save(call);
      return {
        call,
        transcript,
        matches: matchesToSave.length,
      };
    } catch (error) {
      call.status = 'failed';
      await this.callRepo.save(call);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Ошибка транскрибации');
    }
  }

  async deleteAudio(callId: string): Promise<void> {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Звонок не найден');
    if (call.audioPath) {
      const audioPath = await this.getAudioPathByCall(call);
      if (audioPath) {
        try {
          await fs.rm(audioPath);
        } catch {
          // ignore
        }
      }
    }
    try {
      await fs.rm(path.join(this.audioDir, call.id), { recursive: true, force: true });
    } catch {
      // ignore
    }
    call.audioPath = '';
    call.status = 'no_audio';
    call.durationSeconds = 0;
    call.speechDurationSeconds = 0;
    call.silenceDurationSeconds = 0;
    await this.callRepo.save(call);
    await this.transcriptRepo.delete({ callId });
    await this.matchRepo.delete({ callId });
  }
}
