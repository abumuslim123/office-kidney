import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadExtraFields1741600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "resume_leads"
        ADD COLUMN "doctorTypes" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN "branches" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN "desiredSalary" integer,
        ADD COLUMN "desiredSalaryType" "resume_salary_type"
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
