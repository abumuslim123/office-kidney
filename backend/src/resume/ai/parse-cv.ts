import { ollama, OLLAMA_MODEL } from './client';
import { CvParsedOutputSchema, cvJsonSchema, QualityEvaluationSchema, qualityJsonSchema, type CvParsedOutput, type QualityEvaluation } from './schemas';
import { CV_QUALITY_EVALUATION_PROMPT } from './prompts';

async function parseViaOllama(rawText: string, systemPrompt: string): Promise<string> {
  const response = await ollama.chat({
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
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

export async function parseCvText(rawText: string, systemPrompt: string): Promise<CvParsedOutput> {
  const content = await parseViaOllama(rawText, systemPrompt);
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

export async function evaluateParsingQuality(rawText: string, parsed: CvParsedOutput): Promise<QualityEvaluation> {
  const parsedJson = JSON.stringify(parsed, null, 2);
  // ~4 символа на токен; 8192 токена ≈ 32768 символов; оставляем запас на промпт
  if (rawText.length + parsedJson.length > 28000) {
    return { score: 0.5, issues: ['Резюме слишком большое для независимой оценки'] };
  }

  const response = await ollama.chat({
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: CV_QUALITY_EVALUATION_PROMPT },
      {
        role: 'user',
        content: `ИСХОДНЫЙ ТЕКСТ РЕЗЮМЕ:\n\n${rawText}\n\n---\n\nРЕЗУЛЬТАТ ПАРСИНГА (JSON):\n\n${parsedJson}`,
      },
    ],
    format: qualityJsonSchema as Record<string, unknown>,
    options: {
      temperature: 0,
      num_ctx: 8192,
    },
  });

  const jsonStr = extractJson(response.message.content);
  const result = JSON.parse(jsonStr);
  return QualityEvaluationSchema.parse(result);
}
