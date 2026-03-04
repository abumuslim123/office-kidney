import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ResumeCandidate } from './entities/resume-candidate.entity';
import { ResumeUploadedFile } from './entities/resume-uploaded-file.entity';
import { ResumeWorkHistory } from './entities/resume-work-history.entity';
import { ResumeEducation } from './entities/resume-education.entity';
import { ResumeCmeCourse } from './entities/resume-cme-course.entity';
import { ResumeCandidateNote } from './entities/resume-candidate-note.entity';
import { ResumeCandidateTag } from './entities/resume-candidate-tag.entity';
import { ResumeTelegramChat } from './entities/resume-telegram-chat.entity';
import { ResumeService } from './resume.service';
import { ResumeDuplicateDetectionService } from './resume-duplicate-detection.service';
import { ResumeController } from './resume.controller';
import { ResumePublicController } from './resume-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ResumeCandidate,
      ResumeUploadedFile,
      ResumeWorkHistory,
      ResumeEducation,
      ResumeCmeCourse,
      ResumeCandidateNote,
      ResumeCandidateTag,
      ResumeTelegramChat,
    ]),
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [ResumeController, ResumePublicController],
  providers: [ResumeService, ResumeDuplicateDetectionService],
  exports: [ResumeService],
})
export class ResumeModule {}
