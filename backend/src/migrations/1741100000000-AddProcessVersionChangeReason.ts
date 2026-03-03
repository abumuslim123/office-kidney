import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessVersionChangeReason1741100000000
  implements MigrationInterface
{
  name = 'AddProcessVersionChangeReason1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "process_versions"
      ADD COLUMN IF NOT EXISTS "changeReason" text DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "process_versions"
      DROP COLUMN IF EXISTS "changeReason"
    `);
  }
}
