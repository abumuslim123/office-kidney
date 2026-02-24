import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Response } from 'express';
import { createReadStream } from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CallsService } from './calls.service';
import { User } from '../users/entities/user.entity';

@Controller('calls')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('calls')
export class CallsController {
  constructor(private calls: CallsService) {}

  private parseList(value?: string): string[] {
    if (!value) return [];
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('employees') employees?: string,
    @Query('topics') topics?: string,
  ) {
    return this.calls.listCalls({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      employees: this.parseList(employees),
      topics: this.parseList(topics),
    });
  }

  @Get('stats')
  stats(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('employees') employees?: string,
    @Query('topics') topics?: string,
  ) {
    return this.calls.getStats({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      employees: this.parseList(employees),
      topics: this.parseList(topics),
    });
  }

  @Get('topics')
  listTopics() {
    return this.calls.listTopics();
  }

  @Get('settings')
  @Permissions('calls_settings')
  getSettings() {
    return this.calls.getSettings();
  }

  @Put('settings')
  @Permissions('calls_settings')
  updateSettings(
    @Req() req: { user: User },
    @Body()
    body: { apiKey?: string; apiBase?: string; audioPath?: string; model?: string },
  ) {
    if (body.apiKey !== undefined) {
      const userPermissions = req.user?.permissions?.map((p) => p.slug) || [];
      if (!userPermissions.includes('calls_api_key')) {
        throw new ForbiddenException('Нет прав для изменения API ключа');
      }
    }
    return this.calls.updateSettings(body);
  }

  @Post('topics')
  @Permissions('calls_manage_topics')
  createTopic(@Body() body: { name: string; keywords?: string[] | string; isActive?: boolean }) {
    return this.calls.createTopic(body);
  }

  @Put('topics/:id')
  @Permissions('calls_manage_topics')
  updateTopic(
    @Param('id') id: string,
    @Body() body: { name?: string; keywords?: string[] | string; isActive?: boolean },
  ) {
    return this.calls.updateTopic(id, body);
  }

  @Delete('topics/:id')
  @Permissions('calls_manage_topics')
  async deleteTopic(@Param('id') id: string) {
    await this.calls.deleteTopic(id);
    return { success: true };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: { employeeName?: string; clientName?: string; callAt?: string; durationSeconds?: string },
  ) {
    if (!file?.buffer) throw new BadRequestException('Файл не загружен');
    return this.calls.uploadCall({
      file,
      employeeName: body.employeeName,
      clientName: body.clientName,
      callAt: body.callAt,
      durationSeconds: body.durationSeconds,
    });
  }

  @Post(':id/transcribe')
  transcribe(@Param('id') id: string) {
    return this.calls.transcribeCall(id);
  }

  @Delete(':id/audio')
  async deleteAudio(@Param('id') id: string) {
    await this.calls.deleteAudio(id);
    return { success: true };
  }

  @Get(':id/audio')
  async streamAudio(@Param('id') id: string, @Res() res: Response) {
    const filePath = await this.calls.getAudioPath(id);
    if (!filePath) return res.status(404).send('Audio not found');
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.mp3' ? 'audio/mpeg' : ext === '.wav' ? 'audio/wav' : 'application/octet-stream';
    const safeExt = ext && /^\.\w+$/.test(ext) ? ext : '';
    res.setHeader('Content-Disposition', `attachment; filename="call-${id}${safeExt}"`);
    res.setHeader('Content-Type', contentType);
    const stream = createReadStream(filePath);
    stream.pipe(res);
  }
}
