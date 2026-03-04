import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubScores1741000007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE resume_candidate_scores
        ADD COLUMN IF NOT EXISTS "experienceScore" float,
        ADD COLUMN IF NOT EXISTS "educationScore" float,
        ADD COLUMN IF NOT EXISTS "qualificationScore" float,
        ADD COLUMN IF NOT EXISTS "developmentScore" float,
        ADD COLUMN IF NOT EXISTS "aiQualitativeScore" float,
        ADD COLUMN IF NOT EXISTS "deterministicScore" float,
        ADD COLUMN IF NOT EXISTS "confidence" float
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE resume_candidate_scores
        DROP COLUMN IF EXISTS "experienceScore",
        DROP COLUMN IF EXISTS "educationScore",
        DROP COLUMN IF EXISTS "qualificationScore",
        DROP COLUMN IF EXISTS "developmentScore",
        DROP COLUMN IF EXISTS "aiQualitativeScore",
        DROP COLUMN IF EXISTS "deterministicScore",
        DROP COLUMN IF EXISTS "confidence"
    `);
  }
}
