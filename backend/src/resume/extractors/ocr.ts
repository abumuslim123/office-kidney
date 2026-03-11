import { readFile } from 'fs/promises';
import { ollama } from '../ai/client';

const VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL || 'llama3.2-vision';

/**
 * Извлекает текст из изображения с помощью Ollama Vision.
 * Отправляет изображение в base64 и просит модель извлечь весь текст.
 */
export async function extractTextFromImage(
  filePath: string,
): Promise<string> {
  const imageBuffer = await readFile(filePath);
  const base64 = imageBuffer.toString('base64');

  const response = await ollama.chat({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content:
          'Извлеки весь текст с этого изображения. Это фото или скриншот резюме. ' +
          'Верни только извлечённый текст как есть, без комментариев, без форматирования markdown. ' +
          'Если текст на русском — верни на русском. Сохрани структуру (абзацы, списки).',
        images: [base64],
      },
    ],
    options: {
      temperature: 0,
      num_ctx: 4096,
    },
  });

  return response.message.content.trim();
}
