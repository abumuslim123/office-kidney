import { NestFactory } from '@nestjs/core';
import { Bot } from 'grammy';
import { AppModule } from '../app.module';
import { ResumeService } from './resume.service';
import type { CvParsedOutput } from './ai/schemas';

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_PASSWORD = process.env.TELEGRAM_BOT_PASSWORD;

if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN не задан в .env');
if (!BOT_PASSWORD) throw new Error('TELEGRAM_BOT_PASSWORD не задан в .env');

// ---------------------------------------------------------------------------
// Brute-force protection
// ---------------------------------------------------------------------------

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_COOLDOWN = 15 * 60 * 1000; // 15 minutes

interface LoginRecord {
  count: number;
  lastAttempt: number;
}

const loginAttempts = new Map<number, LoginRecord>();

// ---------------------------------------------------------------------------
// Accepted MIME types
// ---------------------------------------------------------------------------

const ACCEPTED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
]);

const EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
};

function getMimeFromFilename(filename: string): string | null {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return EXT_TO_MIME[ext] || null;
}

// ---------------------------------------------------------------------------
// Summary formatter
// ---------------------------------------------------------------------------

function formatSummary(data: CvParsedOutput): string {
  const lines: string[] = ['Резюме обработано!\n'];

  if (data.fullName) lines.push(`ФИО: ${data.fullName}`);
  if (data.phone) lines.push(`Телефон: ${data.phone}`);
  if (data.email) lines.push(`Email: ${data.email}`);
  if (data.city) lines.push(`Город: ${data.city}`);

  if (data.specialization) lines.push(`\nСпециализация: ${data.specialization}`);
  if (data.additionalSpecializations?.length) {
    lines.push(`Доп. специализации: ${data.additionalSpecializations.join(', ')}`);
  }

  if (data.qualificationCategory) {
    const categories: Record<string, string> = {
      HIGHEST: 'Высшая',
      FIRST: 'Первая',
      SECOND: 'Вторая',
      NONE: 'Без категории',
    };
    lines.push(
      `Категория: ${categories[data.qualificationCategory] || data.qualificationCategory}`,
    );
  }

  if (data.totalExperienceYears) {
    lines.push(`Общий стаж: ${data.totalExperienceYears} лет`);
  }
  if (data.specialtyExperienceYears) {
    lines.push(`Стаж по специальности: ${data.specialtyExperienceYears} лет`);
  }

  if (data.university) lines.push(`\nВУЗ: ${data.university}`);
  if (data.faculty) lines.push(`Факультет: ${data.faculty}`);
  if (data.graduationYear) lines.push(`Год окончания: ${data.graduationYear}`);

  if (data.accreditationStatus) {
    lines.push(`\nАккредитация: ${data.accreditationStatus}`);
  }

  if (data.workHistory.length > 0) {
    lines.push(`\nОпыт работы (${data.workHistory.length}):`);
    for (const wh of data.workHistory.slice(0, 3)) {
      lines.push(`  • ${wh.position || '—'} — ${wh.organization || '—'}`);
    }
    if (data.workHistory.length > 3) {
      lines.push(`  ... и ещё ${data.workHistory.length - 3}`);
    }
  }

  if ((data as any).confidence !== undefined) {
    lines.push(`\nКачество сканирования: ${Math.round((data as any).confidence * 100)}%`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrap() {
  // NestJS application context gives access to all services and DB
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ResumeService);

  const bot = new Bot(BOT_TOKEN!);

  // In-memory cache of authorized chats (populated from DB on startup)
  const authorizedChats = new Set<number>();

  // Load authorized chats from DB
  try {
    const chats = await service.listTelegramChats();
    for (const chat of chats) {
      authorizedChats.add(Number(chat.chatId));
    }
    console.log(`Loaded ${authorizedChats.size} authorized Telegram chats`);
  } catch (err) {
    console.error('Failed to load authorized chats:', err);
  }

  // Authorize a chat and persist to DB
  async function authorizeChat(
    chatId: number,
    username?: string,
    firstName?: string,
  ) {
    authorizedChats.add(chatId);
    await service.upsertTelegramChat({ chatId, username, firstName });
  }

  // -------------------------------------------------------------------------
  // /start command — reset auth state, ask for password
  // -------------------------------------------------------------------------

  bot.command('start', async (ctx) => {
    authorizedChats.delete(ctx.chat.id);
    loginAttempts.delete(ctx.chat.id);
    await ctx.reply(
      'Добро пожаловать в HR Bot!\n\nДля доступа введите пароль:',
    );
  });

  // -------------------------------------------------------------------------
  // Text messages — password check
  // -------------------------------------------------------------------------

  bot.on('message:text', async (ctx) => {
    // Already authorized — send a hint
    if (authorizedChats.has(ctx.chat.id)) {
      await ctx.reply(
        'Отправьте файл резюме (PDF, DOCX, TXT или фото).',
      );
      return;
    }

    // Brute-force check
    const attempts = loginAttempts.get(ctx.chat.id);
    if (
      attempts &&
      attempts.count >= MAX_LOGIN_ATTEMPTS &&
      Date.now() - attempts.lastAttempt < LOGIN_COOLDOWN
    ) {
      await ctx.reply('Слишком много попыток. Подождите 15 минут.');
      return;
    }

    // Password check
    if (ctx.message.text.trim() === BOT_PASSWORD) {
      loginAttempts.delete(ctx.chat.id);
      await authorizeChat(
        ctx.chat.id,
        ctx.from?.username,
        ctx.from?.first_name,
      );
      await ctx.reply(
        'Доступ открыт!\n\n' +
          'Отправьте файл резюме в одном из форматов:\n' +
          'PDF, DOCX, TXT или фото (JPG, PNG).',
      );
    } else {
      const current = loginAttempts.get(ctx.chat.id) || {
        count: 0,
        lastAttempt: 0,
      };
      loginAttempts.set(ctx.chat.id, {
        count: current.count + 1,
        lastAttempt: Date.now(),
      });
      await ctx.reply('Неверный пароль. Попробуйте ещё раз.');
    }
  });

  // -------------------------------------------------------------------------
  // Document messages
  // -------------------------------------------------------------------------

  bot.on('message:document', async (ctx) => {
    if (!authorizedChats.has(ctx.chat.id)) {
      await ctx.reply('Сначала введите пароль для доступа.');
      return;
    }

    const doc = ctx.message.document;
    const fileName = doc.file_name || 'unknown';
    const mimeType = doc.mime_type || getMimeFromFilename(fileName);

    if (!mimeType || !ACCEPTED_MIMES.has(mimeType)) {
      await ctx.reply(
        `Формат не поддерживается: ${mimeType || 'неизвестный'}\n` +
          'Поддерживаемые форматы: PDF, DOCX, TXT, JPG, PNG, WebP, BMP, TIFF.',
      );
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (doc.file_size && doc.file_size > MAX_FILE_SIZE) {
      await ctx.reply('Файл слишком большой. Максимальный размер — 10 МБ.');
      return;
    }

    await processFile(ctx, bot, service, doc.file_id, fileName, mimeType);
  });

  // -------------------------------------------------------------------------
  // Photo messages — use largest available size
  // -------------------------------------------------------------------------

  bot.on('message:photo', async (ctx) => {
    if (!authorizedChats.has(ctx.chat.id)) {
      await ctx.reply('Сначала введите пароль для доступа.');
      return;
    }

    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1];
    const fileName = `photo_${Date.now()}.jpg`;
    const mimeType = 'image/jpeg';

    await processFile(ctx, bot, service, largest.file_id, fileName, mimeType);
  });

  // -------------------------------------------------------------------------
  // Start polling
  // -------------------------------------------------------------------------

  console.log('Telegram bot starting...');
  await bot.start();
}

// ---------------------------------------------------------------------------
// processFile — full pipeline with synchronous status messages
// ---------------------------------------------------------------------------

async function processFile(
  ctx: { reply: (text: string) => Promise<unknown>; chat: { id: number } },
  bot: Bot,
  service: ResumeService,
  fileId: string,
  fileName: string,
  mimeType: string,
) {
  await ctx.reply(`Загрузка "${fileName}"...`);

  try {
    // 1. Download file from Telegram
    const telegramFile = await bot.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${telegramFile.file_path}`;

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('Не удалось скачать файл из Telegram');
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // 2. Save file and create DB records via service
    const { candidateId, uploadedFileId } =
      await service.saveTelegramFile(buffer, fileName, mimeType);

    void uploadedFileId; // acknowledged — stored in DB via service

    await ctx.reply('Файл получен. Извлекаю текст...');

    // 3. Extract text
    await service.setCandidateProcessingStatus(candidateId, 'EXTRACTING');
    const rawText = await service.extractTextForCandidate(candidateId);

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Не удалось извлечь текст из файла');
    }

    await ctx.reply('Текст извлечён. AI анализирует резюме...');

    // 4. AI parsing
    await service.setCandidateProcessingStatus(candidateId, 'PARSING');
    const parsed = await service.parseCandidateText(candidateId, rawText);

    // 5. Duplicate detection
    const dupResult = await service.checkDuplicates(candidateId);

    if (dupResult.status === 'exact_duplicate_deleted') {
      const locationMap: Record<string, string> = {
        candidates: 'в базе кандидатов',
        archive: 'в архиве',
        trash: 'в корзине',
      };
      const where =
        locationMap[dupResult.existingCandidateLocation || 'candidates'];
      await service.setCandidateProcessingStatus(
        candidateId,
        'COMPLETED',
        (parsed as any).confidence,
      );
      await ctx.reply(
        `Обнаружен точный дубликат (совпадение ${Math.round((dupResult.similarity ?? 0) * 100)}%). ` +
          `Резюме уже существует ${where}. Новая запись отправлена в корзину.`,
      );
      return;
    }

    if (dupResult.status === 'similar_tagged') {
      const locationMap: Record<string, string> = {
        candidates: 'в базе кандидатов',
        archive: 'в архиве',
        trash: 'в корзине',
      };
      const where =
        locationMap[dupResult.existingCandidateLocation || 'candidates'];
      await ctx.reply(
        `Внимание: обнаружен похожий кандидат ${where} ` +
          `(совпадение ${Math.round((dupResult.similarity ?? 0) * 100)}%). ` +
          `Оба кандидата помечены тегом "Возможный дубликат".`,
      );
    }

    await service.setCandidateProcessingStatus(
      candidateId,
      'COMPLETED',
      (parsed as any).confidence,
    );

    // 6. Send summary to chat
    const summary = formatSummary(parsed);
    await ctx.reply(summary);
  } catch (error) {
    console.error('Telegram bot processing error:', error);
    await ctx.reply(
      'Произошла ошибка при обработке файла. Попробуйте позже.',
    );
  }
}

bootstrap().catch(console.error);
