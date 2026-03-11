import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCandidateStages1741700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "resume_candidates_status_enum" ADD VALUE IF NOT EXISTS 'ONLINE_INTERVIEW'`);
    await queryRunner.query(`ALTER TYPE "resume_candidates_status_enum" ADD VALUE IF NOT EXISTS 'INTERVIEW'`);
    await queryRunner.query(`ALTER TYPE "resume_candidates_status_enum" ADD VALUE IF NOT EXISTS 'TRIAL'`);
    await queryRunner.query(`ALTER TYPE "resume_candidates_status_enum" ADD VALUE IF NOT EXISTS 'INTERNSHIP'`);
  }

  public async down(): Promise<void> {
    // Cannot remove enum values in PostgreSQL without recreating the type
  }
}
