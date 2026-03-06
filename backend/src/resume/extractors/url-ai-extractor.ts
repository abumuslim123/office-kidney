import { ollama, OLLAMA_MODEL } from '../ai/client';

/**
 * Просит AI извлечь текст резюме из сырого текста веб-страницы.
 * AI определяет, где на странице резюме, и извлекает только релевантную информацию,
 * отбрасывая навигацию, рекламу, баннеры и прочий мусор.
 */
export async function extractResumeFromPageText(
  rawPageText: string,
): Promise<string> {
  // Обрезаем до разумного размера (context window)
  const truncated = rawPageText.slice(0, 20_000);

  const response = await ollama.chat({
    model: OLLAMA_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Ты — эксперт по извлечению данных. Тебе дан текст веб-страницы, на которой размещено резюме.\n' +
          'Извлеки ТОЛЬКО информацию, относящуюся к резюме кандидата: ФИО, контакты, опыт работы, образование, навыки, сертификаты.\n' +
          'Игнорируй навигацию, рекламу, шапку сайта, куки-баннеры и другой мусор.\n' +
          'Верни извлечённый текст резюме в чистом виде (plain text), без JSON, без разметки markdown.\n' +
          'Если на странице нет резюме — верни пустую строку.',
      },
      {
        role: 'user',
        content: truncated,
      },
    ],
    options: {
      temperature: 0,
      num_ctx: 8192,
    },
  });

  return response.message.content.trim();
}
