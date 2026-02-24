import { MigrationInterface, QueryRunner } from 'typeorm';

export class CallTranscriptOperatorAbonent1739300000000 implements MigrationInterface {
  name = 'CallTranscriptOperatorAbonent1739300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "call_transcripts"
      ADD "operatorText" text,
      ADD "abonentText" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "call_transcripts"
      DROP COLUMN "operatorText",
      DROP COLUMN "abonentText"
    `);
  }
}
