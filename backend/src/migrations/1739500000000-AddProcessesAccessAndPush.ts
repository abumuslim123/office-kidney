import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessesAccessAndPush1739500000000
  implements MigrationInterface
{
  name = 'AddProcessesAccessAndPush1739500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "process_department_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "departmentId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_process_department_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_process_department_users_department_user" UNIQUE ("departmentId", "userId"),
        CONSTRAINT "FK_process_department_users_departmentId" FOREIGN KEY ("departmentId") REFERENCES "process_departments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_process_department_users_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_process_department_users_departmentId" ON "process_department_users" ("departmentId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_process_department_users_userId" ON "process_department_users" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE "user_push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "endpoint" character varying(1000) NOT NULL,
        "p256dh" character varying(255) NOT NULL,
        "auth" character varying(255) NOT NULL,
        "userAgent" character varying(500),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_push_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_push_subscriptions_endpoint" UNIQUE ("endpoint"),
        CONSTRAINT "FK_user_push_subscriptions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_push_subscriptions_userId" ON "user_push_subscriptions" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE "process_read_state" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "processId" uuid NOT NULL,
        "lastReadVersion" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_process_read_state_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_process_read_state_user_process" UNIQUE ("userId", "processId"),
        CONSTRAINT "FK_process_read_state_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_process_read_state_processId" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_process_read_state_userId" ON "process_read_state" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_process_read_state_processId" ON "process_read_state" ("processId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_process_read_state_processId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_process_read_state_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "process_read_state"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_push_subscriptions_userId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_push_subscriptions"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_process_department_users_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_process_department_users_departmentId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "process_department_users"`);
  }
}
