import { ollama, OLLAMA_MODEL } from './client';
import { CvParsedOutputSchema, cvJsonSchema, type CvParsedOutput } from './schemas';
import { CV_PARSING_SYSTEM_PROMPT } from './prompts';

async function parseViaOllama(rawText: string): Promise<string> {
  const response = await ollama.chat({
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: CV_PARSING_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Извлеки структурированные данные из следующего резюме:\n\n---\n${rawText}\n---`,
      },
    ],
    format: cvJsonSchema as Record<string, unknown>,
    options: {
      temperature: 0,
      num_ctx: 8192,
    },
  });
  return response.message.content;
}

function extractJson(content: string): string {
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return content.trim();
}

export async function parseCvText(rawText: string): Promise<CvParsedOutput> {
  const content = await parseViaOllama(rawText);
  if (!content || content.trim() === '' || content.trim() === '{}') {
    throw new Error('AI вернул пустой ответ. Проверьте настройки Ollama.');
  }
  const jsonStr = extractJson(content);
  const parsed = JSON.parse(jsonStr);
  const data =
    (typeof parsed.candidate === 'object' && parsed.candidate) ||
    (typeof parsed.result === 'object' && parsed.result) ||
    (typeof parsed.data === 'object' && parsed.data) ||
    parsed;
  const validated = CvParsedOutputSchema.parse(data);
  return validated;
}
