import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResumeCandidate } from './entities/resume-candidate.entity';
import { ResumeCandidateTag } from './entities/resume-candidate-tag.entity';
import { ResumeCandidateNote } from './entities/resume-candidate-note.entity';
import {
  ResumeCandidatePriority,
  ResumeProcessingStatus,
} from './entities/resume.enums';

export type DuplicateCheckResult = {
  status: 'no_duplicate' | 'exact_duplicate_deleted' | 'similar_tagged';
  existingCandidateId?: string;
  existingCandidateLocation?: 'candidates' | 'archive' | 'trash';
  similarity?: number;
};

// ─── Normalization helpers ────────────────────────────────────────────────────

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 11 && digits.startsWith('8')) {
    return '7' + digits.slice(1);
  }
  return digits;
}

const TRANSLIT_MAP: Record<string, string> = {
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', zh: 'ж', z: 'з',
  i: 'и', y: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п',
  r: 'р', s: 'с', t: 'т', u: 'у', f: 'ф', kh: 'х', h: 'х', ts: 'ц',
  ch: 'ч', sh: 'ш', shch: 'щ', yu: 'ю', ya: 'я', yo: 'ё', j: 'й',
};

function translitToCyrillic(text: string): string {
  let result = text.toLowerCase();
  const sorted = Object.entries(TRANSLIT_MAP).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [lat, cyr] of sorted) {
    result = result.replaceAll(lat, cyr);
  }
  return result;
}

function normalizeName(name: string): string {
  let n = name.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  if (/[a-z]/i.test(n)) {
    n = translitToCyrillic(n);
  }
  return n;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function namesSimilar(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;

  const sortedA = na.split(' ').sort().join(' ');
  const sortedB = nb.split(' ').sort().join(' ');
  if (sortedA === sortedB) return true;

  const dist = levenshtein(sortedA, sortedB);
  const maxLen = Math.max(sortedA.length, sortedB.length);
  return dist <= 3 || dist / maxLen < 0.15;
}

function namesExact(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  const sortedA = na.split(' ').sort().join(' ');
  const sortedB = nb.split(' ').sort().join(' ');
  return sortedA === sortedB;
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function setOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const minSize = Math.min(a.size, b.size);
  return minSize === 0 ? 0 : intersection / minSize;
}

interface ScoredComparison {
  score: number;
  maxScore: number;
  similarity: number;
  differences: string[];
}

// ─── Decision helpers ─────────────────────────────────────────────────────────

function candidateLocation(
  priority: ResumeCandidatePriority,
): 'candidates' | 'archive' | 'trash' {
  if (priority === ResumeCandidatePriority.ARCHIVE) return 'archive';
  if (priority === ResumeCandidatePriority.DELETED) return 'trash';
  return 'candidates';
}

// Thresholds:
// >= 0.80 — same person, same data → delete newer (exact duplicate)
// >= 0.50 — likely same person, some differences → tag both
// <  0.50 — different people or too little data → ignore
const EXACT_THRESHOLD = 0.8;
const SIMILAR_THRESHOLD = 0.5;

@Injectable()
export class ResumeDuplicateDetectionService {
  private readonly logger = new Logger(ResumeDuplicateDetectionService.name);

  constructor(
    @InjectRepository(ResumeCandidate)
    private readonly candidateRepo: Repository<ResumeCandidate>,

    @InjectRepository(ResumeCandidateTag)
    private readonly tagRepo: Repository<ResumeCandidateTag>,

    @InjectRepository(ResumeCandidateNote)
    private readonly noteRepo: Repository<ResumeCandidateNote>,
  ) {}

  // ─── Stage 1: Find potential matches ───────────────────────────────────────
  // Always search by name. Phone/email are bonus signals checked in Stage 2.

  private async findPotentialMatches(
    candidateId: string,
  ): Promise<ResumeCandidate[]> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
    });
    if (!candidate) return [];

    const normalizedName = normalizeName(candidate.fullName);
    const nameParts = normalizedName.split(' ').filter((p) => p.length >= 2);

    // Need at least 2 name parts (фамилия + имя) to avoid false positives
    if (nameParts.length < 2) return [];

    const normalizedPhone = normalizePhone(candidate.phone);
    const normalizedEmail = candidate.email?.toLowerCase().trim() || null;

    // Build query: name parts must all match OR phone suffix matches OR email matches
    const qb = this.candidateRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.workHistory', 'wh')
      .leftJoinAndSelect('c.education', 'edu')
      .leftJoinAndSelect('c.tags', 'tag')
      .where('c.id != :candidateId', { candidateId })
      .andWhere('c.processingStatus = :status', {
        status: ResumeProcessingStatus.COMPLETED,
      });

    // Build the OR block: (all name parts match) OR phone OR email
    const orParts: string[] = [];
    const orParams: Record<string, unknown> = {};

    // Name-based condition: all parts must appear in fullName (AND within the OR group)
    const nameConditions = nameParts
      .map((part, idx) => {
        const key = `namePart${idx}`;
        orParams[key] = `%${part}%`;
        return `c.fullName ILIKE :${key}`;
      })
      .join(' AND ');
    orParts.push(`(${nameConditions})`);

    if (normalizedPhone) {
      orParams['phoneSuffix'] = `%${normalizedPhone.slice(-10)}`;
      orParts.push('c.phone LIKE :phoneSuffix');
    }

    if (normalizedEmail) {
      orParams['email'] = normalizedEmail;
      orParts.push('LOWER(c.email) = :email');
    }

    qb.andWhere(`(${orParts.join(' OR ')})`, orParams);

    const potentialMatches = await qb.getMany();

    // Post-filter: require at least one strong signal
    return potentialMatches.filter((match) => {
      // Similar names
      if (namesSimilar(candidate.fullName, match.fullName)) return true;

      // Phone match
      const matchPhone = normalizePhone(match.phone);
      if (normalizedPhone && matchPhone && normalizedPhone === matchPhone)
        return true;

      // Email match
      if (
        normalizedEmail &&
        match.email &&
        normalizedEmail === match.email.toLowerCase().trim()
      )
        return true;

      return false;
    });
  }

  // ─── Stage 2: Score candidates ─────────────────────────────────────────────
  // Compare STRUCTURED fields only (what AI extracted), NOT raw text.
  // Raw text is unreliable — same person pasted as text vs uploaded as PDF
  // will have very different rawText but identical structured data.

  private scoreCandidate(
    newC: ResumeCandidate,
    existC: ResumeCandidate,
  ): ScoredComparison {
    let score = 0;
    let maxScore = 0;
    const differences: string[] = [];

    // ── Identity signals (strong) ──

    // Exact name match (beyond just "similar" from Stage 1)
    maxScore += 15;
    if (namesExact(newC.fullName, existC.fullName)) {
      score += 15;
    } else if (namesSimilar(newC.fullName, existC.fullName)) {
      score += 10;
      differences.push('ФИО (похожие)');
    } else {
      differences.push('ФИО');
    }

    // Phone match
    maxScore += 12;
    const phoneA = normalizePhone(newC.phone);
    const phoneB = normalizePhone(existC.phone);
    if (phoneA && phoneB) {
      if (phoneA === phoneB) {
        score += 12;
      } else {
        differences.push('телефон');
      }
    } else {
      // One or both missing — don't penalize, reduce maxScore
      maxScore -= 12;
    }

    // Email match
    maxScore += 12;
    const emailA = newC.email?.toLowerCase().trim();
    const emailB = existC.email?.toLowerCase().trim();
    if (emailA && emailB) {
      if (emailA === emailB) {
        score += 12;
      } else {
        differences.push('email');
      }
    } else {
      maxScore -= 12;
    }

    // Birthdate match
    maxScore += 8;
    if (newC.birthDate && existC.birthDate) {
      if (newC.birthDate.getTime() === existC.birthDate.getTime()) {
        score += 8;
      } else {
        differences.push('дата рождения');
      }
    } else {
      maxScore -= 8;
    }

    // ── Professional data (core comparison) ──

    // Specialization
    maxScore += 12;
    if (newC.specialization && existC.specialization) {
      if (
        normalizeName(newC.specialization) ===
        normalizeName(existC.specialization)
      ) {
        score += 12;
      } else {
        differences.push('специализация');
      }
    } else if (!newC.specialization && !existC.specialization) {
      score += 12;
    } else {
      // One has it, other doesn't — partial penalize
      score += 4;
    }

    // University + graduation year
    maxScore += 8;
    if (newC.university && existC.university) {
      const uniMatch =
        normalizeName(newC.university) === normalizeName(existC.university);
      const yearMatch = newC.graduationYear === existC.graduationYear;
      if (uniMatch && yearMatch) {
        score += 8;
      } else if (uniMatch) {
        score += 6;
      } else {
        differences.push('ВУЗ');
      }
    } else if (!newC.university && !existC.university) {
      score += 8;
    } else {
      score += 2;
    }

    // Qualification category
    maxScore += 5;
    if (newC.qualificationCategory === existC.qualificationCategory) {
      score += 5;
    } else {
      differences.push('категория');
    }

    // Experience (within 2 years tolerance)
    maxScore += 5;
    if (
      newC.totalExperienceYears != null &&
      existC.totalExperienceYears != null
    ) {
      if (
        Math.abs(newC.totalExperienceYears - existC.totalExperienceYears) <= 2
      ) {
        score += 5;
      } else {
        differences.push('стаж');
      }
    } else if (
      newC.totalExperienceYears == null &&
      existC.totalExperienceYears == null
    ) {
      score += 5;
    } else {
      score += 2;
    }

    // Work history organizations overlap
    maxScore += 12;
    const newOrgs = new Set(
      newC.workHistory.map((w) => normalizeName(w.organization)),
    );
    const existOrgs = new Set(
      existC.workHistory.map((w) => normalizeName(w.organization)),
    );
    if (newOrgs.size > 0 || existOrgs.size > 0) {
      const overlap = setOverlap(newOrgs, existOrgs);
      score += overlap * 12;
      if (overlap < 0.5) {
        differences.push('места работы');
      }
    } else {
      score += 12; // both empty
    }

    // Education institutions overlap
    maxScore += 8;
    const newEdu = new Set(
      newC.education.map((e) => normalizeName(e.institution)),
    );
    const existEdu = new Set(
      existC.education.map((e) => normalizeName(e.institution)),
    );
    if (newEdu.size > 0 || existEdu.size > 0) {
      const overlap = setOverlap(newEdu, existEdu);
      score += overlap * 8;
      if (overlap < 0.5) {
        differences.push('образование');
      }
    } else {
      score += 8;
    }

    // City
    maxScore += 3;
    if (newC.city && existC.city) {
      if (normalizeName(newC.city) === normalizeName(existC.city)) {
        score += 3;
      }
    } else if (!newC.city && !existC.city) {
      score += 3;
    }

    const similarity = maxScore > 0 ? score / maxScore : 0;

    return { score, maxScore, similarity, differences };
  }

  // ─── Public entry point ────────────────────────────────────────────────────

  async checkAndHandleDuplicates(
    candidateId: string,
  ): Promise<DuplicateCheckResult> {
    try {
      const matches = await this.findPotentialMatches(candidateId);
      if (matches.length === 0) {
        return { status: 'no_duplicate' };
      }

      const newCandidate = await this.candidateRepo.findOne({
        where: { id: candidateId },
        relations: ['workHistory', 'education', 'tags'],
      });
      if (!newCandidate) return { status: 'no_duplicate' };

      // Find best match
      let bestMatch = matches[0];
      let bestResult = this.scoreCandidate(newCandidate, bestMatch);

      for (let i = 1; i < matches.length; i++) {
        const result = this.scoreCandidate(newCandidate, matches[i]);
        if (result.similarity > bestResult.similarity) {
          bestMatch = matches[i];
          bestResult = result;
        }
      }

      // Exact duplicate → soft-delete newer + mark with tag and note
      if (bestResult.similarity >= EXACT_THRESHOLD) {
        await this.candidateRepo.update(candidateId, {
          priority: ResumeCandidatePriority.DELETED,
        });

        // Tag as "Дубликат"
        const existingTag = await this.tagRepo.findOne({
          where: { candidateId, label: 'Дубликат' },
        });
        if (!existingTag) {
          await this.tagRepo.save(
            this.tagRepo.create({ candidateId, label: 'Дубликат', color: '#dc2626' }),
          );
        }

        // Explanatory note
        const pct = Math.round(bestResult.similarity * 100);
        await this.noteRepo.save(
          this.noteRepo.create({
            candidateId,
            content: `Автоматически перемещён в корзину как дубликат (совпадение ${pct}%). Оригинал: ${bestMatch.fullName}.`,
            authorName: 'Система',
          }),
        );

        return {
          status: 'exact_duplicate_deleted',
          existingCandidateId: bestMatch.id,
          existingCandidateLocation: candidateLocation(bestMatch.priority),
          similarity: bestResult.similarity,
        };
      }

      // Similar → tag both
      if (bestResult.similarity >= SIMILAR_THRESHOLD) {
        const DUPLICATE_TAG = {
          label: 'Возможный дубликат',
          color: '#ef4444',
        };

        // Tag new candidate
        const existingTagNew = await this.tagRepo.findOne({
          where: { candidateId, label: DUPLICATE_TAG.label },
        });
        if (!existingTagNew) {
          await this.tagRepo.save(
            this.tagRepo.create({ candidateId, ...DUPLICATE_TAG }),
          );
        }

        // Tag existing candidate
        const existingTagOld = await this.tagRepo.findOne({
          where: { candidateId: bestMatch.id, label: DUPLICATE_TAG.label },
        });
        if (!existingTagOld) {
          await this.tagRepo.save(
            this.tagRepo.create({
              candidateId: bestMatch.id,
              ...DUPLICATE_TAG,
            }),
          );
        }

        // Add notes
        const pct = Math.round(bestResult.similarity * 100);
        const diffStr =
          bestResult.differences.length > 0
            ? bestResult.differences.join(', ')
            : 'нет значимых';
        const noteText = `Обнаружен возможный дубликат (совпадение ${pct}%). Различия: ${diffStr}.`;

        await this.noteRepo.save(
          this.noteRepo.create({
            candidateId,
            content: noteText,
            authorName: 'Система',
          }),
        );
        await this.noteRepo.save(
          this.noteRepo.create({
            candidateId: bestMatch.id,
            content: noteText,
            authorName: 'Система',
          }),
        );

        return {
          status: 'similar_tagged',
          existingCandidateId: bestMatch.id,
          existingCandidateLocation: candidateLocation(bestMatch.priority),
          similarity: bestResult.similarity,
        };
      }

      return { status: 'no_duplicate' };
    } catch (error) {
      this.logger.error('Duplicate detection error', error);
      return { status: 'no_duplicate' };
    }
  }
}
