import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrDeleteAllAndManageFields1738598400000 implements MigrationInterface {
  name = 'AddHrDeleteAllAndManageFields1738598400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'hr_delete_all_entries', 'HR: удаление всех записей'),
        (uuid_generate_v4(), 'hr_manage_fields', 'HR: настройки полей')
    `);

    await queryRunner.query(`
      INSERT INTO "user_permissions" ("userId", "permissionId")
      SELECT u."id", p."id"
      FROM "users" u
      CROSS JOIN "permissions" p
      WHERE u."roleId" IN (SELECT "id" FROM "roles" WHERE "slug" = 'admin')
        AND p."slug" IN ('hr_delete_all_entries', 'hr_manage_fields')
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
        SELECT "id" FROM "permissions"
        WHERE "slug" IN ('hr_delete_all_entries', 'hr_manage_fields')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "slug" IN ('hr_delete_all_entries', 'hr_manage_fields')
    `);
  }
}
