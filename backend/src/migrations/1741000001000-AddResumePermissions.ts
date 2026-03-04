import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResumePermissions1741000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO permissions (id, slug, name, description) VALUES
        (gen_random_uuid(), 'hr_resume_view',               'Просмотр резюме',           'Просмотр раздела резюме'),
        (gen_random_uuid(), 'hr_resume_edit',               'Редактирование резюме',      'Добавление и редактирование кандидатов'),
        (gen_random_uuid(), 'hr_resume_delete',             'Удаление резюме',            'Удаление кандидатов'),
        (gen_random_uuid(), 'hr_resume_analytics',          'Аналитика резюме',           'Просмотр аналитики резюме'),
        (gen_random_uuid(), 'hr_resume_telegram_manage',    'Управление Telegram',        'Управление Telegram-ботом резюме'),
        (gen_random_uuid(), 'hr_resume_public_apply_manage','Управление публичной формой','Управление публичной формой подачи резюме')
      ON CONFLICT (slug) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.slug = 'admin' AND p.slug LIKE 'hr_resume_%'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE permission_id IN (
        SELECT id FROM permissions WHERE slug LIKE 'hr_resume_%'
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE slug LIKE 'hr_resume_%'
    `);
  }
}
