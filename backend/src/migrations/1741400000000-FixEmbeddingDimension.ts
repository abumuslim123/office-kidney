import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixEmbeddingDimension1741400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Удаляем HNSW-индекс (нельзя менять тип с индексом)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_resume_candidates_embedding"`,
    );

    // Меняем размерность: 768 (nomic-embed-text) → 1024 (snowflake-arctic-embed2)
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" ALTER COLUMN "embedding" TYPE vector(1024)`,
    );

    // Пересоздаём HNSW-индекс
    await queryRunner.query(
      `CREATE INDEX "IDX_resume_candidates_embedding" ON "resume_candidates" USING hnsw ("embedding" vector_cosine_ops)`,
    );

    // Обнуляем существующие эмбеддинги — старые 768-мерные невалидны
    await queryRunner.query(
      `UPDATE "resume_candidates" SET "embedding" = NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_resume_candidates_embedding"`,
    );
    await queryRunner.query(
      `UPDATE "resume_candidates" SET "embedding" = NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" ALTER COLUMN "embedding" TYPE vector(768)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_resume_candidates_embedding" ON "resume_candidates" USING hnsw ("embedding" vector_cosine_ops)`,
    );
  }
}
