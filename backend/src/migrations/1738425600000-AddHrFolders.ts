import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrFolders1738425600000 implements MigrationInterface {
  name = 'AddHrFolders1738425600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "hr_folders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hr_folders_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "hr_lists" ADD "folderId" uuid
    `);

    await queryRunner.query(
      `INSERT INTO "hr_folders" ("name") VALUES ('Общее')`,
    );
    const result = await queryRunner.query(
      `SELECT id FROM "hr_folders" WHERE "name" = 'Общее' LIMIT 1`,
    );
    const folderId = (Array.isArray(result) ? result[0] : result?.rows?.[0])?.id;
    if (folderId) {
      await queryRunner.query(
        `UPDATE "hr_lists" SET "folderId" = $1 WHERE "folderId" IS NULL`,
        [folderId],
      );
    }

    await queryRunner.query(`
      ALTER TABLE "hr_lists" ALTER COLUMN "folderId" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "hr_lists"
      ADD CONSTRAINT "FK_hr_lists_folderId"
      FOREIGN KEY ("folderId") REFERENCES "hr_folders"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_hr_lists_folderId" ON "hr_lists" ("folderId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hr_lists_folderId"`);
    await queryRunner.query(`
      ALTER TABLE "hr_lists" DROP CONSTRAINT "FK_hr_lists_folderId"
    `);
    await queryRunner.query(`
      ALTER TABLE "hr_lists" DROP COLUMN "folderId"
    `);
    await queryRunner.query(`DROP TABLE "hr_folders"`);
  }
}
