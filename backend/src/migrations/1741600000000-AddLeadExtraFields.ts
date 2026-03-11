import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadExtraFields1741600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resume_salary_type') THEN
          CREATE TYPE "resume_salary_type" AS ENUM ('FIXED_RUB', 'PERCENT_OF_VISIT');
        END IF;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "resume_leads"
        ADD COLUMN IF NOT EXISTS "doctorTypes" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "branches" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "desiredSalary" integer,
        ADD COLUMN IF NOT EXISTS "desiredSalaryType" "resume_salary_type"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "resume_leads"
        DROP COLUMN IF EXISTS "desiredSalaryType",
        DROP COLUMN IF EXISTS "desiredSalary",
        DROP COLUMN IF EXISTS "branches",
        DROP COLUMN IF EXISTS "doctorTypes"
    `);
  }
}
