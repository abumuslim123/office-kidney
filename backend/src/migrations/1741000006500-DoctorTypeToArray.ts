import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Преобразование doctorType (varchar, одно значение) → doctorTypes (text[], мультивыбор).
 */
export class DoctorTypeToArray1741000006500 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавить новую колонку-массив
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" ADD COLUMN IF NOT EXISTS "doctorTypes" text[] NOT NULL DEFAULT '{}'`,
    );

    // Перенести данные: если doctorType был заполнен → массив из одного элемента
    const hasDoctorType = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'resume_candidates' AND column_name = 'doctorType'`,
    );
    if (hasDoctorType.length > 0) {
      await queryRunner.query(
        `UPDATE "resume_candidates" SET "doctorTypes" = ARRAY["doctorType"] WHERE "doctorType" IS NOT NULL`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_resume_candidates_doctorType"`,
      );
      await queryRunner.query(
        `ALTER TABLE "resume_candidates" DROP COLUMN "doctorType"`,
      );
    }

    // Создать GIN-индекс для массива
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_resume_candidates_doctorTypes" ON "resume_candidates" USING GIN ("doctorTypes")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_resume_candidates_doctorTypes"`,
    );

    // Восстановить одиночную колонку
    await queryRunner.query(
      `ALTER TABLE "resume_candidates" ADD COLUMN "doctorType" VARCHAR(20) DEFAULT NULL`,
    );

    // Перенести первый элемент массива обратно
    await queryRunner.query(
      `UPDATE "resume_candidates" SET "doctorType" = "doctorTypes"[1] WHERE array_length("doctorTypes", 1) > 0`,
    );

    await queryRunner.query(
      `ALTER TABLE "resume_candidates" DROP COLUMN "doctorTypes"`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_resume_candidates_doctorType" ON "resume_candidates" ("doctorType")`,
    );
  }
}
