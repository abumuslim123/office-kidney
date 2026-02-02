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
import { AddHrFolders1738425600000 } from './migrations/1738425600000-AddHrFolders';
import { AddHrDetailPermissions1738512000000 } from './migrations/1738512000000-AddHrDetailPermissions';
import { AddHrDeleteAllAndManageFields1738598400000 } from './migrations/1738598400000-AddHrDeleteAllAndManageFields';
import { AddHrEvents1738684800000 } from './migrations/1738684800000-AddHrEvents';
import { AddHrEventsEndDate1738771200000 } from './migrations/1738771200000-AddHrEventsEndDate';
import { AddHrEventsShare1738771300000 } from './migrations/1738771300000-AddHrEventsShare';
import { AddHrEventsColor1738771400000 } from './migrations/1738771400000-AddHrEventsColor';
import { AddHrListsShare1738771500000 } from './migrations/1738771500000-AddHrListsShare';
import { ListSharePerList1738771600000 } from './migrations/1738771600000-ListSharePerList';

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
      migrations: [InitialSchema1738166400000, AddPermissions1738252800000, AddHrTables1738339200000, AddHrFolders1738425600000, AddHrDetailPermissions1738512000000, AddHrDeleteAllAndManageFields1738598400000, AddHrEvents1738684800000, AddHrEventsEndDate1738771200000, AddHrEventsShare1738771300000, AddHrEventsColor1738771400000, AddHrListsShare1738771500000, ListSharePerList1738771600000],
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
