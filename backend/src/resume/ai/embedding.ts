import { ollama, OLLAMA_EMBED_MODEL } from './client';
import { ResumeCandidate } from '../entities/resume-candidate.entity';

/**
 * Собирает текстовый профиль кандидата для генерации эмбеддинга.
 * Компактный формат — ключевые факты без лишней воды.
 */
export function buildCandidateProfileText(c: ResumeCandidate): string {
  const parts: string[] = [];

  parts.push(`Специализация: ${c.specialization || 'не указана'}`);

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
    parts.push(`Курсы ПК: ${c.cmeCourses.length} шт.`);
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
 * Возвращает вектор размерности 768 (nomic-embed-text).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ollama.embed({
    model: OLLAMA_EMBED_MODEL,
    input: text,
  });
  return response.embeddings[0];
}
