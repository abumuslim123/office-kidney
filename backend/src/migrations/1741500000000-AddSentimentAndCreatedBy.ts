import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSentimentAndCreatedBy1741500000000
  implements MigrationInterface
{
  name = 'AddSentimentAndCreatedBy1741500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "call_transcripts" ADD COLUMN IF NOT EXISTS "sentiment" jsonb DEFAULT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "call_topics" ADD COLUMN IF NOT EXISTS "createdBy" character varying(200) DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "call_topics" DROP COLUMN IF EXISTS "createdBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "call_transcripts" DROP COLUMN IF EXISTS "sentiment"`,
    );
  }
}
