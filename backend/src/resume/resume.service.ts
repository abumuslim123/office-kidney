import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as mammoth from 'mammoth';
import { In, ILike, Not, Repository } from 'typeorm';
import { ResumeCandidate } from './entities/resume-candidate.entity';
import { ResumeUploadedFile } from './entities/resume-uploaded-file.entity';
import { ResumeCandidateNote } from './entities/resume-candidate-note.entity';
import { ResumeCandidateTag } from './entities/resume-candidate-tag.entity';
import { ResumeWorkHistory } from './entities/resume-work-history.entity';
import { ResumeEducation } from './entities/resume-education.entity';
import { ResumeCmeCourse } from './entities/resume-cme-course.entity';
import {
  ResumeCandidatePriority,
  ResumeCandidateStatus,
  ResumeProcessingStatus,
  ResumeQualificationCategory,
} from './entities/resume.enums';
import { ResumeTelegramChat } from './entities/resume-telegram-chat.entity';

type CandidateListParams = {
  search?: string;
  specialization?: string;
  category?: ResumeQualificationCategory;
  status?: ResumeCandidateStatus;
  priority?: ResumeCandidatePriority;
  branch?: string;
  city?: string;
  workCity?: string;
  educationCity?: string;
  experience?: string;
  accreditation?: 'yes' | 'no';
  page?: number;
  limit?: number;
};

type CandidateUpdatePayload = Partial<{
  fullName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  specialization: string | null;
  qualificationCategory: ResumeQualificationCategory;
  status: ResumeCandidateStatus;
  priority: ResumeCandidatePriority;
  branches: string[];
  rawText: string | null;
  publications: string | null;
  additionalSkills: string | null;
  nmoPoints: number | null;
  totalExperienceYears: number | null;
  specialtyExperienceYears: number | null;
  accreditationStatus: boolean;
  accreditationExpiryDate: Date | null;
}>;

@Injectable()
export class ResumeService {
  private readonly uploadDir: string;
  private readonly pendingProcessing = new Set<string>();
  private processingActive = false;

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
    private config: ConfigService,
  ) {
    const baseDir =
      this.config.get<string>('RESUME_UPLOAD_DIR') ||
      path.join(process.cwd(), 'uploads', 'resume');
    this.uploadDir = path.isAbsolute(baseDir)
      ? baseDir
      : path.join(process.cwd(), baseDir);
  }

  private async ensureUploadDir(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  private normalizeArray(input: unknown): string[] {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input
        .map((v) => String(v).trim())
        .filter(Boolean)
        .slice(0, 50);
    }
    return String(input)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
  }

  private safeFileExt(fileName: string, mimeType: string): string {
    const known: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
      'text/plain': '.txt',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const byMime = known[mimeType];
    if (byMime) return byMime;
    const ext = path.extname(fileName || '');
    if (/^\.[a-zA-Z0-9]{1,10}$/.test(ext)) return ext.toLowerCase();
    return '.bin';
  }

  private async storeUploadedFile(file: Express.Multer.File): Promise<ResumeUploadedFile> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл не загружен');
    }
    await this.ensureUploadDir();
    const ext = this.safeFileExt(file.originalname, file.mimetype);
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const fullPath = path.join(this.uploadDir, fileName);
    await fs.writeFile(fullPath, file.buffer);
    const saved = this.fileRepo.create({
      originalName: file.originalname || fileName,
      storedPath: fullPath,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: file.size || file.buffer.length,
    });
    return this.fileRepo.save(saved);
  }

  async createCandidateFromUpload(file: Express.Multer.File): Promise<ResumeCandidate> {
    const uploadedFile = await this.storeUploadedFile(file);
    const candidate = this.candidateRepo.create({
      fullName: 'Обработка...',
      uploadedFileId: uploadedFile.id,
      branches: [],
      additionalSpecializations: [],
      languages: [],
      processingStatus: ResumeProcessingStatus.PENDING,
    });
    const saved = await this.candidateRepo.save(candidate);
    this.enqueueProcessing(saved.id);
    return this.findCandidateById(saved.id);
  }

  async createCandidateFromText(rawText: string): Promise<ResumeCandidate> {
    const normalized = rawText?.trim();
    if (!normalized) throw new BadRequestException('Текст резюме не предоставлен');
    if (normalized.length > 50000) {
      throw new BadRequestException('Текст слишком большой (максимум 50000 символов)');
    }

    const candidate = this.candidateRepo.create({
      fullName: 'Обработка...',
      rawText: normalized,
      branches: [],
      additionalSpecializations: [],
      languages: [],
      processingStatus: ResumeProcessingStatus.PENDING,
    });
    const saved = await this.candidateRepo.save(candidate);
    this.enqueueProcessing(saved.id);
    return this.findCandidateById(saved.id);
  }

  async createCandidateFromPublicForm(payload: {
    fullName?: string;
    email?: string;
    phone?: string;
    city?: string;
    specialization?: string;
    rawText?: string;
    uploadedFileId?: string;
    branches?: string[];
  }): Promise<ResumeCandidate> {
    const hasText = payload.rawText && payload.rawText.trim().length > 0;
    const hasFile = !!payload.uploadedFileId;
    if (!hasText && !hasFile) {
      throw new BadRequestException('Нужен текст резюме или загруженный файл');
    }
    const candidate = this.candidateRepo.create({
      fullName: payload.fullName?.trim() || 'Обработка...',
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      city: payload.city?.trim() || null,
      specialization: payload.specialization?.trim() || null,
      rawText: payload.rawText?.trim() || null,
      uploadedFileId: payload.uploadedFileId || null,
      branches: this.normalizeArray(payload.branches),
      additionalSpecializations: [],
      languages: [],
      processingStatus: ResumeProcessingStatus.PENDING,
    });
    const saved = await this.candidateRepo.save(candidate);
    this.enqueueProcessing(saved.id);
    return this.findCandidateById(saved.id);
  }

  async savePublicUploadedFile(file: Express.Multer.File): Promise<{ uploadedFileId: string }> {
    const uploadedFile = await this.storeUploadedFile(file);
    return { uploadedFileId: uploadedFile.id };
  }

  async findCandidates(params: CandidateListParams): Promise<{
    candidates: ResumeCandidate[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const qb = this.candidateRepo
      .createQueryBuilder('candidate')
      .leftJoinAndSelect('candidate.tags', 'tags')
      .orderBy('candidate.createdAt', 'DESC');

    if (params.priority) {
      qb.where('candidate.priority = :priority', { priority: params.priority });
    } else {
      qb.where('candidate.priority NOT IN (:...excludedPriorities)', {
        excludedPriorities: [ResumeCandidatePriority.DELETED, ResumeCandidatePriority.ARCHIVE],
      });
    }

    if (params.search) {
      qb.andWhere('candidate.fullName ILIKE :search', {
        search: `%${params.search.trim()}%`,
      });
    }
    if (params.specialization) {
      qb.andWhere('candidate.specialization = :specialization', {
        specialization: params.specialization,
      });
    }
    if (params.category) {
      qb.andWhere('candidate.qualificationCategory = :category', {
        category: params.category,
      });
    }
    if (params.status) {
      qb.andWhere('candidate.status = :status', { status: params.status });
    }
    if (params.branch) {
      qb.andWhere(':branch = ANY(candidate.branches)', { branch: params.branch });
    }
    if (params.city) {
      qb.andWhere('candidate.city = :city', { city: params.city });
    }
    if (params.workCity) {
      qb.andWhere(
        `EXISTS (
          SELECT 1
          FROM "resume_work_history" wh
          WHERE wh."candidateId" = candidate.id
            AND wh.city = :workCity
        )`,
        { workCity: params.workCity },
      );
    }
    if (params.educationCity) {
      qb.andWhere(
        `EXISTS (
          SELECT 1
          FROM "resume_education" edu
          WHERE edu."candidateId" = candidate.id
            AND edu.city = :educationCity
        )`,
        { educationCity: params.educationCity },
      );
    }
    if (params.experience) {
      if (params.experience === '10+') {
        qb.andWhere('candidate.totalExperienceYears >= :expStart', { expStart: 10 });
      } else {
        const [startRaw, endRaw] = params.experience.split('-');
        const start = Number(startRaw);
        const end = Number(endRaw);
        if (Number.isFinite(start) && Number.isFinite(end)) {
          qb.andWhere(
            'candidate.totalExperienceYears >= :expStart AND candidate.totalExperienceYears < :expEnd',
            { expStart: start, expEnd: end },
          );
        }
      }
    }
    if (params.accreditation === 'yes') {
      qb.andWhere('candidate.accreditationStatus = true');
    } else if (params.accreditation === 'no') {
      qb.andWhere('candidate.accreditationStatus = false');
    }

    const total = await qb.getCount();
    const candidates = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { candidates, total, page, limit };
  }

  async findCandidateById(id: string): Promise<ResumeCandidate> {
    const candidate = await this.candidateRepo.findOne({
      where: { id },
      relations: ['workHistory', 'education', 'cmeCourses', 'notes', 'tags'],
    });
    if (!candidate) throw new NotFoundException('Кандидат не найден');
    return candidate;
  }

  async updateCandidate(id: string, payload: CandidateUpdatePayload): Promise<ResumeCandidate> {
    const candidate = await this.findCandidateById(id);
    Object.assign(candidate, payload);
    if (payload.branches !== undefined) {
      candidate.branches = this.normalizeArray(payload.branches);
    }
    await this.candidateRepo.save(candidate);
    return this.findCandidateById(id);
  }

  async removeCandidate(id: string): Promise<void> {
    const candidate = await this.findCandidateById(id);
    candidate.priority = ResumeCandidatePriority.DELETED;
    await this.candidateRepo.save(candidate);
  }

  async reprocessCandidate(id: string): Promise<{ queued: boolean }> {
    await this.findCandidateById(id);
    this.enqueueProcessing(id);
    return { queued: true };
  }

  async deduplicateCandidate(candidateId: string): Promise<{
    status: 'no_duplicates' | 'marked_deleted';
    duplicateCandidateId?: string;
  }> {
    const candidate = await this.findCandidateById(candidateId);
    const duplicate = await this.findPotentialDuplicate(candidate);
    if (!duplicate) return { status: 'no_duplicates' };
    candidate.priority = ResumeCandidatePriority.DELETED;
    await this.candidateRepo.save(candidate);
    return { status: 'marked_deleted', duplicateCandidateId: duplicate.id };
  }

  private async findPotentialDuplicate(
    candidate: ResumeCandidate,
  ): Promise<ResumeCandidate | null> {
    if (candidate.email?.trim()) {
      const byEmail = await this.candidateRepo.findOne({
        where: {
          id: Not(candidate.id),
          email: ILike(candidate.email.trim()),
          priority: Not(ResumeCandidatePriority.DELETED),
        },
      });
      if (byEmail) return byEmail;
    }
    if (candidate.phone?.trim()) {
      const byPhone = await this.candidateRepo.findOne({
        where: {
          id: Not(candidate.id),
          phone: ILike(candidate.phone.trim()),
          priority: Not(ResumeCandidatePriority.DELETED),
        },
      });
      if (byPhone) return byPhone;
    }
    if (candidate.fullName?.trim()) {
      const byName = await this.candidateRepo.findOne({
        where: {
          id: Not(candidate.id),
          fullName: ILike(candidate.fullName.trim()),
          priority: Not(ResumeCandidatePriority.DELETED),
        },
      });
      if (byName) return byName;
    }
    return null;
  }

  async listNotes(candidateId: string): Promise<ResumeCandidateNote[]> {
    await this.findCandidateById(candidateId);
    return this.noteRepo.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
    });
  }

  async addNote(
    candidateId: string,
    payload: { content: string; authorName: string },
  ): Promise<ResumeCandidateNote> {
    await this.findCandidateById(candidateId);
    const note = this.noteRepo.create({
      candidateId,
      content: payload.content.trim(),
      authorName: payload.authorName.trim(),
    });
    return this.noteRepo.save(note);
  }

  async deleteNote(candidateId: string, noteId: string): Promise<void> {
    await this.findCandidateById(candidateId);
    const note = await this.noteRepo.findOne({ where: { id: noteId, candidateId } });
    if (!note) throw new NotFoundException('Заметка не найдена');
    await this.noteRepo.remove(note);
  }

  async listTags(candidateId: string): Promise<ResumeCandidateTag[]> {
    await this.findCandidateById(candidateId);
    return this.tagRepo.find({
      where: { candidateId },
      order: { label: 'ASC' },
    });
  }

  async addTag(
    candidateId: string,
    payload: { label: string; color?: string | null },
  ): Promise<ResumeCandidateTag> {
    await this.findCandidateById(candidateId);
    const normalized = payload.label.trim();
    if (!normalized) throw new BadRequestException('Label обязателен');
    const existing = await this.tagRepo.findOne({
      where: { candidateId, label: ILike(normalized) },
    });
    if (existing) return existing;
    const tag = this.tagRepo.create({
      candidateId,
      label: normalized,
      color: payload.color?.trim() || null,
    });
    return this.tagRepo.save(tag);
  }

  async deleteTag(candidateId: string, tagId: string): Promise<void> {
    await this.findCandidateById(candidateId);
    const tag = await this.tagRepo.findOne({ where: { id: tagId, candidateId } });
    if (!tag) throw new NotFoundException('Тег не найден');
    await this.tagRepo.remove(tag);
  }

  async replaceTags(
    candidateId: string,
    tags: Array<{ label: string; color?: string | null }>,
  ): Promise<ResumeCandidateTag[]> {
    await this.findCandidateById(candidateId);
    if (!Array.isArray(tags) || tags.length > 20) {
      throw new BadRequestException('Максимум 20 тегов');
    }
    await this.tagRepo.delete({ candidateId });
    if (tags.length > 0) {
      const entities = tags.map((t) =>
        this.tagRepo.create({
          candidateId,
          label: t.label.trim().slice(0, 100),
          color: t.color?.trim() || null,
        }),
      );
      await this.tagRepo.save(entities);
    }
    return this.tagRepo.find({ where: { candidateId }, order: { label: 'ASC' } });
  }

  async getFilterOptions(): Promise<{
    specializations: string[];
    categories: string[];
    statuses: string[];
    priorities: string[];
    branches: string[];
    cities: string[];
    workCities: string[];
    educationCities: string[];
  }> {
    const [specializationsRows, citiesRows, workCitiesRows, educationCitiesRows, branchesRows] =
      await Promise.all([
        this.candidateRepo
          .createQueryBuilder('candidate')
          .select('DISTINCT candidate.specialization', 'value')
          .where('candidate.specialization IS NOT NULL')
          .andWhere('candidate.priority != :deletedPriority', {
            deletedPriority: ResumeCandidatePriority.DELETED,
          })
          .orderBy('value', 'ASC')
          .getRawMany<{ value: string }>(),
        this.candidateRepo
          .createQueryBuilder('candidate')
          .select('DISTINCT candidate.city', 'value')
          .where('candidate.city IS NOT NULL')
          .andWhere('candidate.priority != :deletedPriority', {
            deletedPriority: ResumeCandidatePriority.DELETED,
          })
          .orderBy('value', 'ASC')
          .getRawMany<{ value: string }>(),
        this.workHistoryRepo
          .createQueryBuilder('wh')
          .select('DISTINCT wh.city', 'value')
          .where('wh.city IS NOT NULL')
          .orderBy('value', 'ASC')
          .getRawMany<{ value: string }>(),
        this.educationRepo
          .createQueryBuilder('edu')
          .select('DISTINCT edu.city', 'value')
          .where('edu.city IS NOT NULL')
          .orderBy('value', 'ASC')
          .getRawMany<{ value: string }>(),
        this.candidateRepo.query(`
          SELECT DISTINCT UNNEST("branches") AS value
          FROM "resume_candidates"
          WHERE "priority" != $1
          ORDER BY value ASC
        `, [ResumeCandidatePriority.DELETED]) as Promise<Array<{ value: string }>>,
      ]);

    return {
      specializations: specializationsRows.map((r) => r.value).filter(Boolean),
      categories: Object.values(ResumeQualificationCategory),
      statuses: Object.values(ResumeCandidateStatus),
      priorities: Object.values(ResumeCandidatePriority),
      branches: branchesRows.map((r) => r.value).filter(Boolean),
      cities: citiesRows.map((r) => r.value).filter(Boolean),
      workCities: workCitiesRows.map((r) => r.value).filter(Boolean),
      educationCities: educationCitiesRows.map((r) => r.value).filter(Boolean),
    };
  }

  async exportCandidates(params: CandidateListParams): Promise<Buffer> {
    const data = await this.findCandidates({ ...params, page: 1, limit: 10000 });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Кандидаты');
    worksheet.columns = [
      { header: 'ФИО', key: 'fullName', width: 35 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Телефон', key: 'phone', width: 20 },
      { header: 'Город', key: 'city', width: 20 },
      { header: 'Специализация', key: 'specialization', width: 24 },
      { header: 'Категория', key: 'qualificationCategory', width: 18 },
      { header: 'Статус', key: 'status', width: 15 },
      { header: 'Приоритет', key: 'priority', width: 15 },
      { header: 'Стаж (лет)', key: 'totalExperienceYears', width: 14 },
      { header: 'Аккредитация', key: 'accreditationStatus', width: 14 },
      { header: 'Филиалы', key: 'branches', width: 30 },
      { header: 'Создан', key: 'createdAt', width: 20 },
    ];
    worksheet.getRow(1).font = { bold: true };
    for (const candidate of data.candidates) {
      worksheet.addRow({
        fullName: candidate.fullName,
        email: candidate.email || '',
        phone: candidate.phone || '',
        city: candidate.city || '',
        specialization: candidate.specialization || '',
        qualificationCategory: candidate.qualificationCategory,
        status: candidate.status,
        priority: candidate.priority,
        totalExperienceYears: candidate.totalExperienceYears ?? '',
        accreditationStatus: candidate.accreditationStatus ? 'Да' : 'Нет',
        branches: candidate.branches?.join(', ') || '',
        createdAt: candidate.createdAt.toISOString(),
      });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async getUploadedFileById(fileId: string): Promise<ResumeUploadedFile> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Файл не найден');
    return file;
  }

  async readUploadedFile(fileId: string): Promise<{ file: ResumeUploadedFile; content: Buffer }> {
    const file = await this.getUploadedFileById(fileId);
    const content = await fs.readFile(file.storedPath);
    return { file, content };
  }

  async getAnalyticsSummary(): Promise<{
    totals: Record<string, number>;
    byStatus: Array<{ key: string; count: number }>;
    byPriority: Array<{ key: string; count: number }>;
    byCategory: Array<{ key: string; count: number }>;
    topSpecializations: Array<{ key: string; count: number }>;
  }> {
    const totalsRaw = await this.candidateRepo
      .createQueryBuilder('candidate')
      .select('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN candidate.priority = :active THEN 1 ELSE 0 END)`,
        'active',
      )
      .addSelect(
        `SUM(CASE WHEN candidate.priority = :archive THEN 1 ELSE 0 END)`,
        'archive',
      )
      .addSelect(
        `SUM(CASE WHEN candidate.processingStatus = :failed THEN 1 ELSE 0 END)`,
        'failed',
      )
      .setParameters({
        active: ResumeCandidatePriority.ACTIVE,
        archive: ResumeCandidatePriority.ARCHIVE,
        failed: ResumeProcessingStatus.FAILED,
      })
      .where('candidate.priority != :deletedPriority', {
        deletedPriority: ResumeCandidatePriority.DELETED,
      })
      .getRawOne<{ total: string; active: string; archive: string; failed: string }>();

    const [byStatusRaw, byPriorityRaw, byCategoryRaw, topSpecializationsRaw] =
      await Promise.all([
        this.candidateRepo
          .createQueryBuilder('candidate')
          .select('candidate.status', 'key')
          .addSelect('COUNT(*)', 'count')
          .where('candidate.priority != :deletedPriority', {
            deletedPriority: ResumeCandidatePriority.DELETED,
          })
          .groupBy('candidate.status')
          .getRawMany<{ key: string; count: string }>(),
        this.candidateRepo
          .createQueryBuilder('candidate')
          .select('candidate.priority', 'key')
          .addSelect('COUNT(*)', 'count')
          .where('candidate.priority != :deletedPriority', {
            deletedPriority: ResumeCandidatePriority.DELETED,
          })
          .groupBy('candidate.priority')
          .getRawMany<{ key: string; count: string }>(),
        this.candidateRepo
          .createQueryBuilder('candidate')
          .select('candidate.qualificationCategory', 'key')
          .addSelect('COUNT(*)', 'count')
          .where('candidate.priority != :deletedPriority', {
            deletedPriority: ResumeCandidatePriority.DELETED,
          })
          .groupBy('candidate.qualificationCategory')
          .getRawMany<{ key: string; count: string }>(),
        this.candidateRepo
          .createQueryBuilder('candidate')
          .select('candidate.specialization', 'key')
          .addSelect('COUNT(*)', 'count')
          .where('candidate.specialization IS NOT NULL')
          .andWhere('candidate.priority != :deletedPriority', {
            deletedPriority: ResumeCandidatePriority.DELETED,
          })
          .groupBy('candidate.specialization')
          .orderBy('COUNT(*)', 'DESC')
          .limit(10)
          .getRawMany<{ key: string; count: string }>(),
      ]);

    return {
      totals: {
        total: parseInt(totalsRaw?.total || '0', 10),
        active: parseInt(totalsRaw?.active || '0', 10),
        archive: parseInt(totalsRaw?.archive || '0', 10),
        failed: parseInt(totalsRaw?.failed || '0', 10),
      },
      byStatus: byStatusRaw.map((r) => ({ key: r.key, count: parseInt(r.count, 10) })),
      byPriority: byPriorityRaw.map((r) => ({ key: r.key, count: parseInt(r.count, 10) })),
      byCategory: byCategoryRaw.map((r) => ({ key: r.key, count: parseInt(r.count, 10) })),
      topSpecializations: topSpecializationsRaw.map((r) => ({
        key: r.key,
        count: parseInt(r.count, 10),
      })),
    };
  }

  async getFullAnalytics(params: {
    period?: string;
    branch?: string;
  }): Promise<Record<string, unknown>> {
    const now = new Date();
    const BRANCHES = ['Каспийск', 'Махачкала', 'Хасавюрт'];
    const MONTH_NAMES = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, year: 365 };
    const days = params.period && daysMap[params.period] ? daysMap[params.period] : null;
    const currentFrom = days ? new Date(now.getTime() - days * 86400000) : new Date(2000, 0, 1);
    const previousFrom = days ? new Date(currentFrom.getTime() - days * 86400000) : null;
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const baseQb = () => {
      const qb = this.candidateRepo.createQueryBuilder('c')
        .where('c.priority != :del', { del: ResumeCandidatePriority.DELETED });
      if (params.branch) qb.andWhere(':br = ANY(c.branches)', { br: params.branch });
      return qb;
    };

    const currentQb = () => baseQb().andWhere('c.createdAt >= :from AND c.createdAt <= :to', { from: currentFrom, to: now });
    const previousQb = () => previousFrom ? baseQb().andWhere('c.createdAt >= :from AND c.createdAt <= :to', { from: previousFrom, to: currentFrom }) : null;

    const [
      totalCurrent, totalPrevious,
      processedCurrent, processedPrevious,
      hiredCurrent, hiredPrevious,
      avgExpResult, avgExpPrevResult,
      expiringCount,
      distinctSpecs, distinctSpecsPrev,
    ] = await Promise.all([
      currentQb().getCount(),
      previousQb()?.getCount() ?? Promise.resolve(null),
      currentQb().andWhere('c.processingStatus = :comp', { comp: ResumeProcessingStatus.COMPLETED }).getCount(),
      previousQb()?.andWhere('c.processingStatus = :comp', { comp: ResumeProcessingStatus.COMPLETED }).getCount() ?? Promise.resolve(null),
      currentQb().andWhere('c.status = :hired', { hired: ResumeCandidateStatus.HIRED }).getCount(),
      previousQb()?.andWhere('c.status = :hired', { hired: ResumeCandidateStatus.HIRED }).getCount() ?? Promise.resolve(null),
      currentQb().andWhere('c.processingStatus = :comp AND c.totalExperienceYears IS NOT NULL', { comp: ResumeProcessingStatus.COMPLETED })
        .select('AVG(c.totalExperienceYears)', 'avg').getRawOne<{ avg: string | null }>(),
      previousQb()?.andWhere('c.processingStatus = :comp AND c.totalExperienceYears IS NOT NULL', { comp: ResumeProcessingStatus.COMPLETED })
        .select('AVG(c.totalExperienceYears)', 'avg').getRawOne<{ avg: string | null }>() ?? Promise.resolve(null),
      baseQb()
        .andWhere('c.accreditationExpiryDate >= :now AND c.accreditationExpiryDate <= :expire', { now, expire: new Date(now.getTime() + 90 * 86400000) })
        .getCount(),
      currentQb().andWhere('c.processingStatus = :comp AND c.specialization IS NOT NULL', { comp: ResumeProcessingStatus.COMPLETED })
        .select('DISTINCT c.specialization').getRawMany<{ c_specialization: string }>(),
      previousQb()?.andWhere('c.processingStatus = :comp AND c.specialization IS NOT NULL', { comp: ResumeProcessingStatus.COMPLETED })
        .select('DISTINCT c.specialization').getRawMany<{ c_specialization: string }>() ?? Promise.resolve(null),
    ]);

    const avgExpCurrent = Math.round(parseFloat(avgExpResult?.avg || '0') * 10) / 10;
    const avgExpPrevious = avgExpPrevResult ? Math.round(parseFloat(avgExpPrevResult.avg || '0') * 10) / 10 : null;
    const convCurrent = processedCurrent > 0 ? Math.round((hiredCurrent / processedCurrent) * 100) : 0;
    const convPrevious = processedPrevious && processedPrevious > 0 && hiredPrevious !== null ? Math.round((hiredPrevious / processedPrevious) * 100) : null;
    const specCovCurrent = distinctSpecs?.length || 0;
    const specCovPrevious = distinctSpecsPrev ? distinctSpecsPrev.length : null;

    const SPECIALIZATIONS_COUNT = 24;
    const kpis = [
      { key: 'total', title: 'Всего кандидатов', value: totalCurrent, previousValue: totalPrevious, format: 'number', icon: 'Users', color: 'text-blue-600', trendDirection: 'up-good' },
      { key: 'processed', title: 'Обработано', value: processedCurrent, previousValue: processedPrevious, format: 'number', icon: 'UserCheck', color: 'text-green-600', trendDirection: 'up-good' },
      { key: 'avgExperience', title: 'Средний стаж (лет)', value: avgExpCurrent, previousValue: avgExpPrevious, format: 'decimal', icon: 'Clock', color: 'text-indigo-600', trendDirection: 'neutral' },
      { key: 'expiring', title: 'Истекает аккредитация', value: expiringCount, previousValue: null, format: 'number', icon: 'AlertTriangle', color: expiringCount > 0 ? 'text-orange-600' : 'text-gray-400', trendDirection: 'up-bad' },
      { key: 'conversion', title: 'Конверсия воронки', value: convCurrent, previousValue: convPrevious, format: 'percent', icon: 'Target', color: 'text-purple-600', trendDirection: 'up-good' },
      { key: 'coverage', title: 'Покрытие специализаций', value: specCovCurrent, previousValue: specCovPrevious, format: 'fraction', fractionTotal: SPECIALIZATIONS_COUNT, icon: 'Activity', color: 'text-teal-600', trendDirection: 'up-good' },
    ];

    const timelineCandidates = await baseQb()
      .andWhere('c.createdAt >= :since', { since: twelveMonthsAgo })
      .select(['c.createdAt'])
      .getMany();

    const monthMap = new Map<string, number>();
    timelineCandidates.forEach((c) => {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });
    const timeline: { month: string; label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      timeline.push({ month: key, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, count: monthMap.get(key) || 0 });
    }

    const funnelCandidates = await currentQb()
      .select(['c.status', 'c.priority', 'c.processingStatus'])
      .getMany();
    const fTotal = funnelCandidates.length;
    const fProcessed = funnelCandidates.filter((c) => c.processingStatus === ResumeProcessingStatus.COMPLETED).length;
    const fActive = funnelCandidates.filter((c) => c.priority === ResumeCandidatePriority.ACTIVE).length;
    const fReviewing = funnelCandidates.filter((c) => c.status === ResumeCandidateStatus.REVIEWING).length;
    const fInvited = funnelCandidates.filter((c) => c.status === ResumeCandidateStatus.INVITED).length;
    const fHired = funnelCandidates.filter((c) => c.status === ResumeCandidateStatus.HIRED).length;
    const funnelRaw = [
      { name: 'Всего', value: fTotal, color: '#94a3b8' },
      { name: 'Обработано', value: fProcessed, color: '#3b82f6' },
      { name: 'Актуальные', value: fActive, color: '#6366f1' },
      { name: 'На рассмотрении', value: fReviewing, color: '#8b5cf6' },
      { name: 'Приглашены', value: fInvited, color: '#a855f7' },
      { name: 'Приняты', value: fHired, color: '#22c55e' },
    ];
    const funnel = funnelRaw.map((stage, i) => ({
      ...stage,
      conversionFromPrevious: i === 0 || funnelRaw[i - 1].value === 0 ? null : Math.round((stage.value / funnelRaw[i - 1].value) * 100),
    }));

    const completedCandidates = await currentQb()
      .andWhere('c.processingStatus = :comp', { comp: ResumeProcessingStatus.COMPLETED })
      .select(['c.specialization', 'c.qualificationCategory', 'c.totalExperienceYears', 'c.branches', 'c.status'])
      .getMany();

    const specMap = new Map<string, number>();
    completedCandidates.forEach((c) => {
      const spec = c.specialization || 'Не указано';
      specMap.set(spec, (specMap.get(spec) || 0) + 1);
    });
    const specializations = Array.from(specMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const totalCompleted = completedCandidates.length;
    const categoryRaw = [
      { name: 'Высшая', key: 'HIGHEST' }, { name: 'Первая', key: 'FIRST' },
      { name: 'Вторая', key: 'SECOND' }, { name: 'Без категории', key: 'NONE' },
    ];
    const categories = categoryRaw.map(({ name, key }) => {
      const count = completedCandidates.filter((c) => c.qualificationCategory === key).length;
      return { name, key, count, percentage: totalCompleted > 0 ? Math.round((count / totalCompleted) * 100) : 0 };
    }).filter((c) => c.count > 0);

    const expBuckets = [
      { name: '0-2', min: 0, max: 2, count: 0 }, { name: '2-5', min: 2, max: 5, count: 0 },
      { name: '5-10', min: 5, max: 10, count: 0 }, { name: '10-15', min: 10, max: 15, count: 0 },
      { name: '15-20', min: 15, max: 20, count: 0 }, { name: '20+', min: 20, max: Infinity, count: 0 },
    ];
    completedCandidates.forEach((c) => {
      const exp = c.totalExperienceYears || 0;
      const bucket = expBuckets.find((b) => exp >= b.min && exp < b.max);
      if (bucket) bucket.count++;
    });
    const experienceBuckets = expBuckets.map((b) => ({ name: b.name, count: b.count }));

    const branchMap = new Map<string, Record<string, number>>();
    BRANCHES.forEach((b) => branchMap.set(b, { NEW: 0, REVIEWING: 0, INVITED: 0, HIRED: 0 }));
    completedCandidates.filter((c) => c.branches?.length > 0).forEach((c) => {
      (c.branches || []).forEach((branch: string) => {
        const entry = branchMap.get(branch);
        if (entry && c.status in entry) (entry as Record<string, number>)[c.status]++;
      });
    });
    const branchDistribution = Array.from(branchMap.entries()).map(([branch, statuses]) => ({
      branch, ...statuses, total: Object.values(statuses).reduce((s, n) => s + n, 0),
    }));

    const SPECIALIZATIONS_LIST = [
      'Педиатр','Неонатолог','Детский хирург','Детский невролог','Детский кардиолог',
      'Детский эндокринолог','Детский гастроэнтеролог','Детский офтальмолог',
      'Детский оториноларинголог (ЛОР)','Детский уролог','Детский ортопед-травматолог',
      'Детский аллерголог-иммунолог','Детский пульмонолог','Детский дерматолог',
      'Детский инфекционист','Детский реаниматолог-анестезиолог','Детский психиатр',
      'Детский ревматолог','Детский нефролог','Детский гематолог-онколог',
      'Врач УЗД','Рентгенолог','Клинический лабораторный диагност','Медицинская сестра',
    ];
    const matrix = new Map<string, Record<string, number>>();
    SPECIALIZATIONS_LIST.forEach((spec) => {
      const row: Record<string, number> = {};
      BRANCHES.forEach((b) => (row[b] = 0));
      matrix.set(spec, row);
    });
    completedCandidates.filter((c) => c.specialization && c.branches?.length > 0).forEach((c) => {
      const row = matrix.get(c.specialization!);
      if (row) (c.branches || []).forEach((b: string) => { if (b in row) row[b]++; });
    });
    const branchCoverage = Array.from(matrix.entries())
      .map(([specialization, branches]) => ({ specialization, branches, total: Object.values(branches).reduce((s, n) => s + n, 0) }))
      .sort((a, b) => b.total - a.total);

    const tagStats = await this.tagRepo
      .createQueryBuilder('t')
      .select('t.label', 'label')
      .addSelect('t.color', 'color')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('t.candidate', 'c')
      .where('c.priority != :del', { del: ResumeCandidatePriority.DELETED })
      .andWhere('c.createdAt >= :from', { from: currentFrom })
      .groupBy('t.label')
      .addGroupBy('t.color')
      .orderBy('COUNT(*)', 'DESC')
      .limit(15)
      .getRawMany<{ label: string; color: string | null; count: string }>();
    const topTags = tagStats.map((t) => ({ label: t.label, count: parseInt(t.count, 10), color: t.color }));

    const expiringAccreditations = await baseQb()
      .andWhere('c.accreditationExpiryDate >= :now AND c.accreditationExpiryDate <= :expire', { now, expire: new Date(now.getTime() + 90 * 86400000) })
      .select(['c.id', 'c.fullName', 'c.specialization', 'c.accreditationExpiryDate'])
      .orderBy('c.accreditationExpiryDate', 'ASC')
      .getMany();

    return { kpis, timeline, funnel, specializations, categories, experienceBuckets, branchDistribution, branchCoverage, topTags, expiringAccreditations };
  }

  private async extractPdfText(filePath: string): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjsLib.getDocument(filePath).promise;
    const pages: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item: unknown) => 'str' in (item as Record<string, unknown>))
        .map((item: unknown) => (item as { str: string }).str)
        .join(' ');
      if (pageText.trim()) pages.push(pageText.trim());
    }

    return pages.join('\n\n');
  }

  private async extractTextFromFile(file: ResumeUploadedFile): Promise<string> {
    try {
      if (file.mimeType.startsWith('text/')) {
        const buffer = await fs.readFile(file.storedPath);
        return buffer.toString('utf8');
      }

      if (file.mimeType === 'application/pdf') {
        const text = await this.extractPdfText(file.storedPath);
        if (text && text.trim().length > 20) return text.trim();
        throw new BadRequestException('PDF не содержит извлекаемого текста (возможно, скан-копия)');
      }

      if (
        file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.originalName?.endsWith('.docx')
      ) {
        const buffer = await fs.readFile(file.storedPath);
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value?.trim();
        if (text && text.length > 20) return text;
        throw new BadRequestException('DOCX не содержит текста');
      }

      if (
        file.mimeType === 'application/msword' ||
        file.originalName?.endsWith('.doc')
      ) {
        const buffer = await fs.readFile(file.storedPath);
        const text = buffer.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ').trim();
        if (text.length > 50) return text;
        throw new BadRequestException('Формат .doc: не удалось извлечь текст');
      }

      const buffer = await fs.readFile(file.storedPath);
      const fallback = buffer.toString('utf8').replace(/\u0000/g, ' ').trim();
      if (fallback.length > 50) return fallback;
      throw new BadRequestException('Не удалось извлечь текст из файла');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `Не удалось прочитать файл: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private parseRawText(rawText: string): Partial<ResumeCandidate> {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const email = rawText.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    )?.[0];
    const phone = rawText.match(
      /(\+?\d[\d\s\-()]{8,}\d)/,
    )?.[0];
    const name = lines[0] || 'Кандидат';
    const yearsMatch = rawText.match(/(\d{1,2})\s*(?:лет|года|год)/i);
    const experience = yearsMatch ? Number(yearsMatch[1]) : null;

    const specializationMap: Array<{ keyword: RegExp; specialization: string }> = [
      { keyword: /уролог/i, specialization: 'Урология' },
      { keyword: /нефрол/i, specialization: 'Нефрология' },
      { keyword: /терапевт|терапия/i, specialization: 'Терапия' },
      { keyword: /хирург/i, specialization: 'Хирургия' },
      { keyword: /анестези|реанимат/i, specialization: 'Анестезиология-реаниматология' },
      { keyword: /кардиолог/i, specialization: 'Кардиология' },
    ];
    const specialization =
      specializationMap.find((item) => item.keyword.test(rawText))?.specialization || null;

    return {
      fullName: name.slice(0, 300),
      email: email?.slice(0, 255) || null,
      phone: phone?.slice(0, 255) || null,
      specialization,
      totalExperienceYears: experience,
      aiConfidence: 0.65,
    };
  }

  private parseJsonFromText(raw: string): Record<string, unknown> | null {
    const text = raw?.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          const parsed = JSON.parse(text.slice(start, end + 1));
          return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private parseOllamaEnum<T extends string>(
    value: unknown,
    allowed: readonly T[],
  ): T | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toUpperCase() as T;
    return allowed.includes(normalized) ? normalized : undefined;
  }

  private async parseWithOllama(rawText: string): Promise<Partial<ResumeCandidate> | null> {
    const hostRaw = this.config.get<string>('OLLAMA_HOST') || '';
    const modelRaw = this.config.get<string>('OLLAMA_MODEL') || '';
    const host = hostRaw.trim().replace(/\/+$/, '');
    const model = modelRaw.trim();
    if (!host || !model) return null;

    const prompt = `Ты — эксперт-рекрутер в детской медицинской клинике (Россия).
Твоя задача — извлечь структурированную информацию из резюме медицинского специалиста и вернуть её СТРОГО в JSON-формате с указанными ниже ключами.

КОНТЕКСТ:
- Это ДЕТСКАЯ (педиатрическая) клиника
- Кандидаты — медицинские специалисты
- Документы на русском языке

ПРАВИЛА ИЗВЛЕЧЕНИЯ:

1. ФИО: Полное имя с отчеством, если указано.

2. КОНТАКТЫ: Email, телефон, город проживания.

3. ОБРАЗОВАНИЕ: Определи основной медицинский ВУЗ, факультет, год выпуска.
   Отдельно определи интернатуру и ординатуру, если упомянуты.
   ГОРОДА: Для каждого учебного заведения и места работы ОБЯЗАТЕЛЬНО определи город.
   Если город не указан явно — определи его по названию учреждения
   (например, «Дагестанский государственный медицинский университет» → «Махачкала»,
   «РНИМУ им. Пирогова» → «Москва», «СПбГПМУ» → «Санкт-Петербург»).
   Используй свои знания о расположении российских медицинских ВУЗов и клиник.

4. СПЕЦИАЛИЗАЦИЯ: Если специализация совпадает с одной из известных — используй значение из списка:
   Педиатр, Неонатолог, Детский хирург, Детский невролог, Детский кардиолог,
   Детский эндокринолог, Детский гастроэнтеролог, Детский офтальмолог,
   Детский оториноларинголог (ЛОР), Детский уролог, Детский ортопед-травматолог,
   Детский аллерголог-иммунолог, Детский пульмонолог, Детский дерматолог,
   Детский инфекционист, Детский реаниматолог-анестезиолог, Детский психиатр,
   Детский ревматолог, Детский нефролог, Детский гематолог-онколог,
   Врач УЗД, Рентгенолог, Клинический лабораторный диагност, Медицинская сестра.
   ПРАВИЛА: НЕ добавляй префикс "врач" (например, "врач педиатр" → "Педиатр").
   Если специализация близка к одному из значений списка — используй значение из списка.
   Если специализация НЕ совпадает ни с одним значением — укажи как есть (именительный падеж, с заглавной).

5. КВАЛИФИКАЦИОННАЯ КАТЕГОРИЯ: Ищи "высшая категория", "первая категория", "вторая категория".
   Значения: "HIGHEST", "FIRST", "SECOND", "NONE". Если не указано — "NONE".

6. АККРЕДИТАЦИЯ: Ищи "аккредитация", даты действия, номера сертификатов.
   Также ищи "сертификат специалиста".

7. ОПЫТ РАБОТЫ: Извлеки ВСЕ должности с датами. Рассчитай общий стаж
   и стаж по специальности из дат трудовой истории.
   Для каждого места работы определи город (см. правило 3 про города).

8. НМО/ПОВЫШЕНИЕ КВАЛИФИКАЦИИ: Ищи "повышение квалификации", "НМО баллы",
   "сертификационные циклы", курсы.

9. ДАТЫ: Когда точные даты недоступны, выводи из контекста
   (например, "2015-2017" значит startDate="2015-01", endDate="2017-12").
   Всегда используй ISO формат.

10. УВЕРЕННОСТЬ: Оцени от 0 до 1:
    - 0.9-1.0: Чёткое, хорошо структурированное резюме со всеми ключевыми полями
    - 0.7-0.9: Большая часть информации есть, небольшие пробелы
    - 0.5-0.7: Значительные пробелы или неоднозначная информация
    - Ниже 0.5: Очень плохое качество текста, многое приходится угадывать

ВАЖНО: Извлекай только информацию, которая ЯВНО указана или может быть обоснованно выведена.
НЕ выдумывай данные. Для отсутствующих полей используй null.

ОБЯЗАТЕЛЬНАЯ СТРУКТУРА JSON-ОТВЕТА (используй ИМЕННО эти ключи):
{
  "fullName": "ФИО кандидата",
  "email": "email или null",
  "phone": "телефон в формате +7XXXXXXXXXX или null",
  "birthDate": "YYYY-MM-DD или null",
  "city": "город или null",
  "university": "основной мед. ВУЗ или null",
  "faculty": "факультет или null",
  "graduationYear": 2020,
  "internshipPlace": "место интернатуры или null",
  "internshipSpecialty": "специальность интернатуры или null",
  "internshipYearEnd": 2021,
  "residencyPlace": "место ординатуры или null",
  "residencySpecialty": "специальность ординатуры или null",
  "residencyYearEnd": 2023,
  "specialization": "основная специализация или null",
  "additionalSpecializations": ["доп. специализация 1"],
  "qualificationCategory": "HIGHEST | FIRST | SECOND | NONE",
  "categoryAssignedDate": "YYYY-MM-DD или null",
  "accreditationStatus": true,
  "accreditationDate": "YYYY-MM-DD или null",
  "accreditationExpiryDate": "YYYY-MM-DD или null",
  "certificateNumber": "номер сертификата или null",
  "certificateIssueDate": "YYYY-MM-DD или null",
  "certificateExpiryDate": "YYYY-MM-DD или null",
  "totalExperienceYears": 10.5,
  "specialtyExperienceYears": 8.0,
  "nmoPoints": 150,
  "publications": "список публикаций или null",
  "languages": ["Русский", "Английский"],
  "additionalSkills": "навыки или null",
  "workHistory": [
    {
      "organization": "Название учреждения",
      "position": "Должность",
      "department": "Отделение или null",
      "city": "Город или null",
      "startDate": "YYYY-MM или null",
      "endDate": "YYYY-MM или null",
      "isCurrent": false,
      "description": "описание или null"
    }
  ],
  "education": [
    {
      "institution": "Название учебного заведения",
      "faculty": "Факультет или null",
      "specialty": "Специальность или null",
      "degree": "Степень или null",
      "city": "Город или null",
      "startYear": 2015,
      "endYear": 2021,
      "type": "higher | internship | residency | retraining | other"
    }
  ],
  "cmeCourses": [
    {
      "courseName": "Название курса",
      "provider": "Организатор или null",
      "completedAt": "YYYY-MM или null",
      "hours": 72,
      "nmoPoints": 36,
      "certificateNumber": "номер или null"
    }
  ],
  "confidence": 0.85
}

Верни ТОЛЬКО JSON. Без markdown, без пояснений, без комментариев.

Текст резюме:
${rawText.slice(0, 50000)}`;

    const controller = new AbortController();
    const timeoutMs = Math.max(
      5000,
      parseInt(this.config.get<string>('OLLAMA_TIMEOUT_MS') || '45000', 10),
    );
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Ollama HTTP ${res.status}`);
      }
      const data = (await res.json()) as { response?: string };
      const parsed = this.parseJsonFromText(data?.response || '');
      if (!parsed) return null;

      const out: Partial<ResumeCandidate> & {
        _workHistory?: unknown[];
        _education?: unknown[];
        _cmeCourses?: unknown[];
      } = {};

      const str = (v: unknown, max = 255) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
      const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
      const intNum = (v: unknown) => {
        const n = num(v);
        return n !== null ? Math.round(n) : null;
      };
      const isoDate = (v: unknown): Date | null => {
        if (typeof v !== 'string' || !v.trim()) return null;
        const d = new Date(v.trim());
        return isNaN(d.getTime()) ? null : d;
      };

      if (str(parsed.fullName, 300)) out.fullName = str(parsed.fullName, 300)!;
      out.email = str(parsed.email);
      out.phone = str(parsed.phone);
      out.city = str(parsed.city);
      out.specialization = str(parsed.specialization);
      out.university = str(parsed.university);
      out.faculty = str(parsed.faculty);
      out.graduationYear = intNum(parsed.graduationYear);
      out.internshipPlace = str(parsed.internshipPlace);
      out.internshipSpecialty = str(parsed.internshipSpecialty);
      out.internshipYearEnd = intNum(parsed.internshipYearEnd);
      out.residencyPlace = str(parsed.residencyPlace);
      out.residencySpecialty = str(parsed.residencySpecialty);
      out.residencyYearEnd = intNum(parsed.residencyYearEnd);
      out.additionalSkills = str(parsed.additionalSkills, 5000);
      out.publications = str(parsed.publications, 5000);
      out.certificateNumber = str(parsed.certificateNumber);

      if (num(parsed.totalExperienceYears) !== null) out.totalExperienceYears = num(parsed.totalExperienceYears);
      if (num(parsed.specialtyExperienceYears) !== null) out.specialtyExperienceYears = num(parsed.specialtyExperienceYears);
      if (intNum(parsed.nmoPoints) !== null) out.nmoPoints = Math.max(0, intNum(parsed.nmoPoints)!);

      if (typeof parsed.accreditationStatus === 'boolean') out.accreditationStatus = parsed.accreditationStatus;
      const accDate = isoDate(parsed.accreditationDate);
      if (accDate) out.accreditationDate = accDate;
      const accExpiry = isoDate(parsed.accreditationExpiryDate);
      if (accExpiry) out.accreditationExpiryDate = accExpiry;
      const catDate = isoDate(parsed.categoryAssignedDate);
      if (catDate) out.categoryAssignedDate = catDate;
      const certIssue = isoDate(parsed.certificateIssueDate);
      if (certIssue) out.certificateIssueDate = certIssue;
      const certExpiry = isoDate(parsed.certificateExpiryDate);
      if (certExpiry) out.certificateExpiryDate = certExpiry;
      const birthDate = isoDate(parsed.birthDate);
      if (birthDate) out.birthDate = birthDate;

      const qualificationCategory = this.parseOllamaEnum(
        parsed.qualificationCategory,
        Object.values(ResumeQualificationCategory),
      );
      if (qualificationCategory) out.qualificationCategory = qualificationCategory;

      out.additionalSpecializations = this.normalizeArray(parsed.additionalSpecializations);
      out.languages = this.normalizeArray(parsed.languages);

      if (typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)) {
        out.aiConfidence = Math.max(0, Math.min(1, parsed.confidence));
      }

      if (Array.isArray(parsed.workHistory) && parsed.workHistory.length > 0) {
        out._workHistory = parsed.workHistory;
      }
      if (Array.isArray(parsed.education) && parsed.education.length > 0) {
        out._education = parsed.education;
      }
      if (Array.isArray(parsed.cmeCourses) && parsed.cmeCourses.length > 0) {
        out._cmeCourses = parsed.cmeCourses;
      }

      return out;
    } finally {
      clearTimeout(timer);
    }
  }

  enqueueProcessing(candidateId: string): void {
    this.pendingProcessing.add(candidateId);
    void this.runProcessingQueue();
  }

  private async runProcessingQueue(): Promise<void> {
    if (this.processingActive) return;
    this.processingActive = true;
    try {
      while (this.pendingProcessing.size > 0) {
        const [candidateId] = this.pendingProcessing;
        if (!candidateId) break;
        this.pendingProcessing.delete(candidateId);
        await this.processCandidate(candidateId);
      }
    } finally {
      this.processingActive = false;
    }
  }

  async processCandidate(candidateId: string): Promise<void> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      relations: ['uploadedFile'],
    });
    if (!candidate) return;

    try {
      candidate.processingStatus = ResumeProcessingStatus.EXTRACTING;
      candidate.processingError = null;
      await this.candidateRepo.save(candidate);

      let rawText = candidate.rawText;
      if (!rawText && candidate.uploadedFile) {
        rawText = await this.extractTextFromFile(candidate.uploadedFile);
      }
      if (!rawText || !rawText.trim()) {
        throw new BadRequestException('Не удалось извлечь текст резюме');
      }

      candidate.rawText = rawText;
      candidate.processingStatus = ResumeProcessingStatus.PARSING;
      await this.candidateRepo.save(candidate);

      const heuristicParsed = this.parseRawText(rawText);
      let ollamaParsed: (Partial<ResumeCandidate> & {
        _workHistory?: unknown[];
        _education?: unknown[];
        _cmeCourses?: unknown[];
      }) | null = null;
      try {
        ollamaParsed = await this.parseWithOllama(rawText);
      } catch (error) {
        console.warn(
          `[resume] ollama parse failed for ${candidateId}:`,
          error instanceof Error ? error.message : error,
        );
      }

      const { _workHistory, _education, _cmeCourses, ...ollamaFields } = ollamaParsed || {};
      const parsed = { ...heuristicParsed, ...ollamaFields };
      Object.assign(candidate, parsed);

      if (_workHistory && Array.isArray(_workHistory) && _workHistory.length > 0) {
        await this.workHistoryRepo.delete({ candidateId });
        for (const wh of _workHistory) {
          const entry = wh as Record<string, unknown>;
          const whEntity = this.workHistoryRepo.create({
            candidateId,
            organization: (typeof entry.organization === 'string' ? entry.organization.trim() : '') || 'Не указано',
            position: (typeof entry.position === 'string' ? entry.position.trim() : '') || 'Не указано',
            department: typeof entry.department === 'string' ? entry.department.trim() || null : null,
            city: typeof entry.city === 'string' ? entry.city.trim() || null : null,
            startDate: typeof entry.startDate === 'string' && entry.startDate ? new Date(entry.startDate) : null,
            endDate: typeof entry.endDate === 'string' && entry.endDate ? new Date(entry.endDate) : null,
            isCurrent: entry.isCurrent === true,
            description: typeof entry.description === 'string' ? entry.description.trim() || null : null,
          });
          await this.workHistoryRepo.save(whEntity);
        }
      }

      if (_education && Array.isArray(_education) && _education.length > 0) {
        await this.educationRepo.delete({ candidateId });
        for (const ed of _education) {
          const entry = ed as Record<string, unknown>;
          const edEntity = this.educationRepo.create({
            candidateId,
            institution: (typeof entry.institution === 'string' ? entry.institution.trim() : '') || 'Не указано',
            specialty: typeof entry.specialty === 'string' ? entry.specialty.trim() || null : null,
            degree: typeof entry.degree === 'string' ? entry.degree.trim() || null : null,
            city: typeof entry.city === 'string' ? entry.city.trim() || null : null,
            endYear: typeof entry.endYear === 'number' ? entry.endYear : null,
            type: typeof entry.type === 'string' ? entry.type.trim() || null : null,
          });
          await this.educationRepo.save(edEntity);
        }
      }

      if (_cmeCourses && Array.isArray(_cmeCourses) && _cmeCourses.length > 0) {
        await this.cmeRepo.delete({ candidateId });
        for (const c of _cmeCourses) {
          const entry = c as Record<string, unknown>;
          const cmeEntity = this.cmeRepo.create({
            candidateId,
            courseName: (typeof entry.courseName === 'string' ? entry.courseName.trim() : '') || 'Не указано',
            provider: typeof entry.provider === 'string' ? entry.provider.trim() || null : null,
            completedAt: typeof entry.completedAt === 'string' && entry.completedAt ? new Date(entry.completedAt) : null,
            hours: typeof entry.hours === 'number' ? entry.hours : null,
            nmoPoints: typeof entry.nmoPoints === 'number' ? entry.nmoPoints : null,
            certificateNumber: typeof entry.certificateNumber === 'string' ? entry.certificateNumber.trim() || null : null,
          });
          await this.cmeRepo.save(cmeEntity);
        }
      }

      const duplicate = await this.findPotentialDuplicate(candidate);
      if (duplicate) {
        candidate.priority = ResumeCandidatePriority.DELETED;
      }
      candidate.processingStatus = ResumeProcessingStatus.COMPLETED;
      await this.candidateRepo.save(candidate);
    } catch (error) {
      candidate.processingStatus = ResumeProcessingStatus.FAILED;
      candidate.processingError =
        error instanceof Error ? error.message : 'Неизвестная ошибка';
      await this.candidateRepo.save(candidate);
    }
  }

  async processPendingCandidates(batchSize = 20): Promise<number> {
    const pending = await this.candidateRepo.find({
      where: { processingStatus: In([ResumeProcessingStatus.PENDING]) },
      order: { createdAt: 'ASC' },
      take: Math.max(1, Math.min(batchSize, 100)),
    });
    for (const candidate of pending) {
      await this.processCandidate(candidate.id);
    }
    return pending.length;
  }

  async ingestTelegram(payload: {
    chatId?: string;
    username?: string;
    firstName?: string;
    rawText?: string;
    fileBase64?: string;
    fileName?: string;
    mimeType?: string;
  }): Promise<{ candidateId: string }> {
    if (payload.chatId) {
      await this.telegramChatRepo.save({
        chatId: payload.chatId,
        username: payload.username || null,
        firstName: payload.firstName || null,
      });
    }

    let uploadedFileId: string | null = null;
    if (payload.fileBase64?.trim()) {
      const buffer = Buffer.from(payload.fileBase64, 'base64');
      const fakeFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: payload.fileName || 'telegram-upload.bin',
        encoding: '7bit',
        mimetype: payload.mimeType || 'application/octet-stream',
        size: buffer.length,
        destination: '',
        filename: '',
        path: '',
        stream: undefined as never,
        buffer,
      };
      const uploaded = await this.storeUploadedFile(fakeFile);
      uploadedFileId = uploaded.id;
    }

    const candidate = await this.createCandidateFromPublicForm({
      fullName: payload.firstName || 'Telegram кандидат',
      rawText: payload.rawText,
      uploadedFileId: uploadedFileId || undefined,
    });
    return { candidateId: candidate.id };
  }
}
