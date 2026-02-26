import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ConfigService } from '@nestjs/config';
import { ResumeService } from './resume.service';
import { PublicApplySubmitDto } from './dto/public-apply-submit.dto';
import { TelegramIngestDto } from './dto/telegram-ingest.dto';
import { ResumeFeatureGuard } from './guards/resume-feature.guard';

@Controller('public/resume/apply')
@UseGuards(ResumeFeatureGuard)
export class ResumePublicController {
  constructor(
    private readonly resumeService: ResumeService,
    private readonly config: ConfigService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.resumeService.savePublicUploadedFile(file);
  }

  @Post('submit')
  submit(@Body() dto: PublicApplySubmitDto) {
    return this.resumeService.createCandidateFromPublicForm(dto);
  }

  @Post('telegram/ingest')
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
