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
import { CreateListDto } from './dto/create-list.dto';
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

  // ========== Lists ==========

  @Get('lists')
  findAllLists(@Query('year') year?: string) {
    return this.hr.findAllLists(year ? parseInt(year, 10) : undefined);
  }

  @Post('lists/import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async createListFromFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('name') name?: string,
    @Query('year') year?: string,
  ) {
    if (!file?.buffer) throw new BadRequestException('Файл не загружен');
    return this.hr.createListFromFile(
      file.buffer,
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
  async deleteList(@Param('id') id: string) {
    await this.hr.deleteList(id);
    return { success: true };
  }

  // ========== Fields ==========

  @Get('lists/:listId/fields')
  findFields(@Param('listId') listId: string) {
    return this.hr.findFieldsByList(listId);
  }

  @Post('lists/:listId/fields')
  createField(@Param('listId') listId: string, @Body() dto: CreateFieldDto) {
    return this.hr.createField(listId, dto);
  }

  @Put('fields/:id')
  updateField(@Param('id') id: string, @Body() dto: UpdateFieldDto) {
    return this.hr.updateField(id, dto);
  }

  @Delete('fields/:id')
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
    // Extract filter[fieldName]=value from query
    const filters: Record<string, string> = {};
    for (const [key, value] of Object.entries(query || {})) {
      const match = key.match(/^filter\[(.+)\]$/);
      if (match) filters[match[1]] = value;
    }
    console.log('[HR] findEntries query:', JSON.stringify(query));
    console.log('[HR] findEntries filters:', JSON.stringify(filters));
    console.log('[HR] findEntries search:', search);
    return this.hr.findEntriesByList(listId, filters, search);
  }

  @Post('lists/:listId/entries')
  createEntry(@Param('listId') listId: string, @Body() dto: CreateEntryDto) {
    return this.hr.createEntry(listId, dto);
  }

  @Put('entries/:id')
  updateEntry(@Param('id') id: string, @Body() dto: UpdateEntryDto) {
    return this.hr.updateEntry(id, dto);
  }

  @Delete('entries/:id')
  async deleteEntry(@Param('id') id: string) {
    await this.hr.deleteEntry(id);
    return { success: true };
  }

  @Delete('lists/:listId/entries')
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
      const match = key.match(/^filter\[(.+)\]$/);
      if (match) filters[match[1]] = value;
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
