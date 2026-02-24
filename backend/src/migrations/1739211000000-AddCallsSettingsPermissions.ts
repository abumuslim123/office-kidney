import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCallsSettingsPermissions1739211000000 implements MigrationInterface {
  name = 'AddCallsSettingsPermissions1739211000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'calls_settings', 'Настройки звонков'),
        (uuid_generate_v4(), 'calls_api_key', 'API ключ Polza.ai')
      ON CONFLICT ("slug") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "user_permissions" ("userId", "permissionId")
      SELECT u."id", p."id"
      FROM "users" u
      CROSS JOIN "permissions" p
      WHERE u."roleId" IN (SELECT "id" FROM "roles" WHERE "slug" = 'admin')
        AND p."slug" IN ('calls_settings', 'calls_api_key')
        AND NOT EXISTS (
          SELECT 1 FROM "user_permissions" up
          WHERE up."userId" = u."id" AND up."permissionId" = p."id"
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_permissions"
      WHERE "permissionId" IN (
        SELECT "id" FROM "permissions" WHERE "slug" IN ('calls_settings', 'calls_api_key')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "slug" IN ('calls_settings', 'calls_api_key')
    `);
  }
}
