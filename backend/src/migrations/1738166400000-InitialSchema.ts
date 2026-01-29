import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1738166400000 implements MigrationInterface {
  name = 'InitialSchema1738166400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        CONSTRAINT "UQ_roles_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "displayName" character varying(200) NOT NULL DEFAULT '',
        "isActive" boolean NOT NULL DEFAULT true,
        "roleId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_users_roleId" FOREIGN KEY ("roleId") REFERENCES "roles"("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token" character varying NOT NULL,
        "userId" uuid NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_token" ON "refresh_tokens" ("token")
    `);
    await queryRunner.query(`
      INSERT INTO "roles" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'admin', 'Администратор'),
        (uuid_generate_v4(), 'manager', 'Руководитель'),
        (uuid_generate_v4(), 'employee', 'Сотрудник'),
        (uuid_generate_v4(), 'viewer', 'Наблюдатель')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_tokens_token"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "roles"`);
  }
}
