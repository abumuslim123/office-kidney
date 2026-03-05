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
import { Request, Response } from 'express';
import { createReadStream, statSync } from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CallsService } from './calls.service';
import { User } from '../users/entities/user.entity';
import { UpdateCallsSettingsDto } from './dto/update-settings.dto';

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
    @Body() body: UpdateCallsSettingsDto,
  ) {
    const needsKeyPerm =
      body.apiKey !== undefined ||
      body.speechkitApiKey !== undefined ||
      body.speechkitFolderId !== undefined;
    if (needsKeyPerm) {
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
    body: { employeeName?: string; clientName?: string; clientPhone?: string; callAt?: string; durationSeconds?: string },
  ) {
    if (!file?.buffer) throw new BadRequestException('Файл не загружен');
    return this.calls.uploadCall({
      file,
      employeeName: body.employeeName,
      clientName: body.clientName,
      clientPhone: body.clientPhone,
      callAt: body.callAt,
      durationSeconds: body.durationSeconds,
    });
  }

  @Get(':id/audio')
  async streamAudio(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const filePath = await this.calls.getAudioPath(id);
    if (!filePath) return res.status(404).send('Audio not found');
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.mp3' ? 'audio/mpeg' : ext === '.wav' ? 'audio/wav' : 'application/octet-stream';

    const stat = statSync(filePath);
    const fileSize = stat.size;

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': contentType,
      });
      createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      createReadStream(filePath).pipe(res);
    }
  }

  @Get(':id')
  getCall(@Param('id') id: string) {
    return this.calls.getCall(id);
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
}
