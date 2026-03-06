import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from '../settings/entities/app-setting.entity';
import { HunterService } from './hunter.service';
import { HunterController } from './hunter.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting])],
  controllers: [HunterController],
  providers: [HunterService],
  exports: [HunterService],
})
export class HunterModule {}
