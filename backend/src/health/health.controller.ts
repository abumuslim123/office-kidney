import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get()
  check() {
    return this.health.check();
  }
}
