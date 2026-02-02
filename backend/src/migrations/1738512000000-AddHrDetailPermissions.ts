import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrDetailPermissions1738512000000 implements MigrationInterface {
  name = 'AddHrDetailPermissions1738512000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'hr_delete_folders', 'HR: удаление папок'),
        (uuid_generate_v4(), 'hr_delete_entries', 'HR: удаление записей'),
        (uuid_generate_v4(), 'hr_edit_fields', 'HR: редактирование полей'),
        (uuid_generate_v4(), 'hr_delete_fields', 'HR: удаление полей'),
        (uuid_generate_v4(), 'hr_edit_entries', 'HR: редактирование записей')
    `);

    await queryRunner.query(`
      INSERT INTO "user_permissions" ("userId", "permissionId")
      SELECT u."id", p."id"
      FROM "users" u
      CROSS JOIN "permissions" p
      WHERE u."roleId" IN (SELECT "id" FROM "roles" WHERE "slug" = 'admin')
        AND p."slug" IN ('hr_delete_folders', 'hr_delete_entries', 'hr_edit_fields', 'hr_delete_fields', 'hr_edit_entries')
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
        WHERE "slug" IN ('hr_delete_folders', 'hr_delete_entries', 'hr_edit_fields', 'hr_delete_fields', 'hr_edit_entries')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "slug" IN ('hr_delete_folders', 'hr_delete_entries', 'hr_edit_fields', 'hr_delete_fields', 'hr_edit_entries')
    `);
  }
}
