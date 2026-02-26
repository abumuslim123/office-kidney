import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ResumeController } from './resume.controller';
import { ResumePublicController } from './resume-public.controller';
import { ResumeService } from './resume.service';
import { ResumeCandidate } from './entities/resume-candidate.entity';
import { ResumeUploadedFile } from './entities/resume-uploaded-file.entity';
import { ResumeWorkHistory } from './entities/resume-work-history.entity';
import { ResumeEducation } from './entities/resume-education.entity';
import { ResumeCmeCourse } from './entities/resume-cme-course.entity';
import { ResumeCandidateNote } from './entities/resume-candidate-note.entity';
import { ResumeCandidateTag } from './entities/resume-candidate-tag.entity';
import { ResumeTelegramChat } from './entities/resume-telegram-chat.entity';
import { ResumeFeatureGuard } from './guards/resume-feature.guard';

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
  providers: [ResumeService, ResumeFeatureGuard],
  exports: [ResumeService],
})
export class ResumeModule {}
