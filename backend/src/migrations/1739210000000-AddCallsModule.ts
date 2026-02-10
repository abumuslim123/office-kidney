import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCallsModule1739210000000 implements MigrationInterface {
  name = 'AddCallsModule1739210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "calls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "employeeName" character varying(200) NOT NULL,
        "clientName" character varying(200),
        "callAt" TIMESTAMP NOT NULL DEFAULT now(),
        "durationSeconds" integer NOT NULL DEFAULT 0,
        "speechDurationSeconds" integer NOT NULL DEFAULT 0,
        "silenceDurationSeconds" integer NOT NULL DEFAULT 0,
        "audioPath" character varying(500) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'uploaded',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_calls_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "call_transcripts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "callId" uuid NOT NULL,
        "text" text NOT NULL,
        "language" character varying(20),
        "provider" character varying(50) NOT NULL DEFAULT 'polza',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_call_transcripts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_call_transcripts_callId" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "call_topics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "keywords" jsonb NOT NULL DEFAULT '[]',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_call_topics_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "call_topic_matches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "callId" uuid NOT NULL,
        "topicId" uuid NOT NULL,
        "keyword" character varying(200) NOT NULL,
        "occurrences" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_call_topic_matches_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_call_topic_matches_callId" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_call_topic_matches_topicId" FOREIGN KEY ("topicId") REFERENCES "call_topics"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_calls_callAt" ON "calls" ("callAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_calls_employeeName" ON "calls" ("employeeName")`);
    await queryRunner.query(`CREATE INDEX "IDX_calls_status" ON "calls" ("status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_call_transcripts_callId" ON "call_transcripts" ("callId")`);
    await queryRunner.query(`CREATE INDEX "IDX_call_topic_matches_callId" ON "call_topic_matches" ("callId")`);
    await queryRunner.query(`CREATE INDEX "IDX_call_topic_matches_topicId" ON "call_topic_matches" ("topicId")`);

    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "slug", "name") VALUES
        (uuid_generate_v4(), 'calls', 'Звонки'),
        (uuid_generate_v4(), 'calls_manage_topics', 'Тематики звонков')
      ON CONFLICT ("slug") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "user_permissions" ("userId", "permissionId")
      SELECT u."id", p."id"
      FROM "users" u
      CROSS JOIN "permissions" p
      WHERE u."roleId" IN (SELECT "id" FROM "roles" WHERE "slug" = 'admin')
        AND p."slug" IN ('calls', 'calls_manage_topics')
        AND NOT EXISTS (
          SELECT 1 FROM "user_permissions" up
          WHERE up."userId" = u."id" AND up."permissionId" = p."id"
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_permissions"
      WHERE "permissionId" IN (
        SELECT "id" FROM "permissions" WHERE "slug" IN ('calls', 'calls_manage_topics')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "slug" IN ('calls', 'calls_manage_topics')
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_call_topic_matches_topicId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_call_topic_matches_callId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_call_transcripts_callId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_calls_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_calls_employeeName"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_calls_callAt"`);
    await queryRunner.query(`DROP TABLE "call_topic_matches"`);
    await queryRunner.query(`DROP TABLE "call_topics"`);
    await queryRunner.query(`DROP TABLE "call_transcripts"`);
    await queryRunner.query(`DROP TABLE "calls"`);
  }
}
