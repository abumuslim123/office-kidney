import type { DeterministicScores, PoolStats } from './deterministic-scoring';
import { formatSubScoresForPrompt } from './deterministic-scoring';

interface SpecializationStats {
  avgExperience: number;
  totalCount: number;
  avgScore: number;
  categoryDistribution: Record<string, number>;
}

/**
 * Строит системный промпт для AI качественной оценки кандидата.
 * AI работает с сырым текстом резюме и ловит то, что парсер пропустил.
 */
export function buildScoringPrompt(
  rawText: string | null,
  similarProfiles: string[],
  subScores: DeterministicScores,
  poolStats: PoolStats,
  specStats: SpecializationStats | null,
): string {
  const resumeSection = rawText
    ? `ПОЛНЫЙ ТЕКСТ РЕЗЮМЕ КАНДИДАТА:\n${rawText}`
    : 'Сырой текст резюме отсутствует. Оценивай на основе структурированных данных.';

  const subScoresSection = formatSubScoresForPrompt(subScores, poolStats);

  const similarSection = similarProfiles.length
    ? `\nПОХОЖИЕ КАНДИДАТЫ В НАШЕЙ БАЗЕ (${similarProfiles.length} шт.):\n${similarProfiles.map((p, i) => `--- Кандидат ${i + 1} ---\n${p}`).join('\n\n')}`
    : '\nПОХОЖИХ КАНДИДАТОВ В БАЗЕ ПОКА НЕТ.';

  const statsSection = specStats
    ? `\nСТАТИСТИКА ПО СПЕЦИАЛИЗАЦИИ (${specStats.totalCount} кандидатов):
- Средний стаж: ${specStats.avgExperience.toFixed(1)} лет
- Средний балл: ${specStats.avgScore > 0 ? specStats.avgScore.toFixed(0) : 'ещё не оценивались'}
- Распределение категорий: ${Object.entries(specStats.categoryDistribution).map(([k, v]) => `${k}: ${v}`).join(', ')}`
    : '';

  return `Ты — опытный эксперт-рекрутер в педиатрическом медицинском центре (Россия, Дагестан, 3 филиала: Каспийск, Махачкала, Хасавюрт).

ЗАДАЧА: Дай качественную оценку кандидату — оцени то, что НЕ ловят числа и формулы.

${resumeSection}

${subScoresSection}
${similarSection}
${statsSection}

ТВОЯ РОЛЬ:

Детерминированные баллы уже рассчитаны автоматически (опыт, образование, квалификация, развитие). Твоя задача — оценить то, что числа НЕ могут поймать:

1. **Качество карьерной траектории** — рост по должностям, переход в более престижные учреждения, или наоборот деградация
2. **Престиж мест работы** — федеральный центр vs районная поликлиника, известные клиники
3. **То, что парсер мог пропустить** — награды, грамоты, конференции, доклады, уникальные процедуры, управленческий опыт
4. **Уникальные комбинации навыков** — редкие сочетания специализаций, языков, опыта
5. **Общее впечатление** — цельность профиля, мотивация, потенциал

ОТВЕТ:

qualitativeScore (0-100): Твоя качественная оценка. 50 = средний кандидат, выше/ниже — лучше/хуже относительно похожих в базе.

summary: 2-4 предложения — уровень кандидата в контексте других.

strengths: 2-5 пунктов — чем выгодно отличается.

weaknesses: 0-4 пункта — в чём проигрывает.

highlights: Только действительно примечательное и редкое. Типы: publication, rare_specialty, top_education, unique_experience, certification, language, other. Если ничего редкого — пустой массив.

comparison: Конкретное сравнение с похожими кандидатами из базы.

Пиши на русском. Будь конкретным — факты и сравнения, не общие фразы.`;
}
