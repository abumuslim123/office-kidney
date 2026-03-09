import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Добавление системы AI-скоринга кандидатов:
 * - pgvector расширение для векторного поиска похожих кандидатов
 * - Таблица resume_candidate_scores для хранения AI-оценок
 * - Поля aiScore (кеш) и embedding (вектор) в resume_candidates
 */
export class AddCandidateScoring1741000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Расширение pgvector (skip if not available — e.g. local dev without pgvector)
    const [{ available }] = await queryRunner.query(
      `SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS available`,
    );
    const hasVector = available === true || available === 't';
    if (hasVector) {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);
    }

    // 2. Таблица AI-оценок
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resume_candidate_scores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "candidateId" uuid NOT NULL,
        "totalScore" int NOT NULL DEFAULT 0,
        "aiSummary" text NOT NULL DEFAULT '',
        "strengths" jsonb NOT NULL DEFAULT '[]',
        "weaknesses" jsonb NOT NULL DEFAULT '[]',
        "highlights" jsonb NOT NULL DEFAULT '[]',
        "comparison" text NOT NULL DEFAULT '',
        "percentileRank" float,
        "specialization" varchar,
        "totalCandidatesInGroup" int NOT NULL DEFAULT 0,
        "version" int NOT NULL DEFAULT 1,
        "isCurrent" boolean NOT NULL DEFAULT true,
        "modelVersion" varchar,
        CONSTRAINT "PK_resume_candidate_scores" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_candidate_scores_candidate"
          FOREIGN KEY ("candidateId") REFERENCES "resume_candidates"("id") ON DELETE CASCADE
      )
    `);

    // 3. Индексы для таблицы оценок
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rcs_candidateId" ON "resume_candidate_scores" ("candidateId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rcs_totalScore" ON "resume_candidate_scores" ("totalScore")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rcs_isCurrent" ON "resume_candidate_scores" ("isCurrent") WHERE "isCurrent" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rcs_specialization" ON "resume_candidate_scores" ("specialization")`,
    );

    // 4. Кешированный балл в candidates
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" ADD COLUMN IF NOT EXISTS "aiScore" float`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_resume_candidates_aiScore" ON "resume_candidates" ("aiScore")`,
    );

    // 5. Вектор эмбеддинга в candidates (768 — размерность nomic-embed-text)
    if (hasVector) {
      await queryRunner.query(
        `ALTER TABLE "resume_candidates" ADD COLUMN IF NOT EXISTS "embedding" vector(768)`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_resume_candidates_embedding" ON "resume_candidates" USING hnsw ("embedding" vector_cosine_ops)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_resume_candidates_embedding"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" DROP COLUMN "embedding"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_resume_candidates_aiScore"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" DROP COLUMN "aiScore"`,
    );
    await queryRunner.query(
      `DROP TABLE "resume_candidate_scores"`,
    );
  }
}
