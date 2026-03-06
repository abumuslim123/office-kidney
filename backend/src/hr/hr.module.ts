import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { HrFolder } from './entities/hr-folder.entity';
import { HrList } from './entities/hr-list.entity';
import { HrFieldDefinition } from './entities/hr-field-definition.entity';
import { HrEntry } from './entities/hr-entry.entity';
import { HrEvent } from './entities/hr-event.entity';
import { HrEventsShare } from './entities/hr-events-share.entity';
import { HrService } from './hr.service';
import { HrController } from './hr.controller';
import { HrPublicController } from './hr-public.controller';
import { HrListsPublicController } from './hr-lists-public.controller';
import { HhController, HhOAuthCallbackController } from './hh/hh.controller';
import { HhService } from './hh/hh.service';
import { AppSetting } from '../settings/entities/app-setting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([HrFolder, HrList, HrFieldDefinition, HrEntry, HrEvent, HrEventsShare, AppSetting]),
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [HhOAuthCallbackController, HrController, HrPublicController, HrListsPublicController, HhController],
  providers: [HrService, HhService],
  exports: [HrService],
})
export class HrModule {}
