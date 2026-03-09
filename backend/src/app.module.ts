import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AgentsModule } from './agents/agents.module';
import { ServicesModule } from './services/services.module';
import { HrModule } from './hr/hr.module';
import { ScreensModule } from './screens/screens.module';
import { Bitrix24Module } from './bitrix24/bitrix24.module';
import { UsersService } from './users/users.service';
import { CallsModule } from './calls/calls.module';
import { ProcessesModule } from './processes/processes.module';
import { ResumeModule } from './resume/resume.module';

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
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: true,
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    AgentsModule,
    ServicesModule,
    HrModule,
    ScreensModule,
    Bitrix24Module,
    CallsModule,
    ProcessesModule,
    ResumeModule,
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
