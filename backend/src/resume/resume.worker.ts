import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ResumeService } from './resume.service';

async function bootstrap() {
  const isEnabled = (process.env.RESUME_MODULE_ENABLED || 'true').toLowerCase();
  if (['0', 'false', 'off'].includes(isEnabled)) {
    console.log('[resume-worker] skipped because RESUME_MODULE_ENABLED=false');
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const resumeService = app.get(ResumeService);
  const intervalMs = Math.max(1000, parseInt(process.env.RESUME_WORKER_INTERVAL_MS || '10000', 10));
  const batchSize = Math.max(1, Math.min(100, parseInt(process.env.RESUME_WORKER_BATCH_SIZE || '20', 10)));

  console.log(`[resume-worker] started: interval=${intervalMs}ms batch=${batchSize}`);

  while (true) {
    try {
      const processed = await resumeService.processPendingCandidates(batchSize);
      if (processed > 0) {
        console.log(`[resume-worker] processed candidates: ${processed}`);
      }
    } catch (error) {
      console.error('[resume-worker] iteration error:', error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

bootstrap().catch((error) => {
  console.error('[resume-worker] fatal error:', error);
  process.exit(1);
});
