import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixResumePermissions1741000001001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создать resume-права (без колонки description, которой нет в таблице)
    await queryRunner.query(`
      INSERT INTO permissions (id, slug, name) VALUES
        (gen_random_uuid(), 'hr_resume_view',               'HR Резюме: просмотр'),
        (gen_random_uuid(), 'hr_resume_edit',               'HR Резюме: редактирование'),
        (gen_random_uuid(), 'hr_resume_delete',             'HR Резюме: удаление'),
        (gen_random_uuid(), 'hr_resume_analytics',          'HR Резюме: аналитика'),
        (gen_random_uuid(), 'hr_resume_telegram_manage',    'HR Резюме: Telegram канал'),
        (gen_random_uuid(), 'hr_resume_public_apply_manage','HR Резюме: публичные отклики')
      ON CONFLICT (slug) DO NOTHING
    `);

    // Назначить resume-права всем admin-пользователям
    await queryRunner.query(`
      INSERT INTO user_permissions ("userId", "permissionId")
      SELECT u.id, p.id FROM users u
      JOIN roles r ON u."roleId" = r.id
      CROSS JOIN permissions p
      WHERE r.slug = 'admin' AND p.slug LIKE 'hr_resume_%'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM user_permissions
      WHERE "permissionId" IN (
        SELECT id FROM permissions WHERE slug LIKE 'hr_resume_%'
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE slug LIKE 'hr_resume_%'
    `);
  }
}
