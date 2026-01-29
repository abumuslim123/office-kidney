import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrTables1738339200000 implements MigrationInterface {
  name = 'AddHrTables1738339200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // HR Lists
    await queryRunner.query(`
      CREATE TABLE "hr_lists" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "year" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hr_lists_id" PRIMARY KEY ("id")
      )
    `);

    // HR Field Definitions
    await queryRunner.query(`
      CREATE TABLE "hr_field_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "listId" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "fieldType" character varying(50) NOT NULL,
        "options" jsonb,
        "order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_hr_field_definitions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hr_field_definitions_listId" FOREIGN KEY ("listId") REFERENCES "hr_lists"("id") ON DELETE CASCADE
      )
    `);

    // HR Entries
    await queryRunner.query(`
      CREATE TABLE "hr_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "listId" uuid NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hr_entries_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hr_entries_listId" FOREIGN KEY ("listId") REFERENCES "hr_lists"("id") ON DELETE CASCADE
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_hr_lists_year" ON "hr_lists" ("year")`);
    await queryRunner.query(`CREATE INDEX "IDX_hr_field_definitions_listId" ON "hr_field_definitions" ("listId")`);
    await queryRunner.query(`CREATE INDEX "IDX_hr_entries_listId" ON "hr_entries" ("listId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hr_entries_listId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hr_field_definitions_listId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hr_lists_year"`);
    await queryRunner.query(`DROP TABLE "hr_entries"`);
    await queryRunner.query(`DROP TABLE "hr_field_definitions"`);
    await queryRunner.query(`DROP TABLE "hr_lists"`);
  }
}
