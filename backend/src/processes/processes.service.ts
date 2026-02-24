import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CreateProcessDepartmentDto } from './dto/create-process-department.dto';
import { CreateProcessDto } from './dto/create-process.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateProcessDepartmentDto } from './dto/update-process-department.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { UpdateVersionCorrectionsDto } from './dto/update-version-corrections.dto';
import { ProcessAttachment } from './entities/process-attachment.entity';
import {
  ProcessActivityActionType,
  ProcessActivityLog,
} from './entities/process-activity-log.entity';
import { ProcessDepartment } from './entities/process-department.entity';
import { ProcessDepartmentUser } from './entities/process-department-user.entity';
import { Process } from './entities/process.entity';
import { ProcessReadState } from './entities/process-read-state.entity';
import { ProcessVersion } from './entities/process-version.entity';
import { PushNotificationsService } from './push-notifications.service';
import { ChecklistAiService, ChecklistSuggestedItem } from './checklist-ai.service';
import { AppSetting } from '../settings/entities/app-setting.entity';
import {
  PROCESS_POLZA_API_KEY,
  PROCESS_POLZA_BASE_URL,
  PROCESS_POLZA_MODEL,
} from './process-polza-settings.constants';

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
    @InjectRepository(ProcessActivityLog)
    private activityLogRepo: Repository<ProcessActivityLog>,
    @InjectRepository(ProcessDepartmentUser)
    private departmentUsersRepo: Repository<ProcessDepartmentUser>,
    @InjectRepository(ProcessReadState)
    private readStateRepo: Repository<ProcessReadState>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(AppSetting)
    private settingsRepo: Repository<AppSetting>,
    private pushNotifications: PushNotificationsService,
    private checklistAi: ChecklistAiService,
  ) {}

  async getDepartmentTree(currentUser: User) {
    const allDepartments = await this.departmentsRepo.find({
      order: { name: 'ASC' },
    });
    const accessSet = await this.getAccessibleDepartmentIds(currentUser);
    if (accessSet && accessSet.size === 0) {
      return [];
    }
    const visibleSet = accessSet
      ? this.expandWithAncestors(accessSet, allDepartments)
      : new Set(allDepartments.map((d) => d.id));

    const departments = allDepartments.filter((d) => visibleSet.has(d.id));
    const byParent = new Map<string, ProcessDepartment[]>();
    for (const dep of departments) {
      const key = dep.parentId ?? 'root';
      const arr = byParent.get(key) ?? [];
      arr.push(dep);
      byParent.set(key, arr);
    }

    const unreadByDepartment = await this.getUnreadByDepartment(
      currentUser.id,
      departments,
      accessSet,
    );

    const mapNode = (dep: ProcessDepartment): Record<string, unknown> => ({
      ...dep,
      hasUnread: unreadByDepartment.get(dep.id) ?? false,
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

  async getDepartmentProcessCount(departmentId: string, currentUser: User): Promise<number> {
    await this.ensureDepartment(departmentId);
    await this.assertDepartmentAccessible(currentUser, departmentId);
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

  async getUsersForAssignment() {
    const users = await this.usersRepo.find({
      select: ['id', 'login', 'displayName', 'isActive'],
      where: { isActive: true },
      order: { displayName: 'ASC' },
    });
    return users.map((u) => ({
      id: u.id,
      login: u.login,
      displayName: u.displayName,
    }));
  }

  async getDepartmentUsers(departmentId: string) {
    await this.ensureDepartment(departmentId);
    const rows = await this.departmentUsersRepo.find({
      where: { departmentId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.user.id,
      login: row.user.login,
      displayName: row.user.displayName,
    }));
  }

  async setDepartmentUsers(departmentId: string, userIds: string[]) {
    await this.ensureDepartment(departmentId);
    const uniqueIds = Array.from(new Set(userIds));
    const currentAssignments = await this.departmentUsersRepo.find({
      where: { departmentId },
      select: ['userId'],
    });
    const currentAssignedSet = new Set(currentAssignments.map((row) => row.userId));
    const newlyAssignedUserIds = uniqueIds.filter((id) => !currentAssignedSet.has(id));
    if (uniqueIds.length) {
      const users = await this.usersRepo.findBy({ id: In(uniqueIds), isActive: true });
      if (users.length !== uniqueIds.length) {
        throw new BadRequestException('Некоторые пользователи не найдены или неактивны');
      }
    }
    await this.departmentUsersRepo.delete({ departmentId });
    if (!uniqueIds.length) return [];
    await this.departmentUsersRepo.save(
      uniqueIds.map((userId) =>
        this.departmentUsersRepo.create({
          departmentId,
          userId,
        }),
      ),
    );
    await this.initializeReadStateForNewDepartmentUsers(
      departmentId,
      newlyAssignedUserIds,
    );
    return this.getDepartmentUsers(departmentId);
  }

  getPushPublicKey() {
    return { publicKey: this.pushNotifications.getPublicKey() };
  }

  async subscribePush(
    currentUser: User,
    payload: {
      endpoint: string;
      p256dh: string;
      auth: string;
      userAgent?: string | null;
    },
  ) {
    await this.pushNotifications.upsertSubscription({
      userId: currentUser.id,
      ...payload,
    });
    return { success: true };
  }

  async unsubscribePush(currentUser: User, endpoint: string) {
    await this.pushNotifications.removeSubscription(currentUser.id, endpoint);
    return { success: true };
  }

  async markProcessAsRead(processId: string, currentUser: User) {
    return this.acknowledgeLatestVersion(processId, currentUser);
  }

  async acknowledgeLatestVersion(processId: string, currentUser: User) {
    const process = await this.ensureProcess(processId);
    await this.assertDepartmentAccessible(currentUser, process.departmentId);
    const latest = await this.versionsRepo.findOne({
      where: { processId },
      order: { version: 'DESC' },
      select: ['id', 'version'],
    });
    await this.upsertReadState(currentUser.id, processId, latest?.version ?? 0);
    await this.logProcessActivity({
      processId,
      userId: currentUser.id,
      versionId: latest?.id ?? null,
      actionType: 'acknowledge_latest',
      meta: latest?.version
        ? { version: latest.version }
        : null,
    });
    return { success: true };
  }

  async getProcessActivity(
    processId: string,
    currentUser: User,
    filters?: { search?: string },
  ) {
    const process = await this.ensureProcess(processId);
    await this.assertDepartmentAccessible(currentUser, process.departmentId);
    const qb = this.activityLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .leftJoinAndSelect('log.version', 'version')
      .where('log.processId = :processId', { processId })
      .orderBy('log.createdAt', 'DESC')
      .take(300);

    const search = filters?.search?.trim();
    if (search) {
      qb.andWhere(
        '(user."displayName" ILIKE :search OR user.login ILIKE :search OR log."actionType" ILIKE :search OR CAST(version.version AS TEXT) ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      processId: row.processId,
      versionId: row.versionId,
      actionType: row.actionType,
      createdAt: row.createdAt,
      meta: row.meta,
      user: {
        id: row.user.id,
        login: row.user.login,
        displayName: row.user.displayName,
      },
      version: row.version
        ? {
            id: row.version.id,
            version: row.version.version,
          }
        : null,
    }));
  }

  async getProcessesByDepartment(departmentId: string, currentUser: User) {
    await this.ensureDepartment(departmentId);
    await this.assertDepartmentAccessible(currentUser, departmentId);
    const processes = await this.processesRepo.find({
      where: { departmentId },
      relations: ['createdBy'],
      order: { updatedAt: 'DESC' },
    });
    const unreadMap = await this.getUnreadByProcess(
      currentUser.id,
      processes.map((p) => p.id),
    );
    return processes.map((process) => ({
      ...process,
      hasUnread: unreadMap.get(process.id) ?? false,
    }));
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
    await this.upsertReadState(currentUser.id, saved.id, 1);
    return this.findProcessById(saved.id);
  }

  async findProcessById(id: string, currentUser?: User) {
    const process = await this.processesRepo.findOne({
      where: { id },
      relations: ['createdBy', 'attachments', 'attachments.uploadedBy', 'department'],
      order: { attachments: { createdAt: 'DESC' } },
    });
    if (!process) throw new NotFoundException('Процесс не найден');
    if (currentUser) {
      await this.assertDepartmentAccessible(currentUser, process.departmentId);
    }
    const latestVersion = await this.versionsRepo.findOne({
      where: { processId: id },
      relations: ['changedBy'],
      order: { version: 'DESC' },
    });
    const hasUnread = currentUser
      ? (await this.getUnreadByProcess(currentUser.id, [process.id])).get(process.id) ?? false
      : false;
    if (currentUser) {
      await this.logProcessActivity({
        processId: process.id,
        userId: currentUser.id,
        versionId: latestVersion?.id ?? null,
        actionType: 'view_process',
        meta: latestVersion?.version
          ? { version: latestVersion.version }
          : null,
      });
    }
    const acknowledgmentStats = currentUser
      ? await this.getAcknowledgmentStats(id)
      : { total: 0, acknowledged: 0, notAcknowledgedUserNames: [] };
    return { ...process, latestVersion, hasUnread, acknowledgmentStats };
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
    await this.assertDepartmentAccessible(currentUser, process.departmentId);
    const nextDoc = this.normalizeDoc(dto.descriptionDoc);
    const lastVersion = await this.versionsRepo.findOne({
      where: { processId: process.id },
      order: { version: 'DESC' },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;
    const prevDoc = lastVersion?.descriptionDoc ?? process.currentDescriptionDoc;
    const prevText = this.extractText(prevDoc);
    const nextText = this.extractText(nextDoc);
    const hasChecklist = Array.isArray(dto.checklist?.items) && dto.checklist.items.length > 0;
    if (prevText === nextText && !hasChecklist) {
      return this.findProcessById(process.id, currentUser);
    }

    const userName = currentUser.displayName || currentUser.login || 'Пользователь';
    const now = new Date().toISOString();
    let diffData: DiffData;
    if (dto.diffData?.changes?.length) {
      diffData = {
        changes: dto.diffData.changes.map((c) => ({
          blockIndex: c.blockIndex,
          changeType: c.changeType as 'added' | 'modified',
          oldText: c.oldText ?? '',
          newText: c.newText ?? '',
          changedByName: c.changedByName ?? userName,
          changedAt: c.changedAt ?? now,
        })),
      };
    } else if (prevText !== nextText) {
      diffData = this.buildDiffData(prevDoc, nextDoc, currentUser);
    } else {
      diffData = { changes: [] };
    }
    const checklistPayload =
      hasChecklist
        ? {
            items: dto.checklist!.items
              .filter((i) => i && typeof i.title === 'string' && (i.title as string).trim())
              .map((i) => ({
                title: (i.title as string).trim(),
                assignee: typeof i.assignee === 'string' ? (i.assignee as string).trim() : undefined,
                completed: false,
              })),
          }
        : null;

    const newVersion = await this.versionsRepo.save(
      this.versionsRepo.create({
        processId: process.id,
        version: nextVersion,
        descriptionDoc: nextDoc,
        diffData,
        diffDataCorrections: [],
        changedById: currentUser.id,
        checklist: checklistPayload,
      }),
    );
    process.currentDescriptionDoc = nextDoc;
    await this.processesRepo.save(process);
    await this.upsertReadState(currentUser.id, process.id, nextVersion);
    if (hasChecklist) {
      await this.logProcessActivity({
        processId: process.id,
        userId: currentUser.id,
        versionId: newVersion.id,
        actionType: 'checklist_approved',
        meta: { itemsCount: checklistPayload!.items.length },
      });
    }
    const recipients = await this.getUsersWithAccessToDepartment(process.departmentId);
    const recipientIds = recipients.filter((id) => id !== currentUser.id);
    if (recipientIds.length) {
      await this.pushNotifications.sendToUsers(recipientIds, {
        title: `Новая итерация: ${process.title}`,
        body: `${currentUser.displayName || currentUser.login} обновил(а) процесс`,
        url: `/processes?processId=${process.id}`,
        processId: process.id,
        version: nextVersion,
      });
    }
    return this.findProcessById(process.id, currentUser);
  }

  async approveProcess(processId: string, currentUser: User) {
    if (!this.canForceApprove(currentUser)) {
      throw new ForbiddenException(
        'Утвердить процесс может только администратор или пользователь с правом «Процессы: утверждение»',
      );
    }
    const process = await this.ensureProcess(processId);
    await this.assertDepartmentAccessible(currentUser, process.departmentId);
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
    await this.upsertReadState(currentUser.id, process.id, nextVersionNo);
    return this.findProcessById(process.id, currentUser);
  }

  async forceAcknowledgeProcess(processId: string, currentUser: User) {
    const process = await this.ensureProcess(processId);
    await this.assertDepartmentAccessible(currentUser, process.departmentId);
    if (!this.canForceApprove(currentUser)) {
      throw new ForbiddenException(
        'Принудительно ознакомить может только администратор или пользователь с правом «Процессы: утверждение»',
      );
    }
    const latestVersion = await this.versionsRepo.findOne({
      where: { processId: process.id },
      order: { version: 'DESC' },
      select: ['version'],
    });
    const latestVer = latestVersion?.version ?? 0;
    const subscriberIds = await this.getUsersWithAccessToDepartment(process.departmentId);
    for (const userId of subscriberIds) {
      await this.upsertReadState(userId, process.id, latestVer);
    }
    return this.findProcessById(process.id, currentUser);
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

  async getVersions(processId: string, currentUser: User) {
    const process = await this.ensureProcess(processId);
    await this.assertDepartmentAccessible(currentUser, process.departmentId);
    return this.versionsRepo.find({
      where: { processId },
      relations: ['changedBy'],
      order: { version: 'DESC' },
    });
  }

  async suggestChecklists(
    processId: string,
    text: string,
    currentUser: User,
  ): Promise<{ items: ChecklistSuggestedItem[] }> {
    const process = await this.ensureProcess(processId);
    await this.assertDepartmentAccessible(currentUser, process.departmentId);
    const items = await this.checklistAi.suggestChecklists(text || '');
    return { items };
  }

  async getPolzaSettings(): Promise<{
    apiKeyConfigured: boolean;
    apiKeyMask?: string;
    baseUrl?: string;
    model?: string;
    availableModels: string[];
  }> {
    const { apiKey, baseUrl, model } = await this.checklistAi.getPolzaConfig();
    const availableModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4o-nano', 'gpt-3.5-turbo'];
    return {
      apiKeyConfigured: !!apiKey,
      apiKeyMask: apiKey ? `***${apiKey.slice(-4)}` : undefined,
      baseUrl,
      model,
      availableModels,
    };
  }

  async updatePolzaSettings(dto: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }): Promise<{ apiKeyConfigured: boolean; apiKeyMask?: string; baseUrl?: string; model?: string }> {
    if (dto.apiKey !== undefined) {
      if (dto.apiKey.trim()) {
        await this.settingsRepo.save({ key: PROCESS_POLZA_API_KEY, value: dto.apiKey.trim() });
      } else {
        await this.settingsRepo.delete({ key: PROCESS_POLZA_API_KEY }).catch(() => {});
      }
    }
    if (dto.baseUrl !== undefined) {
      const v = dto.baseUrl.trim();
      if (v) {
        await this.settingsRepo.save({ key: PROCESS_POLZA_BASE_URL, value: v });
      } else {
        await this.settingsRepo.delete({ key: PROCESS_POLZA_BASE_URL }).catch(() => {});
      }
    }
    if (dto.model !== undefined && dto.model.trim()) {
      await this.settingsRepo.save({ key: PROCESS_POLZA_MODEL, value: dto.model.trim() });
    }
    const { apiKey, baseUrl, model } = await this.checklistAi.getPolzaConfig();
    return {
      apiKeyConfigured: !!apiKey,
      apiKeyMask: apiKey ? `***${apiKey.slice(-4)}` : undefined,
      baseUrl,
      model,
    };
  }

  async getVersion(processId: string, versionId: string, currentUser?: User) {
    const process = await this.ensureProcess(processId);
    if (currentUser) {
      await this.assertDepartmentAccessible(currentUser, process.departmentId);
    }
    const version = await this.versionsRepo.findOne({
      where: { id: versionId, processId },
      relations: ['changedBy'],
    });
    if (!version) throw new NotFoundException('Версия не найдена');
    if (currentUser) {
      await this.logProcessActivity({
        processId,
        userId: currentUser.id,
        versionId: version.id,
        actionType: 'view_version',
        meta: { version: version.version },
      });
    }
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
    await this.upsertReadState(currentUser.id, processId, nextVersionNo);
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
    const prevPm = this.splitHardBreaks(
      ((prevDoc?.doc as Record<string, unknown>) ?? prevDoc) as Record<string, unknown>,
    );
    const nextPm = this.splitHardBreaks(
      ((nextDoc?.doc as Record<string, unknown>) ?? nextDoc) as Record<string, unknown>,
    );
    const prevBlocks = this.extractBlockTexts({ doc: prevPm });
    const nextBlocks = this.extractBlockTexts({ doc: nextPm });

    console.log('[DIFF] prevBlocks:', prevBlocks.length, prevBlocks.map((b) => b.slice(0, 60)));
    console.log('[DIFF] nextBlocks:', nextBlocks.length, nextBlocks.map((b) => b.slice(0, 60)));

    const blockChanges = this.diffBlocks(prevBlocks, nextBlocks);

    console.log('[DIFF] changes:', blockChanges.length, blockChanges.map((c) => `${c.blockIndex}:${c.changeType}`));

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
    const norm = (s: string) =>
      s.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u2028\u2029]/g, '')
       .replace(/\s+/g, ' ')
       .trim();
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
    const splitDoc = this.splitHardBreaks(rawDoc);
    const text = this.extractTextFromProseMirrorDoc(splitDoc);
    return { doc: splitDoc, text };
  }

  private splitHardBreaks(doc: Record<string, unknown>): Record<string, unknown> {
    const content = Array.isArray((doc as { content?: unknown }).content)
      ? ((doc as { content: unknown[] }).content as Array<Record<string, unknown>>)
      : [];
    const newContent: Record<string, unknown>[] = [];
    for (const node of content) {
      if (
        node?.type === 'paragraph' &&
        Array.isArray(node.content) &&
        (node.content as Array<Record<string, unknown>>).some(
          (child: Record<string, unknown>) => child?.type === 'hardBreak',
        )
      ) {
        const segments = this.splitNodeByHardBreak(node);
        newContent.push(...segments);
      } else {
        newContent.push(node);
      }
    }
    return { ...doc, content: newContent };
  }

  private splitNodeByHardBreak(
    paragraph: Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    const children = (paragraph.content ?? []) as Array<Record<string, unknown>>;
    const segments: Array<Array<Record<string, unknown>>> = [[]];
    for (const child of children) {
      if (child?.type === 'hardBreak') {
        segments.push([]);
      } else {
        segments[segments.length - 1].push(child);
      }
    }
    const { content: _ignored, ...paraAttrs } = paragraph;
    return segments
      .filter((seg) => seg.length > 0)
      .map((seg) => ({ ...paraAttrs, content: seg }));
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

  private hasPermission(user: User, slug: string): boolean {
    return user.permissions?.some((p) => p.slug === slug) ?? false;
  }

  private canForceApprove(user: User): boolean {
    return (
      this.hasPermission(user, 'processes_approve') ||
      this.hasPermission(user, 'admin') ||
      user.role?.slug === 'admin'
    );
  }

  private async getAcknowledgmentStats(
    processId: string,
  ): Promise<{ total: number; acknowledged: number; notAcknowledgedUserNames: string[] }> {
    const process = await this.processesRepo.findOne({
      where: { id: processId },
      select: ['departmentId'],
    });
    if (!process) return { total: 0, acknowledged: 0, notAcknowledgedUserNames: [] };
    const latestVersion = await this.versionsRepo.findOne({
      where: { processId },
      order: { version: 'DESC' },
      select: ['version'],
    });
    const latestVer = latestVersion?.version ?? 0;
    const subscriberIds = await this.getUsersWithAccessToDepartment(process.departmentId);
    if (subscriberIds.length === 0) return { total: 0, acknowledged: 0, notAcknowledgedUserNames: [] };
    const readStates = await this.readStateRepo.find({
      where: { processId, userId: In(subscriberIds) },
      select: ['userId', 'lastReadVersion'],
    });
    const acknowledgedSet = new Set(
      readStates.filter((r) => r.lastReadVersion >= latestVer).map((r) => r.userId),
    );
    const acknowledged = acknowledgedSet.size;
    const notAcknowledgedIds = subscriberIds.filter((id) => !acknowledgedSet.has(id));
    let notAcknowledgedUserNames: string[] = [];
    if (notAcknowledgedIds.length > 0) {
      const users = await this.usersRepo.find({
        where: { id: In(notAcknowledgedIds) },
        select: ['displayName', 'login'],
      });
      notAcknowledgedUserNames = users.map((u) => (u.displayName && u.displayName.trim() ? u.displayName.trim() : u.login));
    }
    return { total: subscriberIds.length, acknowledged, notAcknowledgedUserNames };
  }

  private async getAccessibleDepartmentIds(currentUser: User): Promise<Set<string> | null> {
    if (this.hasPermission(currentUser, 'processes_edit')) {
      return null;
    }
    const assignments = await this.departmentUsersRepo.find({
      where: { userId: currentUser.id },
      select: ['departmentId'],
    });
    if (!assignments.length) return new Set<string>();
    const allDepartments = await this.departmentsRepo.find({
      select: ['id', 'parentId'],
    });
    const byParent = new Map<string, string[]>();
    for (const dep of allDepartments) {
      const key = dep.parentId ?? 'root';
      const arr = byParent.get(key) ?? [];
      arr.push(dep.id);
      byParent.set(key, arr);
    }
    const result = new Set<string>();
    const queue = assignments.map((a) => a.departmentId);
    while (queue.length) {
      const id = queue.shift() as string;
      if (result.has(id)) continue;
      result.add(id);
      for (const childId of byParent.get(id) ?? []) {
        queue.push(childId);
      }
    }
    return result;
  }

  private expandWithAncestors(
    initialSet: Set<string>,
    allDepartments: Array<{ id: string; parentId: string | null }>,
  ): Set<string> {
    const byId = new Map(allDepartments.map((d) => [d.id, d]));
    const result = new Set(initialSet);
    for (const depId of initialSet) {
      let cursor = byId.get(depId)?.parentId ?? null;
      while (cursor) {
        if (result.has(cursor)) break;
        result.add(cursor);
        cursor = byId.get(cursor)?.parentId ?? null;
      }
    }
    return result;
  }

  private async assertDepartmentAccessible(currentUser: User, departmentId: string): Promise<void> {
    const accessSet = await this.getAccessibleDepartmentIds(currentUser);
    if (accessSet && !accessSet.has(departmentId)) {
      throw new ForbiddenException('Нет доступа к отделу');
    }
  }

  private async getLatestVersionByProcess(
    processIds: string[],
  ): Promise<Map<string, number>> {
    if (!processIds.length) return new Map();
    const rows = await this.versionsRepo
      .createQueryBuilder('v')
      .select('v.processId', 'processId')
      .addSelect('MAX(v.version)', 'version')
      .where('v.processId IN (:...processIds)', { processIds })
      .groupBy('v.processId')
      .getRawMany<{ processId: string; version: string }>();
    const result = new Map<string, number>();
    for (const row of rows) {
      result.set(row.processId, Number(row.version || 0));
    }
    return result;
  }

  private async getReadStateMap(
    userId: string,
    processIds: string[],
  ): Promise<Map<string, number>> {
    if (!processIds.length) return new Map();
    const rows = await this.readStateRepo.find({
      where: { userId, processId: In(processIds) },
      select: ['processId', 'lastReadVersion'],
    });
    return new Map(rows.map((r) => [r.processId, r.lastReadVersion]));
  }

  private async getUnreadByProcess(
    userId: string,
    processIds: string[],
  ): Promise<Map<string, boolean>> {
    const latest = await this.getLatestVersionByProcess(processIds);
    const read = await this.getReadStateMap(userId, processIds);
    const result = new Map<string, boolean>();
    for (const processId of processIds) {
      const latestVersion = latest.get(processId) ?? 0;
      const lastReadVersion = read.get(processId) ?? 0;
      result.set(processId, latestVersion > lastReadVersion);
    }
    return result;
  }

  private async getUnreadByDepartment(
    userId: string,
    departments: ProcessDepartment[],
    accessSet: Set<string> | null,
  ): Promise<Map<string, boolean>> {
    const departmentIds = accessSet
      ? Array.from(accessSet)
      : departments.map((d) => d.id);
    if (!departmentIds.length) return new Map();
    const processes = await this.processesRepo.find({
      where: { departmentId: In(departmentIds) },
      select: ['id', 'departmentId'],
    });
    const unreadByProcess = await this.getUnreadByProcess(
      userId,
      processes.map((p) => p.id),
    );
    const direct = new Map<string, boolean>();
    for (const dep of departments) {
      direct.set(dep.id, false);
    }
    for (const process of processes) {
      if (unreadByProcess.get(process.id)) {
        direct.set(process.departmentId, true);
      }
    }
    const byParent = new Map<string, ProcessDepartment[]>();
    for (const dep of departments) {
      const key = dep.parentId ?? 'root';
      const arr = byParent.get(key) ?? [];
      arr.push(dep);
      byParent.set(key, arr);
    }
    const out = new Map<string, boolean>();
    const walk = (dep: ProcessDepartment): boolean => {
      const childUnread = (byParent.get(dep.id) ?? []).some(walk);
      const ownUnread = direct.get(dep.id) ?? false;
      const hasUnread = ownUnread || childUnread;
      out.set(dep.id, hasUnread);
      return hasUnread;
    };
    for (const root of byParent.get('root') ?? []) {
      walk(root);
    }
    return out;
  }

  private async upsertReadState(
    userId: string,
    processId: string,
    version: number,
  ): Promise<void> {
    const existing = await this.readStateRepo.findOne({
      where: { userId, processId },
    });
    if (existing) {
      existing.lastReadVersion = version;
      await this.readStateRepo.save(existing);
      return;
    }
    await this.readStateRepo.save(
      this.readStateRepo.create({
        userId,
        processId,
        lastReadVersion: version,
      }),
    );
  }

  private async getUsersWithAccessToDepartment(
    departmentId: string,
  ): Promise<string[]> {
    const allDepartments = await this.departmentsRepo.find({
      select: ['id', 'parentId'],
    });
    const byId = new Map(allDepartments.map((d) => [d.id, d]));
    const ancestorIds: string[] = [];
    let cursor: string | null = departmentId;
    while (cursor) {
      ancestorIds.push(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
    const rows = await this.departmentUsersRepo.find({
      where: { departmentId: In(ancestorIds) },
      select: ['userId'],
    });
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    if (!userIds.length) return [];
    const activeUsers = await this.usersRepo.find({
      where: {
        id: In(userIds),
        isActive: true,
      },
      select: ['id'],
    });
    return activeUsers.map((u) => u.id);
  }

  private async getDepartmentAndDescendantIds(departmentId: string): Promise<string[]> {
    const allDepartments = await this.departmentsRepo.find({
      select: ['id', 'parentId'],
    });
    const byParent = new Map<string, string[]>();
    for (const dep of allDepartments) {
      const key = dep.parentId ?? 'root';
      const arr = byParent.get(key) ?? [];
      arr.push(dep.id);
      byParent.set(key, arr);
    }
    const result = new Set<string>();
    const queue = [departmentId];
    while (queue.length) {
      const current = queue.shift() as string;
      if (result.has(current)) continue;
      result.add(current);
      for (const childId of byParent.get(current) ?? []) {
        queue.push(childId);
      }
    }
    return Array.from(result);
  }

  private async initializeReadStateForNewDepartmentUsers(
    departmentId: string,
    userIds: string[],
  ): Promise<void> {
    if (!userIds.length) return;
    const departmentIds = await this.getDepartmentAndDescendantIds(departmentId);
    if (!departmentIds.length) return;
    const processes = await this.processesRepo.find({
      where: { departmentId: In(departmentIds) },
      select: ['id'],
    });
    const processIds = processes.map((p) => p.id);
    if (!processIds.length) return;

    const latestVersions = await this.getLatestVersionByProcess(processIds);
    const existingStateRows = await this.readStateRepo.find({
      where: {
        userId: In(userIds),
        processId: In(processIds),
      },
      select: ['userId', 'processId'],
    });
    const existingPairs = new Set(
      existingStateRows.map((row) => `${row.userId}:${row.processId}`),
    );

    const rowsToCreate: ProcessReadState[] = [];
    for (const userId of userIds) {
      for (const processId of processIds) {
        const pairKey = `${userId}:${processId}`;
        if (existingPairs.has(pairKey)) continue;
        rowsToCreate.push(
          this.readStateRepo.create({
            userId,
            processId,
            lastReadVersion: latestVersions.get(processId) ?? 0,
          }),
        );
      }
    }
    if (!rowsToCreate.length) return;
    await this.readStateRepo.save(rowsToCreate);
  }

  private async logProcessActivity(params: {
    processId: string;
    userId: string;
    versionId?: string | null;
    actionType: ProcessActivityActionType;
    meta?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.activityLogRepo.save(
      this.activityLogRepo.create({
        processId: params.processId,
        userId: params.userId,
        versionId: params.versionId ?? null,
        actionType: params.actionType,
        meta: params.meta ?? null,
      }),
    );
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
