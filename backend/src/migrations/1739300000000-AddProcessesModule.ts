import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessesModule1739300000000 implements MigrationInterface {
  name = 'AddProcessesModule1739300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "process_departments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "parentId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_process_departments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_process_departments_parentId" FOREIGN KEY ("parentId") REFERENCES "process_departments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_process_departments_parentId" ON "process_departments" ("parentId")`);

    await queryRunner.query(`
      CREATE TABLE "processes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "departmentId" uuid NOT NULL,
        "title" character varying(300) NOT NULL,
        "currentDescriptionDoc" jsonb NOT NULL DEFAULT '{}',
        "createdById" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_processes_departmentId" FOREIGN KEY ("departmentId") REFERENCES "process_departments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_processes_createdById" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_processes_departmentId" ON "processes" ("departmentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_processes_createdById" ON "processes" ("createdById")`);

    await queryRunner.query(`
      CREATE TABLE "process_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "processId" uuid NOT NULL,
        "path" character varying(500) NOT NULL,
        "originalName" character varying(255) NOT NULL,
        "mimeType" character varying(120) NOT NULL,
        "size" integer NOT NULL,
        "uploadedById" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_process_attachments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_process_attachments_processId" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_process_attachments_uploadedById" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_process_attachments_processId" ON "process_attachments" ("processId")`);

    await queryRunner.query(`
      CREATE TABLE "process_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "processId" uuid NOT NULL,
        "version" integer NOT NULL,
        "descriptionDoc" jsonb NOT NULL,
        "diffData" jsonb,
        "diffDataCorrections" jsonb NOT NULL DEFAULT '[]',
        "changedById" uuid NOT NULL,
        "changedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_process_versions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_process_versions_processId" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_process_versions_changedById" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_process_versions_processId" ON "process_versions" ("processId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_process_versions_processId_version" ON "process_versions" ("processId", "version")`);

    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'processes_view', 'Процессы: просмотр'),
        (uuid_generate_v4(), 'processes_edit', 'Процессы: редактирование')
      ON CONFLICT ("slug") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "user_permissions" ("userId", "permissionId")
      SELECT u."id", p."id"
      FROM "users" u
      CROSS JOIN "permissions" p
      WHERE u."roleId" IN (SELECT "id" FROM "roles" WHERE "slug" = 'admin')
        AND p."slug" IN ('processes_view', 'processes_edit')
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
        SELECT "id" FROM "permissions" WHERE "slug" IN ('processes_view', 'processes_edit')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "slug" IN ('processes_view', 'processes_edit')
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_process_versions_processId_version"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_process_versions_processId"`);
    await queryRunner.query(`DROP TABLE "process_versions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_process_attachments_processId"`);
    await queryRunner.query(`DROP TABLE "process_attachments"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_processes_createdById"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_processes_departmentId"`);
    await queryRunner.query(`DROP TABLE "processes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_process_departments_parentId"`);
    await queryRunner.query(`DROP TABLE "process_departments"`);
  }
}
