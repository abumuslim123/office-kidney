import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ResumeService } from './resume.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { CreateResumeNoteDto } from './dto/create-note.dto';
import { CreateResumeTagDto } from './dto/create-tag.dto';
import { TelegramIngestDto } from './dto/telegram-ingest.dto';
import { ResumeFeatureGuard } from './guards/resume-feature.guard';

@Controller('resume')
@UseGuards(ResumeFeatureGuard, JwtAuthGuard, PermissionsGuard)
@Permissions('hr')
export class ResumeController {
  constructor(
    private readonly resumeService: ResumeService,
    private readonly config: ConfigService,
  ) {}

  @Get('candidates')
  @Permissions('hr', 'hr_resume_view')
  findCandidates(
    @Query('search') search?: string,
    @Query('specialization') specialization?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('branch') branch?: string,
    @Query('city') city?: string,
    @Query('workCity') workCity?: string,
    @Query('educationCity') educationCity?: string,
    @Query('experience') experience?: string,
    @Query('accreditation') accreditation?: 'yes' | 'no',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.resumeService.findCandidates({
      search,
      specialization,
      category: category as never,
      status: status as never,
      priority: priority as never,
      branch,
      city,
      workCity,
      educationCity,
      experience,
      accreditation,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('candidates/filter-options')
  @Permissions('hr', 'hr_resume_view')
  getFilterOptions() {
    return this.resumeService.getFilterOptions();
  }

  @Get('analytics/summary')
  @Permissions('hr', 'hr_resume_analytics')
  getAnalyticsSummary() {
    return this.resumeService.getAnalyticsSummary();
  }

  @Get('analytics')
  @Permissions('hr', 'hr_resume_analytics')
  getFullAnalytics(
    @Query('period') period?: string,
    @Query('branch') branch?: string,
  ) {
    return this.resumeService.getFullAnalytics({ period, branch });
  }

  @Get('candidates/export')
  @Permissions('hr', 'hr_resume_view')
  async exportCandidates(
    @Query('search') search: string | undefined,
    @Query('specialization') specialization: string | undefined,
    @Query('category') category: string | undefined,
    @Query('status') status: string | undefined,
    @Query('priority') priority: string | undefined,
    @Query('branch') branch: string | undefined,
    @Query('city') city: string | undefined,
    @Query('workCity') workCity: string | undefined,
    @Query('educationCity') educationCity: string | undefined,
    @Query('experience') experience: string | undefined,
    @Query('accreditation') accreditation: 'yes' | 'no' | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.resumeService.exportCandidates({
      search,
      specialization,
      category: category as never,
      status: status as never,
      priority: priority as never,
      branch,
      city,
      workCity,
      educationCity,
      experience,
      accreditation,
    });

    const fileName = `resume-candidates-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(buffer);
  }

  @Post('candidates/deduplicate')
  @Permissions('hr', 'hr_resume_edit')
  async bulkDeduplicate(@Body() body: Record<string, string>) {
    const { candidates: all } = await this.resumeService.findCandidates({
      page: 1,
      limit: 1000,
      search: body.search,
      specialization: body.specialization,
      category: body.category as never,
      status: body.status as never,
      priority: body.priority as never,
      branch: body.branch,
      city: body.city,
      workCity: body.workCity,
      educationCity: body.educationCity,
      experience: body.experience,
      accreditation: body.accreditation as 'yes' | 'no' | undefined,
    });
    let deleted = 0;
    let tagged = 0;
    for (const candidate of all) {
      try {
        const result = await this.resumeService.deduplicateCandidate(candidate.id);
        if (result.status === 'marked_deleted') deleted++;
      } catch { tagged++; }
    }
    return { deleted, tagged };
  }

  @Get('candidates/:id')
  @Permissions('hr', 'hr_resume_view')
  findCandidate(@Param('id') id: string) {
    return this.resumeService.findCandidateById(id);
  }

  @Get('files/:id')
  @Permissions('hr', 'hr_resume_view')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    const { file, content } = await this.resumeService.readUploadedFile(id);
    res.set({
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(
        file.originalName || 'resume-file',
      )}"`,
    });
    res.send(content);
  }

  @Post('candidates')
  @Permissions('hr', 'hr_resume_edit')
  createCandidate(@Body() dto: CreateCandidateDto) {
    return this.resumeService.createCandidateFromText(dto.rawText);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  @Permissions('hr', 'hr_resume_edit')
  createCandidateFromUpload(@UploadedFile() file: Express.Multer.File) {
    return this.resumeService.createCandidateFromUpload(file);
  }

  @Put('candidates/:id')
  @Permissions('hr', 'hr_resume_edit')
  updateCandidate(@Param('id') id: string, @Body() dto: UpdateCandidateDto) {
    return this.resumeService.updateCandidate(id, {
      ...dto,
      accreditationExpiryDate: dto.accreditationExpiryDate
        ? new Date(dto.accreditationExpiryDate)
        : null,
    });
  }

  @Delete('candidates/:id')
  @Permissions('hr', 'hr_resume_delete')
  async removeCandidate(@Param('id') id: string) {
    await this.resumeService.removeCandidate(id);
    return { success: true };
  }

  @Post('candidates/:id/reprocess')
  @Permissions('hr', 'hr_resume_edit')
  reprocessCandidate(@Param('id') id: string) {
    return this.resumeService.reprocessCandidate(id);
  }

  @Post('candidates/:id/deduplicate')
  @Permissions('hr', 'hr_resume_edit')
  deduplicateCandidate(@Param('id') id: string) {
    return this.resumeService.deduplicateCandidate(id);
  }

  @Get('candidates/:id/notes')
  @Permissions('hr', 'hr_resume_view')
  listNotes(@Param('id') id: string) {
    return this.resumeService.listNotes(id);
  }

  @Post('candidates/:id/notes')
  @Permissions('hr', 'hr_resume_edit')
  addNote(@Param('id') id: string, @Body() dto: CreateResumeNoteDto) {
    return this.resumeService.addNote(id, dto);
  }

  @Delete('candidates/:id/notes/:noteId')
  @Permissions('hr', 'hr_resume_edit')
  async deleteNote(@Param('id') id: string, @Param('noteId') noteId: string) {
    await this.resumeService.deleteNote(id, noteId);
    return { success: true };
  }

  @Get('candidates/:id/tags')
  @Permissions('hr', 'hr_resume_view')
  listTags(@Param('id') id: string) {
    return this.resumeService.listTags(id);
  }

  @Put('candidates/:id/tags')
  @Permissions('hr', 'hr_resume_edit')
  replaceTags(
    @Param('id') id: string,
    @Body() body: { tags: Array<{ label: string; color?: string | null }> },
  ) {
    return this.resumeService.replaceTags(id, body.tags);
  }

  @Post('candidates/:id/tags')
  @Permissions('hr', 'hr_resume_edit')
  addTag(@Param('id') id: string, @Body() dto: CreateResumeTagDto) {
    return this.resumeService.addTag(id, dto);
  }

  @Delete('candidates/:id/tags/:tagId')
  @Permissions('hr', 'hr_resume_edit')
  async deleteTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    await this.resumeService.deleteTag(id, tagId);
    return { success: true };
  }

  @Post('telegram/ingest')
  @Permissions('hr', 'hr_resume_telegram_manage')
  ingestTelegram(
    @Body() dto: TelegramIngestDto,
    @Headers('x-telegram-secret') secret?: string,
  ) {
    const expected = this.config.get<string>('TELEGRAM_INGEST_SECRET');
    if (expected && secret !== expected) {
      throw new UnauthorizedException('Invalid telegram secret');
    }
    return this.resumeService.ingestTelegram(dto);
  }
}
