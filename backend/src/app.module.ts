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
import { InitialSchema1738166400000 } from './migrations/1738166400000-InitialSchema';
import { AddPermissions1738252800000 } from './migrations/1738252800000-AddPermissions';
import { AddHrTables1738339200000 } from './migrations/1738339200000-AddHrTables';
import { AddHrFolders1738425600000 } from './migrations/1738425600000-AddHrFolders';
import { AddHrDetailPermissions1738512000000 } from './migrations/1738512000000-AddHrDetailPermissions';
import { AddHrDeleteAllAndManageFields1738598400000 } from './migrations/1738598400000-AddHrDeleteAllAndManageFields';
import { AddHrEvents1738684800000 } from './migrations/1738684800000-AddHrEvents';
import { AddHrEventsEndDate1738771200000 } from './migrations/1738771200000-AddHrEventsEndDate';
import { AddHrEventsShare1738771300000 } from './migrations/1738771300000-AddHrEventsShare';
import { AddHrEventsColor1738771400000 } from './migrations/1738771400000-AddHrEventsColor';
import { AddHrListsShare1738771500000 } from './migrations/1738771500000-AddHrListsShare';
import { ListSharePerList1738771600000 } from './migrations/1738771600000-ListSharePerList';
import { AddScreensModule1738771800000 } from './migrations/1738771800000-AddScreensModule';
import { AddUserLogin1738950000000 } from './migrations/1738950000000-AddUserLogin';
import { AddAppSettings1738953600000 } from './migrations/1738953600000-AddAppSettings';
import { RemoveAccountingPermission1738953700000 } from './migrations/1738953700000-RemoveAccountingPermission';
import { AddBitrix24Permission1738953800000 } from './migrations/1738953800000-AddBitrix24Permission';
import { AddCallsModule1739210000000 } from './migrations/1739210000000-AddCallsModule';
import { AddCallsSettingsPermissions1739211000000 } from './migrations/1739211000000-AddCallsSettingsPermissions';
import { CallsModule } from './calls/calls.module';
import { AddProcessesModule1739300000000 } from './migrations/1739300000000-AddProcessesModule';
import { AddProcessesAccessAndPush1739500000000 } from './migrations/1739500000000-AddProcessesAccessAndPush';
import { AddProcessActivityLog1739600000000 } from './migrations/1739600000000-AddProcessActivityLog';
import { AddProcessesApprovePermission1739700000000 } from './migrations/1739700000000-AddProcessesApprovePermission';
import { AddProcessVersionChecklist1739800000000 } from './migrations/1739800000000-AddProcessVersionChecklist';
import { ProcessesModule } from './processes/processes.module';
import { AddResumeModule1741000000000 } from './migrations/1741000000000-AddResumeModule';
import { AddResumePermissions1741000001000 } from './migrations/1741000001000-AddResumePermissions';
import { ResumeModule } from './resume/resume.module';
import { HunterModule } from './hunter/hunter.module';

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
      migrations: [InitialSchema1738166400000, AddPermissions1738252800000, AddHrTables1738339200000, AddHrFolders1738425600000, AddHrDetailPermissions1738512000000, AddHrDeleteAllAndManageFields1738598400000, AddHrEvents1738684800000, AddHrEventsEndDate1738771200000, AddHrEventsShare1738771300000, AddHrEventsColor1738771400000, AddHrListsShare1738771500000, ListSharePerList1738771600000, AddScreensModule1738771800000, AddUserLogin1738950000000, AddAppSettings1738953600000, RemoveAccountingPermission1738953700000, AddBitrix24Permission1738953800000, AddCallsModule1739210000000, AddCallsSettingsPermissions1739211000000, AddProcessesModule1739300000000, AddProcessesAccessAndPush1739500000000, AddProcessActivityLog1739600000000, AddProcessesApprovePermission1739700000000, AddProcessVersionChecklist1739800000000, AddResumeModule1741000000000, AddResumePermissions1741000001000],
      migrationsRun: false,
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
    HunterModule,
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
