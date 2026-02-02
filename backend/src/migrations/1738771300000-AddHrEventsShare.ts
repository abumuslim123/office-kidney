import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrEventsShare1738771300000 implements MigrationInterface {
  name = 'AddHrEventsShare1738771300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "hr_events_share" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "enabled" boolean NOT NULL DEFAULT false,
        "token" character varying(255) NOT NULL DEFAULT '',
        CONSTRAINT "PK_hr_events_share_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_hr_events_share_token" ON "hr_events_share" ("token") WHERE "token" != ''
    `);
    await queryRunner.query(`
      INSERT INTO "hr_events_share" ("id", "enabled", "token") VALUES (uuid_generate_v4(), false, '')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hr_events_share_token"`);
    await queryRunner.query(`DROP TABLE "hr_events_share"`);
  }
}
