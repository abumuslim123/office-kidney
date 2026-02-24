import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AppSetting } from '../settings/entities/app-setting.entity';
import { ProcessAttachment } from './entities/process-attachment.entity';
import { ProcessActivityLog } from './entities/process-activity-log.entity';
import { ProcessDepartment } from './entities/process-department.entity';
import { ProcessDepartmentUser } from './entities/process-department-user.entity';
import { Process } from './entities/process.entity';
import { ProcessReadState } from './entities/process-read-state.entity';
import { ProcessVersion } from './entities/process-version.entity';
import { UserPushSubscription } from './entities/user-push-subscription.entity';
import { ChecklistAiService } from './checklist-ai.service';
import { ProcessesController } from './processes.controller';
import { PushNotificationsService } from './push-notifications.service';
import { ProcessesService } from './processes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessDepartment,
      ProcessDepartmentUser,
      Process,
      ProcessVersion,
      ProcessAttachment,
      ProcessActivityLog,
      ProcessReadState,
      UserPushSubscription,
      User,
      AppSetting,
    ]),
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [ProcessesController],
  providers: [ProcessesService, PushNotificationsService, ChecklistAiService],
  exports: [ProcessesService],
})
export class ProcessesModule {}
