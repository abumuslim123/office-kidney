import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAccountingPermission1738953700000 implements MigrationInterface {
  name = 'RemoveAccountingPermission1738953700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_permissions"
      WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "slug" = 'accounting')
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "slug" = 'accounting'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'accounting', 'Учёт')
    `);
    await queryRunner.query(`
      INSERT INTO "user_permissions" ("userId", "permissionId")
      SELECT u."id", p."id"
      FROM "users" u
      CROSS JOIN "permissions" p
      WHERE u."roleId" IN (SELECT "id" FROM "roles" WHERE "slug" = 'admin')
        AND p."slug" = 'accounting'
    `);
  }
}
