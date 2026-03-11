import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCandidateStages1741700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure the enum type exists (TypeORM creates it with the table, but on fresh DBs the table may not exist yet)
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resume_candidates_status_enum') THEN
          CREATE TYPE "resume_candidates_status_enum" AS ENUM (
            'NEW', 'REVIEWING', 'INVITED', 'ONLINE_INTERVIEW', 'INTERVIEW',
            'TRIAL', 'INTERNSHIP', 'HIRED', 'REJECTED', 'RESERVE'
          );
        ELSE
          ALTER TYPE "resume_candidates_status_enum" ADD VALUE IF NOT EXISTS 'ONLINE_INTERVIEW';
          ALTER TYPE "resume_candidates_status_enum" ADD VALUE IF NOT EXISTS 'INTERVIEW';
          ALTER TYPE "resume_candidates_status_enum" ADD VALUE IF NOT EXISTS 'TRIAL';
          ALTER TYPE "resume_candidates_status_enum" ADD VALUE IF NOT EXISTS 'INTERNSHIP';
        END IF;
      END $$
    `);
  }

  public async down(): Promise<void> {
    // Cannot remove enum values in PostgreSQL without recreating the type
  }
}
