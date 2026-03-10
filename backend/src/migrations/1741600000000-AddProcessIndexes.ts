import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessIndexes1741600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_process_versions_process_version"
        ON "process_versions" ("processId", "version")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_process_activity_log_process_date"
        ON "process_activity_log" ("processId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_processes_department"
        ON "processes" ("departmentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_processes_department"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_process_activity_log_process_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_process_versions_process_version"`);
  }
}
