import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CreateProcessDepartmentDto } from './dto/create-process-department.dto';
import { CreateProcessDto } from './dto/create-process.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateProcessDepartmentDto } from './dto/update-process-department.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { UpdateVersionCorrectionsDto } from './dto/update-version-corrections.dto';
import { ProcessAttachment } from './entities/process-attachment.entity';
import { ProcessDepartment } from './entities/process-department.entity';
import { Process } from './entities/process.entity';
import { ProcessVersion } from './entities/process-version.entity';

type DiffChange = {
  blockIndex: number;
  changeType: 'added' | 'modified';
  oldText: string;
  newText: string;
  changedByName: string;
  changedAt: string;
};

type DiffData = {
  changes: DiffChange[];
};

@Injectable()
export class ProcessesService {
  constructor(
    @InjectRepository(ProcessDepartment)
    private departmentsRepo: Repository<ProcessDepartment>,
    @InjectRepository(Process)
    private processesRepo: Repository<Process>,
    @InjectRepository(ProcessVersion)
    private versionsRepo: Repository<ProcessVersion>,
    @InjectRepository(ProcessAttachment)
    private attachmentsRepo: Repository<ProcessAttachment>,
  ) {}

  async getDepartmentTree() {
    const departments = await this.departmentsRepo.find({
      order: { name: 'ASC' },
    });
    const byParent = new Map<string, ProcessDepartment[]>();
    for (const dep of departments) {
      const key = dep.parentId ?? 'root';
      const arr = byParent.get(key) ?? [];
      arr.push(dep);
      byParent.set(key, arr);
    }
    const mapNode = (dep: ProcessDepartment): Record<string, unknown> => ({
      ...dep,
      children: (byParent.get(dep.id) ?? []).map(mapNode),
    });
    return (byParent.get('root') ?? []).map(mapNode);
  }

  async createDepartment(dto: CreateProcessDepartmentDto) {
    if (dto.parentId) {
      await this.ensureDepartment(dto.parentId);
    }
    const dep = this.departmentsRepo.create({
      name: dto.name.trim(),
      parentId: dto.parentId ?? null,
    });
    return this.departmentsRepo.save(dep);
  }

  async updateDepartment(id: string, dto: UpdateProcessDepartmentDto) {
    const dep = await this.ensureDepartment(id);
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('Отдел не может быть родителем сам себе');
      }
      if (dto.parentId) {
        await this.ensureDepartment(dto.parentId);
        await this.assertNoCycle(id, dto.parentId);
        dep.parentId = dto.parentId;
      } else {
        dep.parentId = null;
      }
    }
    if (dto.name !== undefined) {
      dep.name = dto.name.trim();
    }
    return this.departmentsRepo.save(dep);
  }

  async deleteDepartment(id: string): Promise<void> {
    const dep = await this.ensureDepartment(id);
    await this.departmentsRepo.remove(dep);
  }

  async getDepartmentProcessCount(departmentId: string): Promise<number> {
    await this.ensureDepartment(departmentId);
    return this.processesRepo.count({ where: { departmentId } });
  }

  async moveProcesses(
    sourceDepartmentId: string,
    targetDepartmentId: string,
  ): Promise<void> {
    await this.ensureDepartment(sourceDepartmentId);
    await this.ensureDepartment(targetDepartmentId);
    if (sourceDepartmentId === targetDepartmentId) {
      throw new BadRequestException('Нельзя перенести процессы в тот же отдел');
    }
    await this.processesRepo.update(
      { departmentId: sourceDepartmentId },
      { departmentId: targetDepartmentId },
    );
  }

  async getProcessesByDepartment(departmentId: string) {
    await this.ensureDepartment(departmentId);
    return this.processesRepo.find({
      where: { departmentId },
      relations: ['createdBy'],
      order: { updatedAt: 'DESC' },
    });
  }

  async createProcess(dto: CreateProcessDto, currentUser: User) {
    await this.ensureDepartment(dto.departmentId);
    const doc = this.normalizeDoc(dto.descriptionDoc);
    const process = this.processesRepo.create({
      departmentId: dto.departmentId,
      title: dto.title.trim(),
      currentDescriptionDoc: doc,
      createdById: currentUser.id,
    });
    const saved = await this.processesRepo.save(process);
    await this.versionsRepo.save(
      this.versionsRepo.create({
        processId: saved.id,
        version: 1,
        descriptionDoc: doc,
        diffData: { changes: [] },
        diffDataCorrections: [],
        changedById: currentUser.id,
      }),
    );
    return this.findProcessById(saved.id);
  }

  async findProcessById(id: string) {
    const process = await this.processesRepo.findOne({
      where: { id },
      relations: ['createdBy', 'attachments', 'attachments.uploadedBy', 'department'],
      order: { attachments: { createdAt: 'DESC' } },
    });
    if (!process) throw new NotFoundException('Процесс не найден');
    const latestVersion = await this.versionsRepo.findOne({
      where: { processId: id },
      relations: ['changedBy'],
      order: { version: 'DESC' },
    });
    return { ...process, latestVersion };
  }

  async updateProcess(id: string, dto: UpdateProcessDto) {
    const process = await this.processesRepo.findOne({ where: { id } });
    if (!process) throw new NotFoundException('Процесс не найден');

    if (dto.departmentId !== undefined && dto.departmentId !== process.departmentId) {
      await this.ensureDepartment(dto.departmentId);
      process.departmentId = dto.departmentId;
    }
    if (dto.title !== undefined) {
      process.title = dto.title.trim();
    }

    await this.processesRepo.save(process);
    return this.findProcessById(process.id);
  }

  async createVersion(
    processId: string,
    dto: CreateVersionDto,
    currentUser: User,
  ) {
    const process = await this.ensureProcess(processId);
    const nextDoc = this.normalizeDoc(dto.descriptionDoc);
    const lastVersion = await this.versionsRepo.findOne({
      where: { processId: process.id },
      order: { version: 'DESC' },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;
    const prevDoc = lastVersion?.descriptionDoc ?? process.currentDescriptionDoc;
    const prevText = this.extractText(prevDoc);
    const nextText = this.extractText(nextDoc);
    if (prevText === nextText) {
      return this.findProcessById(process.id);
    }

    const diffData = this.buildDiffData(prevDoc, nextDoc, currentUser);
    await this.versionsRepo.save(
      this.versionsRepo.create({
        processId: process.id,
        version: nextVersion,
        descriptionDoc: nextDoc,
        diffData,
        diffDataCorrections: [],
        changedById: currentUser.id,
      }),
    );
    process.currentDescriptionDoc = nextDoc;
    await this.processesRepo.save(process);
    return this.findProcessById(process.id);
  }

  async approveProcess(processId: string, currentUser: User) {
    const process = await this.ensureProcess(processId);
    const nextVersionNo = await this.getNextVersionNo(processId);
    await this.versionsRepo.save(
      this.versionsRepo.create({
        processId: process.id,
        version: nextVersionNo,
        descriptionDoc: process.currentDescriptionDoc,
        diffData: { changes: [] },
        diffDataCorrections: [],
        changedById: currentUser.id,
      }),
    );
    return this.findProcessById(process.id);
  }

  async deleteProcess(id: string): Promise<void> {
    const process = await this.processesRepo.findOne({
      where: { id },
      relations: ['attachments'],
    });
    if (!process) throw new NotFoundException('Процесс не найден');
    await this.removeAttachmentFiles(process.attachments);
    await this.processesRepo.remove(process);
  }

  async getVersions(processId: string) {
    await this.ensureProcess(processId);
    return this.versionsRepo.find({
      where: { processId },
      relations: ['changedBy'],
      order: { version: 'DESC' },
    });
  }

  async getVersion(processId: string, versionId: string) {
    await this.ensureProcess(processId);
    const version = await this.versionsRepo.findOne({
      where: { id: versionId, processId },
      relations: ['changedBy'],
    });
    if (!version) throw new NotFoundException('Версия не найдена');
    return version;
  }

  async applyVersion(processId: string, versionId: string, currentUser: User) {
    const process = await this.ensureProcess(processId);
    const targetVersion = await this.getVersion(processId, versionId);
    const nextVersionNo = await this.getNextVersionNo(processId);
    const diffData = this.buildDiffData(
      process.currentDescriptionDoc,
      targetVersion.descriptionDoc,
      currentUser,
    );
    process.currentDescriptionDoc = targetVersion.descriptionDoc;
    await this.processesRepo.save(process);
    await this.versionsRepo.save(
      this.versionsRepo.create({
        processId,
        version: nextVersionNo,
        descriptionDoc: targetVersion.descriptionDoc,
        diffData,
        diffDataCorrections: [],
        changedById: currentUser.id,
      }),
    );
    return this.findProcessById(processId);
  }

  async updateVersionCorrections(
    processId: string,
    versionId: string,
    dto: UpdateVersionCorrectionsDto,
  ) {
    const version = await this.getVersion(processId, versionId);
    const diffData = (version.diffData as DiffData | null) ?? { changes: [] };
    const maxIdx = diffData.changes.length - 1;
    for (const correction of dto.corrections) {
      if (correction.changeIndex > maxIdx) {
        throw new BadRequestException(
          `Нельзя править несуществующую подсветку index=${correction.changeIndex}`,
        );
      }
    }
    version.diffDataCorrections = dto.corrections.map((c) => ({
      changeIndex: c.changeIndex,
      overrideNewText: c.overrideNewText,
      note: c.note,
    }));
    return this.versionsRepo.save(version);
  }

  async uploadAttachment(processId: string, file: Express.Multer.File, currentUser: User) {
    await this.ensureProcess(processId);
    if (!file?.buffer) throw new BadRequestException('Файл не загружен');
    const uploadDir = path.join(process.cwd(), 'uploads', 'processes', processId);
    await fs.mkdir(uploadDir, { recursive: true });
    const safeName = file.originalname.replace(/[^\w.\-() ]/g, '_');
    const fileName = `${Date.now()}-${randomUUID()}-${safeName}`;
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    const attachment = this.attachmentsRepo.create({
      processId,
      path: filePath,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      uploadedById: currentUser.id,
    });
    return this.attachmentsRepo.save(attachment);
  }

  async getAttachment(processId: string, attachmentId: string) {
    await this.ensureProcess(processId);
    const attachment = await this.attachmentsRepo.findOne({
      where: { id: attachmentId, processId },
      relations: ['uploadedBy'],
    });
    if (!attachment) throw new NotFoundException('Файл не найден');
    return attachment;
  }

  async deleteAttachment(processId: string, attachmentId: string): Promise<void> {
    const attachment = await this.getAttachment(processId, attachmentId);
    await this.attachmentsRepo.remove(attachment);
    try {
      await fs.unlink(attachment.path);
    } catch {
      // ignore if file already removed
    }
  }

  private extractText(doc: Record<string, unknown>): string {
    if (typeof doc?.text === 'string') return doc.text;
    const fromJson = this.extractTextFromProseMirrorDoc(
      doc?.doc as Record<string, unknown> | undefined,
    );
    if (fromJson) return fromJson;
    const html = typeof doc?.html === 'string' ? doc.html : '';
    if (!html) return '';
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private buildDiffData(
    prevDoc: Record<string, unknown>,
    nextDoc: Record<string, unknown>,
    currentUser: User,
  ): DiffData {
    const prevBlocks = this.extractBlockTexts(prevDoc);
    const nextBlocks = this.extractBlockTexts(nextDoc);
    const blockChanges = this.diffBlocks(prevBlocks, nextBlocks);
    const userName =
      currentUser.displayName || currentUser.login || 'Пользователь';
    const now = new Date().toISOString();
    const changes: DiffChange[] = blockChanges.map((bc) => ({
      blockIndex: bc.blockIndex,
      changeType: bc.changeType,
      oldText: bc.oldText,
      newText: bc.newText,
      changedByName: userName,
      changedAt: now,
    }));
    return { changes };
  }

  private extractBlockTexts(doc: Record<string, unknown>): string[] {
    const pmDoc = (doc?.doc as Record<string, unknown>) ?? doc;
    const content = Array.isArray((pmDoc as { content?: unknown }).content)
      ? ((pmDoc as { content: unknown[] }).content as unknown[])
      : [];
    return content.map((node) => this.extractNodeText(node));
  }

  private extractNodeText(node: unknown): string {
    if (!node || typeof node !== 'object') return '';
    const text = (node as { text?: unknown }).text;
    if (typeof text === 'string') return text;
    const content = (node as { content?: unknown }).content;
    if (Array.isArray(content)) {
      return content.map((child) => this.extractNodeText(child)).join('');
    }
    return '';
  }

  private diffBlocks(
    prevBlocks: string[],
    nextBlocks: string[],
  ): Array<{ blockIndex: number; changeType: 'added' | 'modified'; oldText: string; newText: string }> {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const normPrev = prevBlocks.map(norm);
    const normNext = nextBlocks.map(norm);

    const m = normPrev.length;
    const n = normNext.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      new Array(n + 1).fill(0),
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (normPrev[i - 1] === normNext[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const matchedNew = new Set<number>();
    const matchedOld = new Set<number>();
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (normPrev[i - 1] === normNext[j - 1]) {
        matchedNew.add(j - 1);
        matchedOld.add(i - 1);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    const unusedOld: string[] = [];
    for (let oi = 0; oi < m; oi++) {
      if (!matchedOld.has(oi)) unusedOld.push(prevBlocks[oi]);
    }

    const result: Array<{
      blockIndex: number;
      changeType: 'added' | 'modified';
      oldText: string;
      newText: string;
    }> = [];
    let unusedIdx = 0;
    for (let ni = 0; ni < n; ni++) {
      if (matchedNew.has(ni)) continue;
      const newNorm = normNext[ni];
      if (unusedIdx < unusedOld.length) {
        const oldNorm = norm(unusedOld[unusedIdx]);
        if (!newNorm && !oldNorm) {
          unusedIdx++;
          continue;
        }
        result.push({
          blockIndex: ni,
          changeType: 'modified',
          oldText: unusedOld[unusedIdx],
          newText: nextBlocks[ni],
        });
        unusedIdx++;
      } else {
        if (!newNorm) continue;
        result.push({
          blockIndex: ni,
          changeType: 'added',
          oldText: '',
          newText: nextBlocks[ni],
        });
      }
    }
    return result;
  }

  private normalizeDoc(doc: Record<string, unknown>): Record<string, unknown> {
    const rawDoc = this.normalizeProseMirrorDoc(doc?.doc);
    const text = this.extractTextFromProseMirrorDoc(rawDoc);
    return { doc: rawDoc, text };
  }

  private normalizeProseMirrorDoc(input: unknown): Record<string, unknown> {
    if (this.isProseMirrorDoc(input)) {
      return input;
    }
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [],
        },
      ],
    };
  }

  private isProseMirrorDoc(input: unknown): input is Record<string, unknown> {
    if (!input || typeof input !== 'object') return false;
    const t = (input as { type?: unknown }).type;
    return t === 'doc';
  }

  private extractTextFromProseMirrorDoc(doc?: Record<string, unknown>): string {
    if (!doc) return '';
    const out: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const text = (node as { text?: unknown }).text;
      if (typeof text === 'string') out.push(text);
      const content = (node as { content?: unknown }).content;
      if (Array.isArray(content)) {
        for (const child of content) walk(child);
      }
    };
    walk(doc);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  }

  private async ensureDepartment(id: string): Promise<ProcessDepartment> {
    const dep = await this.departmentsRepo.findOne({ where: { id } });
    if (!dep) throw new NotFoundException('Отдел не найден');
    return dep;
  }

  private async ensureProcess(id: string): Promise<Process> {
    const process = await this.processesRepo.findOne({ where: { id } });
    if (!process) throw new NotFoundException('Процесс не найден');
    return process;
  }

  private async getNextVersionNo(processId: string): Promise<number> {
    const latest = await this.versionsRepo.findOne({
      where: { processId },
      order: { version: 'DESC' },
    });
    return (latest?.version ?? 0) + 1;
  }

  private async assertNoCycle(
    departmentId: string,
    newParentId: string,
  ): Promise<void> {
    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === departmentId) {
        throw new BadRequestException('Нельзя создать циклическую иерархию отделов');
      }
      const parent = await this.departmentsRepo.findOne({
        where: { id: cursor },
        select: ['id', 'parentId'],
      });
      cursor = parent?.parentId ?? null;
    }
  }

  private async removeAttachmentFiles(attachments: ProcessAttachment[]) {
    for (const attachment of attachments) {
      try {
        await fs.unlink(attachment.path);
      } catch {
        // ignore if file already removed
      }
    }
  }
}
