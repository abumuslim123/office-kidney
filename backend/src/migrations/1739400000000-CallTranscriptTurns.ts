import { MigrationInterface, QueryRunner } from 'typeorm';

export class CallTranscriptTurns1739400000000 implements MigrationInterface {
  name = 'CallTranscriptTurns1739400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "call_transcripts"
      ADD "turns" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "call_transcripts"
      DROP COLUMN "turns"
    `);
  }
}
