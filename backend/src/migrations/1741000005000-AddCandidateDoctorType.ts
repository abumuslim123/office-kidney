import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Добавление поля doctorType (направление врача: педиатрический/терапевтический/семейный)
 * к таблице resume_candidates.
 */
export class AddCandidateDoctorType1741000005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" ADD COLUMN "doctorType" VARCHAR(20) DEFAULT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_resume_candidates_doctorType" ON "resume_candidates" ("doctorType")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_resume_candidates_doctorType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" DROP COLUMN "doctorType"`,
    );
  }
}
