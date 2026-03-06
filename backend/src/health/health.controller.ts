import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get()
  check() {
    return this.health.check();
  }

  @Get('backup-status')
  @UseGuards(JwtAuthGuard)
  backupStatus() {
    return this.health.backupStatus();
  }
}
