import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ScreensService } from './screens.service';

@Controller('screens')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('screens')
export class ScreensController {
  constructor(private screens: ScreensService) {}

  @Get()
  list() {
    return this.screens.findAll();
  }

  @Get('apk')
  async downloadApk(@Res() res: Response) {
    const filePath = await this.screens.getApkPath();
    if (!filePath) throw new NotFoundException('APK file not configured or not found');
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="kidney-office-tv.apk"');
    const stream = createReadStream(filePath);
    stream.pipe(res);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.screens.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string | null }) {
    return this.screens.updateName(id, body.name ?? null);
  }

  @Post(':id/video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 512 * 1024 * 1024 }, // 512 MB
    }),
  )
  async uploadVideo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('Файл не загружен');
    return this.screens.saveVideo(id, file.buffer, file.originalname || 'video.mp4');
  }

  @Delete(':id/video')
  async deleteVideo(@Param('id') id: string) {
    await this.screens.deleteVideo(id);
    return { success: true };
  }

  @Get(':id/photos')
  async listPhotos(@Param('id') id: string) {
    return this.screens.listPhotos(id);
  }

  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: { durationSeconds?: string; rotation?: string; expiresAt?: string; orderIndex?: string },
  ) {
    if (!file?.buffer) throw new BadRequestException('Файл не загружен');
    const durationSeconds = body.durationSeconds ? parseInt(body.durationSeconds, 10) : 15;
    const rotation = body.rotation ? parseInt(body.rotation, 10) : 0;
    const orderIndex = body.orderIndex ? parseInt(body.orderIndex, 10) : 0;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    return this.screens.savePhoto(
      id,
      file.buffer,
      file.originalname || 'photo.jpg',
      durationSeconds,
      rotation,
      expiresAt,
      orderIndex,
    );
  }

  @Patch('photos/:photoId')
  async updatePhoto(
    @Param('photoId') photoId: string,
    @Body() body: { durationSeconds?: number; rotation?: number; expiresAt?: string | null; orderIndex?: number },
  ) {
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : body.expiresAt === null ? null : undefined;
    return this.screens.updatePhoto(photoId, {
      durationSeconds: body.durationSeconds,
      rotation: body.rotation,
      expiresAt,
      orderIndex: body.orderIndex,
    });
  }

  @Delete('photos/:photoId')
  async deletePhoto(@Param('photoId') photoId: string) {
    await this.screens.deletePhoto(photoId);
    return { success: true };
  }

  @Get(':id/video')
  async streamVideo(@Param('id') id: string, @Res() res: Response) {
    const filePath = await this.screens.getVideoPath(id);
    if (!filePath) return res.status(404).send('Video not found');
    const stream = createReadStream(filePath);
    res.setHeader('Content-Type', 'video/mp4');
    stream.pipe(res);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.screens.delete(id);
    return { success: true };
  }
}
