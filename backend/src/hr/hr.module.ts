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

@Module({
  imports: [
    TypeOrmModule.forFeature([HrFolder, HrList, HrFieldDefinition, HrEntry, HrEvent, HrEventsShare]),
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [HrController, HrPublicController, HrListsPublicController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
