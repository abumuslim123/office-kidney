import { ollama, OLLAMA_MODEL } from './client';
import { AiScoringOutputSchema, scoringJsonSchema, type AiScoringOutput } from './scoring-schemas';

/**
 * Вызывает Ollama для AI-оценки кандидата.
 * Получает промпт с контекстом (данные кандидата + похожие кандидаты) и возвращает структурированную оценку.
 */
export async function generateAiScoring(systemPrompt: string): Promise<AiScoringOutput> {
  const response = await ollama.chat({
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: 'Проанализируй кандидата и выстави оценку в JSON-формате.',
      },
    ],
    format: scoringJsonSchema as Record<string, unknown>,
    options: {
      temperature: 0.3,
      num_ctx: 16384,
    },
  });

  const content = response.message.content.trim();
  if (!content || content === '{}') {
    throw new Error('AI вернул пустой ответ при скоринге');
  }

  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : content;

  const parsed = JSON.parse(jsonStr);
  return AiScoringOutputSchema.parse(parsed);
}
