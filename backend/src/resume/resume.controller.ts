import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ResumeFeatureGuard } from './guards/resume-feature.guard';
import { ResumeService } from './resume.service';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateTagDto } from './dto/create-tag.dto';

@Controller('resume')
@UseGuards(JwtAuthGuard, PermissionsGuard, ResumeFeatureGuard)
@Permissions('hr', 'hr_resume_view')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  @Post('upload')
  @Permissions('hr', 'hr_resume_edit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('Файл не предоставлен');
    }
    return this.resumeService.createCandidateFromFile(file);
  }

  @Get('files/:id')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    const fileRecord = await this.resumeService.getFileRecord(id);
    if (!fileRecord) {
      throw new NotFoundException('Файл не найден');
    }
    res.setHeader('Content-Type', fileRecord.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileRecord.originalName)}"`,
    );
    return this.resumeService.pipeFileStream(fileRecord, res);
  }

  // ---------------------------------------------------------------------------
  // Candidates — specific routes before :id to avoid conflicts
  // ---------------------------------------------------------------------------

  @Get('candidates/filter-options')
  getFilterOptions() {
    return this.resumeService.getFilterOptions();
  }

  @Get('candidates/export')
  async exportToExcel(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('specialization') specialization?: string,
    @Query('qualificationCategory') qualificationCategory?: string,
    @Query('branch') branch?: string,
    @Query('processingStatus') processingStatus?: string,
    @Query('experienceMin') experienceMin?: string,
    @Query('experienceMax') experienceMax?: string,
    @Query('city') city?: string,
    @Query('tag') tag?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.resumeService.exportToExcel({
      search,
      status,
      priority,
      specialization,
      qualificationCategory,
      branch,
      processingStatus,
      experienceMin: experienceMin ? Number(experienceMin) : undefined,
      experienceMax: experienceMax ? Number(experienceMax) : undefined,
      city,
      tag,
      sort,
      order,
    });

    const date = new Date().toISOString().slice(0, 10);
    res!.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res!.setHeader(
      'Content-Disposition',
      `attachment; filename="candidates_${date}.xlsx"`,
    );
    res!.send(buffer);
  }

  @Post('candidates/deduplicate')
  @Permissions('hr', 'hr_resume_edit')
  bulkDeduplicate(@Body() body: Record<string, unknown>) {
    return this.resumeService.bulkDeduplicate(body);
  }

  @Post('candidates')
  @Permissions('hr', 'hr_resume_edit')
  createCandidateFromText(@Body() body: { rawText: string }) {
    if (!body?.rawText?.trim()) {
      throw new BadRequestException('Текст резюме не предоставлен');
    }
    return this.resumeService.createCandidateFromText(body.rawText.trim());
  }

  @Get('candidates')
  findCandidates(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('specialization') specialization?: string,
    @Query('qualificationCategory') qualificationCategory?: string,
    @Query('branch') branch?: string,
    @Query('doctorType') doctorType?: string,
    @Query('processingStatus') processingStatus?: string,
    @Query('experienceMin') experienceMin?: string,
    @Query('experienceMax') experienceMax?: string,
    @Query('city') city?: string,
    @Query('workCity') workCity?: string,
    @Query('educationCity') educationCity?: string,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.resumeService.findCandidates({
      search,
      status,
      priority,
      specialization,
      qualificationCategory,
      branch,
      doctorType,
      processingStatus,
      experienceMin: experienceMin ? Number(experienceMin) : undefined,
      experienceMax: experienceMax ? Number(experienceMax) : undefined,
      city,
      workCity,
      educationCity,
      tag,
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Math.max(Number(limit), 1), 100) : 20,
      sort,
      order,
    });
  }

  @Get('candidates/:id')
  findCandidateById(@Param('id') id: string) {
    return this.resumeService.findCandidateById(id);
  }

  @Patch('candidates/:id')
  @Permissions('hr', 'hr_resume_edit')
  updateCandidate(@Param('id') id: string, @Body() dto: UpdateCandidateDto) {
    return this.resumeService.updateCandidate(id, dto);
  }

  @Delete('candidates/:id')
  @Permissions('hr', 'hr_resume_delete')
  @HttpCode(HttpStatus.OK)
  async deleteCandidate(
    @Param('id') id: string,
    @Query('permanent') permanent?: string,
  ) {
    await this.resumeService.softDeleteCandidate(id, permanent === 'true');
    return { success: true };
  }

  @Post('candidates/:id/restore')
  @Permissions('hr', 'hr_resume_edit')
  @HttpCode(HttpStatus.OK)
  restoreCandidate(@Param('id') id: string) {
    return this.resumeService.restoreCandidate(id);
  }

  @Post('candidates/:id/reprocess')
  @Permissions('hr', 'hr_resume_edit')
  @HttpCode(HttpStatus.OK)
  reprocessCandidate(@Param('id') id: string) {
    return this.resumeService.reprocessCandidate(id);
  }

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------

  @Get('candidates/:id/notes')
  listNotes(@Param('id') id: string) {
    return this.resumeService.listNotes(id);
  }

  @Post('candidates/:id/notes')
  @Permissions('hr', 'hr_resume_edit')
  addNote(@Param('id') id: string, @Body() dto: CreateNoteDto) {
    return this.resumeService.addNote(id, dto);
  }

  @Delete('notes/:noteId')
  @Permissions('hr', 'hr_resume_delete')
  @HttpCode(HttpStatus.OK)
  async deleteNote(@Param('noteId') noteId: string) {
    await this.resumeService.deleteNote(noteId);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------

  @Get('candidates/:id/tags')
  listTags(@Param('id') id: string) {
    return this.resumeService.listTags(id);
  }

  @Post('candidates/:id/tags')
  @Permissions('hr', 'hr_resume_edit')
  addTag(@Param('id') id: string, @Body() dto: CreateTagDto) {
    return this.resumeService.addTag(id, dto);
  }

  @Delete('tags/:tagId')
  @Permissions('hr', 'hr_resume_edit')
  @HttpCode(HttpStatus.OK)
  async deleteTag(@Param('tagId') tagId: string) {
    await this.resumeService.deleteTag(tagId);
    return { success: true };
  }

  @Put('candidates/:id/tags')
  @Permissions('hr', 'hr_resume_edit')
  replaceTags(
    @Param('id') id: string,
    @Body() body: { tags: { label: string; color?: string }[] },
  ) {
    if (!Array.isArray(body?.tags) || body.tags.length > 20) {
      throw new BadRequestException('Максимум 20 тегов');
    }
    for (const tag of body.tags) {
      if (typeof tag.label !== 'string' || tag.label.length > 100) {
        throw new BadRequestException(
          'Название тега слишком длинное (максимум 100 символов)',
        );
      }
    }
    return this.resumeService.replaceTags(id, body.tags);
  }

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------

  @Get('analytics')
  @Permissions('hr', 'hr_resume_analytics')
  getFullAnalytics(
    @Query('period') period?: string,
    @Query('branch') branch?: string,
  ) {
    return this.resumeService.getFullAnalytics({ period, branch });
  }

  // ---------------------------------------------------------------------------
  // Telegram management
  // ---------------------------------------------------------------------------

  @Get('telegram/chats')
  @Permissions('hr', 'hr_resume_telegram_manage')
  listTelegramChats() {
    return this.resumeService.listTelegramChats();
  }

  @Delete('telegram/chats/:chatId')
  @Permissions('hr', 'hr_resume_telegram_manage')
  @HttpCode(HttpStatus.OK)
  async removeTelegramChat(@Param('chatId') chatId: string) {
    await this.resumeService.removeTelegramChat(chatId);
    return { success: true };
  }
}
