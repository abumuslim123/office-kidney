import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPermissions1738252800000 implements MigrationInterface {
  name = 'AddPermissions1738252800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаём таблицу permissions
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        CONSTRAINT "UQ_permissions_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id")
      )
    `);

    // Создаём join-таблицу user_permissions
    await queryRunner.query(`
      CREATE TABLE "user_permissions" (
        "userId" uuid NOT NULL,
        "permissionId" uuid NOT NULL,
        CONSTRAINT "PK_user_permissions" PRIMARY KEY ("userId", "permissionId"),
        CONSTRAINT "FK_user_permissions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_permissions_permissionId" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE
      )
    `);

    // Индексы
    await queryRunner.query(`CREATE INDEX "IDX_user_permissions_userId" ON "user_permissions" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_permissions_permissionId" ON "user_permissions" ("permissionId")`);

    // Seed permissions
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'accounting', 'Учёт'),
        (uuid_generate_v4(), 'agents', 'Агенты'),
        (uuid_generate_v4(), 'services', 'Сервисы'),
        (uuid_generate_v4(), 'hr', 'HR'),
        (uuid_generate_v4(), 'users', 'Пользователи')
    `);

    // Даём все права существующим админам
    await queryRunner.query(`
      INSERT INTO "user_permissions" ("userId", "permissionId")
      SELECT u."id", p."id"
      FROM "users" u
      CROSS JOIN "permissions" p
      WHERE u."roleId" IN (SELECT "id" FROM "roles" WHERE "slug" = 'admin')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_permissions_permissionId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_permissions_userId"`);
    await queryRunner.query(`DROP TABLE "user_permissions"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
  }
}
