import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrListsShare1738771500000 implements MigrationInterface {
  name = 'AddHrListsShare1738771500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hr_lists_share_token"`);
    await queryRunner.query(`DROP TABLE "hr_lists_share"`);
  }
}
