import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppSettings1738953600000 implements MigrationInterface {
  name = 'AddAppSettings1738953600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "key" character varying(200) NOT NULL,
        "value" character varying(2000) NOT NULL,
        CONSTRAINT "PK_app_settings_key" PRIMARY KEY ("key")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "app_settings" ("key", "value")
      VALUES ('screensDefaultPhotoDurationSeconds', '15')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_settings"`);
  }
}

