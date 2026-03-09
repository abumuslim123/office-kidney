import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCallsMissingColumns1741400000000 implements MigrationInterface {
  name = 'AddCallsMissingColumns1741400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // calls.isFavorite
    await queryRunner.query(
      `ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "isFavorite" boolean NOT NULL DEFAULT false`,
    );

    // call_transcripts.dictionaryApplied
    await queryRunner.query(
      `ALTER TABLE "call_transcripts" ADD COLUMN IF NOT EXISTS "dictionaryApplied" jsonb DEFAULT NULL`,
    );

    // call_dictionary_entries table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "call_dictionary_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "originalWord" character varying(200) NOT NULL,
        "correctedWord" character varying(200) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_call_dictionary_entries_id" PRIMARY KEY ("id")
      )
    `);

    // call_speakers table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "call_speakers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "tritechModelId" character varying(200),
        "status" character varying(30) NOT NULL DEFAULT 'pending',
        "description" character varying(500),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_call_speakers_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "call_speakers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "call_dictionary_entries"`);
    await queryRunner.query(
      `ALTER TABLE "call_transcripts" DROP COLUMN IF EXISTS "dictionaryApplied"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calls" DROP COLUMN IF EXISTS "isFavorite"`,
    );
  }
}
