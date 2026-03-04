import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnauthorizedException,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ResumeService } from './resume.service';
import { PublicApplySubmitDto } from './dto/public-apply-submit.dto';
import { TelegramIngestDto } from './dto/telegram-ingest.dto';
import {
  UploadRateLimitGuard,
  SubmitRateLimitGuard,
} from './guards/resume-rate-limit.guard';

@Controller('public/resume/apply')
export class ResumePublicController {
  constructor(private readonly resumeService: ResumeService) {}

  /**
   * Публичный список специализаций для формы подачи резюме.
   */
  @Get('specializations')
  async getSpecializations() {
    const specs = await this.resumeService.getAllSpecializations();
    return specs.map((s) => s.name);
  }

  /**
   * Public file upload endpoint for the self-service application form.
   * Rate-limited: 5 uploads per IP per hour.
   */
  @Post('upload')
  @UseGuards(UploadRateLimitGuard)
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

    const ALLOWED_MIME_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/bmp',
      'image/tiff',
    ];

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Неподдерживаемый формат файла');
    }

    return this.resumeService.uploadFile(file);
  }

  /**
   * Public application form submission endpoint.
   * Rate-limited: 3 submissions per IP per hour.
   * Checks honeypot field to block bots.
   */
  @Post('submit')
  @UseGuards(SubmitRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async submitApplication(@Body() dto: PublicApplySubmitDto) {
    // Honeypot check — bots fill the hidden "website" field
    if (dto.website) {
      return { candidateId: 'ok' };
    }
    return this.resumeService.submitApplication(dto);
  }

  /**
   * Internal webhook for the Telegram bot worker to ingest processed files.
   * Protected by a shared secret header (x-telegram-secret).
   */
  @Post('telegram/ingest')
  @HttpCode(HttpStatus.OK)
  async telegramIngest(
    @Headers('x-telegram-secret') secret: string,
    @Body() dto: TelegramIngestDto,
  ) {
    const expectedSecret = process.env.TELEGRAM_INGEST_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid telegram secret');
    }
    return this.resumeService.telegramIngest(dto);
  }
}
