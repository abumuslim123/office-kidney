import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLogin1738950000000 implements MigrationInterface {
  name = 'AddUserLogin1738950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "login" character varying`);
    await queryRunner.query(`UPDATE "users" SET "login" = "email"`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "login" SET NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_login" ON "users" ("login")`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_email"`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email") WHERE "email" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_email"`);
    await queryRunner.query(`UPDATE "users" SET "email" = "login" WHERE "email" IS NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email")`);
    await queryRunner.query(`DROP INDEX "UQ_users_login"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "login"`);
  }
}
