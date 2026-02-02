import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Response } from 'express';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CreateListDto } from './dto/create-list.dto';
import { CopyListDto } from './dto/copy-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('hr')
export class HrController {
  constructor(private hr: HrService) {}

  // ========== Folders ==========

  @Get('folders')
  findAllFolders() {
    return this.hr.findAllFolders();
  }

  @Get('folders/:id')
  findFolder(@Param('id') id: string) {
    return this.hr.findFolderById(id);
  }

  @Post('folders')
  createFolder(@Body() dto: CreateFolderDto) {
    return this.hr.createFolder(dto);
  }

  @Put('folders/:id')
  updateFolder(@Param('id') id: string, @Body() dto: UpdateFolderDto) {
    return this.hr.updateFolder(id, dto);
  }

  @Delete('folders/:id')
  @Permissions('hr', 'hr_delete_folders')
  async deleteFolder(@Param('id') id: string) {
    await this.hr.deleteFolder(id);
    return { success: true };
  }

  // ========== Lists ==========

  @Get('lists')
  findAllLists(@Query('folderId') folderId?: string, @Query('year') year?: string) {
    return this.hr.findAllLists(folderId || undefined, year ? parseInt(year, 10) : undefined);
  }

  @Post('lists/import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async createListFromFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folderId') folderId?: string,
    @Query('name') name?: string,
    @Query('year') year?: string,
  ) {
    if (!file?.buffer) throw new BadRequestException('Файл не загружен');
    if (!folderId) throw new BadRequestException('folderId обязателен');
    return this.hr.createListFromFile(
      file.buffer,
      folderId,
      name || undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('lists/:id')
  findList(@Param('id') id: string) {
    return this.hr.findListById(id);
  }

  @Post('lists')
  createList(@Body() dto: CreateListDto) {
    return this.hr.createList(dto);
  }

  @Put('lists/:id')
  updateList(@Param('id') id: string, @Body() dto: UpdateListDto) {
    return this.hr.updateList(id, dto);
  }

  @Delete('lists/:id')
  @Permissions('hr', 'hr_delete_entries')
  async deleteList(@Param('id') id: string) {
    await this.hr.deleteList(id);
    return { success: true };
  }

  @Post('lists/:id/copy')
  copyList(@Param('id') id: string, @Body() dto: CopyListDto) {
    return this.hr.copyList(id, dto);
  }

  // ========== Fields ==========

  @Get('lists/:listId/fields')
  findFields(@Param('listId') listId: string) {
    return this.hr.findFieldsByList(listId);
  }

  @Post('lists/:listId/fields')
  @Permissions('hr', 'hr_edit_fields')
  createField(@Param('listId') listId: string, @Body() dto: CreateFieldDto) {
    return this.hr.createField(listId, dto);
  }

  @Put('fields/:id')
  @Permissions('hr', 'hr_edit_fields')
  updateField(@Param('id') id: string, @Body() dto: UpdateFieldDto) {
    return this.hr.updateField(id, dto);
  }

  @Delete('fields/:id')
  @Permissions('hr', 'hr_delete_fields')
  async deleteField(@Param('id') id: string) {
    await this.hr.deleteField(id);
    return { success: true };
  }

  // ========== Entries ==========

  @Get('lists/:listId/entries')
  findEntries(
    @Param('listId') listId: string,
    @Query('search') search?: string,
    @Query() query?: Record<string, string>,
  ) {
    // Extract f_fieldName=value from query (f_ prefix for field filters)
    const filters: Record<string, string> = {};
    for (const [key, value] of Object.entries(query || {})) {
      if (key.startsWith('f_') && key.length > 2) {
        filters[key.slice(2)] = value;
      }
    }
    console.log('[HR] findEntries query:', JSON.stringify(query));
    console.log('[HR] findEntries filters:', JSON.stringify(filters));
    console.log('[HR] findEntries search:', search);
    return this.hr.findEntriesByList(listId, filters, search);
  }

  @Post('lists/:listId/entries')
  @Permissions('hr', 'hr_edit_entries')
  createEntry(@Param('listId') listId: string, @Body() dto: CreateEntryDto) {
    return this.hr.createEntry(listId, dto);
  }

  @Put('entries/:id')
  @Permissions('hr', 'hr_edit_entries')
  updateEntry(@Param('id') id: string, @Body() dto: UpdateEntryDto) {
    return this.hr.updateEntry(id, dto);
  }

  @Delete('entries/:id')
  @Permissions('hr', 'hr_delete_entries')
  async deleteEntry(@Param('id') id: string) {
    await this.hr.deleteEntry(id);
    return { success: true };
  }

  @Delete('lists/:listId/entries')
  @Permissions('hr', 'hr_delete_entries')
  async deleteAllEntries(@Param('listId') listId: string) {
    return this.hr.deleteAllEntries(listId);
  }

  // ========== Template & Import ==========

  @Get('lists/:listId/template')
  async getTemplate(@Param('listId') listId: string, @Res() res: Response) {
    const buffer = await this.hr.getListTemplate(listId);
    const list = await this.hr.findListById(listId);
    const filename = `Шаблон_${list.name}${list.year ? '_' + list.year : ''}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    res.send(buffer);
  }

  @Post('lists/:listId/import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  @Permissions('hr', 'hr_edit_entries')
  async importEntries(
    @Param('listId') listId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('Файл не загружен');
    return this.hr.importEntriesFromFile(listId, file.buffer);
  }

  // ========== Export ==========

  @Get('lists/:listId/export')
  async exportExcel(
    @Param('listId') listId: string,
    @Query('search') search?: string,
    @Query() query?: Record<string, string>,
    @Res() res?: Response,
  ) {
    const filters: Record<string, string> = {};
    for (const [key, value] of Object.entries(query || {})) {
      if (key.startsWith('f_') && key.length > 2) {
        filters[key.slice(2)] = value;
      }
    }
    const buffer = await this.hr.exportToExcel(listId, filters, search);
    const list = await this.hr.findListById(listId);
    const filename = `${list.name}${list.year ? '_' + list.year : ''}.xlsx`;

    res!.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    res!.send(buffer);
  }
}
