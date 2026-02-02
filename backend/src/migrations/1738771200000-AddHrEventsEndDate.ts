import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrEventsEndDate1738771200000 implements MigrationInterface {
  name = 'AddHrEventsEndDate1738771200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hr_events"
      ADD COLUMN "endDate" date
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hr_events"
      DROP COLUMN "endDate"
    `);
  }
}
