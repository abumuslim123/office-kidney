import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from '../settings/entities/app-setting.entity';
import { Bitrix24Service } from './bitrix24.service';
import { Bitrix24Controller } from './bitrix24.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting])],
  controllers: [Bitrix24Controller],
  providers: [Bitrix24Service],
  exports: [Bitrix24Service],
})
export class Bitrix24Module {}
