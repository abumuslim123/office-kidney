import { MigrationInterface, QueryRunner } from 'typeorm';

const WEBHOOK_URL = 'https://bitrix09102.kidney.srvu.ru/rest/119588/6ymsc7jm2onxgum7/';

export class SetBitrix24Webhook1738953900000 implements MigrationInterface {
  name = 'SetBitrix24Webhook1738953900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Только подставить значение, если ключа ещё нет (не перезаписывать сохранённый пользователем вебхук).
    await queryRunner.query(
      `INSERT INTO "app_settings" ("key", "value") VALUES ('bitrix24_webhook_url', $1)
       ON CONFLICT ("key") DO NOTHING`,
      [WEBHOOK_URL],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "app_settings" WHERE "key" = 'bitrix24_webhook_url'`,
    );
  }
}
