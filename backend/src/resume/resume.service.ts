import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Repository,
  SelectQueryBuilder,
  Not,
  IsNull,
  In,
  DataSource,
  Brackets,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as mammoth from 'mammoth';
import * as ExcelJS from 'exceljs';

import { ResumeCandidate } from './entities/resume-candidate.entity';
import { ResumeUploadedFile } from './entities/resume-uploaded-file.entity';
import { ResumeWorkHistory } from './entities/resume-work-history.entity';
import { ResumeEducation } from './entities/resume-education.entity';
import { ResumeCmeCourse } from './entities/resume-cme-course.entity';
import { ResumeCandidateNote } from './entities/resume-candidate-note.entity';
import { ResumeCandidateTag } from './entities/resume-candidate-tag.entity';
import { ResumeTelegramChat } from './entities/resume-telegram-chat.entity';
import { ResumeLead } from './entities/resume-lead.entity';
import { ResumeLeadTag } from './entities/resume-lead-tag.entity';
import {
  ResumeProcessingStatus,
  ResumeQualificationCategory,
  ResumeCandidateStatus,
  ResumeCandidatePriority,
  ResumeCandidateGender,
  ResumeCandidateDoctorType,
  ResumeLeadStatus,
  ResumeSalaryType,
} from './entities/resume.enums';
import { ResumeSpecialization } from './entities/resume-specialization.entity';
import { ResumeDuplicateDetectionService, type DuplicateCheckResult } from './resume-duplicate-detection.service';
import { parseCvText, evaluateParsingQuality } from './ai/parse-cv';
import { buildCvParsingPrompt } from './ai/prompts';
import type { CvParsedOutput } from './ai/schemas';
import { ResumeCandidateScore } from './entities/resume-candidate-score.entity';
import { buildCompactProfile, buildCandidateProfileText, generateEmbedding, generateEmbeddingsBatch, saveEmbedding, analyzeSearchQuery, validateSqlClause } from './ai/embedding';

import { buildScoringPrompt } from './ai/scoring-prompt';
import { generateAiScoring } from './ai/score-candidate';
import { ollama, OLLAMA_MODEL, OLLAMA_FAST_MODEL } from './ai/client';
import { computePoolStats, computeDeterministicScores } from './ai/deterministic-scoring';

import { CreateNoteDto } from './dto/create-note.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { PublicApplySubmitDto } from './dto/public-apply-submit.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOCTOR_TYPE_LABELS: Record<string, string> = {
  PEDIATRIC: 'Детский',
  THERAPIST: 'Взрослый',
  FAMILY: 'Семейный',
};

const BRANCHES = ['Каспийск', 'Махачкала', 'Хасавюрт'] as const;

const QUALIFICATION_CATEGORIES: Record<string, string> = {
  HIGHEST: 'Высшая',
  FIRST: 'Первая',
  SECOND: 'Вторая',
  NONE: 'Без категории',
};

const CANDIDATE_STATUSES: Record<string, string> = {
  NEW: 'Новый',
  REVIEWING: 'На рассмотрении',
  INVITED: 'Приглашен на собеседование',
  ONLINE_INTERVIEW: 'Онлайн собеседование',
  INTERVIEW: 'Собеседование',
  TRIAL: 'Пробный приём',
  INTERNSHIP: 'Стажировка',
  HIRED: 'Принят',
  REJECTED: 'Не подходит',
  RESERVE: 'Кадровый резерв',
};

const CANDIDATE_PRIORITIES: Record<string, string> = {
  ACTIVE: 'Актуальный',
  RESERVE: 'Кадровый резерв',
  NOT_SUITABLE: 'Не подходит',
  ARCHIVE: 'Архив',
};

const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
];

const MONTH_NAMES = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
];

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Удаляет типичные префиксы из названия специализации.
 */
function stripSpecializationPrefixes(raw: string): string {
  const prefixes = [
    /^детский\s+врач[\s\-]*/i,
    /^врач[\s\-]+/i,
    /^доктор[\s\-]+/i,
    /^детская\s+/i,
    /^детский\s+/i,
  ];

  let cleaned = raw;
  for (const prefix of prefixes) {
    const attempt = cleaned.replace(prefix, '').trim();
    if (attempt) {
      cleaned = attempt;
      break;
    }
  }
  return cleaned;
}

/**
 * Parse a date string into a Date object; returns null if invalid.
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodPreset = '7d' | '30d' | '90d' | 'year' | 'all';

interface AnalyticsFilters {
  period: PeriodPreset;
  branch: string | null;
}

interface DateRange {
  current: { from: Date; to: Date };
  previous: { from: Date; to: Date } | null;
}

interface KpiMetric {
  key: string;
  title: string;
  value: number;
  previousValue: number | null;
  format: 'number' | 'percent' | 'decimal' | 'fraction';
  fractionTotal?: number;
  icon: string;
  color: string;
  trendDirection: 'up-good' | 'up-bad' | 'neutral';
}

interface TimelinePoint {
  month: string;
  label: string;
  count: number;
}

interface FunnelStage {
  name: string;
  value: number;
  conversionFromPrevious: number | null;
  color: string;
}

interface BranchDistributionItem {
  branch: string;
  NEW: number;
  REVIEWING: number;
  INVITED: number;
  ONLINE_INTERVIEW: number;
  INTERVIEW: number;
  TRIAL: number;
  INTERNSHIP: number;
  HIRED: number;
  total: number;
}

interface BranchCoverageRow {
  specialization: string;
  branches: Record<string, number>;
  total: number;
}

interface TagCount {
  label: string;
  count: number;
  color: string | null;
}

interface CategoryItem {
  name: string;
  key: string;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  kpis: KpiMetric[];
  timeline: TimelinePoint[];
  funnel: FunnelStage[];
  specializations: { name: string; count: number }[];
  categories: CategoryItem[];
  genderDistribution: CategoryItem[];
  doctorTypeDistribution: CategoryItem[];
  experienceBuckets: { name: string; count: number }[];
  branchDistribution: BranchDistributionItem[];
  branchCoverage: BranchCoverageRow[];
  topTags: TagCount[];
  scoreDistribution: { name: string; count: number }[];
  expiringAccreditations: {
    id: string;
    fullName: string;
    specialization: string | null;
    accreditationExpiryDate: Date | null;
  }[];
}

export interface CandidateListFilters {
  search?: string;
  status?: string;
  priority?: string;
  specialization?: string;
  qualificationCategory?: string;
  branch?: string;
  doctorType?: string;
  processingStatus?: string;
  experienceMin?: number;
  experienceMax?: number;
  city?: string;
  workCity?: string;
  educationCity?: string;
  tag?: string;
  scoreMin?: number;
  scoreMax?: number;
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  createdAt: 'c.createdAt',
  fullName: 'c.fullName',
  specialization: 'c.specialization',
  qualificationCategory: 'c.qualificationCategory',
  totalExperienceYears: 'c.totalExperienceYears',
  accreditationExpiryDate: 'c.accreditationExpiryDate',
  status: 'c.status',
  priority: 'c.priority',
  processingStatus: 'c.processingStatus',
  aiScore: 'c.aiScore',
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  /** Queue of candidate IDs waiting to be processed */
  private readonly processingQueue = new Set<string>();
  private isProcessingRunning = false;

  constructor(
    @InjectRepository(ResumeCandidate)
    private candidateRepo: Repository<ResumeCandidate>,
    @InjectRepository(ResumeUploadedFile)
    private fileRepo: Repository<ResumeUploadedFile>,
    @InjectRepository(ResumeWorkHistory)
    private workHistoryRepo: Repository<ResumeWorkHistory>,
    @InjectRepository(ResumeEducation)
    private educationRepo: Repository<ResumeEducation>,
    @InjectRepository(ResumeCmeCourse)
    private cmeRepo: Repository<ResumeCmeCourse>,
    @InjectRepository(ResumeCandidateNote)
    private noteRepo: Repository<ResumeCandidateNote>,
    @InjectRepository(ResumeCandidateTag)
    private tagRepo: Repository<ResumeCandidateTag>,
    @InjectRepository(ResumeTelegramChat)
    private telegramChatRepo: Repository<ResumeTelegramChat>,
    @InjectRepository(ResumeSpecialization)
    private specializationRepo: Repository<ResumeSpecialization>,
    @InjectRepository(ResumeCandidateScore)
    private scoreRepo: Repository<ResumeCandidateScore>,
    @InjectRepository(ResumeLead)
    private leadRepo: Repository<ResumeLead>,
    @InjectRepository(ResumeLeadTag)
    private leadTagRepo: Repository<ResumeLeadTag>,
    private config: ConfigService,
    private duplicateService: ResumeDuplicateDetectionService,
    private dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  //  Specialization helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Получить все специализации из справочной таблицы.
   */
  async getAllSpecializations(): Promise<ResumeSpecialization[]> {
    return this.specializationRepo.find({ order: { name: 'ASC' } });
  }

  /**
   * Нормализация специализации по справочной таблице:
   * 1. Удаление префиксов (врач, доктор, детский)
   * 2. Exact match по name (case-insensitive)
   * 3. Match по aliases (case-insensitive)
   * 4. Substring match
   * 5. Если ничего не нашлось — создать новую запись
   */
  async normalizeSpecialization(
    raw: string | null,
    specializations: ResumeSpecialization[],
  ): Promise<string | null> {
    if (!raw) return null;

    const trimmed = raw.trim();
    if (!trimmed) return null;

    const cleaned = stripSpecializationPrefixes(trimmed);
    const lowerCleaned = cleaned.toLowerCase();
    const lowerTrimmed = trimmed.toLowerCase();

    // 1. Exact match по name
    const exactName = specializations.find(
      (s) =>
        s.name.toLowerCase() === lowerTrimmed ||
        s.name.toLowerCase() === lowerCleaned,
    );
    if (exactName) return exactName.name;

    // 2. Match по aliases
    const aliasMatch = specializations.find((s) =>
      s.aliases.some(
        (a) =>
          a.toLowerCase() === lowerTrimmed ||
          a.toLowerCase() === lowerCleaned,
      ),
    );
    if (aliasMatch) return aliasMatch.name;

    // 3. Substring match: name содержит cleaned или наоборот
    const substringMatch = specializations.find((s) => {
      const lowerName = s.name.toLowerCase();
      return (
        lowerName.includes(lowerCleaned) || lowerCleaned.includes(lowerName)
      );
    });
    if (substringMatch) return substringMatch.name;

    // 4. Substring match по aliases
    const aliasSubstring = specializations.find((s) =>
      s.aliases.some((a) => {
        const la = a.toLowerCase();
        return la.includes(lowerCleaned) || lowerCleaned.includes(la);
      }),
    );
    if (aliasSubstring) return aliasSubstring.name;

    // 5. Ничего не нашли — создать новую запись
    const canonicalName =
      cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    try {
      const newSpec = this.specializationRepo.create({
        name: canonicalName,
        aliases: [lowerCleaned],
      });
      await this.specializationRepo.save(newSpec);
      this.logger.log(`Создана новая специализация: "${canonicalName}"`);
    } catch {
      // UNIQUE constraint — кто-то уже создал
      this.logger.warn(
        `Специализация "${canonicalName}" уже существует в БД`,
      );
    }

    return canonicalName;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  File Upload
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Save an uploaded file to disk and create a DB record.
   */
  async uploadFile(file: Express.Multer.File): Promise<ResumeUploadedFile> {
    const uploadDir =
      this.config.get<string>('RESUME_UPLOAD_DIR') || 'uploads/resume';
    const absoluteUploadDir = join(process.cwd(), uploadDir);

    await mkdir(absoluteUploadDir, { recursive: true });

    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${Date.now()}_${uuidv4()}_${sanitizedName}`;
    const storedPath = join(absoluteUploadDir, storedName);

    await writeFile(storedPath, file.buffer);

    const uploadedFile = this.fileRepo.create({
      originalName: file.originalname,
      storedPath,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });

    return this.fileRepo.save(uploadedFile);
  }

  private static readonly SAFE_EXT_MAP: Record<string, string> = {
    jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp',
    bmp: 'bmp', tiff: 'tiff', gif: 'gif', pdf: 'pdf',
  };

  /**
   * Save a file downloaded from a URL (image or PDF).
   */
  private async saveUrlDownload(
    data: Buffer,
    mimeType: string,
  ): Promise<{ storedPath: string; savedFile: ResumeUploadedFile }> {
    const uploadDir =
      this.config.get<string>('RESUME_UPLOAD_DIR') || 'uploads/resume';
    const absoluteUploadDir = join(process.cwd(), uploadDir);
    await mkdir(absoluteUploadDir, { recursive: true });

    const rawExt = mimeType.split('/')[1] || 'bin';
    const ext =
      ResumeService.SAFE_EXT_MAP[rawExt.toLowerCase()] || 'bin';
    const storedName = `${Date.now()}_${uuidv4()}_url_download.${ext}`;
    const storedPath = join(absoluteUploadDir, storedName);
    await writeFile(storedPath, data);

    const uploadedFile = this.fileRepo.create({
      originalName: `url_download.${ext}`,
      storedPath,
      mimeType,
      sizeBytes: data.length,
    });
    const savedFile = await this.fileRepo.save(uploadedFile);
    return { storedPath, savedFile };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Text Extraction
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Route text extraction by mimeType.
   */
  async extractTextFromFile(file: ResumeUploadedFile): Promise<string> {
    const { storedPath, mimeType } = file;

    switch (mimeType) {
      case 'application/pdf':
        return this.extractPdfText(storedPath);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractDocxText(storedPath);

      case 'text/plain':
        return readFile(storedPath, 'utf-8');

      case 'application/vnd.apple.pages':
      case 'application/x-iwork-pages-sffpages':
        return this.extractPagesText(storedPath);

      case 'application/msword':
        throw new BadRequestException(
          'Формат .doc не поддерживается. Сохраните в DOCX или PDF.',
        );

      default:
        if (IMAGE_MIME_TYPES.includes(mimeType)) {
          return this.extractImageText(storedPath);
        }
        throw new BadRequestException(
          `Неподдерживаемый формат файла: ${mimeType}`,
        );
    }
  }

  /**
   * Extract text from a PDF file using pdfjs-dist.
   */
  private async extractPdfText(filePath: string): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjsLib.getDocument(filePath).promise;
    const pages: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: unknown) => {
          const obj = item as Record<string, unknown>;
          return typeof obj.str === 'string' ? obj.str : '';
        })
        .join(' ');
      pages.push(text);
    }

    return pages.join('\n\n');
  }

  /**
   * Extract text from a DOCX file using mammoth.
   */
  private async extractDocxText(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  /**
   * Extract text from an image using Ollama Vision.
   */
  private async extractImageText(filePath: string): Promise<string> {
    const { extractTextFromImage } = await import('./extractors/ocr');
    const text = await extractTextFromImage(filePath);
    if (!text || text.trim().length < 10) {
      throw new BadRequestException(
        'Не удалось распознать текст на изображении. Убедитесь, что фото чёткое и текст читаемый.',
      );
    }
    return text;
  }

  /**
   * Extract text from an Apple Pages (.pages) file.
   * Pages is a ZIP archive containing QuickLook/Preview.pdf.
   */
  private async extractPagesText(filePath: string): Promise<string> {
    const { extractTextFromPages } = await import('./extractors/pages');
    const result = await extractTextFromPages(filePath);

    try {
      return await this.extractPdfText(result.value);
    } finally {
      const { unlink } = await import('fs/promises');
      await unlink(result.value).catch((e) =>
        this.logger.warn(`Не удалось удалить временный файл ${result.value}: ${e.message}`),
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Raw Text Fallback Parsing
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Regex-based fallback extraction when AI parsing is unavailable.
   */
  parseRawText(rawText: string): Partial<ResumeCandidate> {
    const result: Partial<ResumeCandidate> = {};

    // Extract email
    const emailMatch = rawText.match(
      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
    );
    if (emailMatch) {
      result.email = emailMatch[0];
    }

    // Extract phone
    const phoneMatch = rawText.match(
      /(?:\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/,
    );
    if (phoneMatch) {
      result.phone = phoneMatch[0];
    }

    // Extract name from first non-empty lines (heuristic)
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length > 0) {
      // Check if first line looks like a name (2-4 words, all capitalized or Cyrillic)
      const firstLine = lines[0];
      const namePattern = /^[А-ЯЁA-Z][а-яёa-z]+(\s+[А-ЯЁA-Z][а-яёa-z]+){1,3}$/;
      if (namePattern.test(firstLine)) {
        result.fullName = firstLine;
      }
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Process Candidate (full pipeline)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Full processing pipeline for a candidate:
   * 1. Extract text from file
   * 2. AI parse the text
   * 3. Save structured data
   * 4. Check for duplicates
   */
  async processCandidate(candidateId: string): Promise<void> {
    try {
      const candidate = await this.candidateRepo.findOne({
        where: { id: candidateId },
        relations: ['uploadedFile'],
      });

      if (!candidate) {
        throw new Error('Кандидат не найден');
      }

      // Step 1: Extract text
      await this.candidateRepo.update(candidateId, {
        processingStatus: ResumeProcessingStatus.EXTRACTING,
      });

      let rawText = candidate.rawText;

      if (!rawText && candidate.uploadedFile) {
        rawText = await this.extractTextFromFile(candidate.uploadedFile);

        await this.candidateRepo.update(candidateId, { rawText });
      }

      if (!rawText || rawText.trim().length === 0) {
        throw new Error('Не удалось извлечь текст из файла');
      }

      // Step 2: AI parsing
      await this.candidateRepo.update(candidateId, {
        processingStatus: ResumeProcessingStatus.PARSING,
      });

      const specs = await this.getAllSpecializations();
      const systemPrompt = buildCvParsingPrompt(specs.map((s) => s.name));
      const parsed = await parseCvText(rawText, systemPrompt);

      // Step 3: Save structured data
      await this.saveParsedData(candidateId, parsed);

      // Step 4: Duplicate detection
      const dupResult =
        await this.duplicateService.checkAndHandleDuplicates(candidateId);

      // Step 5: Independent quality evaluation
      let aiConfidence = 0.5;
      try {
        const evaluation = await evaluateParsingQuality(rawText, parsed);
        aiConfidence = evaluation.score;
      } catch (evalError) {
        this.logger.warn(
          `Quality evaluation failed for ${candidateId}: ${evalError instanceof Error ? evalError.message : 'unknown'}`,
        );
      }

      if (dupResult.status === 'exact_duplicate_deleted') {
        await this.candidateRepo.update(candidateId, {
          processingStatus: ResumeProcessingStatus.COMPLETED,
          aiConfidence,
        });
        this.logger.log(
          `Candidate ${candidateId} deleted as exact duplicate of ${dupResult.existingCandidateId}`,
        );
        return;
      }

      await this.candidateRepo.update(candidateId, {
        processingStatus: ResumeProcessingStatus.COMPLETED,
        aiConfidence,
      });

      // Step 6: Embedding
      try {
        const embCandidate = await this.candidateRepo.findOne({
          where: { id: candidateId },
          relations: ['workHistory', 'cmeCourses'],
        });
        if (embCandidate) {
          const profileText = buildCandidateProfileText(embCandidate);
          const embVector = await generateEmbedding(profileText);
          await saveEmbedding(this.dataSource, candidateId, embVector);
          this.logger.log(`Embedding generated for candidate ${candidateId}`);
        }
      } catch (embErr) {
        this.logger.warn(
          `Embedding failed for ${candidateId}: ${embErr instanceof Error ? embErr.message : 'unknown'}`,
        );
      }

      // Step 7: AI Scoring (не блокирует основной pipeline)
      try {
        await this.scoreCandidateInternal(candidateId);
      } catch (scoreError) {
        this.logger.warn(
          `AI scoring failed for ${candidateId}: ${scoreError instanceof Error ? scoreError.message : 'unknown'}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Неизвестная ошибка';
      this.logger.error(
        `Processing failed for candidate ${candidateId}: ${message}`,
      );

      await this.candidateRepo.update(candidateId, {
        processingStatus: ResumeProcessingStatus.FAILED,
        processingError: message,
      });
    }
  }

  /**
   * Save AI-parsed data to the candidate and related tables.
   * Deletes and recreates workHistory, education, and cmeCourses.
   */
  private async saveParsedData(
    candidateId: string,
    data: Awaited<ReturnType<typeof parseCvText>>,
  ): Promise<void> {
    const specs = await this.getAllSpecializations();

    const normalizedSpec = await this.normalizeSpecialization(
      data.specialization,
      specs,
    );
    const normalizedAdditional = await Promise.all(
      data.additionalSpecializations.map(async (s) =>
        (await this.normalizeSpecialization(s, specs)) ?? s,
      ),
    );

    await this.dataSource.transaction(async (manager) => {
      // Update the candidate entity with all parsed fields
      await manager.update(ResumeCandidate, candidateId, {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        birthDate: parseDate(data.birthDate),
        city: data.city,
        gender:
          (data.gender as ResumeCandidateGender) ||
          ResumeCandidateGender.UNKNOWN,
        university: data.university,
        faculty: data.faculty,
        graduationYear: data.graduationYear,
        internshipPlace: data.internshipPlace,
        internshipSpecialty: data.internshipSpecialty,
        internshipYearEnd: data.internshipYearEnd,
        residencyPlace: data.residencyPlace,
        residencySpecialty: data.residencySpecialty,
        residencyYearEnd: data.residencyYearEnd,
        specialization: normalizedSpec,
        additionalSpecializations: normalizedAdditional,
        qualificationCategory:
          (data.qualificationCategory as ResumeQualificationCategory) ||
          ResumeQualificationCategory.NONE,
        categoryAssignedDate: parseDate(data.categoryAssignedDate),
        accreditationStatus: data.accreditationStatus,
        accreditationDate: parseDate(data.accreditationDate),
        accreditationExpiryDate: parseDate(data.accreditationExpiryDate),
        certificateNumber: data.certificateNumber,
        certificateIssueDate: parseDate(data.certificateIssueDate),
        certificateExpiryDate: parseDate(data.certificateExpiryDate),
        totalExperienceYears: data.totalExperienceYears,
        specialtyExperienceYears: data.specialtyExperienceYears,
        nmoPoints: data.nmoPoints,
        publications: data.publications,
        languages: data.languages,
        additionalSkills: data.additionalSkills,
        desiredSalary: data.desiredSalary,
        desiredSalaryType: data.desiredSalaryType as any || null,
      });

      // Delete + recreate work history
      await manager.delete(ResumeWorkHistory, { candidateId });
      if (data.workHistory.length > 0) {
        const workHistoryEntities = data.workHistory.map((wh) =>
          manager.create(ResumeWorkHistory, {
            candidateId,
            organization: wh.organization,
            position: wh.position,
            department: wh.department,
            city: wh.city,
            startDate: parseDate(wh.startDate),
            endDate: parseDate(wh.endDate),
            isCurrent: wh.isCurrent,
            description: wh.description,
          }),
        );
        await manager.save(ResumeWorkHistory, workHistoryEntities);
      }

      // Delete + recreate education
      await manager.delete(ResumeEducation, { candidateId });
      if (data.education.length > 0) {
        const educationEntities = data.education.map((edu) =>
          manager.create(ResumeEducation, {
            candidateId,
            institution: edu.institution,
            faculty: edu.faculty,
            specialty: edu.specialty,
            degree: edu.degree,
            city: edu.city,
            startYear: edu.startYear,
            endYear: edu.endYear,
            type: edu.type,
          }),
        );
        await manager.save(ResumeEducation, educationEntities);
      }

      // Delete + recreate CME courses
      await manager.delete(ResumeCmeCourse, { candidateId });
      if (data.cmeCourses.length > 0) {
        const cmeEntities = data.cmeCourses.map((course) =>
          manager.create(ResumeCmeCourse, {
            candidateId,
            courseName: course.courseName,
            provider: course.provider,
            completedAt: parseDate(course.completedAt),
            hours: course.hours,
            nmoPoints: course.nmoPoints,
            certificateNumber: course.certificateNumber,
          }),
        );
        await manager.save(ResumeCmeCourse, cmeEntities);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Processing Queue
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add a candidate to the processing queue and start the queue if not running.
   */
  enqueueProcessing(candidateId: string): void {
    this.processingQueue.add(candidateId);
    if (!this.isProcessingRunning) {
      void this.runProcessingQueue();
    }
  }

  /**
   * Process candidates one at a time from the queue.
   */
  async runProcessingQueue(): Promise<void> {
    if (this.isProcessingRunning) return;
    this.isProcessingRunning = true;

    try {
      while (this.processingQueue.size > 0) {
        const iterator = this.processingQueue.values();
        const next = iterator.next();
        if (next.done) break;

        const candidateId = next.value;
        this.processingQueue.delete(candidateId);

        try {
          await this.processCandidate(candidateId);
        } catch (error) {
          this.logger.error(
            `Queue processing error for candidate ${candidateId}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    } finally {
      this.isProcessingRunning = false;
    }
  }

  /**
   * Find PENDING candidates and enqueue them for processing (worker polling).
   */
  async processPendingCandidates(batchSize = 10): Promise<number> {
    const pendingCandidates = await this.candidateRepo.find({
      where: { processingStatus: ResumeProcessingStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: batchSize,
      select: ['id'],
    });

    for (const candidate of pendingCandidates) {
      this.enqueueProcessing(candidate.id);
    }

    return pendingCandidates.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CRUD — Candidates
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List candidates with 11 filters + pagination.
   */
  async findCandidates(
    filters: CandidateListFilters,
  ): Promise<{ data: ResumeCandidate[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);

    const qb = this.candidateRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.tags', 'tags');

    // Priority filter: hide DELETED and ARCHIVE by default
    if (filters.priority === 'DELETED') {
      qb.where('c.priority = :priority', { priority: ResumeCandidatePriority.DELETED });
    } else if (filters.priority === 'ARCHIVE') {
      qb.where('c.priority = :priority', { priority: ResumeCandidatePriority.ARCHIVE });
    } else {
      qb.where('c.priority NOT IN (:...hidden)', {
        hidden: [ResumeCandidatePriority.DELETED, ResumeCandidatePriority.ARCHIVE],
      });
      if (filters.priority) {
        qb.andWhere('c.priority = :priority', { priority: filters.priority });
      }
    }

    // Search across fullName, email, phone, specialization, additionalSpecializations
    if (filters.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('c.fullName ILIKE :search', {
              search: `%${filters.search}%`,
            })
            .orWhere('c.email ILIKE :search', {
              search: `%${filters.search}%`,
            })
            .orWhere('c.phone ILIKE :search', {
              search: `%${filters.search}%`,
            })
            .orWhere('c.specialization ILIKE :search', {
              search: `%${filters.search}%`,
            })
            .orWhere("array_to_string(c.\"additionalSpecializations\", ',') ILIKE :search", {
              search: `%${filters.search}%`,
            });
        }),
      );
    }

    if (filters.status) {
      qb.andWhere('c.status = :status', { status: filters.status });
    }

    if (filters.specialization) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('c.specialization = :specFilter', { specFilter: filters.specialization })
            .orWhere(':specFilter = ANY(c."additionalSpecializations")', { specFilter: filters.specialization });
        }),
      );
    }

    if (filters.qualificationCategory) {
      qb.andWhere('c.qualificationCategory = :qualificationCategory', {
        qualificationCategory: filters.qualificationCategory,
      });
    }

    if (filters.branch) {
      qb.andWhere(':branch = ANY(c.branches)', { branch: filters.branch });
    }

    if (filters.doctorType) {
      qb.andWhere(':doctorType = ANY(c.doctorTypes)', {
        doctorType: filters.doctorType,
      });
    }

    if (filters.processingStatus) {
      qb.andWhere('c.processingStatus = :processingStatus', {
        processingStatus: filters.processingStatus,
      });
    }

    if (filters.experienceMin !== undefined) {
      qb.andWhere('c.totalExperienceYears >= :expMin', {
        expMin: filters.experienceMin,
      });
    }

    if (filters.experienceMax !== undefined) {
      qb.andWhere('c.totalExperienceYears < :expMax', {
        expMax: filters.experienceMax,
      });
    }

    if (filters.city) {
      qb.andWhere('c.city = :city', { city: filters.city });
    }

    if (filters.workCity) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM resume_work_history wh WHERE wh."candidateId" = c.id AND wh.city = :workCity)`,
        { workCity: filters.workCity },
      );
    }

    if (filters.educationCity) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM resume_education edu WHERE edu."candidateId" = c.id AND edu.city = :educationCity)`,
        { educationCity: filters.educationCity },
      );
    }

    if (filters.tag) {
      qb.andWhere('tags.label = :tagLabel', { tagLabel: filters.tag });
    }

    if (filters.scoreMin !== undefined) {
      qb.andWhere('c.aiScore >= :scoreMin', { scoreMin: filters.scoreMin });
    }

    if (filters.scoreMax !== undefined) {
      qb.andWhere('c.aiScore <= :scoreMax', { scoreMax: filters.scoreMax });
    }

    // Dynamic sorting with whitelist
    const sortColumn = ALLOWED_SORT_COLUMNS[filters.sort || ''] || 'c.createdAt';
    const sortOrder: 'ASC' | 'DESC' = filters.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortColumn, sortOrder, sortColumn !== 'c.createdAt' ? 'NULLS LAST' : undefined)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Get a single candidate with all relations.
   */
  async findCandidateById(id: string): Promise<ResumeCandidate> {
    const candidate = await this.candidateRepo.findOne({
      where: { id },
      relations: [
        'uploadedFile',
        'workHistory',
        'education',
        'cmeCourses',
        'notes',
        'tags',
      ],
    });

    if (!candidate) {
      throw new NotFoundException('Кандидат не найден');
    }

    // Sort relations in-memory (TypeORM find options order is limited)
    if (candidate.workHistory) {
      candidate.workHistory.sort((a, b) => {
        const aDate = a.startDate ? a.startDate.getTime() : 0;
        const bDate = b.startDate ? b.startDate.getTime() : 0;
        return bDate - aDate;
      });
    }
    if (candidate.education) {
      candidate.education.sort((a, b) => (b.endYear || 0) - (a.endYear || 0));
    }
    if (candidate.cmeCourses) {
      candidate.cmeCourses.sort((a, b) => {
        const aDate = a.completedAt ? a.completedAt.getTime() : 0;
        const bDate = b.completedAt ? b.completedAt.getTime() : 0;
        return bDate - aDate;
      });
    }
    if (candidate.notes) {
      candidate.notes.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    }

    return candidate;
  }

  /**
   * Update candidate fields.
   */
  async updateCandidate(
    id: string,
    dto: UpdateCandidateDto,
  ): Promise<ResumeCandidate> {
    const candidate = await this.candidateRepo.findOne({ where: { id } });

    if (!candidate) {
      throw new NotFoundException('Кандидат не найден');
    }

    // Build update data, converting date strings to Date objects where needed
    const updateData: Partial<ResumeCandidate> = {};

    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.university !== undefined) updateData.university = dto.university;
    if (dto.faculty !== undefined) updateData.faculty = dto.faculty;
    if (dto.graduationYear !== undefined)
      updateData.graduationYear = dto.graduationYear;
    if (dto.internshipPlace !== undefined)
      updateData.internshipPlace = dto.internshipPlace;
    if (dto.internshipSpecialty !== undefined)
      updateData.internshipSpecialty = dto.internshipSpecialty;
    if (dto.internshipYearEnd !== undefined)
      updateData.internshipYearEnd = dto.internshipYearEnd;
    if (dto.residencyPlace !== undefined)
      updateData.residencyPlace = dto.residencyPlace;
    if (dto.residencySpecialty !== undefined)
      updateData.residencySpecialty = dto.residencySpecialty;
    if (dto.residencyYearEnd !== undefined)
      updateData.residencyYearEnd = dto.residencyYearEnd;
    if (dto.specialization !== undefined)
      updateData.specialization = dto.specialization;
    if (dto.additionalSpecializations !== undefined)
      updateData.additionalSpecializations = dto.additionalSpecializations;
    if (dto.qualificationCategory !== undefined)
      updateData.qualificationCategory = dto.qualificationCategory;
    if (dto.categoryAssignedDate !== undefined)
      updateData.categoryAssignedDate = parseDate(dto.categoryAssignedDate);
    if (dto.categoryExpiryDate !== undefined)
      updateData.categoryExpiryDate = parseDate(dto.categoryExpiryDate);
    if (dto.accreditationStatus !== undefined)
      updateData.accreditationStatus = dto.accreditationStatus;
    if (dto.accreditationDate !== undefined)
      updateData.accreditationDate = parseDate(dto.accreditationDate);
    if (dto.accreditationExpiryDate !== undefined)
      updateData.accreditationExpiryDate = parseDate(
        dto.accreditationExpiryDate,
      );
    if (dto.certificateNumber !== undefined)
      updateData.certificateNumber = dto.certificateNumber;
    if (dto.certificateIssueDate !== undefined)
      updateData.certificateIssueDate = parseDate(dto.certificateIssueDate);
    if (dto.certificateExpiryDate !== undefined)
      updateData.certificateExpiryDate = parseDate(dto.certificateExpiryDate);
    if (dto.totalExperienceYears !== undefined)
      updateData.totalExperienceYears = dto.totalExperienceYears;
    if (dto.specialtyExperienceYears !== undefined)
      updateData.specialtyExperienceYears = dto.specialtyExperienceYears;
    if (dto.nmoPoints !== undefined) updateData.nmoPoints = dto.nmoPoints;
    if (dto.publications !== undefined)
      updateData.publications = dto.publications;
    if (dto.additionalSkills !== undefined)
      updateData.additionalSkills = dto.additionalSkills;
    if (dto.languages !== undefined) updateData.languages = dto.languages;
    if (dto.branches !== undefined) updateData.branches = dto.branches;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.doctorTypes !== undefined) updateData.doctorTypes = dto.doctorTypes;
    if (dto.desiredSalary !== undefined)
      updateData.desiredSalary = dto.desiredSalary;
    if (dto.desiredSalaryType !== undefined)
      updateData.desiredSalaryType = dto.desiredSalaryType;

    await this.candidateRepo.update(id, updateData);

    // Инвалидируем эмбеддинг при изменении содержательных полей профиля
    const embeddingFields = new Set([
      'fullName', 'city', 'university', 'faculty', 'graduationYear',
      'internshipPlace', 'internshipSpecialty', 'residencyPlace', 'residencySpecialty',
      'specialization', 'additionalSpecializations', 'qualificationCategory',
      'totalExperienceYears', 'specialtyExperienceYears',
      'nmoPoints', 'publications', 'additionalSkills', 'languages',
      'accreditationStatus', 'desiredSalary', 'desiredSalaryType',
    ]);
    const changedKeys = Object.keys(updateData);
    if (changedKeys.some(k => embeddingFields.has(k))) {
      await this.dataSource.query(
        `UPDATE resume_candidates SET embedding = NULL WHERE id = $1`,
        [id],
      );
    }

    return this.candidateRepo.findOneOrFail({ where: { id } });
  }

  /**
   * Soft-delete (set priority=DELETED) or permanently delete a candidate.
   */
  async softDeleteCandidate(
    id: string,
    permanent = false,
  ): Promise<void> {
    const candidate = await this.candidateRepo.findOne({ where: { id } });

    if (!candidate) {
      throw new NotFoundException('Кандидат не найден');
    }

    if (permanent) {
      await this.candidateRepo.remove(candidate);
    } else {
      await this.candidateRepo.update(id, {
        priority: ResumeCandidatePriority.DELETED,
      });
    }
  }

  /**
   * Restore a soft-deleted candidate (set priority=ACTIVE).
   */
  async restoreCandidate(id: string): Promise<void> {
    const candidate = await this.candidateRepo.findOne({ where: { id } });

    if (!candidate) {
      throw new NotFoundException('Кандидат не найден');
    }

    await this.candidateRepo.update(id, {
      priority: ResumeCandidatePriority.ACTIVE,
    });
  }

  /**
   * Reset a candidate to PENDING and re-enqueue for processing.
   */
  async reprocessCandidate(id: string): Promise<void> {
    const candidate = await this.candidateRepo.findOne({ where: { id } });

    if (!candidate) {
      throw new NotFoundException('Кандидат не найден');
    }

    await this.candidateRepo.update(id, {
      processingStatus: ResumeProcessingStatus.PENDING,
      processingError: null,
      aiConfidence: null,
    });

    this.enqueueProcessing(id);
  }

  /**
   * Дополнить резюме кандидата текстом и перепарсить.
   * Текст дописывается к rawText через разделитель, затем запускается полный пайплайн обработки.
   */
  async supplementCandidate(id: string, additionalText: string): Promise<void> {
    const candidate = await this.candidateRepo.findOne({ where: { id } });

    if (!candidate) {
      throw new NotFoundException('Кандидат не найден');
    }

    const separator = '\n\n--- Дополнение от рекрутера ---\n\n';
    const newRawText = (candidate.rawText || '') + separator + additionalText.trim();

    await this.candidateRepo.update(id, {
      rawText: newRawText,
      processingStatus: ResumeProcessingStatus.PENDING,
      processingError: null,
      aiConfidence: null,
    });

    this.enqueueProcessing(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Embeddings
  // ═══════════════════════════════════════════════════════════════════════════

  async getEmbeddingsStatus(): Promise<{ total: number; ready: number; pending: number }> {
    const rows = await this.dataSource.query(
      `SELECT
        COUNT(*) FILTER (WHERE priority NOT IN ('DELETED', 'ARCHIVE') AND "processingStatus" = 'COMPLETED') AS total,
        COUNT(*) FILTER (WHERE priority NOT IN ('DELETED', 'ARCHIVE') AND "processingStatus" = 'COMPLETED' AND embedding IS NOT NULL) AS ready
      FROM resume_candidates`,
    );
    const total = Number(rows[0]?.total || 0);
    const ready = Number(rows[0]?.ready || 0);
    return { total, ready, pending: total - ready };
  }

  /**
   * Запускает фоновую генерацию эмбеддингов. Возвращает управление сразу.
   */
  startEmbeddingGeneration(batchSize = 20): { message: string } {
    const pending = this.dataSource.query(
      `SELECT COUNT(*) as cnt FROM resume_candidates
       WHERE embedding IS NULL AND priority NOT IN ('DELETED', 'ARCHIVE')
         AND "processingStatus" = 'COMPLETED'`,
    ).then((r) => Number(r[0]?.cnt || 0));

    pending.then((count) => {
      if (count === 0) {
        this.logger.log('Все кандидаты уже имеют эмбеддинги');
        return;
      }
      this.logger.log(`Запуск фоновой генерации эмбеддингов для ${count} кандидатов`);
      this.generateMissingEmbeddings(batchSize).then((result) => {
        this.logger.log(`Генерация эмбеддингов завершена: ${result.processed} обработано, ${result.errors} ошибок`);
      }).catch((err) => {
        this.logger.error(`Ошибка генерации эмбеддингов: ${err instanceof Error ? err.message : 'unknown'}`);
      });
    });

    return { message: 'Генерация эмбеддингов запущена в фоне' };
  }

  async generateMissingEmbeddings(batchSize = 20): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    while (true) {
      const candidateRows: { id: string }[] = await this.dataSource.query(
        `SELECT id FROM resume_candidates
         WHERE embedding IS NULL
           AND priority NOT IN ('DELETED', 'ARCHIVE')
           AND "processingStatus" = 'COMPLETED'
         ORDER BY "createdAt" DESC
         LIMIT $1`,
        [batchSize],
      );

      if (candidateRows.length === 0) break;

      // Загружаем полные данные кандидатов параллельно
      const candidates = (await Promise.all(
        candidateRows.map(({ id }) =>
          this.candidateRepo.findOne({ where: { id }, relations: ['workHistory', 'cmeCourses'] }),
        ),
      )).filter(Boolean) as ResumeCandidate[];

      if (candidates.length === 0) break;

      // Строим тексты профилей
      const texts = candidates.map((c) => buildCandidateProfileText(c));

      try {
        // Batch-вызов Ollama — один запрос на весь batch
        const embeddings = await generateEmbeddingsBatch(texts);

        // Сохраняем параллельно
        const saveResults = await Promise.allSettled(
          candidates.map((c, i) => saveEmbedding(this.dataSource, c.id, embeddings[i])),
        );

        for (const r of saveResults) {
          if (r.status === 'fulfilled') processed++;
          else errors++;
        }
      } catch (err) {
        this.logger.warn(`Batch embedding failed: ${err instanceof Error ? err.message : 'unknown'}`);
        errors += candidates.length;
      }
    }

    return { processed, errors };
  }

  /**
   * Гибридный AI поиск: LLM анализирует запрос → SQL бонус + Embedding ранжирование.
   * SQL условия от LLM — НЕ фильтры, а бонус к скору. Все кандидаты видны через embedding.
   */
  async semanticSearch(
    query: string,
    limit = 20,
    _threshold = 0.55,
    filters?: {
      specialization?: string; branch?: string; status?: string;
      priority?: string; doctorType?: string; qualificationCategory?: string;
      city?: string; workCity?: string; educationCity?: string;
      experienceMin?: number; experienceMax?: number;
      accreditation?: string; scoreMin?: number;
    },
  ) {
    const analysis = await analyzeSearchQuery(query);
    this.logger.debug(`Search analysis: ${JSON.stringify(analysis)}`);

    // Embedding всегда генерируется (semanticQuery всегда заполнен после analyzeSearchQuery)
    const queryEmbedding = await generateEmbedding(analysis.semanticQuery);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const selectFields = `c.id, c."fullName", c.specialization, c."aiScore", c.phone, c.email,
      c."qualificationCategory", c."totalExperienceYears", c.city, c.status, c.priority,
      c."processingStatus", c.branches, c."doctorTypes",
      c."desiredSalary", c."desiredSalaryType"`;

    const params: unknown[] = [vectorStr];
    let paramIndex = 2;

    // UI дроп-даун фильтры — жёсткие (пользователь выбрал явно)
    let uiWhere = '';
    if (filters?.specialization) {
      uiWhere += ` AND (c.specialization = $${paramIndex} OR $${paramIndex} = ANY(c."additionalSpecializations"))`;
      params.push(filters.specialization);
      paramIndex++;
    }
    if (filters?.branch) {
      uiWhere += ` AND $${paramIndex} = ANY(c.branches)`;
      params.push(filters.branch);
      paramIndex++;
    }
    if (filters?.status) {
      uiWhere += ` AND c.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters?.priority) {
      uiWhere += ` AND c.priority = $${paramIndex}`;
      params.push(filters.priority);
      paramIndex++;
    }
    if (filters?.doctorType) {
      uiWhere += ` AND $${paramIndex} = ANY(c."doctorTypes")`;
      params.push(filters.doctorType);
      paramIndex++;
    }
    if (filters?.qualificationCategory) {
      uiWhere += ` AND c."qualificationCategory" = $${paramIndex}`;
      params.push(filters.qualificationCategory);
      paramIndex++;
    }
    if (filters?.city) {
      uiWhere += ` AND c.city ILIKE $${paramIndex}`;
      params.push(`%${filters.city}%`);
      paramIndex++;
    }
    if (filters?.workCity) {
      uiWhere += ` AND EXISTS (SELECT 1 FROM resume_work_history wh WHERE wh."candidateId" = c.id AND wh.city ILIKE $${paramIndex})`;
      params.push(`%${filters.workCity}%`);
      paramIndex++;
    }
    if (filters?.educationCity) {
      uiWhere += ` AND EXISTS (SELECT 1 FROM resume_education ed WHERE ed."candidateId" = c.id AND ed.city ILIKE $${paramIndex})`;
      params.push(`%${filters.educationCity}%`);
      paramIndex++;
    }
    if (filters?.experienceMin !== undefined) {
      uiWhere += ` AND c."totalExperienceYears" >= $${paramIndex}`;
      params.push(filters.experienceMin);
      paramIndex++;
    }
    if (filters?.experienceMax !== undefined) {
      uiWhere += ` AND c."totalExperienceYears" <= $${paramIndex}`;
      params.push(filters.experienceMax);
      paramIndex++;
    }
    if (filters?.accreditation) {
      if (filters.accreditation === 'valid') {
        uiWhere += ` AND c."accreditationStatus" = true`;
      } else if (filters.accreditation === 'expired') {
        uiWhere += ` AND c."accreditationStatus" = false`;
      }
    }
    if (filters?.scoreMin !== undefined) {
      uiWhere += ` AND c."aiScore" >= $${paramIndex}`;
      params.push(filters.scoreMin);
      paramIndex++;
    }

    // LLM SQL условия → CASE WHEN (мягкий бонус, НЕ фильтр)
    const hasSql = analysis.sqlConditions.length > 0;
    let sqlCaseExpr = '0';
    if (hasSql) {
      const clauses: string[] = [];
      for (const cond of analysis.sqlConditions) {
        let clause = cond.clause;
        for (let i = cond.params.length; i >= 1; i--) {
          clause = clause.split(`$${i}`).join(`$${paramIndex + i - 1}`);
        }
        clauses.push(`(${clause})`);
        params.push(...cond.params);
        paramIndex += cond.params.length;
      }
      sqlCaseExpr = `CASE WHEN ${clauses.join(' AND ')} THEN 1 ELSE 0 END`;
    }

    const fetchLimit = Math.min(limit * 5, 200);
    params.push(fetchLimit);

    const sql = `SELECT ${selectFields},
      (c.embedding <=> $1::vector) AS distance,
      ${sqlCaseExpr} AS sql_match
    FROM resume_candidates c
    WHERE c.embedding IS NOT NULL
      AND c.priority NOT IN ('DELETED', 'ARCHIVE')${uiWhere}
    ORDER BY distance ASC
    LIMIT $${paramIndex}`;

    let rows: Record<string, unknown>[];
    try {
      this.logger.debug(`Executing SQL: ${sql}`);
      rows = await this.dataSource.query(sql, params);
    } catch (err) {
      this.logger.error(`LLM SQL failed: ${err instanceof Error ? err.message : 'unknown'}, fallback`);
      rows = await this.dataSource.query(
        `SELECT ${selectFields}, (c.embedding <=> $1::vector) AS distance, 0 AS sql_match
         FROM resume_candidates c
         WHERE c.embedding IS NOT NULL AND c.priority NOT IN ('DELETED', 'ARCHIVE')
         ORDER BY distance ASC LIMIT $2`,
        [vectorStr, fetchLimit],
      );
    }

    // Scoring — адаптивная нормализация + SQL бонус
    const allSimilarities = rows.map((r) => 1 - Number(r.distance));
    const bestSimilarity = allSimilarities.length > 0 ? Math.max(...allSimilarities) : 0;
    const worstSimilarity = allSimilarities.length > 1 ? Math.min(...allSimilarities) : 0;
    const simFloor = Math.max(0.05, worstSimilarity - 0.02);
    const simCeiling = Math.max(0.3, bestSimilarity + 0.05);
    const simRange = Math.max(simCeiling - simFloor, 0.05);
    this.logger.debug(`Scoring: bestSim=${bestSimilarity.toFixed(3)}, floor=${simFloor.toFixed(3)}, ceiling=${simCeiling.toFixed(3)}, hasSql=${hasSql}`);

    const scored = rows.map((r: Record<string, unknown>) => {
      const id = r.id as string;
      const distance = Number(r.distance);
      const similarity = 1 - distance;
      const sqlMatch = Number(r.sql_match) === 1;

      // Адаптивная нормализация: simFloor→0%, simCeiling→100%
      const normSim = Math.min(100, Math.max(0, ((similarity - simFloor) / simRange) * 100));

      let matchScore: number;
      if (hasSql && sqlMatch) {
        // SQL совпал → бонус: embedding ранжирует в диапазоне 50-100%
        matchScore = Math.round(50 + normSim * 0.5);
      } else if (hasSql && !sqlMatch) {
        // SQL не совпал → embedding ранжирует в диапазоне 0-45%
        matchScore = Math.round(normSim * 0.45);
      } else {
        // Нет SQL условий → чистый embedding 0-100%
        matchScore = Math.round(normSim);
      }

      let relevanceLevel: 'high' | 'medium' | 'low' = 'low';
      if (matchScore >= 75) relevanceLevel = 'high';
      else if (matchScore >= 45) relevanceLevel = 'medium';

      return {
        ...r,
        id,
        distance,
        similarity: Math.round(similarity * 100) / 100,
        matchScore,
        relevanceLevel,
        sqlMatch,
      };
    });

    const result = scored
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    // Загрузить workHistory + additionalSpecializations для snippet-ов
    const topIds = result.map((r) => r.id as string);
    const whRows: { candidateId: string; position: string; organization: string; city: string }[] =
      topIds.length > 0
        ? await this.dataSource.query(
            `SELECT wh."candidateId", wh.position, wh.organization, wh.city
             FROM resume_work_history wh WHERE wh."candidateId" = ANY($1)
             ORDER BY wh."startDate" DESC NULLS LAST`,
            [topIds],
          )
        : [];
    const whMap = new Map<string, typeof whRows>();
    for (const wh of whRows) {
      if (!whMap.has(wh.candidateId)) whMap.set(wh.candidateId, []);
      whMap.get(wh.candidateId)!.push(wh);
    }

    // Дополнительные специализации + навыки
    const extraRows: { id: string; additionalSpecializations: string[]; additionalSkills: string | null }[] =
      topIds.length > 0
        ? await this.dataSource.query(
            `SELECT id, "additionalSpecializations", "additionalSkills" FROM resume_candidates WHERE id = ANY($1)`,
            [topIds],
          )
        : [];
    const addSpecMap = new Map(extraRows.map((r) => [r.id, r.additionalSpecializations || []]));
    const skillsMap = new Map(extraRows.map((r) => [r.id, r.additionalSkills || '']));

    // Курсы повышения квалификации
    const cmeRows: { candidateId: string; courseName: string }[] =
      topIds.length > 0
        ? await this.dataSource.query(
            `SELECT "candidateId", "courseName" FROM resume_cme_courses WHERE "candidateId" = ANY($1) AND "courseName" IS NOT NULL`,
            [topIds],
          )
        : [];
    const cmeMap = new Map<string, string[]>();
    for (const cme of cmeRows) {
      if (!cmeMap.has(cme.candidateId)) cmeMap.set(cme.candidateId, []);
      cmeMap.get(cme.candidateId)!.push(cme.courseName);
    }

    // Ключевые слова для подсветки релевантности
    const queryWords = (query + ' ' + (analysis.semanticQuery || ''))
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const dataWithSnippets = result.map((r) => {
      const id = r.id as string;
      const wh = whMap.get(id) || [];
      const addSpecs = addSpecMap.get(id) || [];
      const skills = skillsMap.get(id) || '';
      const courses = cmeMap.get(id) || [];
      const sqlMatch = !!r.sqlMatch;

      const snippet = this.buildSearchSnippet(r, wh, addSpecs, skills, courses, queryWords);

      // Тип совпадения: почему кандидат в выдаче
      let matchReason: string;
      if (hasSql && sqlMatch) {
        matchReason = 'Совпадение по критериям поиска';
      } else if (hasSql && !sqlMatch) {
        matchReason = 'Похожий профиль (по смыслу)';
      } else {
        matchReason = 'Семантическая близость к запросу';
      }

      return { ...r, snippet, matchReason };
    });

    return {
      data: dataWithSnippets,
      query,
      queryAnalysis: {
        sqlConditions: analysis.sqlConditions.length,
        semanticQuery: analysis.semanticQuery || null,
        explanation: analysis.explanation,
      },
      total: dataWithSnippets.length,
    };
  }

  /**
   * Формирует snippet — вырезку из данных кандидата, релевантную поисковому запросу.
   */
  private buildSearchSnippet(
    candidate: Record<string, unknown>,
    workHistory: { position: string; organization: string; city: string }[],
    additionalSpecs: string[],
    skills: string,
    courses: string[],
    queryWords: string[],
  ): string {
    const facts: string[] = [];

    // Специализация
    const spec = candidate.specialization as string | null;
    if (spec) facts.push('Специализация: ' + spec);

    // Доп. специализации
    if (additionalSpecs.length > 0) {
      facts.push('Доп. специализации: ' + additionalSpecs.join(', '));
    }

    // Навыки
    if (skills) {
      facts.push('Навыки: ' + skills);
    }

    // Курсы повышения квалификации
    if (courses.length > 0) {
      facts.push('Курсы: ' + courses.slice(0, 5).join(', '));
    }

    // Опыт работы
    for (const wh of workHistory.slice(0, 5)) {
      const parts = [wh.position, wh.organization].filter(Boolean);
      if (wh.city) parts.push(wh.city);
      facts.push(parts.join(' — '));
    }

    // Зарплата
    const salary = candidate.desiredSalary as number | null;
    if (salary != null) {
      const salaryType = candidate.desiredSalaryType === 'PERCENT_OF_VISIT' ? '% от приёма' : 'руб.';
      facts.push(`Зарплата: ${salary.toLocaleString('ru-RU')} ${salaryType}`);
    }

    // Ранжируем факты по релевантности запросу (частичное совпадение тоже считается)
    const scored = facts.map((fact) => {
      const lower = fact.toLowerCase();
      let score = 0;
      for (const w of queryWords) {
        if (lower.includes(w)) score += 2; // точное вхождение
        // Проверяем корень слова (первые 4+ символов)
        if (w.length >= 4) {
          const stem = w.slice(0, Math.min(w.length - 1, 6));
          if (lower.includes(stem)) score += 1;
        }
      }
      return { fact, score };
    });
    scored.sort((a, b) => b.score - a.score);

    // Берём top-3: сначала релевантные, потом любые
    const relevant = scored.filter((s) => s.score > 0).slice(0, 3);
    if (relevant.length > 0) {
      return relevant.map((s) => s.fact).join(' | ');
    }
    // Fallback: первые 2 факта
    return scored.slice(0, 2).map((s) => s.fact).join(' | ');
  }

  /**
   * Найти N ближайших кандидатов по embedding cosine distance.
   */
  async findSimilarByEmbedding(
    candidateId: string,
    limit = 10,
    maxDistance = 0.55,
  ) {
    const [candidateEmb] = await this.dataSource.query(
      `SELECT embedding FROM resume_candidates WHERE id = $1`,
      [candidateId],
    );

    if (!candidateEmb?.embedding) {
      return [];
    }

    const rows = await this.dataSource.query(
      `SELECT c.id, c."fullName", c.specialization, c."aiScore",
              c.city, c."totalExperienceYears", c."qualificationCategory",
              (c.embedding <=> (SELECT embedding FROM resume_candidates WHERE id = $1)) AS distance
       FROM resume_candidates c
       WHERE c.id != $1
         AND c.embedding IS NOT NULL
         AND c.priority NOT IN ('DELETED', 'ARCHIVE')
         AND (c.embedding <=> (SELECT embedding FROM resume_candidates WHERE id = $1)) < $2
       ORDER BY distance ASC
       LIMIT $3`,
      [candidateId, maxDistance, limit],
    );

    return rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      fullName: r.fullName,
      specialization: r.specialization,
      aiScore: r.aiScore,
      city: r.city,
      totalExperienceYears: r.totalExperienceYears,
      qualificationCategory: r.qualificationCategory,
      distance: Number(r.distance),
      similarity: Math.round((1 - Number(r.distance)) * 100) / 100,
    }));
  }

  /**
   * Найти похожих кандидатов через embedding для контекста скоринга.
   * Возвращает compact profiles (как findSimilarBySQL).
   */
  private async findSimilarCandidatesForScoring(
    candidateId: string,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT c.id FROM resume_candidates c
       WHERE c.id != $1
         AND c.embedding IS NOT NULL
         AND c.priority NOT IN ('DELETED', 'ARCHIVE')
       ORDER BY c.embedding <=> (SELECT embedding FROM resume_candidates WHERE id = $1)
       LIMIT $2`,
      [candidateId, limit],
    );

    if (rows.length === 0) throw new Error('No embeddings available');

    const ids = rows.map((r: { id: string }) => r.id);
    const candidates = await this.candidateRepo.find({
      where: { id: In(ids) },
      relations: ['workHistory'],
    });

    return candidates.map(c => buildCompactProfile(c));
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  Create Candidate from Raw Text
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a candidate from raw text (paste) and enqueue processing.
   */
  async createCandidateFromText(rawText: string): Promise<ResumeCandidate> {
    const candidate = this.candidateRepo.create({
      fullName: 'Обработка...',
      rawText,
      processingStatus: ResumeProcessingStatus.PENDING,
      branches: [],
    });

    const saved = await this.candidateRepo.save(candidate);

    this.enqueueProcessing(saved.id);

    return saved;
  }

  /**
   * Create a candidate from an uploaded file and enqueue processing.
   */
  async createCandidateFromFile(
    file: Express.Multer.File,
  ): Promise<{ candidateId: string; fileName: string }> {
    const uploadedFile = await this.uploadFile(file);

    const candidate = this.candidateRepo.create({
      fullName: file.originalname.replace(/\.[^/.]+$/, ''),
      uploadedFileId: uploadedFile.id,
      processingStatus: ResumeProcessingStatus.PENDING,
      branches: [],
    });

    const saved = await this.candidateRepo.save(candidate);

    this.enqueueProcessing(saved.id);

    return { candidateId: saved.id, fileName: file.originalname };
  }

  /**
   * Create a candidate from a URL (link to a resume page).
   * Scrapes the page, extracts text, and enqueues processing.
   */
  async createCandidateFromUrl(
    url: string,
  ): Promise<{ candidateId: string; url: string }> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error();
      }
    } catch {
      throw new BadRequestException(
        'Некорректный URL. Укажите ссылку, начинающуюся с http:// или https://',
      );
    }

    const candidate = this.candidateRepo.create({
      fullName: `Загрузка с ${parsedUrl.hostname}...`,
      processingStatus: ResumeProcessingStatus.PENDING,
      branches: [],
    });
    const saved = await this.candidateRepo.save(candidate);

    void this.processUrl(saved.id, url);

    return { candidateId: saved.id, url };
  }

  /**
   * Background URL processing: scrape → extract text → processCandidate.
   */
  private async processUrl(
    candidateId: string,
    url: string,
  ): Promise<void> {
    try {
      await this.candidateRepo.update(candidateId, {
        processingStatus: ResumeProcessingStatus.EXTRACTING,
      });

      const { scrapeUrl } = await import('./extractors/url-scraper');
      const result = await scrapeUrl(url);

      let rawText: string;

      if (result.contentType === 'html') {
        // HTML → cheerio уже извлёк текст, AI чистит от мусора
        const pageText = result.text || '';
        if (pageText.length < 50) {
          throw new Error(
            `Не удалось извлечь текст со страницы (${result.siteType})`,
          );
        }

        // Для известных сайтов (hh.ru) текст уже чистый, для остальных — AI
        if (result.siteType === 'hh') {
          rawText = pageText;
        } else {
          const { extractResumeFromPageText } = await import(
            './extractors/url-ai-extractor'
          );
          rawText = await extractResumeFromPageText(pageText);
        }
      } else if (result.contentType === 'image' || result.contentType === 'pdf') {
        // Бинарный контент → сохранить файл → парсинг
        const { storedPath, savedFile } = await this.saveUrlDownload(
          result.data!,
          result.mimeType,
        );
        await this.candidateRepo.update(candidateId, {
          uploadedFileId: savedFile.id,
        });

        if (result.contentType === 'image') {
          const { extractTextFromImage } = await import('./extractors/ocr');
          rawText = await extractTextFromImage(storedPath);
        } else {
          rawText = await this.extractPdfText(storedPath);
        }
      } else {
        throw new Error('Неподдерживаемый тип контента по URL');
      }

      if (!rawText || rawText.trim().length < 20) {
        throw new Error(
          'Не удалось извлечь текст резюме со страницы',
        );
      }

      await this.candidateRepo.update(candidateId, {
        rawText: rawText.trim(),
      });
      await this.processCandidate(candidateId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ошибка загрузки по URL';
      this.logger.error(
        `URL processing failed for ${candidateId}: ${message}`,
      );
      await this.candidateRepo.update(candidateId, {
        processingStatus: ResumeProcessingStatus.FAILED,
        processingError: message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Notes
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all notes for a candidate, ordered by newest first.
   */
  async listNotes(candidateId: string): Promise<ResumeCandidateNote[]> {
    return this.noteRepo.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Add a note to a candidate.
   */
  async addNote(
    candidateId: string,
    dto: CreateNoteDto,
  ): Promise<ResumeCandidateNote> {
    // Verify candidate exists
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      select: ['id'],
    });

    if (!candidate) {
      throw new NotFoundException('Кандидат не найден');
    }

    const note = this.noteRepo.create({
      candidateId,
      content: dto.content,
      authorName: dto.authorName,
    });

    return this.noteRepo.save(note);
  }

  /**
   * Delete a note by its ID.
   */
  async deleteNote(noteId: string): Promise<void> {
    const note = await this.noteRepo.findOne({ where: { id: noteId } });

    if (!note) {
      throw new NotFoundException('Заметка не найдена');
    }

    await this.noteRepo.remove(note);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Tags
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all unique tags across all candidates.
   */
  async listAllUniqueTags(): Promise<{ label: string; color: string | null }[]> {
    const rows = await this.tagRepo
      .createQueryBuilder('t')
      .select(['t.label AS label', 't.color AS color', 'COUNT(*) AS cnt'])
      .groupBy('t.label')
      .addGroupBy('t.color')
      .orderBy('cnt', 'DESC')
      .getRawMany<{ label: string; color: string | null; cnt: string }>();

    // Дедупликация по label (берём цвет от самого частого)
    const seen = new Map<string, string | null>();
    for (const r of rows) {
      if (!seen.has(r.label)) {
        seen.set(r.label, r.color);
      }
    }
    return Array.from(seen.entries()).map(([label, color]) => ({ label, color }));
  }

  /**
   * List all tags for a candidate.
   */
  async listTags(candidateId: string): Promise<ResumeCandidateTag[]> {
    return this.tagRepo.find({ where: { candidateId } });
  }

  /**
   * Add a single tag to a candidate.
   */
  async addTag(
    candidateId: string,
    dto: CreateTagDto,
  ): Promise<ResumeCandidateTag> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      select: ['id'],
    });

    if (!candidate) {
      throw new NotFoundException('Кандидат не найден');
    }

    const tag = this.tagRepo.create({
      candidateId,
      label: dto.label,
      color: dto.color || null,
    });

    return this.tagRepo.save(tag);
  }

  /**
   * Delete a tag by its ID.
   */
  async deleteTag(tagId: string): Promise<void> {
    const tag = await this.tagRepo.findOne({ where: { id: tagId } });

    if (!tag) {
      throw new NotFoundException('Тег не найден');
    }

    await this.tagRepo.remove(tag);
  }

  /**
   * Replace all tags for a candidate (delete all, then create new ones).
   */
  async replaceTags(
    candidateId: string,
    tags: { label: string; color?: string }[],
  ): Promise<ResumeCandidateTag[]> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      select: ['id'],
    });

    if (!candidate) {
      throw new NotFoundException('Кандидат не найден');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ResumeCandidateTag, { candidateId });

      if (tags.length > 0) {
        const tagEntities = tags.map((t) =>
          manager.create(ResumeCandidateTag, {
            candidateId,
            label: t.label,
            color: t.color || null,
          }),
        );
        await manager.save(ResumeCandidateTag, tagEntities);
      }
    });

    return this.tagRepo.find({ where: { candidateId } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Filter Options
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get distinct values for city, specialization, and branches from active candidates.
   */
  async getFilterOptions(): Promise<{
    cities: string[];
    specializations: string[];
    branches: string[];
    workCities: string[];
    educationCities: string[];
  }> {
    const notDeleted = { deleted: ResumeCandidatePriority.DELETED };

    const [citiesRaw, specializationsRaw, workCitiesRaw, educationCitiesRaw] = await Promise.all([
      this.candidateRepo
        .createQueryBuilder('c')
        .select('DISTINCT c.city', 'city')
        .where('c.city IS NOT NULL')
        .andWhere('c.priority != :deleted', notDeleted)
        .orderBy('c.city', 'ASC')
        .getRawMany<{ city: string }>(),

      this.candidateRepo
        .createQueryBuilder('c')
        .select('DISTINCT c.specialization', 'specialization')
        .where('c.specialization IS NOT NULL')
        .andWhere('c.priority != :deleted', notDeleted)
        .orderBy('c.specialization', 'ASC')
        .getRawMany<{ specialization: string }>(),

      this.dataSource
        .createQueryBuilder()
        .select('DISTINCT wh.city', 'city')
        .from(ResumeWorkHistory, 'wh')
        .innerJoin(ResumeCandidate, 'c', 'c.id = wh."candidateId"')
        .where('wh.city IS NOT NULL')
        .andWhere('c.priority != :deleted', notDeleted)
        .orderBy('wh.city', 'ASC')
        .getRawMany<{ city: string }>(),

      this.dataSource
        .createQueryBuilder()
        .select('DISTINCT edu.city', 'city')
        .from(ResumeEducation, 'edu')
        .innerJoin(ResumeCandidate, 'c', 'c.id = edu."candidateId"')
        .where('edu.city IS NOT NULL')
        .andWhere('c.priority != :deleted', notDeleted)
        .orderBy('edu.city', 'ASC')
        .getRawMany<{ city: string }>(),
    ]);

    // Мержим канонические специализации из справочника + фактические из кандидатов (включая дополнительные)
    const canonicalSpecs = await this.specializationRepo.find({
      select: ['name'],
      order: { name: 'ASC' },
    });

    const additionalSpecsRaw = await this.candidateRepo
      .createQueryBuilder('c')
      .select('c.additionalSpecializations', 'additionalSpecializations')
      .where("c.\"additionalSpecializations\" != '{}'")
      .andWhere('c.priority != :deleted', notDeleted)
      .getMany();

    const allSpecializations = [
      ...new Set([
        ...canonicalSpecs.map((s) => s.name),
        ...specializationsRaw.map((r) => r.specialization).filter(Boolean),
        ...additionalSpecsRaw.flatMap((r) => r.additionalSpecializations || []).filter(Boolean),
      ]),
    ].sort();

    return {
      cities: citiesRaw.map((r) => r.city).filter(Boolean),
      specializations: allSpecializations,
      branches: [...BRANCHES],
      workCities: workCitiesRaw.map((r) => r.city).filter(Boolean),
      educationCities: educationCitiesRaw.map((r) => r.city).filter(Boolean),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Excel Export
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Export candidates to an Excel file (Buffer).
   * Blue header row with auto-filter and comprehensive columns.
   */
  async exportToExcel(filters: CandidateListFilters): Promise<Buffer> {
    // Use the same filtering logic but with a higher limit
    const MAX_EXPORT = 5000;
    const exportFilters = { ...filters, page: 1, limit: MAX_EXPORT };
    const { data: candidates } = await this.findCandidatesForExport(exportFilters);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Кандидаты');

    const columns: Partial<ExcelJS.Column>[] = [
      { header: 'ФИО', key: 'fullName', width: 30 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Телефон', key: 'phone', width: 18 },
      { header: 'Дата рождения', key: 'birthDate', width: 14 },
      { header: 'Город', key: 'city', width: 16 },
      { header: 'Специализация', key: 'specialization', width: 30 },
      { header: 'Направление', key: 'doctorType', width: 20 },
      { header: 'Доп. специализации', key: 'additionalSpecializations', width: 30 },
      { header: 'Категория', key: 'qualificationCategory', width: 16 },
      { header: 'ВУЗ', key: 'university', width: 30 },
      { header: 'Факультет', key: 'faculty', width: 25 },
      { header: 'Год окончания', key: 'graduationYear', width: 14 },
      { header: 'Интернатура (место)', key: 'internshipPlace', width: 25 },
      { header: 'Интернатура (спец.)', key: 'internshipSpecialty', width: 25 },
      { header: 'Ординатура (место)', key: 'residencyPlace', width: 25 },
      { header: 'Ординатура (спец.)', key: 'residencySpecialty', width: 25 },
      { header: 'Общий стаж (лет)', key: 'totalExperienceYears', width: 16 },
      { header: 'Стаж по спец. (лет)', key: 'specialtyExperienceYears', width: 18 },
      { header: 'Аккредитация', key: 'accreditationStatus', width: 14 },
      { header: 'Дата аккредитации', key: 'accreditationDate', width: 16 },
      { header: 'Аккредит. истекает', key: 'accreditationExpiryDate', width: 16 },
      { header: 'Номер сертификата', key: 'certificateNumber', width: 20 },
      { header: 'Сертификат истекает', key: 'certificateExpiryDate', width: 16 },
      { header: 'Баллы НМО', key: 'nmoPoints', width: 12 },
      { header: 'Публикации', key: 'publications', width: 30 },
      { header: 'Языки', key: 'languages', width: 20 },
      { header: 'Доп. навыки', key: 'additionalSkills', width: 30 },
      { header: 'Филиалы', key: 'branches', width: 20 },
      { header: 'Этап', key: 'status', width: 16 },
      { header: 'Приоритет', key: 'priority', width: 16 },
      { header: 'Теги', key: 'tags', width: 25 },
      { header: 'Места работы', key: 'workHistory', width: 50 },
      { header: 'Образование', key: 'education', width: 50 },
      { header: 'Дата добавления', key: 'createdAt', width: 16 },
    ];

    ws.columns = columns;

    // Style header row (blue)
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', wrapText: true };

    const formatDateRu = (d: Date | null | string): string => {
      if (!d) return '';
      const date = typeof d === 'string' ? new Date(d) : d;
      return isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU');
    };

    for (const c of candidates) {
      ws.addRow({
        fullName: c.fullName,
        email: c.email || '',
        phone: c.phone || '',
        birthDate: formatDateRu(c.birthDate),
        city: c.city || '',
        specialization: c.specialization || '',
        doctorType: (c.doctorTypes || []).map(t => DOCTOR_TYPE_LABELS[t] || t).join(', '),
        additionalSpecializations: (c.additionalSpecializations || []).join(', '),
        qualificationCategory:
          QUALIFICATION_CATEGORIES[c.qualificationCategory] ||
          c.qualificationCategory,
        university: c.university || '',
        faculty: c.faculty || '',
        graduationYear: c.graduationYear || '',
        internshipPlace: c.internshipPlace || '',
        internshipSpecialty: c.internshipSpecialty || '',
        residencyPlace: c.residencyPlace || '',
        residencySpecialty: c.residencySpecialty || '',
        totalExperienceYears: c.totalExperienceYears ?? '',
        specialtyExperienceYears: c.specialtyExperienceYears ?? '',
        accreditationStatus: c.accreditationStatus ? 'Да' : 'Нет',
        accreditationDate: formatDateRu(c.accreditationDate),
        accreditationExpiryDate: formatDateRu(c.accreditationExpiryDate),
        certificateNumber: c.certificateNumber || '',
        certificateExpiryDate: formatDateRu(c.certificateExpiryDate),
        nmoPoints: c.nmoPoints ?? '',
        publications: c.publications || '',
        languages: (c.languages || []).join(', '),
        additionalSkills: c.additionalSkills || '',
        branches: (c.branches || []).join(', '),
        status: CANDIDATE_STATUSES[c.status] || c.status,
        priority: CANDIDATE_PRIORITIES[c.priority] || c.priority,
        tags: (c.tags || []).map((t) => t.label).join(', '),
        workHistory: (c.workHistory || [])
          .map(
            (w) =>
              `${w.organization} — ${w.position}${w.isCurrent ? ' (текущее)' : ''}`,
          )
          .join('; '),
        education: (c.education || [])
          .map(
            (e) =>
              `${e.institution}${e.specialty ? ` (${e.specialty})` : ''}${e.endYear ? `, ${e.endYear}` : ''}`,
          )
          .join('; '),
        createdAt: formatDateRu(c.createdAt),
      });
    }

    // Auto-filter
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: candidates.length + 1, column: columns.length },
    };

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Internal: find candidates for export with relations.
   */
  private async findCandidatesForExport(
    filters: CandidateListFilters,
  ): Promise<{ data: ResumeCandidate[] }> {
    const limit = Math.min(Math.max(filters.limit || 5000, 1), 5000);

    const qb = this.candidateRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.tags', 'tags')
      .leftJoinAndSelect('c.workHistory', 'wh')
      .leftJoinAndSelect('c.education', 'edu')
      .where('c.priority != :deleted', {
        deleted: ResumeCandidatePriority.DELETED,
      });

    if (filters.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('c.fullName ILIKE :search', {
              search: `%${filters.search}%`,
            })
            .orWhere('c.email ILIKE :search', {
              search: `%${filters.search}%`,
            })
            .orWhere('c.phone ILIKE :search', {
              search: `%${filters.search}%`,
            })
            .orWhere('c.specialization ILIKE :search', {
              search: `%${filters.search}%`,
            })
            .orWhere("array_to_string(c.\"additionalSpecializations\", ',') ILIKE :search", {
              search: `%${filters.search}%`,
            });
        }),
      );
    }

    if (filters.status) {
      qb.andWhere('c.status = :status', { status: filters.status });
    }

    if (filters.priority) {
      qb.andWhere('c.priority = :priority', { priority: filters.priority });
    }

    if (filters.specialization) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('c.specialization = :specFilter', { specFilter: filters.specialization })
            .orWhere(':specFilter = ANY(c."additionalSpecializations")', { specFilter: filters.specialization });
        }),
      );
    }

    if (filters.qualificationCategory) {
      qb.andWhere('c.qualificationCategory = :qualificationCategory', {
        qualificationCategory: filters.qualificationCategory,
      });
    }

    if (filters.branch) {
      qb.andWhere(':branch = ANY(c.branches)', { branch: filters.branch });
    }

    if (filters.doctorType) {
      qb.andWhere(':doctorType = ANY(c.doctorTypes)', {
        doctorType: filters.doctorType,
      });
    }

    if (filters.processingStatus) {
      qb.andWhere('c.processingStatus = :processingStatus', {
        processingStatus: filters.processingStatus,
      });
    }

    if (filters.experienceMin !== undefined) {
      qb.andWhere('c.totalExperienceYears >= :expMin', {
        expMin: filters.experienceMin,
      });
    }

    if (filters.experienceMax !== undefined) {
      qb.andWhere('c.totalExperienceYears < :expMax', {
        expMax: filters.experienceMax,
      });
    }

    if (filters.city) {
      qb.andWhere('c.city = :city', { city: filters.city });
    }

    if (filters.tag) {
      qb.andWhere('tags.label = :tagLabel', { tagLabel: filters.tag });
    }

    qb.orderBy('c.createdAt', 'DESC').take(limit);

    const data = await qb.getMany();
    return { data };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Analytics
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compute date range for a given period preset.
   */
  private computeDateRange(period: PeriodPreset): DateRange {
    const now = new Date();

    if (period === 'all') {
      return {
        current: { from: new Date(2000, 0, 1), to: now },
        previous: null,
      };
    }

    const daysMap: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      year: 365,
    };
    const days = daysMap[period];
    const currentFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousFrom = new Date(
      currentFrom.getTime() - days * 24 * 60 * 60 * 1000,
    );

    return {
      current: { from: currentFrom, to: now },
      previous: { from: previousFrom, to: currentFrom },
    };
  }

  /**
   * Build base queryBuilder with common filters for analytics.
   */
  private analyticsBaseQb(
    alias: string,
    dateFrom: Date,
    dateTo: Date,
    branch: string | null,
  ): SelectQueryBuilder<ResumeCandidate> {
    const qb = this.candidateRepo
      .createQueryBuilder(alias)
      .where(`${alias}.createdAt >= :dateFrom`, { dateFrom })
      .andWhere(`${alias}.createdAt <= :dateTo`, { dateTo })
      .andWhere(`${alias}.priority != :deleted`, {
        deleted: ResumeCandidatePriority.DELETED,
      });

    // Exclude candidates tagged "Возможный дубликат"
    qb.andWhere((subQb) => {
      const subQuery = subQb
        .subQuery()
        .select('1')
        .from(ResumeCandidateTag, 'dup_tag')
        .where(`dup_tag.candidateId = ${alias}.id`)
        .andWhere("dup_tag.label = 'Возможный дубликат'")
        .getQuery();
      return `NOT EXISTS ${subQuery}`;
    });

    if (branch) {
      qb.andWhere(`:branch = ANY(${alias}.branches)`, { branch });
    }

    return qb;
  }

  /**
   * Full analytics data: KPIs, timeline, funnel, specializations, categories,
   * experience buckets, branch distribution, branch coverage, top tags,
   * expiring accreditations.
   */
  async getFullAnalytics(
    filters: { period?: string; branch?: string } = {},
  ): Promise<AnalyticsData> {
    const allSpecs = await this.getAllSpecializations();
    const now = new Date();
    const period = (filters.period as PeriodPreset) || 'all';
    const branch = filters.branch || null;
    const dateRange = this.computeDateRange(period);
    const twelveMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 11,
      1,
    );
    const ninetyDaysFromNow = new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000,
    );

    // ── Build all queries in parallel ──────────────────────────────────────

    // Helper: build a "current period" query builder
    const currentQb = () =>
      this.analyticsBaseQb(
        'c',
        dateRange.current.from,
        dateRange.current.to,
        branch,
      );

    const previousQb = () =>
      dateRange.previous
        ? this.analyticsBaseQb(
            'c',
            dateRange.previous.from,
            dateRange.previous.to,
            branch,
          )
        : null;

    // Execute all queries in parallel
    const [
      totalCurrent,
      totalPrevious,
      processedCurrent,
      processedPrevious,
      avgExpCurrentRaw,
      avgExpPreviousRaw,
      expiringCount,
      hiredCurrent,
      hiredPrevious,
      distinctSpecs,
      distinctSpecsPrev,
      timelineCandidates,
      funnelCandidates,
      allCompletedCandidates,
      branchCandidates,
      coverageCandidates,
      tagCandidateIds,
      scoredCandidates,
      expiringAccreditations,
    ] = await Promise.all([
      // 1. Total current
      currentQb().getCount(),

      // 2. Total previous
      previousQb()?.getCount() ?? Promise.resolve(null),

      // 3. Processed current
      currentQb()
        .andWhere('c.processingStatus = :completed', {
          completed: ResumeProcessingStatus.COMPLETED,
        })
        .getCount(),

      // 4. Processed previous
      previousQb()
        ?.andWhere('c.processingStatus = :completed', {
          completed: ResumeProcessingStatus.COMPLETED,
        })
        .getCount() ?? Promise.resolve(null),

      // 5. Avg experience current
      currentQb()
        .andWhere('c.processingStatus = :completed', {
          completed: ResumeProcessingStatus.COMPLETED,
        })
        .andWhere('c.totalExperienceYears IS NOT NULL')
        .select('AVG(c.totalExperienceYears)', 'avg')
        .getRawOne<{ avg: string | null }>(),

      // 6. Avg experience previous
      previousQb()
        ?.andWhere('c.processingStatus = :completed', {
          completed: ResumeProcessingStatus.COMPLETED,
        })
        .andWhere('c.totalExperienceYears IS NOT NULL')
        .select('AVG(c.totalExperienceYears)', 'avg')
        .getRawOne<{ avg: string | null }>() ?? Promise.resolve(null),

      // 7. Expiring accreditations count (next 90 days, independent of period)
      this.candidateRepo
        .createQueryBuilder('c')
        .where('c.accreditationExpiryDate >= :now', { now })
        .andWhere('c.accreditationExpiryDate <= :ninetyDays', {
          ninetyDays: ninetyDaysFromNow,
        })
        .andWhere('c.priority != :deleted', {
          deleted: ResumeCandidatePriority.DELETED,
        })
        .andWhere((subQb) => {
          const subQuery = subQb
            .subQuery()
            .select('1')
            .from(ResumeCandidateTag, 'dup_tag')
            .where('dup_tag.candidateId = c.id')
            .andWhere("dup_tag.label = 'Возможный дубликат'")
            .getQuery();
          return `NOT EXISTS ${subQuery}`;
        })
        .andWhere(
          branch ? ':branch = ANY(c.branches)' : '1=1',
          branch ? { branch } : {},
        )
        .getCount(),

      // 8. Hired current
      currentQb()
        .andWhere('c.status = :hired', {
          hired: ResumeCandidateStatus.HIRED,
        })
        .getCount(),

      // 9. Hired previous
      previousQb()
        ?.andWhere('c.status = :hired', {
          hired: ResumeCandidateStatus.HIRED,
        })
        .getCount() ?? Promise.resolve(null),

      // 10. Distinct specializations current (including additionalSpecializations)
      (async () => {
        const rows = await currentQb()
          .andWhere('c.processingStatus = :completed', {
            completed: ResumeProcessingStatus.COMPLETED,
          })
          .andWhere(
            new Brackets((sub) => {
              sub
                .where('c.specialization IS NOT NULL')
                .orWhere("c.\"additionalSpecializations\" != '{}'");
            }),
          )
          .select(['c.specialization', 'c.additionalSpecializations'])
          .getMany();
        const specSet = new Set<string>();
        for (const r of rows) {
          if (r.specialization) specSet.add(r.specialization);
          for (const s of r.additionalSpecializations || []) specSet.add(s);
        }
        return Array.from(specSet).map((s) => ({ specialization: s }));
      })(),

      // 11. Distinct specializations previous (including additionalSpecializations)
      (async () => {
        const pQb = previousQb();
        if (!pQb) return null;
        const rows = await pQb
          .andWhere('c.processingStatus = :completed', {
            completed: ResumeProcessingStatus.COMPLETED,
          })
          .andWhere(
            new Brackets((sub) => {
              sub
                .where('c.specialization IS NOT NULL')
                .orWhere("c.\"additionalSpecializations\" != '{}'");
            }),
          )
          .select(['c.specialization', 'c.additionalSpecializations'])
          .getMany();
        const specSet = new Set<string>();
        for (const r of rows) {
          if (r.specialization) specSet.add(r.specialization);
          for (const s of r.additionalSpecializations || []) specSet.add(s);
        }
        return Array.from(specSet).map((s) => ({ specialization: s }));
      })(),

      // 12. Timeline (last 12 months, branch filter only)
      (() => {
        const tlQb = this.candidateRepo
          .createQueryBuilder('c')
          .select(['c.createdAt'])
          .where('c.createdAt >= :twelveMonthsAgo', { twelveMonthsAgo })
          .andWhere('c.priority != :deleted', {
            deleted: ResumeCandidatePriority.DELETED,
          });

        // Exclude duplicates
        tlQb.andWhere((subQb) => {
          const subQuery = subQb
            .subQuery()
            .select('1')
            .from(ResumeCandidateTag, 'dup_tag')
            .where('dup_tag.candidateId = c.id')
            .andWhere("dup_tag.label = 'Возможный дубликат'")
            .getQuery();
          return `NOT EXISTS ${subQuery}`;
        });

        if (branch) {
          tlQb.andWhere(':branch = ANY(c.branches)', { branch });
        }

        return tlQb.getMany();
      })(),

      // 13. Funnel candidates
      currentQb()
        .select(['c.status', 'c.priority', 'c.processingStatus'])
        .getMany(),

      // 14. All completed for specialization/category/experience
      currentQb()
        .andWhere('c.processingStatus = :completed', {
          completed: ResumeProcessingStatus.COMPLETED,
        })
        .select([
          'c.specialization',
          'c.additionalSpecializations',
          'c.qualificationCategory',
          'c.totalExperienceYears',
          'c.gender',
          'c.doctorTypes',
        ])
        .getMany(),

      // 15. Branch distribution
      currentQb()
        .andWhere('c.processingStatus = :completed', {
          completed: ResumeProcessingStatus.COMPLETED,
        })
        .andWhere("c.branches != '{}'")
        .select(['c.branches', 'c.status'])
        .getMany(),

      // 16. Branch coverage (all time, not period filtered)
      (() => {
        const covQb = this.candidateRepo
          .createQueryBuilder('c')
          .select(['c.specialization', 'c.additionalSpecializations', 'c.branches'])
          .where('c.processingStatus = :completed', {
            completed: ResumeProcessingStatus.COMPLETED,
          })
          .andWhere(
            new Brackets((sub) => {
              sub
                .where('c.specialization IS NOT NULL')
                .orWhere("c.\"additionalSpecializations\" != '{}'");
            }),
          )
          .andWhere("c.branches != '{}'")
          .andWhere('c.priority != :deleted', {
            deleted: ResumeCandidatePriority.DELETED,
          });

        covQb.andWhere((subQb) => {
          const subQuery = subQb
            .subQuery()
            .select('1')
            .from(ResumeCandidateTag, 'dup_tag')
            .where('dup_tag.candidateId = c.id')
            .andWhere("dup_tag.label = 'Возможный дубликат'")
            .getQuery();
          return `NOT EXISTS ${subQuery}`;
        });

        if (branch) {
          covQb.andWhere(':branch = ANY(c.branches)', { branch });
        }

        return covQb.getMany();
      })(),

      // 17. Tag candidate IDs (for period filter)
      currentQb().select(['c.id']).getMany(),

      // 18. AI score distribution + avg score
      (() => {
        const sQb = this.candidateRepo
          .createQueryBuilder('c')
          .select(['c.aiScore'])
          .where('c.aiScore IS NOT NULL')
          .andWhere('c.priority != :deleted', {
            deleted: ResumeCandidatePriority.DELETED,
          });
        sQb.andWhere((subQb) => {
          const subQuery = subQb
            .subQuery()
            .select('1')
            .from(ResumeCandidateTag, 'dup_tag')
            .where('dup_tag.candidateId = c.id')
            .andWhere("dup_tag.label = 'Возможный дубликат'")
            .getQuery();
          return `NOT EXISTS ${subQuery}`;
        });
        if (branch) {
          sQb.andWhere(':branch = ANY(c.branches)', { branch });
        }
        return sQb.getMany();
      })(),

      // 19. Expiring accreditations detail (next 90 days)
      (() => {
        const expQb = this.candidateRepo
          .createQueryBuilder('c')
          .select([
            'c.id',
            'c.fullName',
            'c.specialization',
            'c.accreditationExpiryDate',
          ])
          .where('c.accreditationExpiryDate >= :now', { now })
          .andWhere('c.accreditationExpiryDate <= :ninetyDays', {
            ninetyDays: ninetyDaysFromNow,
          })
          .andWhere('c.priority != :deleted', {
            deleted: ResumeCandidatePriority.DELETED,
          });

        expQb.andWhere((subQb) => {
          const subQuery = subQb
            .subQuery()
            .select('1')
            .from(ResumeCandidateTag, 'dup_tag')
            .where('dup_tag.candidateId = c.id')
            .andWhere("dup_tag.label = 'Возможный дубликат'")
            .getQuery();
          return `NOT EXISTS ${subQuery}`;
        });

        if (branch) {
          expQb.andWhere(':branch = ANY(c.branches)', { branch });
        }

        return expQb
          .orderBy('c.accreditationExpiryDate', 'ASC')
          .getMany();
      })(),
    ]);

    // ── KPI metrics ──────────────────────────────────────────────

    const avgExpCurrentVal =
      Math.round((parseFloat(avgExpCurrentRaw?.avg || '0') || 0) * 10) / 10;
    const avgExpPreviousVal = avgExpPreviousRaw
      ? Math.round(
          (parseFloat(avgExpPreviousRaw?.avg || '0') || 0) * 10,
        ) / 10
      : null;

    const conversionCurrent =
      processedCurrent > 0
        ? Math.round((hiredCurrent / processedCurrent) * 100)
        : 0;
    const conversionPrevious =
      processedPrevious !== null &&
      processedPrevious > 0 &&
      hiredPrevious !== null
        ? Math.round((hiredPrevious / processedPrevious) * 100)
        : null;

    const specCoverageCurrent = distinctSpecs.length;
    const specCoveragePrevious = distinctSpecsPrev
      ? distinctSpecsPrev.length
      : null;

    const kpis: KpiMetric[] = [
      {
        key: 'total',
        title: 'Всего кандидатов',
        value: totalCurrent,
        previousValue: totalPrevious,
        format: 'number',
        icon: 'Users',
        color: 'text-blue-600',
        trendDirection: 'up-good',
      },
      {
        key: 'processed',
        title: 'Обработано',
        value: processedCurrent,
        previousValue: processedPrevious,
        format: 'number',
        icon: 'UserCheck',
        color: 'text-green-600',
        trendDirection: 'up-good',
      },
      {
        key: 'avgExperience',
        title: 'Средний стаж (лет)',
        value: avgExpCurrentVal,
        previousValue: avgExpPreviousVal,
        format: 'decimal',
        icon: 'Clock',
        color: 'text-indigo-600',
        trendDirection: 'neutral',
      },
      {
        key: 'expiring',
        title: 'Истекает аккредитация',
        value: expiringCount,
        previousValue: null,
        format: 'number',
        icon: 'AlertTriangle',
        color: expiringCount > 0 ? 'text-orange-600' : 'text-gray-400',
        trendDirection: 'up-bad',
      },
      {
        key: 'conversion',
        title: 'Конверсия воронки',
        value: conversionCurrent,
        previousValue: conversionPrevious,
        format: 'percent',
        icon: 'Target',
        color: 'text-purple-600',
        trendDirection: 'up-good',
      },
      {
        key: 'coverage',
        title: 'Покрытие специализаций',
        value: specCoverageCurrent,
        previousValue: specCoveragePrevious,
        format: 'fraction',
        fractionTotal: allSpecs.length,
        icon: 'Activity',
        color: 'text-teal-600',
        trendDirection: 'up-good',
      },
    ];

    // ── Timeline ─────────────────────────────────────────────────

    const monthMap = new Map<string, number>();
    timelineCandidates.forEach((c) => {
      const d = c.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });

    const timeline: TimelinePoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      timeline.push({
        month: key,
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        count: monthMap.get(key) || 0,
      });
    }

    // ── Funnel ───────────────────────────────────────────────────

    const funnelTotal = funnelCandidates.length;
    const funnelProcessed = funnelCandidates.filter(
      (c) => c.processingStatus === ResumeProcessingStatus.COMPLETED,
    ).length;
    const funnelActive = funnelCandidates.filter(
      (c) => c.priority === ResumeCandidatePriority.ACTIVE,
    ).length;
    const funnelReviewing = funnelCandidates.filter(
      (c) => c.status === ResumeCandidateStatus.REVIEWING,
    ).length;
    const funnelInvited = funnelCandidates.filter(
      (c) => c.status === ResumeCandidateStatus.INVITED,
    ).length;
    const funnelOnlineInterview = funnelCandidates.filter(
      (c) => c.status === ResumeCandidateStatus.ONLINE_INTERVIEW,
    ).length;
    const funnelInterview = funnelCandidates.filter(
      (c) => c.status === ResumeCandidateStatus.INTERVIEW,
    ).length;
    const funnelTrial = funnelCandidates.filter(
      (c) => c.status === ResumeCandidateStatus.TRIAL,
    ).length;
    const funnelInternship = funnelCandidates.filter(
      (c) => c.status === ResumeCandidateStatus.INTERNSHIP,
    ).length;
    const funnelHired = funnelCandidates.filter(
      (c) => c.status === ResumeCandidateStatus.HIRED,
    ).length;

    const funnelRaw = [
      { name: 'Всего', value: funnelTotal, color: '#94a3b8' },
      { name: 'Обработано', value: funnelProcessed, color: '#3b82f6' },
      { name: 'Актуальные', value: funnelActive, color: '#6366f1' },
      { name: 'На рассмотрении', value: funnelReviewing, color: '#8b5cf6' },
      { name: 'Приглашены', value: funnelInvited, color: '#a855f7' },
      { name: 'Онлайн собеседование', value: funnelOnlineInterview, color: '#7c3aed' },
      { name: 'Собеседование', value: funnelInterview, color: '#4f46e5' },
      { name: 'Пробный приём', value: funnelTrial, color: '#f59e0b' },
      { name: 'Стажировка', value: funnelInternship, color: '#06b6d4' },
      { name: 'Приняты', value: funnelHired, color: '#22c55e' },
    ];

    const funnel: FunnelStage[] = funnelRaw.map((stage, i) => ({
      ...stage,
      conversionFromPrevious:
        i === 0 || funnelRaw[i - 1].value === 0
          ? null
          : Math.round((stage.value / funnelRaw[i - 1].value) * 100),
    }));

    // ── Specializations ──────────────────────────────────────────

    const specMap = new Map<string, number>();
    allCompletedCandidates.forEach((c) => {
      const specs = [
        c.specialization,
        ...(c.additionalSpecializations || []),
      ].filter(Boolean) as string[];
      if (specs.length === 0) {
        specMap.set('Не указано', (specMap.get('Не указано') || 0) + 1);
      } else {
        for (const spec of specs) {
          specMap.set(spec, (specMap.get(spec) || 0) + 1);
        }
      }
    });
    const specializations = Array.from(specMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // ── Categories ───────────────────────────────────────────────

    const totalCompleted = allCompletedCandidates.length;
    const categoryRaw = [
      { name: 'Высшая', key: 'HIGHEST' },
      { name: 'Первая', key: 'FIRST' },
      { name: 'Вторая', key: 'SECOND' },
      { name: 'Без категории', key: 'NONE' },
    ];
    const categories: CategoryItem[] = categoryRaw
      .map(({ name, key }) => {
        const count = allCompletedCandidates.filter(
          (c) => c.qualificationCategory === key,
        ).length;
        return {
          name,
          key,
          count,
          percentage:
            totalCompleted > 0
              ? Math.round((count / totalCompleted) * 100)
              : 0,
        };
      })
      .filter((c) => c.count > 0);

    // ── Gender distribution ────────────────────────────────────

    const genderRaw = [
      { name: 'Мужчины', key: 'MALE' },
      { name: 'Женщины', key: 'FEMALE' },
      { name: 'Не определён', key: 'UNKNOWN' },
    ];
    const genderDistribution: CategoryItem[] = genderRaw
      .map(({ name, key }) => {
        const count = allCompletedCandidates.filter(
          (c) => c.gender === key,
        ).length;
        return {
          name,
          key,
          count,
          percentage:
            totalCompleted > 0
              ? Math.round((count / totalCompleted) * 100)
              : 0,
        };
      })
      .filter((c) => c.count > 0);

    // ── Doctor type distribution ────────────────────────────────

    const doctorTypeRaw = [
      { name: 'Детский', key: 'PEDIATRIC' },
      { name: 'Взрослый', key: 'THERAPIST' },
      { name: 'Семейный', key: 'FAMILY' },
      { name: 'Не указано', key: 'UNKNOWN' },
    ];
    const doctorTypeDistribution: CategoryItem[] = doctorTypeRaw
      .map(({ name, key }) => {
        const count =
          key === 'UNKNOWN'
            ? allCompletedCandidates.filter((c) => !c.doctorTypes || c.doctorTypes.length === 0).length
            : allCompletedCandidates.filter((c) => (c.doctorTypes || []).includes(key as any))
                .length;
        return {
          name,
          key,
          count,
          percentage:
            totalCompleted > 0
              ? Math.round((count / totalCompleted) * 100)
              : 0,
        };
      })
      .filter((c) => c.count > 0);

    // ── Experience buckets ───────────────────────────────────────

    const expBuckets = [
      { name: '0-2', min: 0, max: 2, count: 0 },
      { name: '2-5', min: 2, max: 5, count: 0 },
      { name: '5-10', min: 5, max: 10, count: 0 },
      { name: '10-15', min: 10, max: 15, count: 0 },
      { name: '15-20', min: 15, max: 20, count: 0 },
      { name: '20+', min: 20, max: Infinity, count: 0 },
    ];
    allCompletedCandidates.forEach((c) => {
      const exp = c.totalExperienceYears || 0;
      const bucket = expBuckets.find((b) => exp >= b.min && exp < b.max);
      if (bucket) bucket.count++;
    });
    const experienceBuckets = expBuckets.map((b) => ({
      name: b.name,
      count: b.count,
    }));

    // ── Branch distribution ──────────────────────────────────────

    const branchMap = new Map<
      string,
      { NEW: number; REVIEWING: number; INVITED: number; ONLINE_INTERVIEW: number; INTERVIEW: number; TRIAL: number; INTERNSHIP: number; HIRED: number }
    >();
    BRANCHES.forEach((b) =>
      branchMap.set(b, { NEW: 0, REVIEWING: 0, INVITED: 0, ONLINE_INTERVIEW: 0, INTERVIEW: 0, TRIAL: 0, INTERNSHIP: 0, HIRED: 0 }),
    );

    branchCandidates.forEach((c) => {
      (c.branches || []).forEach((branchName) => {
        const entry = branchMap.get(branchName);
        if (entry) {
          const status = c.status as keyof typeof entry;
          if (status in entry) entry[status]++;
        }
      });
    });

    const branchDistribution: BranchDistributionItem[] = Array.from(
      branchMap.entries(),
    ).map(([branchName, statuses]) => ({
      branch: branchName,
      ...statuses,
      total: Object.values(statuses).reduce((s, n) => s + n, 0),
    }));

    // ── Branch coverage matrix ───────────────────────────────────

    const matrix = new Map<string, Record<string, number>>();
    allSpecs.forEach((spec) => {
      const row: Record<string, number> = {};
      BRANCHES.forEach((b) => (row[b] = 0));
      matrix.set(spec.name, row);
    });

    coverageCandidates.forEach((c) => {
      const specs = [
        c.specialization,
        ...(c.additionalSpecializations || []),
      ].filter(Boolean) as string[];
      for (const spec of specs) {
        const row = matrix.get(spec);
        if (row) {
          (c.branches || []).forEach((b) => {
            if (b in row) row[b]++;
          });
        }
      }
    });

    const branchCoverage: BranchCoverageRow[] = Array.from(matrix.entries())
      .map(([specialization, branches]) => ({
        specialization,
        branches,
        total: Object.values(branches).reduce((s, n) => s + n, 0),
      }))
      .sort((a, b) => b.total - a.total);

    // ── Tags ─────────────────────────────────────────────────────

    const candidateIds = tagCandidateIds.map((c) => c.id);
    let topTags: TagCount[] = [];

    if (candidateIds.length > 0) {
      // Get tag counts for the candidates in the current period
      const tagGroups = await this.tagRepo
        .createQueryBuilder('t')
        .select(['t.label', 't.color', 'COUNT(t.label) AS cnt'])
        .where('t.candidateId IN (:...candidateIds)', { candidateIds })
        .groupBy('t.label')
        .addGroupBy('t.color')
        .orderBy('cnt', 'DESC')
        .limit(30)
        .getRawMany<{ t_label: string; t_color: string | null; cnt: string }>();

      // Merge rows with the same label but different colors
      const merged = new Map<
        string,
        { count: number; color: string | null }
      >();
      for (const t of tagGroups) {
        const label = t.t_label;
        const color = t.t_color;
        const count = parseInt(t.cnt, 10);
        const existing = merged.get(label);
        if (existing) {
          existing.count += count;
          if (!existing.color && color) existing.color = color;
        } else {
          merged.set(label, { count, color });
        }
      }

      topTags = Array.from(merged.entries())
        .map(([label, { count, color }]) => ({ label, count, color }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
    }

    // ── Score distribution ────────────────────────────────────

    const scoreBuckets = [
      { name: '0-19', min: 0, max: 20, count: 0 },
      { name: '20-39', min: 20, max: 40, count: 0 },
      { name: '40-59', min: 40, max: 60, count: 0 },
      { name: '60-79', min: 60, max: 80, count: 0 },
      { name: '80-100', min: 80, max: 101, count: 0 },
    ];
    let scoreSum = 0;
    scoredCandidates.forEach((c) => {
      const s = c.aiScore!;
      scoreSum += s;
      const bucket = scoreBuckets.find((b) => s >= b.min && s < b.max);
      if (bucket) bucket.count++;
    });
    const scoreDistribution = scoreBuckets.map((b) => ({
      name: b.name,
      count: b.count,
    }));

    if (scoredCandidates.length > 0) {
      const avgScore = Math.round((scoreSum / scoredCandidates.length) * 10) / 10;
      kpis.push({
        key: 'avgScore',
        title: 'Средний AI-балл',
        value: avgScore,
        previousValue: null,
        format: 'decimal',
        icon: 'Brain',
        color: 'text-violet-600',
        trendDirection: 'up-good',
      });
    }

    return {
      kpis,
      timeline,
      funnel,
      specializations,
      categories,
      genderDistribution,
      doctorTypeDistribution,
      experienceBuckets,
      branchDistribution,
      branchCoverage,
      topTags,
      scoreDistribution,
      expiringAccreditations: expiringAccreditations.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        specialization: c.specialization,
        accreditationExpiryDate: c.accreditationExpiryDate,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Public Apply
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a candidate from the public application form (wizard data).
   */
  async createCandidateFromPublicForm(
    dto: PublicApplySubmitDto,
  ): Promise<ResumeCandidate> {
    // Honeypot check — if the hidden field is filled, it's a bot
    if (dto.website) {
      // Return a fake success to confuse the bot
      return { id: 'ok' } as ResumeCandidate;
    }

    const specs = await this.getAllSpecializations();
    const normalizedSpec = await this.normalizeSpecialization(
      dto.specialization || null,
      specs,
    );

    const candidate = await this.dataSource.transaction(async (manager) => {
      const candidateEntity = manager.create(ResumeCandidate, {
        fullName: dto.fullName,
        email: dto.email || null,
        phone: dto.phone || null,
        birthDate: parseDate(dto.birthDate),
        city: dto.city || null,
        branches: dto.branches || [],
        specialization: normalizedSpec,
        rawText: dto.rawText || null,
        uploadedFileId: dto.uploadedFileId || null,
        status: ResumeCandidateStatus.NEW,
        processingStatus: dto.rawText || dto.uploadedFileId
          ? ResumeProcessingStatus.PENDING
          : ResumeProcessingStatus.COMPLETED,
        aiConfidence: null,
        // Образование (верхнеуровневые поля)
        university: dto.university || null,
        faculty: dto.faculty || null,
        graduationYear: dto.graduationYear ?? null,
        internshipPlace: dto.internshipPlace || null,
        internshipSpecialty: dto.internshipSpecialty || null,
        internshipYearEnd: dto.internshipYearEnd ?? null,
        residencyPlace: dto.residencyPlace || null,
        residencySpecialty: dto.residencySpecialty || null,
        residencyYearEnd: dto.residencyYearEnd ?? null,
        // Специализация / квалификация
        additionalSpecializations: dto.additionalSpecializations || [],
        qualificationCategory: (dto.qualificationCategory as any) || 'NONE',
        categoryAssignedDate: parseDate(dto.categoryAssignedDate),
        categoryExpiryDate: parseDate(dto.categoryExpiryDate),
        accreditationStatus: dto.accreditationStatus || false,
        accreditationDate: parseDate(dto.accreditationDate),
        accreditationExpiryDate: parseDate(dto.accreditationExpiryDate),
        certificateNumber: dto.certificateNumber || null,
        certificateIssueDate: parseDate(dto.certificateIssueDate),
        certificateExpiryDate: parseDate(dto.certificateExpiryDate),
        // Опыт
        totalExperienceYears: dto.totalExperienceYears ?? null,
        specialtyExperienceYears: dto.specialtyExperienceYears ?? null,
        // Желаемая ЗП
        desiredSalary: dto.desiredSalary ?? null,
        desiredSalaryType: (dto.desiredSalaryType as any) || null,
        // Дополнительно
        nmoPoints: dto.nmoPoints ?? null,
        publications: dto.publications || null,
        languages: dto.languages || [],
        additionalSkills: [dto.additionalSkills, dto.freeFormNote].filter(Boolean).join('\n\n') || null,
      });

      const savedCandidate = await manager.save(
        ResumeCandidate,
        candidateEntity,
      );

      // Create work history entries
      if (dto.workHistory && dto.workHistory.length > 0) {
        const workHistoryEntities = dto.workHistory.map((wh) =>
          manager.create(ResumeWorkHistory, {
            candidateId: savedCandidate.id,
            organization: wh.organization,
            position: wh.position,
            department: wh.department || null,
            startDate: parseDate(wh.startDate),
            endDate: parseDate(wh.endDate),
            isCurrent: wh.isCurrent || false,
            description: wh.description || null,
          }),
        );
        await manager.save(ResumeWorkHistory, workHistoryEntities);
      }

      // Create education entries
      if (dto.education && dto.education.length > 0) {
        const educationEntities = dto.education.map((edu) =>
          manager.create(ResumeEducation, {
            candidateId: savedCandidate.id,
            institution: edu.institution,
            faculty: edu.faculty || null,
            specialty: edu.specialty || null,
            degree: edu.degree || null,
            city: edu.city || null,
            startYear: edu.startYear ?? null,
            endYear: edu.endYear ?? null,
            type: edu.type || null,
          }),
        );
        await manager.save(ResumeEducation, educationEntities);
      }

      // Create CME course entries
      if (dto.cmeCourses && dto.cmeCourses.length > 0) {
        const cmeEntities = dto.cmeCourses.map((cme) =>
          manager.create(ResumeCmeCourse, {
            candidateId: savedCandidate.id,
            courseName: cme.courseName,
            provider: cme.provider || null,
            completedAt: parseDate(cme.completedAt),
            hours: cme.hours ?? null,
            nmoPoints: cme.nmoPoints ?? null,
            certificateNumber: cme.certificateNumber || null,
          }),
        );
        await manager.save(ResumeCmeCourse, cmeEntities);
      }

      return savedCandidate;
    });

    // Enqueue processing if there is raw text or an uploaded file
    if (dto.rawText || dto.uploadedFileId) {
      this.enqueueProcessing(candidate.id);
    } else {
      // Fire-and-forget duplicate detection for form-submitted candidates
      void this.duplicateService
        .checkAndHandleDuplicates(candidate.id)
        .catch((err) =>
          this.logger.error(`Duplicate detection error: ${err.message}`),
        );
    }

    return candidate;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  Deduplication
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Run deduplication on a batch of completed candidates.
   */
  async deduplicateCandidates(
    filters: CandidateListFilters = {},
  ): Promise<{ deleted: number; tagged: number; total: number }> {
    const MAX_BATCH = 200;

    const qb = this.candidateRepo
      .createQueryBuilder('c')
      .select(['c.id'])
      .where('c.processingStatus = :completed', {
        completed: ResumeProcessingStatus.COMPLETED,
      })
      .andWhere('c.priority != :deleted', {
        deleted: ResumeCandidatePriority.DELETED,
      });

    if (filters.search) {
      qb.andWhere('c.fullName ILIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    if (filters.specialization) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('c.specialization = :specFilter', { specFilter: filters.specialization })
            .orWhere(':specFilter = ANY(c."additionalSpecializations")', { specFilter: filters.specialization });
        }),
      );
    }

    if (filters.qualificationCategory) {
      qb.andWhere('c.qualificationCategory = :qualificationCategory', {
        qualificationCategory: filters.qualificationCategory,
      });
    }

    if (filters.status) {
      qb.andWhere('c.status = :status', { status: filters.status });
    }

    if (filters.priority) {
      qb.andWhere('c.priority = :priority', { priority: filters.priority });
    }

    if (filters.branch) {
      qb.andWhere(':branch = ANY(c.branches)', { branch: filters.branch });
    }

    if (filters.city) {
      qb.andWhere('c.city = :city', { city: filters.city });
    }

    if (filters.experienceMin !== undefined) {
      qb.andWhere('c.totalExperienceYears >= :expMin', {
        expMin: filters.experienceMin,
      });
    }

    if (filters.experienceMax !== undefined) {
      qb.andWhere('c.totalExperienceYears < :expMax', {
        expMax: filters.experienceMax,
      });
    }

    const candidates = await qb
      .orderBy('c.createdAt', 'DESC')
      .take(MAX_BATCH)
      .getMany();

    let deleted = 0;
    let tagged = 0;
    const processed = new Set<string>();

    for (const c of candidates) {
      // Skip if already deleted in this run
      if (processed.has(c.id)) continue;

      // Verify candidate still exists
      const exists = await this.candidateRepo.findOne({
        where: { id: c.id },
        select: ['id'],
      });
      if (!exists) continue;

      const result = await this.duplicateService.checkAndHandleDuplicates(
        c.id,
      );

      if (result.status === 'exact_duplicate_deleted') {
        deleted++;
        processed.add(c.id);
      } else if (result.status === 'similar_tagged') {
        tagged++;
        if (result.existingCandidateId) {
          processed.add(result.existingCandidateId);
        }
      }
    }

    return { deleted, tagged, total: candidates.length };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Facade methods (called by controllers / telegram worker)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Alias used by ResumePublicController.submitApplication.
   */
  async submitApplication(
    dto: PublicApplySubmitDto,
  ): Promise<ResumeCandidate> {
    return this.createCandidateFromPublicForm(dto);
  }

  /**
   * Find an uploaded file record by ID.
   */
  async getFileRecord(id: string): Promise<ResumeUploadedFile | null> {
    return this.fileRepo.findOne({ where: { id } });
  }

  /**
   * Stream a file to an Express response.
   */
  pipeFileStream(
    fileRecord: ResumeUploadedFile,
    res: Response,
  ): void {
    const stream = createReadStream(fileRecord.storedPath);
    stream.pipe(res);
  }

  /**
   * Alias used by ResumeController.bulkDeduplicate.
   */
  async bulkDeduplicate(
    body: Record<string, unknown>,
  ): Promise<{ deleted: number; tagged: number; total: number }> {
    const filters: CandidateListFilters = {};
    if (typeof body.search === 'string') filters.search = body.search;
    if (typeof body.specialization === 'string')
      filters.specialization = body.specialization;
    if (typeof body.qualificationCategory === 'string')
      filters.qualificationCategory = body.qualificationCategory;
    if (typeof body.status === 'string') filters.status = body.status;
    if (typeof body.priority === 'string') filters.priority = body.priority;
    if (typeof body.branch === 'string') filters.branch = body.branch;
    if (typeof body.city === 'string') filters.city = body.city;
    return this.deduplicateCandidates(filters);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Telegram Chat management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all authorized Telegram chats.
   */
  async listTelegramChats(): Promise<ResumeTelegramChat[]> {
    return this.telegramChatRepo.find({ order: { authorizedAt: 'DESC' } });
  }

  /**
   * Remove a Telegram chat by chatId.
   */
  async removeTelegramChat(chatId: string): Promise<void> {
    const chat = await this.telegramChatRepo.findOne({
      where: { chatId },
    });
    if (!chat) {
      throw new NotFoundException('Telegram-чат не найден');
    }
    await this.telegramChatRepo.remove(chat);
  }

  /**
   * Create or update a Telegram chat record.
   */
  async upsertTelegramChat(data: {
    chatId: number;
    username?: string;
    firstName?: string;
  }): Promise<ResumeTelegramChat> {
    const chatIdStr = String(data.chatId);
    let chat = await this.telegramChatRepo.findOne({
      where: { chatId: chatIdStr },
    });

    if (chat) {
      if (data.username !== undefined) chat.username = data.username ?? null;
      if (data.firstName !== undefined) chat.firstName = data.firstName ?? null;
      return this.telegramChatRepo.save(chat);
    }

    chat = this.telegramChatRepo.create({
      chatId: chatIdStr,
      username: data.username || null,
      firstName: data.firstName || null,
    });
    return this.telegramChatRepo.save(chat);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Telegram worker helpers (synchronous pipeline)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Save a file buffer from Telegram, create candidate + uploaded file records.
   * Returns candidateId and uploadedFileId.
   */
  async saveTelegramFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<{ candidateId: string; uploadedFileId: string }> {
    const uploadDir =
      this.config.get<string>('RESUME_UPLOAD_DIR') || 'uploads/resume';
    const absoluteUploadDir = join(process.cwd(), uploadDir);

    await mkdir(absoluteUploadDir, { recursive: true });

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${Date.now()}_${uuidv4()}_tg_${sanitizedName}`;
    const storedPath = join(absoluteUploadDir, storedName);

    await writeFile(storedPath, buffer);

    const uploadedFile = this.fileRepo.create({
      originalName: fileName,
      storedPath,
      mimeType,
      sizeBytes: buffer.length,
    });
    const savedFile = await this.fileRepo.save(uploadedFile);

    const candidate = this.candidateRepo.create({
      fullName: fileName.replace(/\.[^/.]+$/, ''),
      uploadedFileId: savedFile.id,
      processingStatus: ResumeProcessingStatus.PENDING,
      branches: [],
    });
    const savedCandidate = await this.candidateRepo.save(candidate);

    return {
      candidateId: savedCandidate.id,
      uploadedFileId: savedFile.id,
    };
  }

  /**
   * Update the processing status (and optionally confidence) for a candidate.
   */
  async setCandidateProcessingStatus(
    candidateId: string,
    status: string,
    confidence?: number,
  ): Promise<void> {
    const update: Partial<ResumeCandidate> = {
      processingStatus: status as ResumeProcessingStatus,
    };
    if (confidence !== undefined) {
      update.aiConfidence = confidence;
    }
    await this.candidateRepo.update(candidateId, update);
  }

  /**
   * Extract text from the file attached to a candidate and store it.
   * Returns the extracted raw text.
   */
  async extractTextForCandidate(candidateId: string): Promise<string> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      relations: ['uploadedFile'],
    });

    if (!candidate) {
      throw new NotFoundException('Кандидат не найден');
    }

    if (candidate.rawText) {
      return candidate.rawText;
    }

    if (!candidate.uploadedFile) {
      throw new BadRequestException('У кандидата нет загруженного файла');
    }

    const rawText = await this.extractTextFromFile(candidate.uploadedFile);
    await this.candidateRepo.update(candidateId, { rawText });
    return rawText;
  }

  /**
   * AI-parse the raw text for a candidate and save structured data.
   * Returns the parsed output.
   */
  async parseCandidateText(
    candidateId: string,
    rawText: string,
  ): Promise<CvParsedOutput> {
    const specs = await this.getAllSpecializations();
    const systemPrompt = buildCvParsingPrompt(specs.map((s) => s.name));
    const parsed = await parseCvText(rawText, systemPrompt);
    await this.saveParsedData(candidateId, parsed);
    return parsed;
  }

  /**
   * Run duplicate detection for a candidate.
   */
  async checkDuplicates(
    candidateId: string,
  ): Promise<DuplicateCheckResult> {
    return this.duplicateService.checkAndHandleDuplicates(candidateId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  AI Scoring
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Внутренний метод: генерация эмбеддинга, поиск похожих, AI-оценка.
   */
  private async scoreCandidateInternal(candidateId: string): Promise<ResumeCandidateScore> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      relations: ['workHistory', 'education', 'cmeCourses'],
    });
    if (!candidate) throw new NotFoundException('Кандидат не найден');

    // 1. Загрузить пул кандидатов (по специализации, fallback на весь пул)
    const poolCandidates = await this.getPoolCandidates(candidate.specialization);

    // 2. Рассчитать статистику пула
    const poolStats = computePoolStats(poolCandidates);

    // 3. Рассчитать детерминированные sub-scores
    const detScores = computeDeterministicScores(candidate, poolStats);

    // 4. Найти похожих кандидатов (embedding-first, fallback на SQL)
    let similarProfiles: string[];
    try {
      similarProfiles = await this.findSimilarCandidatesForScoring(candidateId, 7);
    } catch {
      similarProfiles = await this.findSimilarBySQL(
        candidateId,
        candidate.specialization,
        candidate.totalExperienceYears,
        7,
      );
    }

    // 5. Получить rawText
    const rawText = candidate.rawText || null;

    // 6. Статистика по специализации (для промпта)
    const specStats = await this.getSpecializationStats(candidate.specialization);

    // 7. AI качественная оценка
    const prompt = buildScoringPrompt(rawText, similarProfiles, detScores, poolStats, specStats);
    const aiResult = await generateAiScoring(prompt);

    // 8. Composite score: 75% deterministic + 25% AI
    const compositeScore = Math.round(
      detScores.composite * 0.75 + aiResult.qualitativeScore * 0.25,
    );

    // 9. Percentile rank
    const percentileRank = await this.computePercentileRank(
      candidate.specialization,
      compositeScore,
    );

    const totalInGroup = candidate.specialization
      ? await this.scoreRepo.count({
          where: { specialization: candidate.specialization, isCurrent: true },
        })
      : 0;

    // 10. Деактивировать предыдущие оценки
    await this.scoreRepo.update(
      { candidateId, isCurrent: true },
      { isCurrent: false },
    );

    // 11. Определить версию
    const lastScore = await this.scoreRepo.findOne({
      where: { candidateId },
      order: { version: 'DESC' },
    });

    // 12. Сохранить новую оценку
    const score = this.scoreRepo.create({
      candidateId,
      totalScore: compositeScore,
      aiSummary: aiResult.summary,
      strengths: aiResult.strengths,
      weaknesses: aiResult.weaknesses,
      highlights: aiResult.highlights,
      comparison: aiResult.comparison,
      percentileRank,
      specialization: candidate.specialization,
      totalCandidatesInGroup: totalInGroup + 1,
      version: (lastScore?.version ?? 0) + 1,
      isCurrent: true,
      modelVersion: OLLAMA_MODEL,
      // Sub-scores
      experienceScore: detScores.experience,
      educationScore: detScores.education,
      qualificationScore: detScores.qualification,
      developmentScore: detScores.development,
      aiQualitativeScore: aiResult.qualitativeScore,
      deterministicScore: detScores.composite,
      confidence: detScores.confidence,
    });
    const saved = await this.scoreRepo.save(score);

    // 13. Обновить кеш
    await this.candidateRepo.update(candidateId, { aiScore: compositeScore });

    this.logger.log(
      `Hybrid scoring completed for ${candidateId}: det=${detScores.composite} ai=${aiResult.qualitativeScore} total=${compositeScore}/100 confidence=${detScores.confidence}%`,
    );

    return saved;
  }

  /**
   * Загрузить кандидатов пула для расчёта z-score.
   * Сначала по специализации, если < 5 — fallback на весь пул.
   */
  private async getPoolCandidates(specialization: string | null): Promise<ResumeCandidate[]> {
    const baseQb = this.candidateRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.workHistory', 'wh')
      .leftJoinAndSelect('c.education', 'edu')
      .leftJoinAndSelect('c.cmeCourses', 'cme')
      .where('c.priority NOT IN (:...hidden)', {
        hidden: [ResumeCandidatePriority.DELETED, ResumeCandidatePriority.ARCHIVE],
      });

    if (specialization) {
      const specCandidates = await baseQb.clone()
        .andWhere('c.specialization = :spec', { spec: specialization })
        .getMany();
      if (specCandidates.length >= 5) return specCandidates;
    }

    return baseQb.getMany();
  }

  /**
   * Найти похожих кандидатов через SQL (по специализации + близость стажа).
   * Заменяет pgvector cosine search — проще и надёжнее.
   */
  private async findSimilarBySQL(
    candidateId: string,
    specialization: string | null,
    experienceYears: number | null,
    limit = 7,
  ): Promise<string[]> {
    try {
      const qb = this.candidateRepo.createQueryBuilder('c')
        .leftJoinAndSelect('c.workHistory', 'wh')
        .where('c.id != :id', { id: candidateId })
        .andWhere('c.priority NOT IN (:...hidden)', {
          hidden: [ResumeCandidatePriority.DELETED, ResumeCandidatePriority.ARCHIVE],
        });

      if (specialization) {
        qb.andWhere('c.specialization = :spec', { spec: specialization });
      }

      if (experienceYears != null) {
        qb.addSelect(
          `ABS(COALESCE(c."totalExperienceYears", 0) - :exp)`,
          'exp_diff',
        ).setParameter('exp', experienceYears)
        .orderBy('exp_diff', 'ASC');
      } else {
        qb.orderBy('c."createdAt"', 'DESC');
      }

      const rows = await qb.limit(limit).getMany();
      return rows.map(r => buildCompactProfile(r));
    } catch {
      return [];
    }
  }

  /**
   * Получить агрегированную статистику по специализации.
   */
  private async getSpecializationStats(
    specialization: string | null,
  ): Promise<{ avgExperience: number; totalCount: number; avgScore: number; categoryDistribution: Record<string, number> } | null> {
    if (!specialization) return null;

    const countResult = await this.candidateRepo
      .createQueryBuilder('c')
      .select('COUNT(*)', 'total')
      .addSelect('AVG(c.totalExperienceYears)', 'avgExp')
      .addSelect('AVG(c.aiScore)', 'avgScore')
      .where('c.specialization = :spec', { spec: specialization })
      .andWhere('c.priority NOT IN (:...hidden)', {
        hidden: [ResumeCandidatePriority.DELETED, ResumeCandidatePriority.ARCHIVE],
      })
      .getRawOne();

    if (!countResult || parseInt(countResult.total) < 2) return null;

    const catRows = await this.candidateRepo
      .createQueryBuilder('c')
      .select('c.qualificationCategory', 'cat')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.specialization = :spec', { spec: specialization })
      .andWhere('c.priority NOT IN (:...hidden)', {
        hidden: [ResumeCandidatePriority.DELETED, ResumeCandidatePriority.ARCHIVE],
      })
      .groupBy('c.qualificationCategory')
      .getRawMany();

    const categoryDistribution: Record<string, number> = {};
    for (const row of catRows) {
      categoryDistribution[row.cat] = parseInt(row.cnt);
    }

    return {
      avgExperience: parseFloat(countResult.avgExp) || 0,
      totalCount: parseInt(countResult.total),
      avgScore: parseFloat(countResult.avgScore) || 0,
      categoryDistribution,
    };
  }

  /**
   * Вычислить percentile rank — какой % кандидатов той же специализации имеет балл ниже.
   */
  private async computePercentileRank(
    specialization: string | null,
    score: number,
  ): Promise<number | null> {
    if (!specialization) return null;

    const result = await this.scoreRepo
      .createQueryBuilder('s')
      .select('COUNT(*)', 'below')
      .where('s.specialization = :spec', { spec: specialization })
      .andWhere('s.isCurrent = true')
      .andWhere('s.totalScore < :score', { score })
      .getRawOne();

    const totalResult = await this.scoreRepo
      .createQueryBuilder('s')
      .select('COUNT(*)', 'total')
      .where('s.specialization = :spec', { spec: specialization })
      .andWhere('s.isCurrent = true')
      .getRawOne();

    const below = parseInt(result?.below) || 0;
    const total = parseInt(totalResult?.total) || 0;

    if (total < 2) return null;
    return Math.round((below / total) * 100 * 10) / 10;
  }

  /**
   * Получить текущую AI-оценку кандидата.
   */
  async getCandidateScore(candidateId: string): Promise<{
    score: ResumeCandidateScore | null;
    history: { version: number; totalScore: number; createdAt: Date }[];
  }> {
    const score = await this.scoreRepo.findOne({
      where: { candidateId, isCurrent: true },
    });

    const history = await this.scoreRepo.find({
      where: { candidateId },
      order: { version: 'DESC' },
      select: ['version', 'totalScore', 'createdAt'],
    });

    return { score, history };
  }

  /**
   * Пересчитать AI-оценку кандидата.
   */
  async recalculateScore(candidateId: string): Promise<ResumeCandidateScore> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
    });
    if (!candidate) throw new NotFoundException('Кандидат не найден');

    return this.scoreCandidateInternal(candidateId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Leads (Банк заявок)
  // ═══════════════════════════════════════════════════════════════════════════

  async findLeads(filters: {
    search?: string;
    status?: string;
    source?: string;
    specialization?: string;
    city?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'ASC' | 'DESC';
  }): Promise<{ data: ResumeLead[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);

    const qb = this.leadRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.tags', 'tags');

    if (filters.search) {
      qb.where(
        new Brackets((sub) => {
          sub
            .where('l.name ILIKE :search', { search: `%${filters.search}%` })
            .orWhere('l.phone ILIKE :search', { search: `%${filters.search}%` })
            .orWhere('l.email ILIKE :search', { search: `%${filters.search}%` });
        }),
      );
    }

    if (filters.status) {
      qb.andWhere('l.status = :status', { status: filters.status });
    }

    if (filters.source) {
      qb.andWhere('l.source = :source', { source: filters.source });
    }

    if (filters.specialization) {
      qb.andWhere('l.specialization = :specialization', {
        specialization: filters.specialization,
      });
    }

    if (filters.city) {
      qb.andWhere('l.city = :city', { city: filters.city });
    }

    const sortWhitelist: Record<string, string> = {
      createdAt: 'l.createdAt',
      name: 'l.name',
      status: 'l.status',
    };
    const sortColumn = sortWhitelist[filters.sort || 'createdAt'] || 'l.createdAt';
    const sortOrder = filters.order === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(sortColumn, sortOrder);
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findLeadById(id: string): Promise<ResumeLead> {
    const lead = await this.leadRepo.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!lead) throw new NotFoundException('Заявка не найдена');
    return lead;
  }

  async createLead(dto: CreateLeadDto): Promise<ResumeLead> {
    const lead = this.leadRepo.create({
      name: dto.name || null,
      phone: dto.phone || null,
      email: dto.email || null,
      city: dto.city || null,
      specialization: dto.specialization || null,
      source: dto.source || null,
      notes: dto.notes || null,
      doctorTypes: (dto.doctorTypes || []) as ResumeCandidateDoctorType[],
      branches: dto.branches || [],
      desiredSalary: dto.desiredSalary ?? null,
      desiredSalaryType: (dto.desiredSalaryType as ResumeSalaryType) || null,
    });

    return this.leadRepo.save(lead);
  }

  async updateLead(id: string, dto: UpdateLeadDto): Promise<ResumeLead> {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Заявка не найдена');

    if (dto.name !== undefined) lead.name = dto.name || null;
    if (dto.phone !== undefined) lead.phone = dto.phone || null;
    if (dto.email !== undefined) lead.email = dto.email || null;
    if (dto.city !== undefined) lead.city = dto.city || null;
    if (dto.specialization !== undefined) lead.specialization = dto.specialization || null;
    if (dto.source !== undefined) lead.source = dto.source || null;
    if (dto.notes !== undefined) lead.notes = dto.notes || null;
    if (dto.doctorTypes !== undefined) lead.doctorTypes = dto.doctorTypes as ResumeCandidateDoctorType[];
    if (dto.branches !== undefined) lead.branches = dto.branches;
    if (dto.desiredSalary !== undefined) lead.desiredSalary = dto.desiredSalary ?? null;
    if (dto.desiredSalaryType !== undefined) lead.desiredSalaryType = (dto.desiredSalaryType as ResumeSalaryType) || null;
    if (dto.status !== undefined) lead.status = dto.status;

    return this.leadRepo.save(lead);
  }

  async deleteLead(id: string): Promise<void> {
    const lead = await this.leadRepo.findOne({ where: { id }, select: ['id'] });
    if (!lead) throw new NotFoundException('Заявка не найдена');
    await this.leadRepo.remove(lead);
  }

  async convertLeadToCandidate(
    leadId: string,
    file?: Express.Multer.File,
    rawText?: string,
  ): Promise<ResumeCandidate> {
    const lead = await this.leadRepo.findOne({
      where: { id: leadId },
      relations: ['tags'],
    });
    if (!lead) throw new NotFoundException('Заявка не найдена');
    if (lead.status === ResumeLeadStatus.CONVERTED) {
      throw new BadRequestException('Заявка уже конвертирована в кандидата');
    }
    if (!file && !rawText) {
      throw new BadRequestException('Необходимо загрузить файл резюме или вставить текст');
    }

    let uploadedFile: ResumeUploadedFile | null = null;
    if (file) {
      uploadedFile = await this.uploadFile(file);
    }

    let candidate: ResumeCandidate;

    await this.dataSource.transaction(async (manager) => {
      candidate = manager.create(ResumeCandidate, {
        fullName: lead.name || 'Обработка...',
        phone: lead.phone || null,
        email: lead.email || null,
        city: lead.city || null,
        specialization: lead.specialization || null,
        rawText: rawText || null,
        uploadedFileId: uploadedFile?.id || null,
        processingStatus: ResumeProcessingStatus.PENDING,
        status: ResumeCandidateStatus.NEW,
        priority: ResumeCandidatePriority.ACTIVE,
        doctorTypes: lead.doctorTypes || [],
        branches: lead.branches || [],
        desiredSalary: lead.desiredSalary ?? null,
        desiredSalaryType: lead.desiredSalaryType || null,
      });
      candidate = await manager.save(ResumeCandidate, candidate);

      // Перенести теги
      if (lead.tags && lead.tags.length > 0) {
        const tagEntities = lead.tags.map((t) =>
          manager.create(ResumeCandidateTag, {
            candidateId: candidate.id,
            label: t.label,
            color: t.color,
          }),
        );
        await manager.save(ResumeCandidateTag, tagEntities);
      }

      // Перенести заметку
      if (lead.notes) {
        const note = manager.create(ResumeCandidateNote, {
          candidateId: candidate.id,
          content: lead.notes,
          authorName: 'Система (из заявки)',
        });
        await manager.save(ResumeCandidateNote, note);
      }

      // Обновить лид
      await manager.update(ResumeLead, leadId, {
        status: ResumeLeadStatus.CONVERTED,
        convertedCandidateId: candidate.id,
      });
    });

    // Запустить AI-обработку
    this.enqueueProcessing(candidate!.id);

    return candidate!;
  }

  async listAllUniqueLeadTags(): Promise<{ label: string; color: string | null }[]> {
    const rows = await this.leadTagRepo
      .createQueryBuilder('t')
      .select(['t.label AS label', 't.color AS color', 'COUNT(*) AS cnt'])
      .groupBy('t.label')
      .addGroupBy('t.color')
      .orderBy('cnt', 'DESC')
      .getRawMany<{ label: string; color: string | null; cnt: string }>();

    const seen = new Map<string, string | null>();
    for (const r of rows) {
      if (!seen.has(r.label)) {
        seen.set(r.label, r.color);
      }
    }
    return Array.from(seen.entries()).map(([label, color]) => ({ label, color }));
  }

  async addLeadTag(
    leadId: string,
    dto: CreateTagDto,
  ): Promise<ResumeLeadTag> {
    const lead = await this.leadRepo.findOne({
      where: { id: leadId },
      select: ['id'],
    });
    if (!lead) throw new NotFoundException('Заявка не найдена');

    const tag = this.leadTagRepo.create({
      leadId,
      label: dto.label,
      color: dto.color || null,
    });
    return this.leadTagRepo.save(tag);
  }

  async deleteLeadTag(tagId: string): Promise<void> {
    const tag = await this.leadTagRepo.findOne({ where: { id: tagId } });
    if (!tag) throw new NotFoundException('Тег не найден');
    await this.leadTagRepo.remove(tag);
  }

  async replaceLeadTags(
    leadId: string,
    tags: { label: string; color?: string }[],
  ): Promise<ResumeLeadTag[]> {
    const lead = await this.leadRepo.findOne({
      where: { id: leadId },
      select: ['id'],
    });
    if (!lead) throw new NotFoundException('Заявка не найдена');

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ResumeLeadTag, { leadId });

      if (tags.length > 0) {
        const tagEntities = tags.map((t) =>
          manager.create(ResumeLeadTag, {
            leadId,
            label: t.label,
            color: t.color || null,
          }),
        );
        await manager.save(ResumeLeadTag, tagEntities);
      }
    });

    return this.leadTagRepo.find({ where: { leadId } });
  }

  async getLeadStats(): Promise<{
    byStatus: Record<string, number>;
    total: number;
  }> {
    const leads = await this.leadRepo
      .createQueryBuilder('l')
      .select('l.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('l.status')
      .getRawMany();

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of leads) {
      byStatus[row.status] = Number(row.count);
      total += Number(row.count);
    }

    return { byStatus, total };
  }

  async getLeadSources(): Promise<string[]> {
    const rows = await this.leadRepo
      .createQueryBuilder('l')
      .select('DISTINCT l.source', 'source')
      .where('l.source IS NOT NULL')
      .andWhere("l.source != ''")
      .orderBy('l.source', 'ASC')
      .getRawMany();

    return rows.map((r) => r.source);
  }
}
