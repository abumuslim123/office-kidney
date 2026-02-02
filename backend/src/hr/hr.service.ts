import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { HrFolder } from './entities/hr-folder.entity';
import { HrList } from './entities/hr-list.entity';
import { HrFieldDefinition } from './entities/hr-field-definition.entity';
import { HrEntry } from './entities/hr-entry.entity';
import { HrEvent } from './entities/hr-event.entity';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(HrFolder)
    private folderRepo: Repository<HrFolder>,
    @InjectRepository(HrList)
    private listRepo: Repository<HrList>,
    @InjectRepository(HrFieldDefinition)
    private fieldRepo: Repository<HrFieldDefinition>,
    @InjectRepository(HrEntry)
    private entryRepo: Repository<HrEntry>,
    @InjectRepository(HrEvent)
    private eventRepo: Repository<HrEvent>,
  ) {}

  // ========== Folders ==========

  async findAllFolders(): Promise<HrFolder[]> {
    return this.folderRepo.find({
      relations: ['lists'],
      order: { name: 'ASC' },
    });
  }

  async findFolderById(id: string): Promise<HrFolder> {
    const folder = await this.folderRepo.findOne({
      where: { id },
      relations: ['lists'],
    });
    if (!folder) throw new NotFoundException('Folder not found');
    return folder;
  }

  async createFolder(dto: CreateFolderDto): Promise<HrFolder> {
    const folder = this.folderRepo.create({ name: dto.name });
    return this.folderRepo.save(folder);
  }

  async updateFolder(id: string, dto: UpdateFolderDto): Promise<HrFolder> {
    const folder = await this.findFolderById(id);
    if (dto.name !== undefined) folder.name = dto.name;
    return this.folderRepo.save(folder);
  }

  async deleteFolder(id: string): Promise<void> {
    const folder = await this.findFolderById(id);
    await this.folderRepo.remove(folder);
  }

  // ========== Lists ==========

  async findAllLists(folderId?: string, year?: number): Promise<HrList[]> {
    const where: { folderId?: string; year?: number } = {};
    if (folderId) where.folderId = folderId;
    if (year !== undefined) where.year = year;
    return this.listRepo.find({
      where,
      order: { year: 'DESC', name: 'ASC' },
    });
  }

  async findListById(id: string): Promise<HrList> {
    const list = await this.listRepo.findOne({
      where: { id },
      relations: ['fields'],
    });
    if (!list) throw new NotFoundException('List not found');
    return list;
  }

  async createList(dto: CreateListDto): Promise<HrList> {
    await this.findFolderById(dto.folderId);
    const list = this.listRepo.create({
      folderId: dto.folderId,
      name: dto.name,
      year: dto.year ?? null,
    });
    return this.listRepo.save(list);
  }

  async updateList(id: string, dto: UpdateListDto): Promise<HrList> {
    const list = await this.findListById(id);
    if (dto.name !== undefined) list.name = dto.name;
    if (dto.year !== undefined) list.year = dto.year;
    return this.listRepo.save(list);
  }

  async deleteList(id: string): Promise<void> {
    const list = await this.findListById(id);
    await this.listRepo.remove(list);
  }

  async copyList(
    sourceListId: string,
    dto: { folderId?: string; name?: string },
  ): Promise<HrList> {
    const list = await this.findListById(sourceListId);
    const fields = await this.findFieldsByList(sourceListId);
    const entries = await this.findEntriesByList(sourceListId);

    const targetFolderId = dto.folderId ?? list.folderId;
    await this.findFolderById(targetFolderId);

    const newList = this.listRepo.create({
      folderId: targetFolderId,
      name: dto.name ?? `${list.name} (копия)`,
      year: list.year,
    });
    const savedList = await this.listRepo.save(newList);

    for (const f of fields) {
      const field = this.fieldRepo.create({
        listId: savedList.id,
        name: f.name,
        fieldType: f.fieldType,
        options: f.options,
        order: f.order,
      });
      await this.fieldRepo.save(field);
    }

    for (const e of entries) {
      const entry = this.entryRepo.create({
        listId: savedList.id,
        data: { ...e.data },
      });
      await this.entryRepo.save(entry);
    }

    return this.findListById(savedList.id);
  }

  async createListFromFile(
    fileBuffer: Buffer,
    folderId: string,
    name?: string,
    year?: number,
  ): Promise<HrList> {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = new Uint8Array(fileBuffer).buffer as ArrayBuffer;
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new NotFoundException('Файл не содержит листов');

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => {
      const val = cell.value?.toString()?.trim();
      if (val) headers.push(val);
    });
    if (headers.length === 0) throw new NotFoundException('Первая строка должна содержать заголовки колонок');

    const listName = name || `Импорт ${new Date().toISOString().slice(0, 10)}`;
    const list = await this.createList({ folderId, name: listName, year: year ?? undefined });

    for (let i = 0; i < headers.length; i++) {
      await this.createField(list.id, {
        name: headers[i],
        fieldType: 'text',
        order: i,
      });
    }

    const fields = await this.findFieldsByList(list.id);
    const rowsToSave: Record<string, unknown>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const data: Record<string, unknown> = {};
      let hasAny = false;
      headers.forEach((header, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        let val: unknown = cell.value;
        if (val != null && val !== '') {
          hasAny = true;
          if (typeof val === 'object' && val !== null && 'result' in val) {
            val = (val as { result: unknown }).result;
          }
          // Convert Date to dd.mm.yyyy format
          if (val instanceof Date) {
            const d = val.getDate().toString().padStart(2, '0');
            const m = (val.getMonth() + 1).toString().padStart(2, '0');
            const y = val.getFullYear();
            val = `${d}.${m}.${y}`;
          } else if (typeof val === 'object' && val !== null) {
            val = String(val);
          }
          data[header] = val;
        }
      });
      if (hasAny) rowsToSave.push(data);
    });

    for (const data of rowsToSave) {
      const entry = this.entryRepo.create({ listId: list.id, data });
      await this.entryRepo.save(entry);
    }

    return this.findListById(list.id);
  }

  // ========== Fields ==========

  async findFieldsByList(listId: string): Promise<HrFieldDefinition[]> {
    await this.findListById(listId); // ensure list exists
    return this.fieldRepo.find({
      where: { listId },
      order: { order: 'ASC', name: 'ASC' },
    });
  }

  async createField(listId: string, dto: CreateFieldDto): Promise<HrFieldDefinition> {
    await this.findListById(listId);
    const maxOrder = await this.fieldRepo
      .createQueryBuilder('f')
      .where('f.listId = :listId', { listId })
      .select('MAX(f.order)', 'max')
      .getRawOne();
    const field = this.fieldRepo.create({
      listId,
      name: dto.name,
      fieldType: dto.fieldType,
      options: dto.options ?? null,
      order: dto.order ?? (maxOrder?.max ?? -1) + 1,
    });
    return this.fieldRepo.save(field);
  }

  async updateField(fieldId: string, dto: UpdateFieldDto): Promise<HrFieldDefinition> {
    const field = await this.fieldRepo.findOne({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('Field not found');
    if (dto.name !== undefined) field.name = dto.name;
    if (dto.fieldType !== undefined) field.fieldType = dto.fieldType;
    if (dto.options !== undefined) field.options = dto.options;
    if (dto.order !== undefined) field.order = dto.order;
    return this.fieldRepo.save(field);
  }

  async deleteField(fieldId: string): Promise<void> {
    const field = await this.fieldRepo.findOne({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('Field not found');
    await this.fieldRepo.remove(field);
  }

  // ========== Entries ==========

  async findEntriesByList(
    listId: string,
    filters: Record<string, string> = {},
    search?: string,
  ): Promise<HrEntry[]> {
    await this.findListById(listId);

    const qb = this.entryRepo
      .createQueryBuilder('e')
      .where('e.listId = :listId', { listId })
      .orderBy('e.createdAt', 'ASC');

    // JSONB filters: filter[fieldName]=value (indexed params to avoid special chars in param names)
    Object.entries(filters).forEach(([key, value], i) => {
      const keyParam = `filterKey${i}`;
      const valParam = `filterVal${i}`;
      qb.andWhere(`e.data->> :${keyParam} ILIKE :${valParam}`, {
        [keyParam]: key,
        [valParam]: `%${value}%`,
      });
    });

    // Full-text search across all text fields
    if (search) {
      qb.andWhere(`e.data::text ILIKE :search`, { search: `%${search}%` });
    }

    return qb.getMany();
  }

  async findEntryById(entryId: string): Promise<HrEntry> {
    const entry = await this.entryRepo.findOne({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Entry not found');
    return entry;
  }

  async createEntry(listId: string, dto: CreateEntryDto): Promise<HrEntry> {
    await this.findListById(listId);
    const entry = this.entryRepo.create({
      listId,
      data: dto.data,
    });
    return this.entryRepo.save(entry);
  }

  async updateEntry(entryId: string, dto: UpdateEntryDto): Promise<HrEntry> {
    const entry = await this.findEntryById(entryId);
    if (dto.data !== undefined) entry.data = dto.data;
    return this.entryRepo.save(entry);
  }

  async deleteEntry(entryId: string): Promise<void> {
    const entry = await this.findEntryById(entryId);
    await this.entryRepo.remove(entry);
  }

  async deleteAllEntries(listId: string): Promise<{ deleted: number }> {
    await this.findListById(listId); // ensure list exists
    const result = await this.entryRepo.delete({ listId });
    return { deleted: result.affected ?? 0 };
  }

  // ========== Events ==========

  async findEventsByDateRange(startDate: string, endDate: string): Promise<HrEvent[]> {
    return this.eventRepo
      .createQueryBuilder('e')
      .where('e.date >= :startDate', { startDate })
      .andWhere('e.date <= :endDate', { endDate })
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.createdAt', 'ASC')
      .getMany();
  }

  async findEventById(id: string): Promise<HrEvent> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async createEvent(dto: CreateEventDto): Promise<HrEvent> {
    const event = this.eventRepo.create({
      title: dto.title,
      date: dto.date,
      description: dto.description ?? null,
    });
    return this.eventRepo.save(event);
  }

  async updateEvent(id: string, dto: UpdateEventDto): Promise<HrEvent> {
    const event = await this.findEventById(id);
    if (dto.title !== undefined) event.title = dto.title;
    if (dto.date !== undefined) event.date = dto.date;
    if (dto.description !== undefined) event.description = dto.description;
    return this.eventRepo.save(event);
  }

  async deleteEvent(id: string): Promise<void> {
    const event = await this.findEventById(id);
    await this.eventRepo.remove(event);
  }

  // ========== Export ==========

  async exportToExcel(
    listId: string,
    filters: Record<string, string> = {},
    search?: string,
  ): Promise<Buffer> {
    const list = await this.findListById(listId);
    const fields = await this.findFieldsByList(listId);
    const entries = await this.findEntriesByList(listId, filters, search);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(list.name);

    // Header row
    sheet.columns = fields.map((f) => ({
      header: f.name,
      key: f.name,
      width: 20,
    }));

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Data rows
    for (const entry of entries) {
      const row: Record<string, unknown> = {};
      for (const f of fields) {
        row[f.name] = entry.data[f.name] ?? '';
      }
      sheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async getListTemplate(listId: string): Promise<Buffer> {
    const list = await this.findListById(listId);
    const fields = await this.findFieldsByList(listId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(list.name);

    sheet.columns = fields.map((f) => ({
      header: f.name,
      key: f.name,
      width: 20,
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importEntriesFromFile(
    listId: string,
    fileBuffer: Buffer,
  ): Promise<{ imported: number; errors: string[] }> {
    await this.findListById(listId);
    const errors: string[] = [];
    let imported = 0;

    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = new Uint8Array(fileBuffer).buffer as ArrayBuffer;
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return { imported: 0, errors: ['Файл не содержит листов'] };
    }

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => {
      const val = cell.value?.toString()?.trim();
      if (val) headers.push(val);
    });

    const rowsToSave: { rowNumber: number; data: Record<string, unknown> }[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const data: Record<string, unknown> = {};
      let hasAny = false;
      headers.forEach((header, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        let val: unknown = cell.value;
        if (val != null && val !== '') {
          hasAny = true;
          if (typeof val === 'object' && val !== null && 'result' in val) {
            val = (val as { result: unknown }).result;
          }
          // Convert Date to dd.mm.yyyy format
          if (val instanceof Date) {
            const d = val.getDate().toString().padStart(2, '0');
            const m = (val.getMonth() + 1).toString().padStart(2, '0');
            const y = val.getFullYear();
            val = `${d}.${m}.${y}`;
          } else if (typeof val === 'object' && val !== null) {
            val = String(val);
          }
          data[header] = val;
        }
      });
      if (hasAny) rowsToSave.push({ rowNumber, data });
    });

    for (const { rowNumber, data } of rowsToSave) {
      try {
        const entry = this.entryRepo.create({ listId, data });
        await this.entryRepo.save(entry);
        imported++;
      } catch (err) {
        errors.push(`Строка ${rowNumber}: ${err instanceof Error ? err.message : 'Ошибка сохранения'}`);
      }
    }

    return { imported, errors };
  }
}
