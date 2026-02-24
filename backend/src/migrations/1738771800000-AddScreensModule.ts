import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScreensModule1738771800000 implements MigrationInterface {
  name = 'AddScreensModule1738771800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "screens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "deviceId" character varying NOT NULL,
        "name" character varying(200),
        "currentVideoPath" character varying(500),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastSeenAt" TIMESTAMP,
        CONSTRAINT "UQ_screens_deviceId" UNIQUE ("deviceId"),
        CONSTRAINT "PK_screens_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'screens', 'Настройка экранов')
    `);

    await queryRunner.query(`
      INSERT INTO "user_permissions" ("userId", "permissionId")
      SELECT u."id", p."id"
      FROM "users" u
      CROSS JOIN "permissions" p
      WHERE u."roleId" IN (SELECT "id" FROM "roles" WHERE "slug" = 'admin')
        AND p."slug" = 'screens'
        AND NOT EXISTS (
          SELECT 1 FROM "user_permissions" up
          WHERE up."userId" = u."id" AND up."permissionId" = p."id"
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_permissions"
      WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "slug" = 'screens')
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "slug" = 'screens'
    `);
    await queryRunner.query(`DROP TABLE "screens"`);
  }
}
