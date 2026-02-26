type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number | string };
    text?: string;
    from?: { username?: string; first_name?: string };
    document?: { file_id: string; file_name?: string; mime_type?: string };
    photo?: Array<{ file_id: string; width: number; height: number }>;
    caption?: string;
  };
};

type TelegramGetFileResponse = {
  ok: boolean;
  result?: { file_path?: string };
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';
const FILE_BASE = BOT_TOKEN ? `https://api.telegram.org/file/bot${BOT_TOKEN}` : '';
const INGEST_URL =
  process.env.TELEGRAM_INGEST_URL ||
  'http://localhost:3000/api/public/resume/apply/telegram/ingest';
const INGEST_SECRET = process.env.TELEGRAM_INGEST_SECRET || '';

async function tgApi<T>(method: string, params: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(`Telegram API ${method} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function getFileBytes(fileId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const getFile = await tgApi<TelegramGetFileResponse>('getFile', { file_id: fileId });
  const filePath = getFile?.result?.file_path;
  if (!filePath) throw new Error('Telegram file_path missing');
  const fileRes = await fetch(`${FILE_BASE}/${filePath}`);
  if (!fileRes.ok) throw new Error(`Telegram file download failed: ${fileRes.status}`);
  const arr = await fileRes.arrayBuffer();
  const fileName = filePath.split('/').pop() || `telegram-${Date.now()}.bin`;
  const mimeType = fileRes.headers.get('content-type') || 'application/octet-stream';
  return { buffer: Buffer.from(arr), mimeType, fileName };
}

async function sendToIngest(payload: Record<string, unknown>) {
  const response = await fetch(INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(INGEST_SECRET ? { 'x-telegram-secret': INGEST_SECRET } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ingest failed (${response.status}): ${text}`);
  }
}

async function processUpdate(update: TelegramUpdate) {
  if (!update.message) return;
  const msg = update.message;
  const chatId = String(msg.chat.id);
  const username = msg.from?.username || '';
  const firstName = msg.from?.first_name || '';

  if (msg.document?.file_id) {
    const file = await getFileBytes(msg.document.file_id);
    await sendToIngest({
      chatId,
      username,
      firstName,
      rawText: msg.caption || '',
      fileBase64: file.buffer.toString('base64'),
      fileName: msg.document.file_name || file.fileName,
      mimeType: msg.document.mime_type || file.mimeType,
    });
    return;
  }

  if (msg.photo?.length) {
    const best = msg.photo[msg.photo.length - 1];
    const file = await getFileBytes(best.file_id);
    await sendToIngest({
      chatId,
      username,
      firstName,
      rawText: msg.caption || '',
      fileBase64: file.buffer.toString('base64'),
      fileName: file.fileName,
      mimeType: file.mimeType,
    });
    return;
  }

  if (msg.text?.trim()) {
    await sendToIngest({
      chatId,
      username,
      firstName,
      rawText: msg.text.trim(),
    });
  }
}

async function bootstrap() {
  const isEnabled = (process.env.RESUME_MODULE_ENABLED || 'true').toLowerCase();
  if (['0', 'false', 'off'].includes(isEnabled)) {
    console.log('[resume-telegram-worker] skipped because RESUME_MODULE_ENABLED=false');
    return;
  }

  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }
  console.log('[resume-telegram-worker] started');
  let offset = 0;
  while (true) {
    try {
      const response = await tgApi<{ ok: boolean; result: TelegramUpdate[] }>('getUpdates', {
        timeout: 25,
        offset,
      });
      for (const update of response.result || []) {
        offset = update.update_id + 1;
        try {
          await processUpdate(update);
        } catch (error) {
          console.error('[resume-telegram-worker] update error:', error);
        }
      }
    } catch (error) {
      console.error('[resume-telegram-worker] polling error:', error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

bootstrap().catch((error) => {
  console.error('[resume-telegram-worker] fatal error:', error);
  process.exit(1);
});
