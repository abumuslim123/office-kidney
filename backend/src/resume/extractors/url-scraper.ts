import axios from 'axios';
import * as cheerio from 'cheerio';
import { isIP } from 'net';
import { resolve4 } from 'dns';
import { promisify } from 'util';

const resolve4Async = promisify(resolve4);

const BLOCKED_HOSTS = /^(localhost|.*\.local|.*\.internal)$/i;
const BLOCKED_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./, /^169\.254\./, /^0\.0\.0\.0/, /^::1$/, /^fc/, /^fd/,
];

function isBlockedIp(ip: string): boolean {
  return BLOCKED_IP_PATTERNS.some((r) => r.test(ip));
}

async function assertSafeUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;

  if (BLOCKED_HOSTS.test(hostname)) {
    throw new Error('Недопустимый хост');
  }

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error('Недопустимый IP-адрес');
    }
    return;
  }

  try {
    const addrs = await resolve4Async(hostname);
    for (const addr of addrs) {
      if (isBlockedIp(addr)) {
        throw new Error('Домен разрешается во внутренний IP');
      }
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.startsWith('Домен')) throw e;
    if (e instanceof Error && e.message.startsWith('Недопустимый')) throw e;
  }
}

const HTTP_CONFIG = {
  timeout: 15_000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.5',
  },
  maxRedirects: 5,
  maxContentLength: 5 * 1024 * 1024, // 5 MB
  responseType: 'arraybuffer' as const,
};

export interface ScrapeResult {
  /** Тип полученного контента */
  contentType: 'html' | 'image' | 'pdf';
  /** Извлечённый текст (для html) или null (для бинарных типов) */
  text: string | null;
  /** Бинарные данные (для image/pdf) или null */
  data: Buffer | null;
  /** MIME тип из Content-Type заголовка */
  mimeType: string;
  /** Тип сайта */
  siteType: string;
  /** Заголовок страницы */
  title: string;
}

/**
 * Определяет тип сайта по URL.
 */
function detectSiteType(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes('hh.ru') || hostname.includes('headhunter'))
    return 'hh';
  if (hostname.includes('superjob.ru')) return 'superjob';
  if (hostname.includes('linkedin.com')) return 'linkedin';
  if (hostname.includes('rezume.info')) return 'rezume_info';
  return 'generic';
}

/**
 * Специализированный парсер для hh.ru.
 */
function parseHhRu($: cheerio.CheerioAPI): string {
  const parts: string[] = [];

  const name =
    $('[data-qa="resume-personal-name"]').text().trim() ||
    $('h2[data-qa="bloko-header-1"]').text().trim();
  if (name) parts.push(name);

  const title = $('[data-qa="resume-block-title-position"]').text().trim();
  if (title) parts.push(`Должность: ${title}`);

  const sections = [
    'resume-block-experience',
    'resume-block-education',
    'resume-block-skills',
    'resume-block-additional',
    'resume-block-languages',
  ];

  for (const section of sections) {
    const block = $(`[data-qa="${section}"]`);
    if (block.length) {
      parts.push(block.text().replace(/\s+/g, ' ').trim());
    }
  }

  if (parts.length <= 1) {
    return extractGenericText($);
  }

  return parts.join('\n\n');
}

/**
 * Универсальный парсер: извлекает текст из основного контента страницы.
 */
function extractGenericText($: cheerio.CheerioAPI): string {
  $(
    'script, style, nav, footer, header, aside, .sidebar, .menu, .navigation, .cookie-banner, .ad, .advertisement, noscript',
  ).remove();

  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.resume',
    '#resume',
    '.cv',
    '.preview_inner',
    '.resume-content',
  ];
  for (const sel of mainSelectors) {
    const main = $(sel);
    if (main.length && main.text().trim().length > 100) {
      return main.text().replace(/\s+/g, ' ').trim();
    }
  }

  return $('body').text().replace(/\s+/g, ' ').trim();
}

/**
 * Скачивает контент по URL и определяет его тип.
 * Возвращает текст для HTML или бинарные данные для изображений/PDF.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  await assertSafeUrl(url);
  const response = await axios.get(url, HTTP_CONFIG);
  const contentType = (
    response.headers['content-type'] || 'text/html'
  ).toLowerCase();
  const buffer = Buffer.from(response.data);

  // Определяем тип контента
  if (contentType.startsWith('image/')) {
    return {
      contentType: 'image',
      text: null,
      data: buffer,
      mimeType: contentType.split(';')[0].trim(),
      siteType: detectSiteType(url),
      title: '',
    };
  }

  if (contentType.includes('application/pdf')) {
    return {
      contentType: 'pdf',
      text: null,
      data: buffer,
      mimeType: 'application/pdf',
      siteType: detectSiteType(url),
      title: '',
    };
  }

  // HTML — парсим текст
  const html = buffer.toString('utf-8');
  const $ = cheerio.load(html);
  const siteType = detectSiteType(url);
  const title = $('title').text().trim();

  let text: string;
  switch (siteType) {
    case 'hh':
      text = parseHhRu($);
      break;
    default:
      text = extractGenericText($);
  }

  return {
    contentType: 'html',
    text,
    data: null,
    mimeType: contentType.split(';')[0].trim(),
    siteType,
    title,
  };
}
