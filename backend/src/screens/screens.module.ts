import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Screen } from './entities/screen.entity';
import { ScreenPhoto } from './entities/screen-photo.entity';
import { AppSetting } from '../settings/entities/app-setting.entity';
import { ScreensService } from './screens.service';
import { ScreensController } from './screens.controller';
import { ScreensPublicController } from './screens-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Screen, ScreenPhoto, AppSetting]),
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [ScreensController, ScreensPublicController],
  providers: [ScreensService],
  exports: [ScreensService],
})
export class ScreensModule {}
