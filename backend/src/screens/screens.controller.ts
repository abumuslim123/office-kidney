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

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.screens.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string | null }) {
    return this.screens.updateName(id, body.name ?? null);
  }

  @Post(':id/video')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async uploadVideo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('Файл не загружен');
    return this.screens.saveVideo(id, file.buffer, file.originalname || 'video.mp4');
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
