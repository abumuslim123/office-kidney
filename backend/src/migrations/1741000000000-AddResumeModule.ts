import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResumeModule1741000000000 implements MigrationInterface {
  name = 'AddResumeModule1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "resume_processing_status_enum" AS ENUM (
        'PENDING',
        'EXTRACTING',
        'PARSING',
        'COMPLETED',
        'FAILED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "resume_qualification_category_enum" AS ENUM (
        'HIGHEST',
        'FIRST',
        'SECOND',
        'NONE'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "resume_candidate_status_enum" AS ENUM (
        'NEW',
        'REVIEWING',
        'INVITED',
        'HIRED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "resume_candidate_priority_enum" AS ENUM (
        'ACTIVE',
        'RESERVE',
        'NOT_SUITABLE',
        'ARCHIVE',
        'DELETED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resume_uploaded_files" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "originalName" character varying(500) NOT NULL,
        "storedPath" character varying(1000) NOT NULL,
        "mimeType" character varying(255) NOT NULL,
        "sizeBytes" integer NOT NULL,
        CONSTRAINT "PK_resume_uploaded_files_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resume_candidates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "fullName" character varying(300) NOT NULL,
        "email" character varying,
        "phone" character varying,
        "birthDate" TIMESTAMP,
        "city" character varying,
        "university" character varying,
        "faculty" character varying,
        "graduationYear" integer,
        "internshipPlace" character varying,
        "internshipSpecialty" character varying,
        "internshipYearEnd" integer,
        "residencyPlace" character varying,
        "residencySpecialty" character varying,
        "residencyYearEnd" integer,
        "specialization" character varying,
        "additionalSpecializations" text[] NOT NULL DEFAULT '{}',
        "qualificationCategory" "resume_qualification_category_enum" NOT NULL DEFAULT 'NONE',
        "categoryAssignedDate" TIMESTAMP,
        "categoryExpiryDate" TIMESTAMP,
        "accreditationStatus" boolean NOT NULL DEFAULT false,
        "accreditationDate" TIMESTAMP,
        "accreditationExpiryDate" TIMESTAMP,
        "certificateNumber" character varying,
        "certificateIssueDate" TIMESTAMP,
        "certificateExpiryDate" TIMESTAMP,
        "totalExperienceYears" double precision,
        "specialtyExperienceYears" double precision,
        "nmoPoints" integer,
        "publications" text,
        "languages" text[] NOT NULL DEFAULT '{}',
        "additionalSkills" text,
        "branches" text[] NOT NULL DEFAULT '{}',
        "status" "resume_candidate_status_enum" NOT NULL DEFAULT 'NEW',
        "priority" "resume_candidate_priority_enum" NOT NULL DEFAULT 'ACTIVE',
        "processingStatus" "resume_processing_status_enum" NOT NULL DEFAULT 'PENDING',
        "processingError" text,
        "rawText" text,
        "aiConfidence" double precision,
        "uploadedFileId" uuid,
        CONSTRAINT "UQ_resume_candidates_uploadedFileId" UNIQUE ("uploadedFileId"),
        CONSTRAINT "PK_resume_candidates_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_candidates_uploadedFileId" FOREIGN KEY ("uploadedFileId")
          REFERENCES "resume_uploaded_files"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resume_work_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization" character varying(300) NOT NULL,
        "position" character varying(300) NOT NULL,
        "department" character varying,
        "city" character varying,
        "startDate" TIMESTAMP,
        "endDate" TIMESTAMP,
        "isCurrent" boolean NOT NULL DEFAULT false,
        "description" text,
        "candidateId" uuid NOT NULL,
        CONSTRAINT "PK_resume_work_history_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_work_history_candidateId" FOREIGN KEY ("candidateId")
          REFERENCES "resume_candidates"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resume_education" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "institution" character varying(300) NOT NULL,
        "faculty" character varying,
        "specialty" character varying,
        "degree" character varying,
        "city" character varying,
        "startYear" integer,
        "endYear" integer,
        "type" character varying,
        "candidateId" uuid NOT NULL,
        CONSTRAINT "PK_resume_education_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_education_candidateId" FOREIGN KEY ("candidateId")
          REFERENCES "resume_candidates"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resume_cme_courses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "courseName" character varying(400) NOT NULL,
        "provider" character varying,
        "completedAt" TIMESTAMP,
        "hours" integer,
        "nmoPoints" integer,
        "certificateNumber" character varying,
        "candidateId" uuid NOT NULL,
        CONSTRAINT "PK_resume_cme_courses_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_cme_courses_candidateId" FOREIGN KEY ("candidateId")
          REFERENCES "resume_candidates"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resume_candidate_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "content" text NOT NULL,
        "authorName" character varying(200) NOT NULL,
        "candidateId" uuid NOT NULL,
        CONSTRAINT "PK_resume_candidate_notes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_candidate_notes_candidateId" FOREIGN KEY ("candidateId")
          REFERENCES "resume_candidates"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resume_candidate_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" character varying(150) NOT NULL,
        "color" character varying,
        "candidateId" uuid NOT NULL,
        CONSTRAINT "PK_resume_candidate_tags_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_candidate_tags_candidateId" FOREIGN KEY ("candidateId")
          REFERENCES "resume_candidates"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resume_telegram_chats" (
        "chatId" bigint NOT NULL,
        "authorizedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "username" character varying,
        "firstName" character varying,
        CONSTRAINT "PK_resume_telegram_chats_chatId" PRIMARY KEY ("chatId")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_specialization" ON "resume_candidates" ("specialization")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_qualificationCategory" ON "resume_candidates" ("qualificationCategory")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_status" ON "resume_candidates" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_priority" ON "resume_candidates" ("priority")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_processingStatus" ON "resume_candidates" ("processingStatus")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_accreditationExpiryDate" ON "resume_candidates" ("accreditationExpiryDate")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_phone" ON "resume_candidates" ("phone")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_email" ON "resume_candidates" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_branches_gin" ON "resume_candidates" USING GIN ("branches")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_work_history_candidateId" ON "resume_work_history" ("candidateId")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_education_candidateId" ON "resume_education" ("candidateId")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_cme_courses_candidateId" ON "resume_cme_courses" ("candidateId")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidate_notes_candidateId" ON "resume_candidate_notes" ("candidateId")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidate_tags_candidateId" ON "resume_candidate_tags" ("candidateId")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidate_tags_label" ON "resume_candidate_tags" ("label")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidate_tags_label"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidate_tags_candidateId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidate_notes_candidateId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_cme_courses_candidateId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_education_candidateId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_work_history_candidateId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidates_branches_gin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidates_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidates_phone"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidates_accreditationExpiryDate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidates_processingStatus"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidates_priority"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidates_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidates_qualificationCategory"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_candidates_specialization"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "resume_telegram_chats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_candidate_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_candidate_notes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_cme_courses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_education"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_work_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_candidates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_uploaded_files"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "resume_candidate_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resume_candidate_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resume_qualification_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resume_processing_status_enum"`);
  }
}
