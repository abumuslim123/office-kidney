import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrEventsColor1738771400000 implements MigrationInterface {
  name = 'AddHrEventsColor1738771400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hr_events"
      ADD COLUMN "color" character varying(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hr_events"
      DROP COLUMN "color"
    `);
  }
}
