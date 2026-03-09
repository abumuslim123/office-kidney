import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResumeModule1741000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "resume_processing_status" AS ENUM (
        'PENDING', 'EXTRACTING', 'PARSING', 'COMPLETED', 'FAILED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "resume_qualification_category" AS ENUM (
        'HIGHEST', 'FIRST', 'SECOND', 'NONE'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "resume_candidate_status" AS ENUM (
        'NEW', 'REVIEWING', 'INVITED', 'HIRED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "resume_candidate_priority" AS ENUM (
        'ACTIVE', 'RESERVE', 'NOT_SUITABLE', 'ARCHIVE', 'DELETED'
      )
    `);

    // Create resume_uploaded_files
    await queryRunner.query(`
      CREATE TABLE "resume_uploaded_files" (
        "id"           uuid        NOT NULL DEFAULT gen_random_uuid(),
        "createdAt"    timestamp   NOT NULL DEFAULT now(),
        "originalName" varchar(500) NOT NULL,
        "storedPath"   varchar(1000) NOT NULL,
        "mimeType"     varchar(100) NOT NULL,
        "sizeBytes"    integer      NOT NULL,
        CONSTRAINT "PK_resume_uploaded_files" PRIMARY KEY ("id")
      )
    `);

    // Create resume_candidates
    await queryRunner.query(`
      CREATE TABLE "resume_candidates" (
        "id"                        uuid        NOT NULL DEFAULT gen_random_uuid(),
        "createdAt"                 timestamp   NOT NULL DEFAULT now(),
        "updatedAt"                 timestamp   NOT NULL DEFAULT now(),
        "fullName"                  varchar     NOT NULL,
        "email"                     varchar,
        "phone"                     varchar,
        "birthDate"                 timestamp,
        "city"                      varchar,
        "university"                varchar,
        "faculty"                   varchar,
        "graduationYear"            integer,
        "internshipPlace"           varchar,
        "internshipSpecialty"       varchar,
        "internshipYearEnd"         integer,
        "residencyPlace"            varchar,
        "residencySpecialty"        varchar,
        "residencyYearEnd"          integer,
        "specialization"            varchar,
        "additionalSpecializations" text[]      NOT NULL DEFAULT '{}',
        "qualificationCategory"     "resume_qualification_category" NOT NULL DEFAULT 'NONE',
        "categoryAssignedDate"      timestamp,
        "categoryExpiryDate"        timestamp,
        "accreditationStatus"       boolean     NOT NULL DEFAULT false,
        "accreditationDate"         timestamp,
        "accreditationExpiryDate"   timestamp,
        "certificateNumber"         varchar,
        "certificateIssueDate"      timestamp,
        "certificateExpiryDate"     timestamp,
        "totalExperienceYears"      double precision,
        "specialtyExperienceYears"  double precision,
        "nmoPoints"                 integer,
        "publications"              text,
        "languages"                 text[]      NOT NULL DEFAULT '{}',
        "additionalSkills"          text,
        "branches"                  text[]      NOT NULL DEFAULT '{}',
        "status"                    "resume_candidate_status"  NOT NULL DEFAULT 'NEW',
        "priority"                  "resume_candidate_priority" NOT NULL DEFAULT 'ACTIVE',
        "processingStatus"          "resume_processing_status" NOT NULL DEFAULT 'PENDING',
        "processingError"           text,
        "rawText"                   text,
        "aiConfidence"              double precision,
        "uploadedFileId"            uuid        UNIQUE REFERENCES "resume_uploaded_files"("id") ON DELETE SET NULL,
        CONSTRAINT "PK_resume_candidates" PRIMARY KEY ("id")
      )
    `);

    // Indexes on resume_candidates
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_specialization"          ON "resume_candidates" ("specialization")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_qualificationCategory"   ON "resume_candidates" ("qualificationCategory")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_status"                 ON "resume_candidates" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_priority"               ON "resume_candidates" ("priority")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_branches"               ON "resume_candidates" USING GIN ("branches")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_processingStatus"       ON "resume_candidates" ("processingStatus")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_accreditationExpiryDate" ON "resume_candidates" ("accreditationExpiryDate")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_phone"                 ON "resume_candidates" ("phone")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidates_email"                 ON "resume_candidates" ("email")`);

    // Create resume_work_history
    await queryRunner.query(`
      CREATE TABLE "resume_work_history" (
        "id"           uuid        NOT NULL DEFAULT gen_random_uuid(),
        "organization" varchar(500) NOT NULL,
        "position"     varchar(500) NOT NULL,
        "department"   varchar,
        "city"         varchar,
        "startDate"    timestamp,
        "endDate"      timestamp,
        "isCurrent"    boolean     NOT NULL DEFAULT false,
        "description"  text,
        "candidateId"  uuid        NOT NULL REFERENCES "resume_candidates"("id") ON DELETE CASCADE,
        CONSTRAINT "PK_resume_work_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_resume_work_history_candidateId" ON "resume_work_history" ("candidateId")`);

    // Create resume_education
    await queryRunner.query(`
      CREATE TABLE "resume_education" (
        "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
        "institution" varchar(300) NOT NULL,
        "faculty"     varchar,
        "specialty"   varchar,
        "degree"      varchar,
        "city"        varchar,
        "startYear"   integer,
        "endYear"     integer,
        "type"        varchar,
        "candidateId" uuid        NOT NULL REFERENCES "resume_candidates"("id") ON DELETE CASCADE,
        CONSTRAINT "PK_resume_education" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_resume_education_candidateId" ON "resume_education" ("candidateId")`);

    // Create resume_cme_courses
    await queryRunner.query(`
      CREATE TABLE "resume_cme_courses" (
        "id"                uuid        NOT NULL DEFAULT gen_random_uuid(),
        "courseName"        varchar(500) NOT NULL,
        "provider"          varchar,
        "completedAt"       timestamp,
        "hours"             integer,
        "nmoPoints"         integer,
        "certificateNumber" varchar,
        "candidateId"       uuid        NOT NULL REFERENCES "resume_candidates"("id") ON DELETE CASCADE,
        CONSTRAINT "PK_resume_cme_courses" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_resume_cme_courses_candidateId" ON "resume_cme_courses" ("candidateId")`);

    // Create resume_candidate_notes
    await queryRunner.query(`
      CREATE TABLE "resume_candidate_notes" (
        "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
        "createdAt"   timestamp   NOT NULL DEFAULT now(),
        "updatedAt"   timestamp   NOT NULL DEFAULT now(),
        "content"     text        NOT NULL,
        "authorName"  varchar(200) NOT NULL,
        "candidateId" uuid        NOT NULL REFERENCES "resume_candidates"("id") ON DELETE CASCADE,
        CONSTRAINT "PK_resume_candidate_notes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidate_notes_candidateId" ON "resume_candidate_notes" ("candidateId")`);

    // Create resume_candidate_tags
    await queryRunner.query(`
      CREATE TABLE "resume_candidate_tags" (
        "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
        "label"       varchar(100) NOT NULL,
        "color"       varchar(50),
        "candidateId" uuid        NOT NULL REFERENCES "resume_candidates"("id") ON DELETE CASCADE,
        CONSTRAINT "PK_resume_candidate_tags" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidate_tags_candidateId" ON "resume_candidate_tags" ("candidateId")`);
    await queryRunner.query(`CREATE INDEX "IDX_resume_candidate_tags_label"       ON "resume_candidate_tags" ("label")`);

    // Create resume_telegram_chats
    await queryRunner.query(`
      CREATE TABLE "resume_telegram_chats" (
        "chatId"       bigint      NOT NULL,
        "authorizedAt" timestamp   NOT NULL DEFAULT now(),
        "username"     varchar,
        "firstName"    varchar,
        CONSTRAINT "PK_resume_telegram_chats" PRIMARY KEY ("chatId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_telegram_chats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_candidate_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_candidate_notes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_cme_courses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_education"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_work_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_candidates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_uploaded_files"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resume_candidate_priority"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resume_candidate_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resume_qualification_category"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resume_processing_status"`);
  }
}
