import { Controller, Get, Post, Body, Param, Res, NotFoundException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { ScreensService } from './screens.service';

@Controller('public/screens')
export class ScreensPublicController {
  constructor(private screens: ScreensService) {}

  @Post('register')
  async register(@Body() body: { deviceId: string; name?: string }) {
    if (!body?.deviceId || typeof body.deviceId !== 'string') {
      throw new BadRequestException('deviceId required');
    }
    const screen = await this.screens.register(body.deviceId.trim(), body.name);
    return { id: screen.id, deviceId: screen.deviceId, name: screen.name };
  }

  @Get('feed/:deviceId')
  async feed(@Param('deviceId') deviceId: string) {
    return this.screens.getFeed(deviceId);
  }

  @Get('video/:screenId')
  async video(@Param('screenId') screenId: string, @Res() res: Response) {
    const filePath = await this.screens.getVideoPath(screenId);
    if (!filePath) throw new NotFoundException('Video not found');
    const stream = createReadStream(filePath);
    res.setHeader('Content-Type', 'video/mp4');
    stream.pipe(res);
  }
}
