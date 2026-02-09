import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScreensPhotos1738872000000 implements MigrationInterface {
  name = 'AddScreensPhotos1738872000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "screens_photos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "screenId" uuid NOT NULL,
        "imagePath" character varying(500) NOT NULL,
        "durationSeconds" integer NOT NULL DEFAULT 15,
        "rotation" integer NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP,
        "orderIndex" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_screens_photos_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_screens_photos_screen" FOREIGN KEY ("screenId") REFERENCES "screens"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_screens_photos_screenId" ON "screens_photos" ("screenId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_screens_photos_screenId"`);
    await queryRunner.query(`DROP TABLE "screens_photos"`);
  }
}
