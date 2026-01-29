import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AccountingModule } from './accounting/accounting.module';
import { AgentsModule } from './agents/agents.module';
import { ServicesModule } from './services/services.module';
import { HrModule } from './hr/hr.module';
import { UsersService } from './users/users.service';
import { InitialSchema1738166400000 } from './migrations/1738166400000-InitialSchema';
import { AddPermissions1738252800000 } from './migrations/1738252800000-AddPermissions';
import { AddHrTables1738339200000 } from './migrations/1738339200000-AddHrTables';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'kidney_office',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      migrations: [InitialSchema1738166400000, AddPermissions1738252800000, AddHrTables1738339200000],
      migrationsRun: false,
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    AccountingModule,
    AgentsModule,
    ServicesModule,
    HrModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private users: UsersService) {}

  async onModuleInit() {
    await this.users.seedRolesIfEmpty();
    await this.users.seedPermissionsIfEmpty();
    await this.users.seedAdminIfConfigured();
  }
}
