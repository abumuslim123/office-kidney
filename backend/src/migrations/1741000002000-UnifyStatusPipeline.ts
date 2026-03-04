import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifyStatusPipeline1741000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new values to resume_candidate_status enum
    await queryRunner.query(`ALTER TYPE "resume_candidate_status" ADD VALUE IF NOT EXISTS 'RESERVE'`);
    await queryRunner.query(`ALTER TYPE "resume_candidate_status" ADD VALUE IF NOT EXISTS 'REJECTED'`);

    // Migrate data: priority decisions → status values
    // RESERVE priority → RESERVE status
    await queryRunner.query(
      `UPDATE "resume_candidates" SET "status" = 'RESERVE' WHERE "priority" = 'RESERVE'`,
    );
    // NOT_SUITABLE priority → REJECTED status
    await queryRunner.query(
      `UPDATE "resume_candidates" SET "status" = 'REJECTED' WHERE "priority" = 'NOT_SUITABLE'`,
    );

    // Set migrated records' priority to ACTIVE (since status now carries the info)
    await queryRunner.query(
      `UPDATE "resume_candidates" SET "priority" = 'ACTIVE' WHERE "priority" IN ('RESERVE', 'NOT_SUITABLE')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: move RESERVE/REJECTED status back to priority
    await queryRunner.query(
      `UPDATE "resume_candidates" SET "priority" = 'RESERVE', "status" = 'NEW' WHERE "status" = 'RESERVE'`,
    );
    await queryRunner.query(
      `UPDATE "resume_candidates" SET "priority" = 'NOT_SUITABLE', "status" = 'NEW' WHERE "status" = 'REJECTED'`,
    );
    // Note: Cannot remove enum values in PostgreSQL without recreating the type
  }
}
