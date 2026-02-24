import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessVersionChecklist1739800000000 implements MigrationInterface {
  name = 'AddProcessVersionChecklist1739800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "process_versions"
      ADD COLUMN IF NOT EXISTS "checklist" jsonb DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "process_versions"
      DROP COLUMN IF EXISTS "checklist"
    `);
  }
}
