import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ResumeService } from './resume.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ResumeService);
  const intervalMs = parseInt(
    process.env.RESUME_WORKER_INTERVAL_MS || '10000',
    10,
  );
  const batchSize = parseInt(
    process.env.RESUME_WORKER_BATCH_SIZE || '20',
    10,
  );

  console.log(
    `Resume worker started (interval: ${intervalMs}ms, batch: ${batchSize})`,
  );

  while (true) {
    try {
      const processed = await service.processPendingCandidates(batchSize);
      if (processed > 0) {
        console.log(`Processed ${processed} candidates`);
      }
    } catch (error) {
      console.error('Worker error:', error);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

bootstrap().catch(console.error);
