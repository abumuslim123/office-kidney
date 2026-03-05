import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCallClientPhone1741300000000 implements MigrationInterface {
  name = 'AddCallClientPhone1741300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "clientPhone" varchar(30) DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calls" DROP COLUMN IF EXISTS "clientPhone"`,
    );
  }
}
