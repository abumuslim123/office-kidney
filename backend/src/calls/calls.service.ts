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
import { CallDictionaryEntry } from './entities/call-dictionary-entry.entity';
import { CallSpeaker } from './entities/call-speaker.entity';
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
  CALLS_SPEECHKIT_API_KEY,
  CALLS_SPEECHKIT_FOLDER_ID,
  CALLS_PROVIDER,
  CALLS_TRITECH_CLIENT_ID,
  CALLS_TRITECH_CLIENT_SECRET,
  CALLS_TRITECH_USERNAME,
  CALLS_TRITECH_PASSWORD,
  CALLS_FILLER_WORDS,
  CALLS_NEGATIVE_WORDS,
} from './calls-settings.constants';
import { AitunnelAudioService } from './aitunnel-audio.service';
import { TritechAudioService } from './tritech-audio.service';
import { splitStereoAudioToMonoFiles, preprocessAudioForTranscription, getAudioDurationSeconds } from './wav-channel-splitter';

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
  clientPhone?: string;
  callAt?: string;
  durationSeconds?: string;
};

import { Logger } from '@nestjs/common';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
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
    @InjectRepository(CallDictionaryEntry)
    private dictRepo: Repository<CallDictionaryEntry>,
    @InjectRepository(CallSpeaker)
    private speakerRepo: Repository<CallSpeaker>,
    @InjectRepository(AppSetting)
    private settingsRepo: Repository<AppSetting>,
    private config: ConfigService,
    private audioProvider: AitunnelAudioService,
    private tritechProvider: TritechAudioService,
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

  /**
   * Извлекает сегменты с таймстемпами из verbose_json ответа Whisper.
   * Формат: { segments: [{ start, end, text }, ...] }
   */
  private getTimedSegments(response: unknown): { start: number; end: number; text: string }[] {
    if (!response || typeof response !== 'object') return [];
    const o = response as Record<string, unknown>;
    const segments = o.segments ?? (o.data && typeof o.data === 'object' && (o.data as Record<string, unknown>).segments);
    if (!Array.isArray(segments)) return [];
    return segments
      .map((seg) => {
        if (!seg || typeof seg !== 'object') return null;
        const s = seg as Record<string, unknown>;
        const start = typeof s.start === 'number' ? s.start : NaN;
        const end = typeof s.end === 'number' ? s.end : NaN;
        const text = (typeof s.text === 'string' ? s.text.trim() : '');
        if (!text || isNaN(start)) return null;
        return { start, end: isNaN(end) ? start : end, text };
      })
      .filter((s): s is { start: number; end: number; text: string } => Boolean(s));
  }

  /**
   * Извлекает слова с таймстемпами из verbose_json ответа Whisper.
   * Формат: { words: [{ word, start, end }, ...] }
   */
  private getTimedWords(response: unknown): { word: string; start: number; end: number }[] {
    if (!response || typeof response !== 'object') return [];
    const o = response as Record<string, unknown>;
    const words = o.words ?? (o.data && typeof o.data === 'object' && (o.data as Record<string, unknown>).words);
    if (!Array.isArray(words)) return [];
    return words
      .map((w) => {
        if (!w || typeof w !== 'object') return null;
        const item = w as Record<string, unknown>;
        const word = typeof item.word === 'string' ? item.word.trim() : '';
        const start = typeof item.start === 'number' ? item.start : NaN;
        const end = typeof item.end === 'number' ? item.end : NaN;
        if (!word || isNaN(start)) return null;
        return { word, start, end: isNaN(end) ? start : end };
      })
      .filter((w): w is { word: string; start: number; end: number } => Boolean(w));
  }

  /**
   * Собирает хронологический диалог из двух каналов по таймстемпам сегментов.
   * Соседние реплики одного спикера склеиваются в одну. Сохраняет start/end.
   */
  private mergeSegmentsByTimestamp(
    operatorSegments: { start: number; end: number; text: string }[],
    abonentSegments: { start: number; end: number; text: string }[],
  ): { speaker: 'operator' | 'abonent'; text: string; start: number; end: number }[] {
    const tagged = [
      ...operatorSegments.map((s) => ({ ...s, speaker: 'operator' as const })),
      ...abonentSegments.map((s) => ({ ...s, speaker: 'abonent' as const })),
    ].sort((a, b) => a.start - b.start);

    const turns: { speaker: 'operator' | 'abonent'; text: string; start: number; end: number }[] = [];
    for (const seg of tagged) {
      const last = turns[turns.length - 1];
      if (last && last.speaker === seg.speaker) {
        last.text += ' ' + seg.text;
        last.end = Math.max(last.end, seg.end);
      } else {
        turns.push({ speaker: seg.speaker, text: seg.text, start: seg.start, end: seg.end });
      }
    }
    return turns;
  }

  /** Fallback: наивное чередование фраз, если таймстемпы недоступны. */
  private buildTurnsFromOperatorAbonent(
    operatorText: string,
    abonentText: string,
  ): { speaker: 'operator' | 'abonent'; text: string }[] {
    const toPhrases = (t: string): string[] => {
      const byNewlines = t.split(/\r?\n/).flatMap((line) => line.split(/(?<=[.!?])\s+/));
      return byNewlines.map((s) => s.trim()).filter(Boolean);
    };
    const opPhrases = toPhrases(operatorText);
    const abPhrases = toPhrases(abonentText);
    const turns: { speaker: 'operator' | 'abonent'; text: string }[] = [];
    let i = 0;
    let j = 0;
    while (i < opPhrases.length || j < abPhrases.length) {
      if (i < opPhrases.length) {
        turns.push({ speaker: 'operator', text: opPhrases[i] });
        i++;
      }
      if (j < abPhrases.length) {
        turns.push({ speaker: 'abonent', text: abPhrases[j] });
        j++;
      }
    }
    return turns;
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
    const clientPhone = payload.clientPhone?.trim() || null;
    const callAt = payload.callAt ? new Date(payload.callAt) : new Date();
    const durationSeconds = payload.durationSeconds ? Math.max(0, parseInt(payload.durationSeconds, 10)) : 0;

    const call = this.callRepo.create({
      employeeName,
      clientName,
      clientPhone,
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

  async getCall(callId: string) {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Звонок не найден');

    const transcript = await this.transcriptRepo.findOne({ where: { callId } });

    const matchRows = await this.matchRepo
      .createQueryBuilder('m')
      .leftJoin(CallTopic, 't', 't.id = m."topicId"')
      .select('m."callId"', 'callId')
      .addSelect('m."topicId"', 'topicId')
      .addSelect('t.name', 'topicName')
      .addSelect('m.keyword', 'keyword')
      .addSelect('m.occurrences', 'occurrences')
      .where('m."callId" = :callId', { callId })
      .orderBy('t.name', 'ASC')
      .getRawMany<{ callId: string; topicId: string; topicName: string; keyword: string; occurrences: string }>();

    const matches = matchRows.map((row) => ({
      topicId: row.topicId,
      topicName: row.topicName,
      keyword: row.keyword,
      occurrences: parseInt(row.occurrences, 10) || 0,
    }));

    return { ...call, transcript: transcript || null, matches };
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

  private static DEFAULT_FILLER_WORDS = [
    'ну', 'вот', 'как бы', 'типа', 'короче', 'это самое', 'в общем',
    'значит', 'так сказать', 'слушай', 'блин', 'ладно', 'прикинь',
    'собственно', 'допустим', 'грубо говоря', 'на самом деле',
  ];

  private static DEFAULT_NEGATIVE_WORDS = [
    'ужасно', 'отвратительно', 'кошмар', 'безобразие', 'хамство',
    'грубо', 'некомпетентно', 'жалоба', 'претензия', 'скандал',
    'обман', 'мошенничество', 'наглость', 'невежливо', 'недопустимо',
    'плохо', 'ужас', 'позор', 'бардак', 'идиот',
  ];

  private async getWordList(key: string, defaults: string[]): Promise<string[]> {
    const raw = await this.getSetting(key);
    if (!raw) return defaults;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults;
    } catch {
      return defaults;
    }
  }

  async getUnwantedWords() {
    const fillerWords = await this.getWordList(CALLS_FILLER_WORDS, CallsService.DEFAULT_FILLER_WORDS);
    const negativeWords = await this.getWordList(CALLS_NEGATIVE_WORDS, CallsService.DEFAULT_NEGATIVE_WORDS);
    return { fillerWords, negativeWords };
  }

  async updateUnwantedWords(data: { fillerWords?: string[]; negativeWords?: string[] }) {
    const updates: { key: string; value: string | null }[] = [];
    if (data.fillerWords !== undefined) {
      const words = data.fillerWords.map((w) => w.trim()).filter(Boolean);
      updates.push({ key: CALLS_FILLER_WORDS, value: JSON.stringify(words) });
    }
    if (data.negativeWords !== undefined) {
      const words = data.negativeWords.map((w) => w.trim()).filter(Boolean);
      updates.push({ key: CALLS_NEGATIVE_WORDS, value: JSON.stringify(words) });
    }
    for (const { key, value } of updates) {
      let row = await this.settingsRepo.findOne({ where: { key } });
      if (!row) {
        row = this.settingsRepo.create({ key, value: value || '' });
      } else {
        row.value = value || '';
      }
      await this.settingsRepo.save(row);
    }
    return this.getUnwantedWords();
  }

  private static GREETING_PATTERNS = /здравствуйте|добрый\s*(день|вечер|утро)|приветствую|алл[её]/i;
  private static FAREWELL_PATTERNS = /до\s*свидания|всего\s*доброго|всего\s*хорошего|хорошего\s*дня|спасибо.*за\s*(звонок|обращение)|до\s*встречи/i;

  private countPatternInText(text: string, words: string[]): number {
    const lower = text.toLowerCase();
    let count = 0;
    for (const w of words) {
      const re = new RegExp(w.replace(/\s+/g, '\\s+'), 'gi');
      const matches = lower.match(re);
      if (matches) count += matches.length;
    }
    return count;
  }

  async getReportAnalysis(filters: { from?: Date; to?: Date; topics?: string[] }) {
    // Get filtered call ids
    const idsQb = this.callRepo.createQueryBuilder('c').select('c.id', 'id');
    if (filters.from) idsQb.andWhere('c."callAt" >= :from', { from: filters.from });
    if (filters.to) idsQb.andWhere('c."callAt" <= :to', { to: filters.to });
    if (filters.topics?.length) {
      idsQb.andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('m2."callId"')
          .from(CallTopicMatch, 'm2')
          .where('m2."topicId" IN (:...filterTopics)', { filterTopics: filters.topics })
          .getQuery();
        return `c.id IN ${sub}`;
      });
    }
    const allCallIds = (await idsQb.getRawMany<{ id: string }>()).map((r) => r.id);

    // Only transcribed calls
    const transcribedCalls = allCallIds.length
      ? await this.callRepo
          .createQueryBuilder('c')
          .where('c.id IN (:...ids)', { ids: allCallIds })
          .andWhere('c.status = :status', { status: 'transcribed' })
          .getMany()
      : [];
    const transcribedIds = transcribedCalls.map((c) => c.id);

    // Topic stats
    const topicStats = transcribedIds.length
      ? await this.matchRepo
          .createQueryBuilder('m')
          .leftJoin(CallTopic, 't', 't.id = m."topicId"')
          .select('t.id', 'topicId')
          .addSelect('t.name', 'topicName')
          .addSelect('COUNT(DISTINCT m."callId")', 'callsCount')
          .addSelect('COALESCE(SUM(m."occurrences"), 0)', 'occurrences')
          .where('m."callId" IN (:...ids)', { ids: transcribedIds })
          .groupBy('t.id')
          .addGroupBy('t.name')
          .orderBy('SUM(m."occurrences")', 'DESC')
          .getRawMany<{ topicId: string; topicName: string; callsCount: string; occurrences: string }>()
      : [];

    // Fetch transcripts for text analysis
    const transcripts = transcribedIds.length
      ? await this.transcriptRepo.find({ where: { callId: In(transcribedIds) } })
      : [];
    const transcriptMap = new Map(transcripts.map((t) => [t.callId, t]));

    // Load dynamic word lists from settings
    const fillerWords = await this.getWordList(CALLS_FILLER_WORDS, CallsService.DEFAULT_FILLER_WORDS);
    const negativeWords = await this.getWordList(CALLS_NEGATIVE_WORDS, CallsService.DEFAULT_NEGATIVE_WORDS);

    let fillerWordsTotal = 0;
    let negativeWordsTotal = 0;
    let greetedCount = 0;
    let farewellCount = 0;
    const fillerDetail = new Map<string, number>();
    const negativeDetail = new Map<string, number>();

    for (const call of transcribedCalls) {
      const tr = transcriptMap.get(call.id);
      if (!tr) continue;
      const opText = tr.operatorText || '';
      if (opText) {
        fillerWordsTotal += this.countPatternInText(opText, fillerWords);
        negativeWordsTotal += this.countPatternInText(opText, negativeWords);
        for (const w of fillerWords) {
          const re = new RegExp(w.replace(/\s+/g, '\\s+'), 'gi');
          const m = opText.toLowerCase().match(re);
          if (m) fillerDetail.set(w, (fillerDetail.get(w) || 0) + m.length);
        }
        for (const w of negativeWords) {
          const re = new RegExp(w.replace(/\s+/g, '\\s+'), 'gi');
          const m = opText.toLowerCase().match(re);
          if (m) negativeDetail.set(w, (negativeDetail.get(w) || 0) + m.length);
        }
        if (CallsService.GREETING_PATTERNS.test(opText)) greetedCount++;
        if (CallsService.FAREWELL_PATTERNS.test(opText)) farewellCount++;
      }
    }

    // Duration stats
    const totalDuration = transcribedCalls.reduce((s, c) => s + (c.durationSeconds || 0), 0);
    const totalSpeech = transcribedCalls.reduce((s, c) => s + (c.speechDurationSeconds || 0), 0);
    const totalSilence = transcribedCalls.reduce((s, c) => s + (c.silenceDurationSeconds || 0), 0);
    const count = transcribedCalls.length || 1;

    const toNum = (v: string) => parseInt(v, 10) || 0;

    return {
      totalCalls: allCallIds.length,
      transcribedCalls: transcribedCalls.length,
      transcribedCallIds: transcribedIds,
      topics: topicStats.map((r) => ({
        topicId: r.topicId,
        topicName: r.topicName,
        callsCount: toNum(r.callsCount),
        occurrences: toNum(r.occurrences),
      })),
      summary: {
        fillerWords: fillerWordsTotal,
        negativeWords: negativeWordsTotal,
        fillerWordsDetail: [...fillerDetail.entries()]
          .map(([word, count]) => ({ word, count }))
          .sort((a, b) => b.count - a.count),
        negativeWordsDetail: [...negativeDetail.entries()]
          .map(([word, count]) => ({ word, count }))
          .sort((a, b) => b.count - a.count),
        greetedCount,
        farewellCount,
        avgDuration: Math.round(totalDuration / count),
        avgSpeechDuration: Math.round(totalSpeech / count),
        avgSilenceDuration: Math.round(totalSilence / count),
        speechRatio: totalDuration > 0 ? Math.round((totalSpeech / totalDuration) * 100) : 0,
      },
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
    provider: string;
    speechkitConfigured: boolean;
    speechkitFolderIdMask?: string;
    tritechConfigured: boolean;
    tritechUsernameMask?: string;
  }> {
    const apiKey = await this.getSetting(CALLS_AUDIO_API_KEY);
    const apiBaseRaw = await this.getSetting(CALLS_AUDIO_API_BASE);
    const apiBase = apiBaseRaw && apiBaseRaw.includes('polza.ai') ? null : apiBaseRaw;
    const audioPath = await this.getSetting(CALLS_AUDIO_PATH);
    const model = await this.getSetting(CALLS_AUDIO_MODEL);
    const provider = (await this.getSetting(CALLS_PROVIDER)) || 'aitunnel';
    const speechkitKey = await this.getSetting(CALLS_SPEECHKIT_API_KEY);
    const speechkitFolderId = await this.getSetting(CALLS_SPEECHKIT_FOLDER_ID);

    const tritechUsername = await this.getSetting(CALLS_TRITECH_USERNAME);
    const tritechClientId = await this.getSetting(CALLS_TRITECH_CLIENT_ID);
    const tritechConfigured = await this.tritechProvider.isConfigured();

    let apiKeyMask: string | undefined;
    if (apiKey) {
      apiKeyMask = apiKey.length > 8
        ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
        : '***';
    }

    let speechkitFolderIdMask: string | undefined;
    if (speechkitFolderId) {
      speechkitFolderIdMask = speechkitFolderId.length > 8
        ? `${speechkitFolderId.slice(0, 4)}...${speechkitFolderId.slice(-4)}`
        : speechkitFolderId;
    }

    let tritechUsernameMask: string | undefined;
    if (tritechUsername) {
      tritechUsernameMask = tritechUsername.length > 6
        ? `${tritechUsername.slice(0, 3)}...`
        : tritechUsername;
    }

    return {
      apiKeyConfigured: Boolean(apiKey),
      apiKeyMask,
      apiBase: apiBase || (this.config.get<string>('AITUNNEL_API_BASE') || '').trim() || 'https://api.aitunnel.ru/v1',
      audioPath: audioPath || (this.config.get<string>('AITUNNEL_AUDIO_PATH') || '').trim() || '/audio/transcriptions',
      model: model || (this.config.get<string>('AITUNNEL_AUDIO_MODEL') || '').trim() || 'whisper-1',
      provider,
      speechkitConfigured: Boolean(speechkitKey && speechkitFolderId),
      speechkitFolderIdMask,
      tritechConfigured,
      tritechUsernameMask,
    };
  }

  async updateSettings(data: {
    apiKey?: string;
    apiBase?: string;
    audioPath?: string;
    model?: string;
    provider?: string;
    speechkitApiKey?: string;
    speechkitFolderId?: string;
    tritechClientId?: string;
    tritechClientSecret?: string;
    tritechUsername?: string;
    tritechPassword?: string;
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
    if (data.provider !== undefined) {
      const value = ['aitunnel', 'yandex', 'tritech'].includes(data.provider) ? data.provider : 'aitunnel';
      updates.push({ key: CALLS_PROVIDER, value });
    }
    if (data.speechkitApiKey !== undefined) {
      const value = data.speechkitApiKey.trim();
      updates.push({ key: CALLS_SPEECHKIT_API_KEY, value: value || null });
    }
    if (data.speechkitFolderId !== undefined) {
      const value = data.speechkitFolderId.trim();
      updates.push({ key: CALLS_SPEECHKIT_FOLDER_ID, value: value || null });
    }
    if (data.tritechClientId !== undefined) {
      updates.push({ key: CALLS_TRITECH_CLIENT_ID, value: data.tritechClientId.trim() || null });
    }
    if (data.tritechClientSecret !== undefined) {
      updates.push({ key: CALLS_TRITECH_CLIENT_SECRET, value: data.tritechClientSecret.trim() || null });
    }
    if (data.tritechUsername !== undefined) {
      updates.push({ key: CALLS_TRITECH_USERNAME, value: data.tritechUsername.trim() || null });
    }
    if (data.tritechPassword !== undefined) {
      updates.push({ key: CALLS_TRITECH_PASSWORD, value: data.tritechPassword.trim() || null });
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

  async createTopic(data: { name: string; keywords?: string[] | string; isActive?: boolean; createdBy?: string | null }) {
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Название тематики обязательно');
    const keywords = this.normalizeKeywords(data.keywords);
    const topic = this.topicRepo.create({
      name,
      keywords,
      isActive: data.isActive ?? true,
      createdBy: data.createdBy || null,
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

  private async transcribeCallWithTritech(call: Call, audioPath: string) {
    const callId = call.id;
    try {
      const result = await this.tritechProvider.transcribeAudio(audioPath);

      // Apply dictionary corrections (also mutates result.words in-place)
      const corrected = await this.applyDictionaryCorrections(result);

      let transcript = await this.transcriptRepo.findOne({ where: { callId } });
      if (!transcript) {
        transcript = this.transcriptRepo.create({
          callId,
          text: corrected.text,
          operatorText: corrected.operatorText,
          abonentText: corrected.abonentText,
          turns: corrected.turns,
          words: result.words || null,
          dictionaryApplied: corrected.dictionaryApplied || null,
          language: 'ru',
          provider: 'tritech',
          sentiment: result.sentiment,
        });
      } else {
        transcript.text = corrected.text;
        transcript.operatorText = corrected.operatorText;
        transcript.abonentText = corrected.abonentText;
        transcript.turns = corrected.turns;
        transcript.words = result.words || null;
        transcript.dictionaryApplied = corrected.dictionaryApplied || null;
        transcript.language = 'ru';
        transcript.provider = 'tritech';
        transcript.sentiment = result.sentiment;
      }
      await this.transcriptRepo.save(transcript);

      // Topic matching on corrected operator text
      await this.matchRepo.delete({ callId });
      const matchesToSave: Partial<CallTopicMatch>[] = [];
      const operatorSource = corrected.operatorText?.trim();
      if (operatorSource) {
        const topics = await this.topicRepo.find({ where: { isActive: true } });
        topics.forEach((topic) => {
          (topic.keywords || []).forEach((keyword) => {
            const trimmed = keyword.trim();
            if (!trimmed) return;
            const occurrences = this.countOccurrences(operatorSource, trimmed);
            if (occurrences > 0) {
              matchesToSave.push({ callId, topicId: topic.id, keyword: trimmed, occurrences });
            }
          });
        });
        if (matchesToSave.length) {
          await this.matchRepo.insert(matchesToSave);
        }
      }

      if (result.duration > 0) call.durationSeconds = Math.round(result.duration);
      if (result.speechDuration > 0) call.speechDurationSeconds = Math.round(result.speechDuration);
      if (result.silenceDuration >= 0 && result.duration > 0) call.silenceDurationSeconds = Math.round(result.silenceDuration);

      call.status = 'transcribed';
      await this.callRepo.save(call);
      return { call, transcript, matches: matchesToSave.length };
    } catch (error) {
      call.status = 'failed';
      await this.callRepo.save(call);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Ошибка транскрибации через 3iTech');
    }
  }

  async transcribeCall(callId: string) {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Звонок не найден');

    const audioPath = await this.getAudioPathByCall(call);
    if (!audioPath) throw new NotFoundException('Аудиофайл не найден');

    call.status = 'transcribing';
    await this.callRepo.save(call);

    // 3iTech provider — separate flow (async task-based API with native diarization)
    const provider = await this.audioProvider.getProvider();
    if (provider === 'tritech') {
      return this.transcribeCallWithTritech(call, audioPath);
    }

    const model =
      (await this.getSetting(CALLS_AUDIO_MODEL)) ||
      (this.config.get<string>('AITUNNEL_AUDIO_MODEL') || '').trim() ||
      'whisper-1';

    const pickText = (r: unknown): string => {
      if (!r || typeof r !== 'object') return '';
      const o = r as Record<string, unknown>;
      const t = o.text ?? (o.data && typeof o.data === 'object' && (o.data as Record<string, unknown>).text) ?? o.transcript ?? (o.result && typeof o.result === 'object' && (o.result as Record<string, unknown>).text);
      return typeof t === 'string' ? t : '';
    };
    const getLanguage = (r: unknown): string | null => {
      if (!r || typeof r !== 'object') return null;
      const o = r as Record<string, unknown>;
      const lang = o.language ?? (o.data && typeof o.data === 'object' && (o.data as Record<string, unknown>).language);
      return typeof lang === 'string' ? lang : null;
    };
    const getDiarizeSegments = (r: unknown): Array<{ speaker: string; text: string }> => {
      if (!r || typeof r !== 'object') return [];
      const o = r as Record<string, unknown>;
      const rawSegments =
        (o.segments as unknown) ||
        (o.data && typeof o.data === 'object' && (o.data as Record<string, unknown>).segments) ||
        (o.result && typeof o.result === 'object' && (o.result as Record<string, unknown>).segments);
      if (!Array.isArray(rawSegments)) return [];
      return rawSegments
        .map((seg) => {
          if (!seg || typeof seg !== 'object') return null;
          const s = seg as Record<string, unknown>;
          const speakerRaw = s.speaker ?? s.spk ?? s.speaker_label ?? s.speaker_id ?? s.speakerId ?? s.label;
          const textRaw = s.text ?? s.transcript;
          const speaker = typeof speakerRaw === 'string' ? speakerRaw.trim() : '';
          const text = typeof textRaw === 'string' ? textRaw.trim() : '';
          if (!speaker || !text) return null;
          return { speaker, text };
        })
        .filter((seg): seg is { speaker: string; text: string } => Boolean(seg));
    };
    const normalizeSpeaker = (raw: string): 'operator' | 'abonent' => {
      const value = raw.toLowerCase();
      if (value.includes('собеседник') || value.includes('пациент') || value.includes('абонент') || value.includes('клиент')) return 'abonent';
      if (value.includes('оператор')) return 'operator';
      if (value.includes('b') || value.includes('2')) return 'abonent';
      return 'operator';
    };

    let tempPaths: { leftPath: string; rightPath: string } | null = null;
    let cleanPath: string | null = null;

    try {
      const isWavOrMp3 = /\.(wav|mp3)$/i.test(audioPath);
      const diarizeModel = model.includes('diarize');
      if (isWavOrMp3 && !diarizeModel) {
        tempPaths = await splitStereoAudioToMonoFiles(audioPath);
      }

      let text: string = '';
      let operatorText: string | null = null;
      let abonentText: string | null = null;
      let response: unknown;

      let turnsFromDiarize: { speaker: 'operator' | 'abonent'; text: string }[] | null = null;

      let stereoTurns: { speaker: 'operator' | 'abonent'; text: string; start: number; end: number }[] | null = null;
      let allWords: { word: string; start: number; end: number; speaker: 'operator' | 'abonent' }[] | null = null;

      if (tempPaths) {
        const [leftResponse, rightResponse] = await Promise.all([
          this.audioProvider.transcribeAudio(tempPaths.leftPath, 'channel_left.wav'),
          this.audioProvider.transcribeAudio(tempPaths.rightPath, 'channel_right.wav'),
        ]);

        // Определяем, какой канал — оператор, по приветствию в начале текста
        const leftText = pickText(leftResponse) || '';
        const rightText = pickText(rightResponse) || '';
        const greetingPattern = /здравствуйте|добрый\s*(день|вечер|утро)|чем\s*(могу|можем)\s*помочь|клиника|кидней|kidney|слушаю\s*вас|алл[её]/i;
        const leftHasGreeting = greetingPattern.test(leftText.slice(0, 300));
        const rightHasGreeting = greetingPattern.test(rightText.slice(0, 300));
        let leftIsOperator: boolean;
        if (leftHasGreeting !== rightHasGreeting) {
          leftIsOperator = leftHasGreeting;
        } else {
          // Вторичная эвристика: оператор обычно говорит больше в начале разговора
          const leftFirstWords = leftText.slice(0, 100).split(/\s+/).filter(Boolean).length;
          const rightFirstWords = rightText.slice(0, 100).split(/\s+/).filter(Boolean).length;
          leftIsOperator = leftFirstWords >= rightFirstWords;
          this.logger.log(`Heuristic fallback: leftWords=${leftFirstWords}, rightWords=${rightFirstWords}`);
        }
        this.logger.log(`Channel detection: left=${leftHasGreeting ? 'greeting' : 'no-greeting'}, right=${rightHasGreeting ? 'greeting' : 'no-greeting'}, leftIsOperator=${leftIsOperator}`);

        const operatorResponse = leftIsOperator ? leftResponse : rightResponse;
        const abonentResponse = leftIsOperator ? rightResponse : leftResponse;

        operatorText = pickText(operatorResponse) || null;
        abonentText = pickText(abonentResponse) || null;

        // LLM-коррекция медицинской терминологии (параллельно для обоих каналов)
        const [corrOp, corrAb] = await Promise.all([
          operatorText ? this.audioProvider.correctMedicalTranscript(operatorText) : Promise.resolve(null),
          abonentText ? this.audioProvider.correctMedicalTranscript(abonentText) : Promise.resolve(null),
        ]);
        if (corrOp !== null) operatorText = corrOp;
        if (corrAb !== null) abonentText = corrAb;

        text =
          (operatorText ? `Оператор:\n${operatorText}` : '') +
          (operatorText && abonentText ? '\n\n' : '') +
          (abonentText ? `Собеседник:\n${abonentText}` : '');
        if (!text.trim()) {
          throw new BadRequestException('Не удалось получить текст транскрибации');
        }

        const opSegments = this.getTimedSegments(operatorResponse);
        const abSegments = this.getTimedSegments(abonentResponse);
        if (opSegments.length || abSegments.length) {
          stereoTurns = this.mergeSegmentsByTimestamp(opSegments, abSegments);
        }

        // Извлекаем word-level timestamps из обоих каналов
        const opWords = this.getTimedWords(operatorResponse).map(w => ({ ...w, speaker: 'operator' as const }));
        const abWords = this.getTimedWords(abonentResponse).map(w => ({ ...w, speaker: 'abonent' as const }));
        if (opWords.length || abWords.length) {
          allWords = [...opWords, ...abWords].sort((a, b) => a.start - b.start);
        }

        response = operatorResponse;
      } else {
        // Стерео-сплит не сработал (моно файл или нет ffmpeg) — используем diarize для определения спикеров
        this.logger.log('Stereo split unavailable, falling back to diarize transcription');
        // Предобрабатываем аудио: шумоподавление + нормализация + 16 кГц
        cleanPath = await preprocessAudioForTranscription(audioPath);
        const diarizeInputPath = cleanPath ?? audioPath;
        response = await this.audioProvider.transcribeWithDiarize(diarizeInputPath, path.basename(audioPath));
        const diarizeSegments = getDiarizeSegments(response);
        if (diarizeSegments.length) {
          // API вернул сегменты с метками спикеров
          turnsFromDiarize = diarizeSegments.map((seg) => ({
            speaker: normalizeSpeaker(seg.speaker),
            text: seg.text,
          }));
        } else {
          // API вернул текст без сегментов — пробуем LLM-диаризацию, затем эвристику
          const rawText = pickText(response);

          // LLM-диаризация: отправляем сплошной текст в LLM для разметки на реплики
          const llmTurns = await this.audioProvider.diarizeWithLLM(rawText);
          if (llmTurns && llmTurns.length > 1) {
            this.logger.log(`LLM diarization produced ${llmTurns.length} turns`);
            turnsFromDiarize = llmTurns;
          } else {
            // Fallback: разбиваем по строкам, чередуем оператор/собеседник
            const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length > 1) {
              const greetingPattern = /здравствуйте|добрый\s*(день|вечер|утро)|чем\s*(могу|можем)\s*помочь|клиника|кидней|kidney|слушаю\s*вас|алл[её]/i;
              const firstIsOperator = greetingPattern.test(lines[0]);
              turnsFromDiarize = lines.map((line, i) => ({
                speaker: ((i % 2 === 0) === firstIsOperator ? 'operator' : 'abonent') as 'operator' | 'abonent',
                text: line,
              }));
            }
          }
        }

        if (turnsFromDiarize && turnsFromDiarize.length) {
          // Склеиваем соседние реплики одного спикера
          const merged: typeof turnsFromDiarize = [];
          for (const turn of turnsFromDiarize) {
            const last = merged[merged.length - 1];
            if (last && last.speaker === turn.speaker) {
              last.text += ' ' + turn.text;
            } else {
              merged.push({ ...turn });
            }
          }
          turnsFromDiarize = merged;

          operatorText = turnsFromDiarize.filter(t => t.speaker === 'operator').map(t => t.text).join(' ') || null;
          abonentText = turnsFromDiarize.filter(t => t.speaker === 'abonent').map(t => t.text).join(' ') || null;

          // LLM-коррекция медицинской терминологии (параллельно)
          const [corrOpD, corrAbD] = await Promise.all([
            operatorText ? this.audioProvider.correctMedicalTranscript(operatorText) : Promise.resolve(null),
            abonentText ? this.audioProvider.correctMedicalTranscript(abonentText) : Promise.resolve(null),
          ]);
          if (corrOpD !== null) operatorText = corrOpD;
          if (corrAbD !== null) abonentText = corrAbD;

          text =
            (operatorText ? `Оператор:\n${operatorText}` : '') +
            (operatorText && abonentText ? '\n\n' : '') +
            (abonentText ? `Собеседник:\n${abonentText}` : '');
          if (!text.trim()) text = turnsFromDiarize.map((seg) => seg.text).join('\n');
        } else {
          text = pickText(response);
        }
        if (!text || typeof text !== 'string') {
          throw new BadRequestException('Не удалось получить текст транскрибации');
        }
      }

      const language = getLanguage(response);
      const durationRaw =
        (response && typeof response === 'object' && (
          (response as { duration?: number }).duration ||
          (response as { data?: { duration?: number } }).data?.duration ||
          (response as { audio_duration?: number }).audio_duration ||
          (response as { meta?: { duration?: number } }).meta?.duration
        )) as number | undefined;
      const speechRaw =
        (response && typeof response === 'object' && (
          (response as { speech_duration_seconds?: number }).speech_duration_seconds ||
          (response as { data?: { speech_duration_seconds?: number } }).data?.speech_duration_seconds ||
          (response as { meta?: { speech_duration_seconds?: number } }).meta?.speech_duration_seconds
        )) as number | undefined;
      const silenceRaw =
        (response && typeof response === 'object' && (
          (response as { silence_duration_seconds?: number }).silence_duration_seconds ||
          (response as { data?: { silence_duration_seconds?: number } }).data?.silence_duration_seconds ||
          (response as { meta?: { silence_duration_seconds?: number } }).meta?.silence_duration_seconds
        )) as number | undefined;

      let durationSeconds = Number(durationRaw);
      let speechSeconds = Number(speechRaw);
      let silenceSeconds = Number(silenceRaw);

      // Если API не вернул общую длительность — получаем из аудиофайла через ffprobe
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        durationSeconds = await getAudioDurationSeconds(audioPath);
      }

      // Если API не вернул речь/молчание — вычисляем из сегментов
      if ((!Number.isFinite(speechSeconds) || speechSeconds <= 0) && stereoTurns && stereoTurns.length > 0) {
        speechSeconds = stereoTurns.reduce((sum, t) => sum + (t.end - t.start), 0);
      }

      // Оценка речи по количеству слов (~150 слов/мин для русской речи)
      if ((!Number.isFinite(speechSeconds) || speechSeconds <= 0) && text) {
        const wordCount = text.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).length;
        if (wordCount > 0) {
          speechSeconds = Math.min((wordCount / 150) * 60, durationSeconds > 0 ? durationSeconds : Infinity);
        }
      }

      if (Number.isFinite(durationSeconds) && durationSeconds > 0 && Number.isFinite(speechSeconds) && speechSeconds > 0) {
        if (!Number.isFinite(silenceSeconds) || silenceSeconds <= 0) {
          silenceSeconds = Math.max(0, durationSeconds - speechSeconds);
        }
      }

      const turns: { speaker: 'operator' | 'abonent'; text: string; start?: number; end?: number }[] | null = turnsFromDiarize
        ? turnsFromDiarize
        : stereoTurns && stereoTurns.length > 0
          ? stereoTurns
          : operatorText != null && operatorText !== '' && abonentText != null && abonentText !== ''
            ? this.buildTurnsFromOperatorAbonent(operatorText, abonentText)
            : null;

      // Apply dictionary corrections
      const corrected = await this.applyDictionaryCorrections({ text, operatorText, abonentText, turns, words: allWords });

      let transcript = await this.transcriptRepo.findOne({ where: { callId } });
      if (!transcript) {
        transcript = this.transcriptRepo.create({
          callId,
          text: corrected.text,
          operatorText: corrected.operatorText,
          abonentText: corrected.abonentText,
          turns: corrected.turns,
          words: allWords,
          dictionaryApplied: corrected.dictionaryApplied || null,
          language,
          provider: 'aitunnel',
        });
      } else {
        transcript.text = corrected.text;
        transcript.operatorText = corrected.operatorText;
        transcript.abonentText = corrected.abonentText;
        transcript.turns = corrected.turns;
        transcript.words = allWords;
        transcript.dictionaryApplied = corrected.dictionaryApplied || null;
        transcript.language = language;
        transcript.provider = 'aitunnel';
      }
      await this.transcriptRepo.save(transcript);

      await this.matchRepo.delete({ callId });
      const matchesToSave: Partial<CallTopicMatch>[] = [];
      const operatorSource = corrected.operatorText?.trim();
      if (operatorSource) {
        const topics = await this.topicRepo.find({ where: { isActive: true } });
        topics.forEach((topic) => {
          (topic.keywords || []).forEach((keyword) => {
            const trimmed = keyword.trim();
            if (!trimmed) return;
            const occurrences = this.countOccurrences(operatorSource, trimmed);
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
    } finally {
      if (tempPaths) {
        const { leftPath, rightPath } = tempPaths;
        await fs.unlink(leftPath).catch(e => this.logger.warn(`Не удалось удалить temp-файл ${leftPath}: ${e.message}`));
        await fs.unlink(rightPath).catch(e => this.logger.warn(`Не удалось удалить temp-файл ${rightPath}: ${e.message}`));
      }
      if (cleanPath) {
        await fs.unlink(cleanPath).catch(e => this.logger.warn(`Не удалось удалить temp-файл ${cleanPath}: ${e.message}`));
      }
    }
  }

  // --- Dictionary corrections ---

  private async applyDictionaryCorrections(result: {
    text: string;
    operatorText: string | null;
    abonentText: string | null;
    turns: { speaker: 'operator' | 'abonent'; text: string; start?: number; end?: number }[] | null;
    words?: { word: string; start: number; end: number; speaker: string }[] | null;
  }) {
    const entries = await this.dictRepo.find({ where: { isActive: true } });
    if (!entries.length) return { ...result, dictionaryApplied: null };

    const appliedMap = new Map<string, { original: string; corrected: string; count: number }>();

    // Single-pass replacement: объединяем все паттерны в один regex
    // чтобы избежать зацикливания при конфликтующих заменах (A→B, B→A)
    const replacementMap = new Map(entries.map(e => [e.originalWord.toLowerCase(), e]));
    const escaped = [...entries]
      .sort((a, b) => b.originalWord.length - a.originalWord.length)
      .map(e => e.originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const combinedRegex = new RegExp(`(${escaped.join('|')})`, 'gi');

    const applyReplacements = (text: string | null): string | null => {
      if (!text) return text;
      const corrected = text.replace(combinedRegex, (match) => {
        const entry = replacementMap.get(match.toLowerCase());
        if (entry) {
          const key = entry.originalWord.toLowerCase();
          const prev = appliedMap.get(key);
          appliedMap.set(key, {
            original: entry.originalWord,
            corrected: entry.correctedWord,
            count: (prev?.count || 0) + 1,
          });
          return entry.correctedWord;
        }
        return match;
      });
      return corrected;
    };

    const correctedText = applyReplacements(result.text) || result.text;
    const correctedOperator = applyReplacements(result.operatorText);
    const correctedAbonent = applyReplacements(result.abonentText);
    const correctedTurns = result.turns?.map(t => ({
      ...t,
      text: applyReplacements(t.text) || t.text,
    })) || null;

    // Correct words array (word-level tokens with timestamps)
    // Двухпроходный подход: сначала собираем все замены, потом применяем от конца к началу
    const correctedWords = result.words;
    if (correctedWords?.length) {
      const wordReplacements: { start: number; length: number; newTokens: typeof correctedWords }[] = [];

      for (const entry of entries) {
        const originalParts = entry.originalWord.toLowerCase().split(/\s+/).filter(Boolean);
        if (!originalParts.length) continue;
        const replacementParts = entry.correctedWord.split(/\s+/).filter(Boolean);

        for (let i = 0; i <= correctedWords.length - originalParts.length; i++) {
          let matched = true;
          for (let j = 0; j < originalParts.length; j++) {
            const clean = correctedWords[i + j].word.toLowerCase().replace(/[.,!?;:"""''()]/g, '');
            if (clean !== originalParts[j]) { matched = false; break; }
          }
          if (matched) {
            const newTokens: typeof correctedWords = [];
            if (replacementParts.length === 1) {
              const orig = correctedWords[i].word;
              const leadPunct = orig.match(/^[.,!?;:"""''()]+/)?.[0] || '';
              const trailPunct = orig.match(/[.,!?;:"""''()]+$/)?.[0] || '';
              newTokens.push({ ...correctedWords[i], word: leadPunct + replacementParts[0] + trailPunct });
            } else {
              for (let j = 0; j < replacementParts.length; j++) {
                const base = correctedWords[Math.min(i + j, i + originalParts.length - 1)];
                newTokens.push({ ...base, word: replacementParts[j] });
              }
            }
            wordReplacements.push({ start: i, length: originalParts.length, newTokens });
          }
        }
      }

      // Применяем от конца к началу чтобы индексы не смещались
      wordReplacements
        .sort((a, b) => b.start - a.start)
        .forEach(r => correctedWords.splice(r.start, r.length, ...r.newTokens));
    }

    const dictionaryApplied = appliedMap.size > 0
      ? [...appliedMap.values()]
      : null;

    return {
      text: correctedText,
      operatorText: correctedOperator,
      abonentText: correctedAbonent,
      turns: correctedTurns,
      dictionaryApplied,
    };
  }

  // --- Favorites ---

  async listFavorites() {
    const calls = await this.callRepo.find({
      where: { isFavorite: true },
      order: { callAt: 'DESC' },
    });
    if (!calls.length) return [];
    const callIds = calls.map((c) => c.id);
    const transcripts = await this.transcriptRepo.find({ where: { callId: In(callIds) } });
    const transcriptMap = new Map(transcripts.map((t) => [t.callId, t]));
    return calls.map((call) => ({
      ...call,
      transcript: transcriptMap.get(call.id) || null,
      matches: [],
    }));
  }

  async toggleFavorite(callId: string) {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Звонок не найден');
    call.isFavorite = !call.isFavorite;
    await this.callRepo.save(call);
    return { id: call.id, isFavorite: call.isFavorite };
  }

  async getDictionaryEntries() {
    return this.dictRepo.find({ order: { createdAt: 'ASC' } });
  }

  async createDictionaryEntry(data: { originalWord: string; correctedWord: string; isActive?: boolean }) {
    const entry = this.dictRepo.create({
      originalWord: data.originalWord.trim(),
      correctedWord: data.correctedWord.trim(),
      isActive: data.isActive ?? true,
    });
    return this.dictRepo.save(entry);
  }

  async updateDictionaryEntry(id: string, data: { originalWord?: string; correctedWord?: string; isActive?: boolean }) {
    const entry = await this.dictRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Запись словаря не найдена');
    if (data.originalWord !== undefined) entry.originalWord = data.originalWord.trim();
    if (data.correctedWord !== undefined) entry.correctedWord = data.correctedWord.trim();
    if (data.isActive !== undefined) entry.isActive = data.isActive;
    return this.dictRepo.save(entry);
  }

  async deleteDictionaryEntry(id: string) {
    const entry = await this.dictRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Запись словаря не найдена');
    await this.dictRepo.remove(entry);
  }

  // --- Speaker management ---

  async getSpeakers() {
    return this.speakerRepo.find({ order: { createdAt: 'ASC' } });
  }

  async createSpeaker(data: { name: string; description?: string }, audioFile: Express.Multer.File) {
    // Save audio to temp file, upload to 3iTech, create speaker model
    const tempDir = path.join(this.audioDir, '_speaker_temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `speaker_${Date.now()}${path.extname(audioFile.originalname) || '.wav'}`);
    await fs.writeFile(tempPath, audioFile.buffer);

    try {
      const fileId = await this.tritechProvider.uploadFilePublic(tempPath);
      const model = await this.tritechProvider.createSpeakerModel(fileId, data.name, data.description);

      const speaker = this.speakerRepo.create({
        name: data.name,
        tritechModelId: model.id,
        status: model.ready ? 'ready' : 'training',
        description: data.description || null,
      });
      return this.speakerRepo.save(speaker);
    } finally {
      await fs.unlink(tempPath).catch(() => {});
    }
  }

  async deleteSpeaker(id: string) {
    const speaker = await this.speakerRepo.findOne({ where: { id } });
    if (!speaker) throw new NotFoundException('Диктор не найден');
    if (speaker.tritechModelId) {
      try {
        await this.tritechProvider.deleteSpeakerModel(speaker.tritechModelId);
      } catch {
        // Model may already be deleted in 3iTech
      }
    }
    await this.speakerRepo.remove(speaker);
  }

  async refreshSpeakerStatuses() {
    const speakers = await this.speakerRepo.find();
    if (!speakers.length) return speakers;
    try {
      const models = await this.tritechProvider.getSpeakerModels();
      const modelMap = new Map(models.map(m => [m.id, m]));
      for (const speaker of speakers) {
        if (speaker.tritechModelId) {
          const model = modelMap.get(speaker.tritechModelId);
          if (model) {
            speaker.status = model.ready ? 'ready' : 'training';
          } else {
            speaker.status = 'error';
          }
        }
      }
      await this.speakerRepo.save(speakers);
    } catch {
      // 3iTech may be unavailable
    }
    return speakers;
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
