import { MigrationInterface, QueryRunner } from 'typeorm';

export class ListSharePerList1738771600000 implements MigrationInterface {
  name = 'ListSharePerList1738771600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hr_lists"
      ADD COLUMN "shareEnabled" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "hr_lists"
      ADD COLUMN "shareToken" character varying(255)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_hr_lists_shareToken" ON "hr_lists" ("shareToken") WHERE "shareToken" IS NOT NULL AND "shareToken" != ''
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hr_lists_share_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hr_lists_share"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hr_lists_shareToken"`);
    await queryRunner.query(`ALTER TABLE "hr_lists" DROP COLUMN "shareToken"`);
    await queryRunner.query(`ALTER TABLE "hr_lists" DROP COLUMN "shareEnabled"`);
    await queryRunner.query(`
      CREATE TABLE "hr_lists_share" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "enabled" boolean NOT NULL DEFAULT false,
        "token" character varying(255) NOT NULL DEFAULT '',
        CONSTRAINT "PK_hr_lists_share_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_hr_lists_share_token" ON "hr_lists_share" ("token") WHERE "token" != ''
    `);
    await queryRunner.query(`
      INSERT INTO "hr_lists_share" ("id", "enabled", "token") VALUES (uuid_generate_v4(), false, '')
    `);
  }
}
