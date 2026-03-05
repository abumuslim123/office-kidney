import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import helmet from 'helmet';
import { AppModule } from './app.module';

process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('unhandledRejection', reason, promise);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (process.env.NODE_ENV === 'production') {
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.set('trust proxy', 1);
    const dataSource = app.get(DataSource);
    await dataSource.runMigrations();
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const origins = frontendUrl.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Kidney Office API running on port ${port} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
}

bootstrap();
