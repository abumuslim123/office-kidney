import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResumeLeads1741500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "resume_lead_status" AS ENUM (
        'NEW', 'IN_PROGRESS', 'CONTACTED', 'CONVERTED', 'NOT_RELEVANT'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resume_leads" (
        "id"                    uuid        NOT NULL DEFAULT gen_random_uuid(),
        "createdAt"             timestamp   NOT NULL DEFAULT now(),
        "updatedAt"             timestamp   NOT NULL DEFAULT now(),
        "name"                  varchar,
        "phone"                 varchar,
        "email"                 varchar,
        "city"                  varchar,
        "specialization"        varchar,
        "source"                varchar,
        "notes"                 text,
        "status"                "resume_lead_status" NOT NULL DEFAULT 'NEW',
        "convertedCandidateId"  uuid,
        CONSTRAINT "PK_resume_leads" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_leads_candidate" FOREIGN KEY ("convertedCandidateId")
          REFERENCES "resume_candidates"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_resume_leads_status" ON "resume_leads" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_leads_phone" ON "resume_leads" ("phone")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_leads_email" ON "resume_leads" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_leads_specialization" ON "resume_leads" ("specialization")`);

    await queryRunner.query(`
      CREATE TABLE "resume_lead_tags" (
        "id"      uuid         NOT NULL DEFAULT gen_random_uuid(),
        "label"   varchar(100) NOT NULL,
        "color"   varchar(50),
        "leadId"  uuid         NOT NULL,
        CONSTRAINT "PK_resume_lead_tags" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_lead_tags_lead" FOREIGN KEY ("leadId")
          REFERENCES "resume_leads"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_resume_lead_tags_leadId" ON "resume_lead_tags" ("leadId")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_lead_tags_label" ON "resume_lead_tags" ("label")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_lead_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_leads"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resume_lead_status"`);
  }
}
