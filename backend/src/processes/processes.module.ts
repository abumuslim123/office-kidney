import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessAttachment } from './entities/process-attachment.entity';
import { ProcessDepartment } from './entities/process-department.entity';
import { Process } from './entities/process.entity';
import { ProcessVersion } from './entities/process-version.entity';
import { ProcessesController } from './processes.controller';
import { ProcessesService } from './processes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessDepartment,
      Process,
      ProcessVersion,
      ProcessAttachment,
    ]),
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [ProcessesController],
  providers: [ProcessesService],
  exports: [ProcessesService],
})
export class ProcessesModule {}
