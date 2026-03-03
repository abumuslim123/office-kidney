import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCallTranscriptWords1741200000000 implements MigrationInterface {
  name = 'AddCallTranscriptWords1741200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "call_transcripts" ADD COLUMN IF NOT EXISTS "words" jsonb DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "call_transcripts" DROP COLUMN IF EXISTS "words"`,
    );
  }
}
