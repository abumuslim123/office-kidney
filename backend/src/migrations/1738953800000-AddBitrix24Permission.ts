import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBitrix24Permission1738953800000 implements MigrationInterface {
  name = 'AddBitrix24Permission1738953800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'bitrix24', 'Битрикс24')
    `);

    await queryRunner.query(`
      INSERT INTO "user_permissions" ("userId", "permissionId")
      SELECT u."id", p."id"
      FROM "users" u
      CROSS JOIN "permissions" p
      WHERE u."roleId" IN (SELECT "id" FROM "roles" WHERE "slug" = 'admin')
        AND p."slug" = 'bitrix24'
        AND NOT EXISTS (
          SELECT 1 FROM "user_permissions" up
          WHERE up."userId" = u."id" AND up."permissionId" = p."id"
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_permissions"
      WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "slug" = 'bitrix24')
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "slug" = 'bitrix24'
    `);
  }
}
