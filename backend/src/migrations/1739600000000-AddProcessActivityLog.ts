import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessActivityLog1739600000000 implements MigrationInterface {
  name = 'AddProcessActivityLog1739600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "process_activity_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "processId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "versionId" uuid,
        "actionType" character varying(64) NOT NULL,
        "meta" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_process_activity_log_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_process_activity_log_processId" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_process_activity_log_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_process_activity_log_versionId" FOREIGN KEY ("versionId") REFERENCES "process_versions"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_process_activity_log_process_createdAt" ON "process_activity_log" ("processId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_process_activity_log_user_createdAt" ON "process_activity_log" ("userId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_process_activity_log_actionType" ON "process_activity_log" ("actionType")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_process_activity_log_versionId" ON "process_activity_log" ("versionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_process_activity_log_versionId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_process_activity_log_actionType"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_process_activity_log_user_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_process_activity_log_process_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "process_activity_log"`);
  }
}
