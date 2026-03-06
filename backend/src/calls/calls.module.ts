import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Call } from './entities/call.entity';
import { CallTranscript } from './entities/call-transcript.entity';
import { CallTopic } from './entities/call-topic.entity';
import { CallTopicMatch } from './entities/call-topic-match.entity';
import { CallDictionaryEntry } from './entities/call-dictionary-entry.entity';
import { CallSpeaker } from './entities/call-speaker.entity';
import { AppSetting } from '../settings/entities/app-setting.entity';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { AitunnelAudioService } from './aitunnel-audio.service';
import { TritechAudioService } from './tritech-audio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Call, CallTranscript, CallTopic, CallTopicMatch, CallDictionaryEntry, CallSpeaker, AppSetting]),
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [CallsController],
  providers: [CallsService, AitunnelAudioService, TritechAudioService],
})
export class CallsModule {}
