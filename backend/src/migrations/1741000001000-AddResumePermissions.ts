import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResumePermissions1741000001000 implements MigrationInterface {
  name = 'AddResumePermissions1741000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'hr_resume_view', 'HR Резюме: просмотр'),
        (uuid_generate_v4(), 'hr_resume_edit', 'HR Резюме: редактирование'),
        (uuid_generate_v4(), 'hr_resume_delete', 'HR Резюме: удаление'),
        (uuid_generate_v4(), 'hr_resume_analytics', 'HR Резюме: аналитика'),
        (uuid_generate_v4(), 'hr_resume_public_apply_manage', 'HR Резюме: публичные отклики'),
        (uuid_generate_v4(), 'hr_resume_telegram_manage', 'HR Резюме: Telegram канал')
      ON CONFLICT ("slug") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "user_permissions" ("userId", "permissionId")
      SELECT u."id", p."id"
      FROM "users" u
      JOIN "roles" r ON r."id" = u."roleId"
      CROSS JOIN "permissions" p
      WHERE r."slug" = 'admin'
        AND p."slug" IN (
          'hr_resume_view',
          'hr_resume_edit',
          'hr_resume_delete',
          'hr_resume_analytics',
          'hr_resume_public_apply_manage',
          'hr_resume_telegram_manage'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "user_permissions" up
          WHERE up."userId" = u."id" AND up."permissionId" = p."id"
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_permissions"
      WHERE "permissionId" IN (
        SELECT "id" FROM "permissions"
        WHERE "slug" IN (
          'hr_resume_view',
          'hr_resume_edit',
          'hr_resume_delete',
          'hr_resume_analytics',
          'hr_resume_public_apply_manage',
          'hr_resume_telegram_manage'
        )
      )
    `);

    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "slug" IN (
        'hr_resume_view',
        'hr_resume_edit',
        'hr_resume_delete',
        'hr_resume_analytics',
        'hr_resume_public_apply_manage',
        'hr_resume_telegram_manage'
      )
    `);
  }
}
