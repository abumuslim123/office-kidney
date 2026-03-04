import { ResumeCandidate } from '../entities/resume-candidate.entity';
import { ResumeQualificationCategory } from '../entities/resume.enums';

// ─── Интерфейсы ─────────────────────────────────────────────

export interface PoolStats {
  count: number;
  experience: { mean: number; stddev: number };
  specialtyExperience: { mean: number; stddev: number };
  workHistoryCount: { mean: number; stddev: number };
  educationCount: { mean: number; stddev: number };
  hasUniversity: number;
  hasResidency: number;
  hasInternship: number;
  categoryValues: { mean: number; stddev: number };
  hasAccreditation: number;
  hasCertificate: number;
  nmoPoints: { mean: number; stddev: number };
  cmeCoursesCount: { mean: number; stddev: number };
  hasPublications: number;
  languagesCount: { mean: number; stddev: number };
}

export interface DeterministicScores {
  experience: number;
  education: number;
  qualification: number;
  development: number;
  composite: number;
  confidence: number;
}

// ─── Веса ───────────────────────────────────────────────────

/** Веса внутри детерминированной части (сумма = 1.0) */
const EXPERIENCE_WEIGHT = 0.333;
const EDUCATION_WEIGHT = 0.200;
const QUALIFICATION_WEIGHT = 0.267;
const DEVELOPMENT_WEIGHT = 0.200;

/** Маппинг категории на числовое значение */
const CATEGORY_MAP: Record<string, number> = {
  [ResumeQualificationCategory.HIGHEST]: 4,
  [ResumeQualificationCategory.FIRST]: 3,
  [ResumeQualificationCategory.SECOND]: 2,
  [ResumeQualificationCategory.NONE]: 1,
};

// ─── Математика ─────────────────────────────────────────────

/**
 * Аппроксимация CDF нормального распределения (Abramowitz & Stegun).
 * z → percentile (0-100).
 */
export function zToPercentile(z: number): number {
  // Ограничиваем z в разумных пределах
  const clampedZ = Math.max(-3.5, Math.min(3.5, z));

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = clampedZ < 0 ? -1 : 1;
  const x = Math.abs(clampedZ) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return Math.round(((1.0 + sign * y) / 2.0) * 100);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function zScore(value: number, avg: number, sd: number): number {
  if (sd === 0) return 0;
  return (value - avg) / sd;
}

// ─── Pool Stats ─────────────────────────────────────────────

function computeMeanStddev(values: number[]): { mean: number; stddev: number } {
  const m = mean(values);
  return { mean: m, stddev: stddev(values, m) };
}

/**
 * Рассчитывает статистику пула для z-score нормализации.
 */
export function computePoolStats(candidates: ResumeCandidate[]): PoolStats {
  const expValues = candidates
    .map(c => c.totalExperienceYears)
    .filter((v): v is number => v != null);

  const specExpValues = candidates
    .map(c => c.specialtyExperienceYears)
    .filter((v): v is number => v != null);

  const whCounts = candidates.map(c => c.workHistory?.length ?? 0);
  const eduCounts = candidates.map(c => c.education?.length ?? 0);

  const catValues = candidates.map(c => CATEGORY_MAP[c.qualificationCategory] ?? 1);

  const nmoValues = candidates
    .map(c => c.nmoPoints)
    .filter((v): v is number => v != null);

  const cmeCounts = candidates.map(c => c.cmeCourses?.length ?? 0);
  const langCounts = candidates.map(c => c.languages?.length ?? 0);

  const total = candidates.length || 1;

  return {
    count: candidates.length,
    experience: computeMeanStddev(expValues),
    specialtyExperience: computeMeanStddev(specExpValues),
    workHistoryCount: computeMeanStddev(whCounts),
    educationCount: computeMeanStddev(eduCounts),
    hasUniversity: candidates.filter(c => !!c.university).length / total,
    hasResidency: candidates.filter(c => !!c.residencyPlace).length / total,
    hasInternship: candidates.filter(c => !!c.internshipPlace).length / total,
    categoryValues: computeMeanStddev(catValues),
    hasAccreditation: candidates.filter(c => c.accreditationStatus).length / total,
    hasCertificate: candidates.filter(c => !!c.certificateNumber).length / total,
    nmoPoints: computeMeanStddev(nmoValues),
    cmeCoursesCount: computeMeanStddev(cmeCounts),
    hasPublications: candidates.filter(c => !!c.publications).length / total,
    languagesCount: computeMeanStddev(langCounts),
  };
}

// ─── Sub-Scores ─────────────────────────────────────────────

/**
 * Для бинарных признаков: есть → z-score от доли в пуле.
 * Если 80% имеют и ты имеешь → средне. Если 20% имеют и ты имеешь → высоко.
 */
function binaryScore(has: boolean, poolRate: number): number {
  const val = has ? 1 : 0;
  const sd = Math.sqrt(poolRate * (1 - poolRate)) || 0.5;
  return zToPercentile(zScore(val, poolRate, sd));
}

/**
 * Опыт (0-100): стаж, специализация, количество мест работы.
 */
export function computeExperienceScore(c: ResumeCandidate, pool: PoolStats): number {
  const scores: number[] = [];

  if (c.totalExperienceYears != null && pool.experience.stddev > 0) {
    scores.push(zToPercentile(zScore(c.totalExperienceYears, pool.experience.mean, pool.experience.stddev)));
  }

  if (c.specialtyExperienceYears != null && pool.specialtyExperience.stddev > 0) {
    scores.push(zToPercentile(zScore(c.specialtyExperienceYears, pool.specialtyExperience.mean, pool.specialtyExperience.stddev)));
  }

  const whCount = c.workHistory?.length ?? 0;
  if (pool.workHistoryCount.stddev > 0) {
    scores.push(zToPercentile(zScore(whCount, pool.workHistoryCount.mean, pool.workHistoryCount.stddev)));
  }

  return scores.length > 0 ? Math.round(mean(scores)) : 50;
}

/**
 * Образование (0-100): ВУЗ, ординатура, интернатура, доп. образование.
 */
export function computeEducationScore(c: ResumeCandidate, pool: PoolStats): number {
  const scores: number[] = [];

  scores.push(binaryScore(!!c.university, pool.hasUniversity));
  scores.push(binaryScore(!!c.residencyPlace, pool.hasResidency));
  scores.push(binaryScore(!!c.internshipPlace, pool.hasInternship));

  const eduCount = c.education?.length ?? 0;
  if (pool.educationCount.stddev > 0) {
    scores.push(zToPercentile(zScore(eduCount, pool.educationCount.mean, pool.educationCount.stddev)));
  }

  return scores.length > 0 ? Math.round(mean(scores)) : 50;
}

/**
 * Квалификация (0-100): категория, аккредитация, сертификат.
 */
export function computeQualificationScore(c: ResumeCandidate, pool: PoolStats): number {
  const scores: number[] = [];

  const catVal = CATEGORY_MAP[c.qualificationCategory] ?? 1;
  if (pool.categoryValues.stddev > 0) {
    scores.push(zToPercentile(zScore(catVal, pool.categoryValues.mean, pool.categoryValues.stddev)));
  } else {
    // Все одинаковые — 50
    scores.push(50);
  }

  scores.push(binaryScore(c.accreditationStatus, pool.hasAccreditation));
  scores.push(binaryScore(!!c.certificateNumber, pool.hasCertificate));

  return scores.length > 0 ? Math.round(mean(scores)) : 50;
}

/**
 * Проф. развитие (0-100): НМО, курсы, публикации, языки.
 */
export function computeDevelopmentScore(c: ResumeCandidate, pool: PoolStats): number {
  const scores: number[] = [];

  if (c.nmoPoints != null && pool.nmoPoints.stddev > 0) {
    scores.push(zToPercentile(zScore(c.nmoPoints, pool.nmoPoints.mean, pool.nmoPoints.stddev)));
  }

  const cmeCount = c.cmeCourses?.length ?? 0;
  if (pool.cmeCoursesCount.stddev > 0) {
    scores.push(zToPercentile(zScore(cmeCount, pool.cmeCoursesCount.mean, pool.cmeCoursesCount.stddev)));
  }

  scores.push(binaryScore(!!c.publications, pool.hasPublications));

  const langCount = c.languages?.length ?? 0;
  if (pool.languagesCount.stddev > 0) {
    scores.push(zToPercentile(zScore(langCount, pool.languagesCount.mean, pool.languagesCount.stddev)));
  }

  return scores.length > 0 ? Math.round(mean(scores)) : 50;
}

// ─── Composite ──────────────────────────────────────────────

/**
 * Рассчитывает все детерминированные sub-scores и composite.
 */
export function computeDeterministicScores(
  candidate: ResumeCandidate,
  pool: PoolStats,
): DeterministicScores {
  const experience = computeExperienceScore(candidate, pool);
  const education = computeEducationScore(candidate, pool);
  const qualification = computeQualificationScore(candidate, pool);
  const development = computeDevelopmentScore(candidate, pool);

  const composite = Math.round(
    experience * EXPERIENCE_WEIGHT +
    education * EDUCATION_WEIGHT +
    qualification * QUALIFICATION_WEIGHT +
    development * DEVELOPMENT_WEIGHT,
  );

  const confidence = computeConfidence(candidate);

  return { experience, education, qualification, development, composite, confidence };
}

// ─── Confidence ─────────────────────────────────────────────

/** Поля, наличие которых влияет на достоверность оценки */
const CONFIDENCE_FIELDS: Array<(c: ResumeCandidate) => boolean> = [
  c => c.totalExperienceYears != null,
  c => c.specialtyExperienceYears != null,
  c => !!c.university,
  c => !!c.residencyPlace || !!c.internshipPlace,
  c => c.qualificationCategory !== ResumeQualificationCategory.NONE,
  c => c.accreditationStatus === true,
  c => (c.workHistory?.length ?? 0) > 0,
  c => (c.education?.length ?? 0) > 0,
  c => c.nmoPoints != null,
  c => (c.cmeCourses?.length ?? 0) > 0,
  c => !!c.specialization,
  c => !!c.rawText,
];

/**
 * Достоверность оценки (0-100): % заполненных значимых полей.
 */
export function computeConfidence(candidate: ResumeCandidate): number {
  const filled = CONFIDENCE_FIELDS.filter(fn => fn(candidate)).length;
  return Math.round((filled / CONFIDENCE_FIELDS.length) * 100);
}

// ─── Форматирование для промпта ────────────────────────────

/**
 * Формирует текстовое описание sub-scores для включения в AI промпт.
 */
export function formatSubScoresForPrompt(scores: DeterministicScores, pool: PoolStats): string {
  const lines: string[] = [];
  lines.push(`РАССЧИТАННЫЕ БАЛЛЫ КАНДИДАТА (по данным из базы, относительно ${pool.count} кандидатов):`);
  lines.push(`  Опыт: ${scores.experience}/100`);
  lines.push(`  Образование: ${scores.education}/100`);
  lines.push(`  Квалификация: ${scores.qualification}/100`);
  lines.push(`  Проф. развитие: ${scores.development}/100`);
  lines.push(`  Итого (детерминированный): ${scores.composite}/100`);
  lines.push(`  Достоверность данных: ${scores.confidence}%`);
  return lines.join('\n');
}
