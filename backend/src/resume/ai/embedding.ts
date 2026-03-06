import { DataSource } from 'typeorm';
import { ollama, OLLAMA_EMBED_MODEL, OLLAMA_FAST_MODEL } from './client';
import { ResumeCandidate } from '../entities/resume-candidate.entity';

/**
 * Собирает текстовый профиль кандидата для генерации эмбеддинга.
 * Компактный формат — ключевые факты без лишней воды.
 */
/** Синонимы специализаций для обогащения эмбеддингов */
const SPECIALIZATION_SYNONYMS: Record<string, string> = {
  'педиатр': 'детский врач врач для детей',
  'терапевт': 'врач общей практики семейный врач',
  'отоларинголог': 'ЛОР лор ушной врач горло нос уши оториноларинголог',
  'офтальмолог': 'окулист глазной врач зрение',
  'уролог': 'почки мочевыделительная система',
  'нефролог': 'почки лечит почки',
  'кардиолог': 'сердце сердечный врач лечит сердце',
  'невролог': 'невропатолог нервы врач по нервам',
  'дерматолог': 'дерматовенеролог кожный врач кожа',
  'гинеколог': 'акушер-гинеколог женский врач',
  'хирург': 'операции оперирует',
  'ортопед': 'травматолог кости суставы',
  'эндокринолог': 'гормоны щитовидка диабет',
  'гастроэнтеролог': 'желудок кишечник пищеварение',
  'пульмонолог': 'лёгкие дыхание',
  'стоматолог': 'зубной врач зубы',
  'онколог': 'опухоли рак',
  'аллерголог': 'иммунолог аллергия',
  'ревматолог': 'суставы ревматизм',
  'гематолог': 'кровь',
  'инфекционист': 'инфекции',
  'психиатр': 'психотерапевт психическое здоровье',
  'нарколог': 'зависимости',
  'фтизиатр': 'туберкулёз',
  'проктолог': 'колопроктолог',
  'флеболог': 'вены сосуды варикоз',
  'анестезиолог': 'реаниматолог анестезия наркоз',
};

function getSpecSynonyms(spec: string | null): string {
  if (!spec) return '';
  const key = spec.toLowerCase();
  for (const [term, syns] of Object.entries(SPECIALIZATION_SYNONYMS)) {
    if (key.includes(term) || term.includes(key)) return syns;
  }
  return '';
}

export function buildCandidateProfileText(c: ResumeCandidate): string {
  const parts: string[] = [];

  const synonyms = getSpecSynonyms(c.specialization);
  parts.push(`Специализация: ${c.specialization || 'не указана'}${synonyms ? ` (${synonyms})` : ''}`);

  if (c.additionalSpecializations?.length) {
    parts.push(`Доп. специализации: ${c.additionalSpecializations.join(', ')}`);
  }

  if (c.totalExperienceYears != null) {
    parts.push(`Общий стаж: ${c.totalExperienceYears} лет`);
  }
  if (c.specialtyExperienceYears != null) {
    parts.push(`Стаж по специальности: ${c.specialtyExperienceYears} лет`);
  }

  parts.push(`Квалификационная категория: ${c.qualificationCategory}`);

  if (c.university) {
    parts.push(`ВУЗ: ${c.university}`);
  }
  if (c.faculty) {
    parts.push(`Факультет: ${c.faculty}`);
  }
  if (c.residencyPlace) {
    parts.push(`Ординатура: ${c.residencyPlace}${c.residencySpecialty ? ` (${c.residencySpecialty})` : ''}`);
  }
  if (c.internshipPlace) {
    parts.push(`Интернатура: ${c.internshipPlace}`);
  }

  parts.push(`Аккредитация: ${c.accreditationStatus ? 'есть' : 'нет'}`);

  if (c.nmoPoints) {
    parts.push(`НМО: ${c.nmoPoints} баллов`);
  }
  if (c.publications) {
    parts.push(`Публикации: ${c.publications}`);
  }
  if (c.languages?.length) {
    parts.push(`Языки: ${c.languages.join(', ')}`);
  }
  if (c.additionalSkills) {
    parts.push(`Навыки: ${c.additionalSkills}`);
  }
  if (c.city) {
    parts.push(`Город: ${c.city}`);
  }

  if (c.workHistory?.length) {
    const jobs = c.workHistory
      .slice(0, 5)
      .map((wh) => `${wh.position} — ${wh.organization}${wh.city ? ` (${wh.city})` : ''}`)
      .join('; ');
    parts.push(`Опыт: ${jobs}`);
  }

  if (c.cmeCourses?.length) {
    const courseNames = c.cmeCourses
      .filter((cc) => cc.courseName)
      .slice(0, 10)
      .map((cc) => cc.courseName)
      .join(', ');
    parts.push(`Курсы повышения квалификации (${c.cmeCourses.length}): ${courseNames || 'без названий'}`);
  }

  return parts.join('. ');
}

/**
 * Формирует компактное описание кандидата для контекста AI-оценки.
 * ~100-120 токенов на кандидата.
 */
export function buildCompactProfile(c: ResumeCandidate): string {
  const lines: string[] = [];

  lines.push(
    `${c.fullName} | ${c.specialization || '—'} | Стаж: ${c.totalExperienceYears ?? '?'} лет` +
    `${c.specialtyExperienceYears != null ? ` (${c.specialtyExperienceYears} по спец.)` : ''} | Категория: ${c.qualificationCategory}`,
  );

  const edu: string[] = [];
  if (c.university) edu.push(`ВУЗ: ${c.university}`);
  if (c.residencyPlace) edu.push(`Ординатура: ${c.residencyPlace}`);
  if (edu.length) lines.push(edu.join(' | '));

  const extra: string[] = [];
  if (c.accreditationStatus) {
    const exp = c.accreditationExpiryDate
      ? ` до ${new Date(c.accreditationExpiryDate).getFullYear()}`
      : '';
    extra.push(`Аккредитация: есть${exp}`);
  }
  if (c.nmoPoints) extra.push(`НМО: ${c.nmoPoints}`);
  if (c.publications) extra.push(`Публикации: есть`);
  if (extra.length) lines.push(extra.join(' | '));

  return lines.join('\n');
}

/**
 * Генерирует эмбеддинг для текста через Ollama.
 * Возвращает вектор размерности 1024 (snowflake-arctic-embed2).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ollama.embed({
    model: OLLAMA_EMBED_MODEL,
    input: text,
  });
  return response.embeddings[0];
}

/**
 * Batch-генерация эмбеддингов через один вызов Ollama.
 * Ollama embed API поддерживает input: string[] — возвращает массив эмбеддингов.
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await ollama.embed({
    model: OLLAMA_EMBED_MODEL,
    input: texts,
  });
  return response.embeddings;
}

/**
 * Обогащает поисковый запрос через быструю LLM.
 * Добавляет синонимы, связанные термины — для лучшего эмбеддинга запроса.
 * При ошибке возвращает исходный запрос.
 */
export async function expandSearchQuery(query: string): Promise<string> {
  try {
    const response = await ollama.chat({
      model: OLLAMA_FAST_MODEL,
      messages: [
        {
          role: 'system',
          content: `Ты помощник HR-рекрутера в медицинской клинике. Тебе дают поисковый запрос для поиска врачей-кандидатов.
Твоя задача — расширить запрос синонимами и связанными терминами на русском языке.

Правила:
- Добавь медицинские синонимы специализаций (педиатр = детский врач, отоларинголог = ЛОР)
- Добавь связанные навыки и области (уролог → почки, мочевыделительная система)
- Если упоминается язык — добавь варианты (кумык → кумыкский язык, владение кумыкским)
- Если упоминается город/регион — добавь связанные (Махачкала → Дагестан)
- НЕ добавляй ничего лишнего, только релевантные синонимы
- Ответ — одна строка, без пояснений, без нумерации`,
        },
        {
          role: 'user',
          content: query,
        },
      ],
      options: { temperature: 0, num_predict: 150 },
    });
    const expanded = response.message?.content?.trim();
    if (expanded && expanded.length > query.length) {
      return `${query}. ${expanded}`;
    }
    return query;
  } catch {
    return query;
  }
}

/**
 * Сохраняет эмбеддинг в БД через raw SQL (TypeORM не поддерживает тип vector).
 */
export async function saveEmbedding(
  dataSource: DataSource,
  candidateId: string,
  embedding: number[],
): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`;
  await dataSource.query(
    `UPDATE resume_candidates SET embedding = $1::vector WHERE id = $2`,
    [vectorStr, candidateId],
  );
}
