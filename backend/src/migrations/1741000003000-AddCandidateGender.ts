import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCandidateGender1741000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" ADD COLUMN IF NOT EXISTS "gender" VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" DROP COLUMN "gender"`,
    );
  }
}
