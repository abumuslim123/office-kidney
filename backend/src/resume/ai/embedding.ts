import { DataSource } from 'typeorm';
import { ollama, OLLAMA_EMBED_MODEL, OLLAMA_FAST_MODEL } from './client';
import { ResumeCandidate } from '../entities/resume-candidate.entity';

/**
 * Собирает текстовый профиль кандидата для генерации эмбеддинга.
 * Компактный формат — ключевые факты без лишней воды.
 */

function getExperienceLevel(years: number | null): string {
  if (years == null) return '';
  if (years < 3) return 'начинающий специалист';
  if (years < 5) return 'специалист с небольшим опытом';
  if (years < 10) return 'опытный специалист';
  if (years < 20) return 'высококвалифицированный специалист';
  return 'эксперт с многолетним стажем';
}

function formatWorkDuration(wh: { startDate?: Date | null; endDate?: Date | null; isCurrent?: boolean }): string {
  if (!wh.startDate) return '';
  const start = new Date(wh.startDate).getFullYear();
  if (wh.isCurrent) return `с ${start}, по наст. время`;
  if (!wh.endDate) return `${start}`;
  const end = new Date(wh.endDate).getFullYear();
  const duration = end - start;
  return duration > 0 ? `${duration} лет` : `${start}`;
}

export function buildCandidateProfileText(c: ResumeCandidate): string {
  const blocks: string[] = [];

  // Блок 1: Специализация (без синонимов — они только для поиска)
  const specParts: string[] = [];
  specParts.push(`Врач, ${c.specialization || 'специализация не указана'}`);
  if (c.additionalSpecializations?.length) {
    specParts.push(`доп. специализации: ${c.additionalSpecializations.join(', ')}`);
  }
  blocks.push(specParts.join(', '));

  // Блок 2: Уровень и стаж
  const expParts: string[] = [];
  const level = getExperienceLevel(c.totalExperienceYears);
  if (level) expParts.push(level);
  if (c.totalExperienceYears != null) {
    let stazh = `стаж ${c.totalExperienceYears} лет`;
    if (c.specialtyExperienceYears != null) {
      stazh += ` (${c.specialtyExperienceYears} по специальности)`;
    }
    expParts.push(stazh);
  }
  if (c.qualificationCategory && c.qualificationCategory !== 'NONE') {
    const catLabels: Record<string, string> = {
      HIGHEST: 'высшая категория',
      FIRST: 'первая категория',
      SECOND: 'вторая категория',
    };
    expParts.push(catLabels[c.qualificationCategory] || c.qualificationCategory);
  }
  if (expParts.length) blocks.push(expParts.join(', '));

  // Блок 3: Образование
  const eduParts: string[] = [];
  if (c.university) {
    eduParts.push(`ВУЗ: ${c.university}${c.faculty ? `, ${c.faculty}` : ''}`);
  }
  if (c.residencyPlace) {
    eduParts.push(`ординатура: ${c.residencyPlace}${c.residencySpecialty ? ` (${c.residencySpecialty})` : ''}`);
  }
  if (c.internshipPlace) {
    eduParts.push(`интернатура: ${c.internshipPlace}`);
  }
  if (c.education?.length) {
    const extraEdu = c.education
      .filter((e) => e.institution !== c.university)
      .slice(0, 3)
      .map((e) => {
        let s = e.institution;
        if (e.specialty) s += ` (${e.specialty})`;
        if (e.endYear) s += `, ${e.endYear}`;
        return s;
      });
    if (extraEdu.length) eduParts.push(`доп. образование: ${extraEdu.join('; ')}`);
  }
  if (eduParts.length) blocks.push(`Образование: ${eduParts.join('. ')}`);

  // Блок 4: Опыт работы (расширенный)
  if (c.workHistory?.length) {
    const jobs = c.workHistory
      .slice(0, 7)
      .map((wh) => {
        let s = `${wh.position} — ${wh.organization}`;
        if (wh.department) s += `, ${wh.department}`;
        if (wh.city) s += ` (${wh.city})`;
        const dur = formatWorkDuration(wh);
        if (dur) s += `, ${dur}`;
        return s;
      })
      .join('; ');
    blocks.push(`Опыт: ${jobs}`);
  }

  // Блок 5: Квалификация и развитие
  const qualParts: string[] = [];
  qualParts.push(`аккредитация: ${c.accreditationStatus ? 'действующая' : 'нет'}`);
  if (c.nmoPoints) qualParts.push(`НМО ${c.nmoPoints} баллов`);
  if (c.cmeCourses?.length) {
    const courseNames = c.cmeCourses
      .filter((cc) => cc.courseName)
      .slice(0, 5)
      .map((cc) => cc.courseName)
      .join(', ');
    qualParts.push(`${c.cmeCourses.length} курсов${courseNames ? `: ${courseNames}` : ''}`);
  }
  if (c.publications) qualParts.push(`публикации: ${c.publications}`);
  blocks.push(qualParts.join('. '));

  // Блок 6: Дополнительное
  const extraParts: string[] = [];
  if (c.additionalSkills) extraParts.push(`навыки: ${c.additionalSkills}`);
  if (c.languages?.length) extraParts.push(`языки: ${c.languages.join(', ')}`);
  if (c.city) extraParts.push(`город: ${c.city}`);
  if (c.desiredSalary != null) {
    const salaryTypeLabel = c.desiredSalaryType === 'PERCENT_OF_VISIT' ? '% от приёма' : 'руб.';
    extraParts.push(`желаемая зарплата: ${c.desiredSalary} ${salaryTypeLabel}`);
  }
  if (extraParts.length) blocks.push(extraParts.join('. '));

  return blocks.join('. ');
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

// ---------------------------------------------------------------------------
// Гибридный поиск: LLM анализирует запрос → SQL + Embedding
// ---------------------------------------------------------------------------

export interface SearchQueryAnalysis {
  sqlConditions: Array<{ clause: string; params: unknown[] }>;
  semanticQuery: string;
  explanation: string;
}

const SEARCH_ANALYSIS_PROMPT = `Ты — эксперт-аналитик поисковых запросов для HR-системы медицинского центра.

ЗАДАЧА: Разбей пользовательский запрос на две части:
1. SQL-часть — то, что ТОЧНО можно выразить как SQL условия (числа, даты, города, категории, отрицания, EXISTS-подзапросы)
2. Семантическая часть — всё остальное, что нужно искать по смыслу (навыки, описания, абстрактные понятия)

ПРАВИЛО КОНСЕРВАТИЗМА: Генерируй SQL ТОЛЬКО для того, в чём уверен на 100%.
Пример: "делал операции" НЕ должно стать specialization ILIKE '%хирург%', потому что урологи тоже делают операции. Это семантическая часть.

ПРАВИЛО РАСШИРЕНИЯ СЕМАНТИКИ: semanticQuery ВСЕГДА должен содержать синонимы, связанные термины и медицинские эквиваленты.
Пример: "операции" → "операции хирургия оперативное вмешательство хирургические процедуры".
Пример: "вакцинация" → "вакцинация вакцинопрофилактика иммунизация прививки".
Никогда не оставляй semanticQuery без расширения — чем больше релевантных синонимов, тем лучше поиск.

ПРАВИЛО КОЛИЧЕСТВЕННЫХ ОПИСАНИЙ: слова "большой", "значительный", "огромный" опыт → SQL: totalExperienceYears >= 10.
"небольшой/маленький опыт" → totalExperienceYears <= 3. "Средний опыт" → totalExperienceYears BETWEEN 3 AND 10.

ПРАВИЛО ТИПОВ ОРГАНИЗАЦИЙ: "государственная клиника", "частная клиника", "госбольница", "частный кабинет" — это АБСТРАКТНЫЕ понятия. Названия организаций в базе НЕ содержат слов "государственная" или "частная". Используй SQL с несколькими ILIKE паттернами по ключевым словам + ОБЯЗАТЕЛЬНО добавь семантический запрос.

СХЕМА БД:

resume_candidates (алиас: c):
  id (UUID), "fullName" (VARCHAR), email, phone, city (VARCHAR — город проживания),
  gender ('MALE','FEMALE','UNKNOWN'), "doctorTypes" (TEXT[]: 'PEDIATRIC','THERAPIST','FAMILY'),
  specialization (VARCHAR), "additionalSpecializations" (TEXT[]),
  university, faculty, "graduationYear" (INT),
  "internshipPlace", "internshipSpecialty", "internshipYearEnd",
  "residencyPlace", "residencySpecialty", "residencyYearEnd",
  "qualificationCategory" ('HIGHEST','FIRST','SECOND','NONE'),
  "accreditationStatus" (BOOLEAN), "accreditationExpiryDate" (TIMESTAMP),
  "totalExperienceYears" (FLOAT), "specialtyExperienceYears" (FLOAT),
  "nmoPoints" (INT), publications (TEXT), languages (TEXT[]),
  "additionalSkills" (TEXT), branches (TEXT[]),
  status ('NEW','REVIEWING','INVITED','HIRED','RESERVE','REJECTED'),
  priority ('ACTIVE','RESERVE','NOT_SUITABLE','ARCHIVE','DELETED'),
  "desiredSalary" (INT), "desiredSalaryType" ('FIXED_RUB','PERCENT_OF_VISIT'),
  "aiScore" (FLOAT)

resume_work_history (алиас: wh):
  "candidateId" (UUID FK → c.id), organization (VARCHAR), position (VARCHAR),
  department (VARCHAR), city (VARCHAR), "startDate" (TIMESTAMP), "endDate" (TIMESTAMP),
  "isCurrent" (BOOLEAN), description (TEXT)

resume_education (алиас: edu):
  "candidateId" (UUID FK → c.id), institution (VARCHAR), faculty, specialty,
  degree, city, "startYear" (INT), "endYear" (INT), type (VARCHAR)

resume_cme_courses (алиас: cme):
  "candidateId" (UUID FK → c.id), "courseName" (VARCHAR), provider,
  "completedAt" (TIMESTAMP), hours (INT), "nmoPoints" (INT)

ПРАВИЛА SQL:
- Используй ТОЛЬКО параметризованные условия с плейсхолдерами $1, $2, $3... (нумерация с $1 для каждого условия отдельно)
- Для массивов: $1 = ANY(c."doctorTypes") — ОБЯЗАТЕЛЬНО используй $1, НЕ $N
- Для текстового поиска: ILIKE $N (передавай значение с %%)
- Для связанных таблиц: EXISTS (SELECT 1 FROM resume_work_history wh WHERE wh."candidateId" = c.id AND ...)
- Для отрицаний: NOT ILIKE или NOT EXISTS
- Названия колонок с camelCase ОБЯЗАТЕЛЬНО в двойных кавычках: c."totalExperienceYears"
- НЕЛЬЗЯ: DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, TRUNCATE, GRANT, ;

ПОЛЕ explanation: Краткое понятное описание того, ЧТО ищем, для показа пользователю. Пиши как для обычного человека, не для программиста.

ПРИМЕРЫ:

Запрос: "педиатр с опытом больше 10 лет не из Дагестана"
{"sqlConditions":[{"clause":"c.specialization ILIKE $1","params":["%педиатр%"]},{"clause":"c.\\"totalExperienceYears\\" >= $1","params":[10]},{"clause":"c.city NOT ILIKE $1 AND c.city NOT ILIKE $2 AND c.city NOT ILIKE $3","params":["%Махачкала%","%Каспийск%","%Дагестан%"]}],"semanticQuery":"","explanation":"Педиатры со стажем от 10 лет, не из Дагестана"}

Запрос: "врач который делал операции на сердце"
{"sqlConditions":[],"semanticQuery":"врач операции на сердце кардиохирургия сердечно-сосудистая хирургия","explanation":"Врачи с опытом операций на сердце (кардиохирургия)"}

Запрос: "хочет зарплату больше 100000"
{"sqlConditions":[{"clause":"c.\\"desiredSalary\\" >= $1","params":[100000]}],"semanticQuery":"","explanation":"Кандидаты с желаемой зарплатой от 100 000 руб."}

Запрос: "работал в Москве"
{"sqlConditions":[{"clause":"EXISTS (SELECT 1 FROM resume_work_history wh WHERE wh.\\"candidateId\\" = c.id AND wh.city ILIKE $1)","params":["%Москва%"]}],"semanticQuery":"","explanation":"Кандидаты с опытом работы в Москве"}

Запрос: "педиатр из Москвы"
{"sqlConditions":[{"clause":"c.specialization ILIKE $1","params":["%педиатр%"]},{"clause":"c.city ILIKE $1","params":["%Москва%"]}],"semanticQuery":"","explanation":"Педиатры из Москвы"}

Запрос: "педиатр с опытом > 10 делал операции зарплата до 150000"
{"sqlConditions":[{"clause":"c.specialization ILIKE $1","params":["%педиатр%"]},{"clause":"c.\\"totalExperienceYears\\" >= $1","params":[10]},{"clause":"c.\\"desiredSalary\\" <= $1","params":[150000]}],"semanticQuery":"операции хирургия оперативное лечение","explanation":"Педиатры со стажем от 10 лет, зарплата до 150 000 руб., с опытом операций"}

Запрос: "кумыкский язык"
{"sqlConditions":[{"clause":"EXISTS (SELECT 1 FROM unnest(c.languages) lang WHERE lang ILIKE $1)","params":["%кумык%"]}],"semanticQuery":"кумыкский язык кумык","explanation":"Кандидаты, владеющие кумыкским языком"}

Запрос: "большой опыт в операциях"
{"sqlConditions":[{"clause":"c.\\"totalExperienceYears\\" >= $1","params":[10]}],"semanticQuery":"операции хирургия оперативное вмешательство хирургические процедуры оперативное лечение","explanation":"Врачи со стажем от 10 лет и опытом хирургических операций"}

Запрос: "есть опыт в вакцинации"
{"sqlConditions":[],"semanticQuery":"вакцинация вакцинопрофилактика иммунизация прививки профилактические прививки","explanation":"Врачи с опытом вакцинации и иммунопрофилактики"}

Запрос: "работал в государственных клиниках"
{"sqlConditions":[{"clause":"EXISTS (SELECT 1 FROM resume_work_history wh WHERE wh.\\"candidateId\\" = c.id AND (wh.organization ILIKE $1 OR wh.organization ILIKE $2 OR wh.organization ILIKE $3 OR wh.organization ILIKE $4))","params":["%поликлиника%","%больница%","%ГБУ%","%ГБУЗ%"]}],"semanticQuery":"государственная клиника поликлиника больница государственное медицинское учреждение","explanation":"Кандидаты, работавшие в государственных медицинских учреждениях"}

Ответ — ТОЛЬКО валидный JSON. Без markdown, без \`\`\`, без пояснений вне JSON.`;

/**
 * Валидирует SQL clause, сгенерированный LLM.
 * Отвергает опасные конструкции, разрешает только чтение из известных таблиц.
 */
export function validateSqlClause(clause: string, params: unknown[]): boolean {
  if (!clause || clause.length > 500) return false;
  if (/;/.test(clause)) return false;
  if (/--/.test(clause)) return false;
  if (/\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)\b/i.test(clause)) return false;

  // Проверяем что FROM ссылается только на разрешённые таблицы
  const fromMatches = clause.match(/FROM\s+(\w+)/gi);
  if (fromMatches) {
    const allowed = new Set(['resume_work_history', 'resume_education', 'resume_cme_courses', 'unnest']);
    for (const m of fromMatches) {
      const table = m.replace(/FROM\s+/i, '').toLowerCase();
      if (!allowed.has(table)) return false;
    }
  }

  // Проверяем наличие плейсхолдеров $N
  const placeholders = clause.match(/\$\d+/g) || [];
  const maxIdx = Math.max(0, ...placeholders.map(p => parseInt(p.slice(1))));
  if (maxIdx > params.length) return false;

  return true;
}

/**
 * Анализирует поисковый запрос через LLM (phi4).
 * Разделяет на SQL-условия (точные фильтры) и семантический запрос (для embedding).
 * При ошибке — fallback на чистый embedding.
 */
export async function analyzeSearchQuery(query: string): Promise<SearchQueryAnalysis> {
  const fallback: SearchQueryAnalysis = { sqlConditions: [], semanticQuery: query, explanation: 'fallback' };
  try {
    const response = await ollama.chat({
      model: OLLAMA_FAST_MODEL,
      messages: [
        { role: 'system', content: SEARCH_ANALYSIS_PROMPT },
        { role: 'user', content: query },
      ],
      options: { temperature: 0, num_predict: 500 },
    });

    const text = response.message?.content?.trim();
    if (!text) return fallback;

    // Извлекаем JSON (LLM может обернуть в ```json...```)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);

    const result: SearchQueryAnalysis = {
      sqlConditions: [],
      semanticQuery: typeof parsed.semanticQuery === 'string' ? parsed.semanticQuery : '',
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
    };

    // Валидируем каждое SQL-условие
    if (Array.isArray(parsed.sqlConditions)) {
      for (const cond of parsed.sqlConditions) {
        if (typeof cond.clause === 'string' && Array.isArray(cond.params)) {
          // Фикс: LLM иногда генерирует $N вместо $1 — заменяем
          let clause = cond.clause.replace(/\$N\b/g, '$1');
          // Фикс: LLM иногда оборачивает params в лишние кавычки "'VALUE'" → "VALUE"
          const params = cond.params.map((p: unknown) =>
            typeof p === 'string' ? p.replace(/^'(.*)'$/, '$1') : p,
          );
          if (validateSqlClause(clause, params)) {
            result.sqlConditions.push({ clause, params });
          }
        }
      }
    }

    // Всегда обеспечиваем embedding-поиск: если LLM оставил семантику пустой,
    // используем оригинальный запрос. Так гибрид работает всегда.
    if (!result.semanticQuery) {
      result.semanticQuery = query;
    }

    return result;
  } catch {
    return fallback;
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
