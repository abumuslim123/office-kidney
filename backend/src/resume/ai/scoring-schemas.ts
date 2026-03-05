import { z } from 'zod';

export const AiScoringOutputSchema = z.object({
  qualitativeScore: z.number().min(0).max(100).describe('Качественная оценка кандидата от 0 до 100 — то, что не ловят числа'),
  summary: z.string().min(10).describe('Краткое резюме о кандидате, 2-4 предложения'),
  strengths: z.array(z.string()).min(1).max(5).describe('Сильные стороны кандидата, 2-5 пунктов'),
  weaknesses: z.array(z.string()).max(5).catch([]).describe('Слабые стороны и пробелы, 0-4 пункта'),
  highlights: z.array(z.object({
    type: z.enum([
      'publication',
      'rare_specialty',
      'top_education',
      'unique_experience',
      'certification',
      'language',
      'other',
    ]).describe('Тип интересного момента'),
    text: z.string().describe('Описание'),
    importance: z.enum(['high', 'medium', 'low']).describe('Важность'),
  })).catch([]).describe('Интересные и примечательные моменты'),
  comparison: z.string().catch('').describe('Сравнение с похожими кандидатами, 1-3 предложения'),
});

export type AiScoringOutput = z.infer<typeof AiScoringOutputSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scoringJsonSchema = z.toJSONSchema(AiScoringOutputSchema as any);
