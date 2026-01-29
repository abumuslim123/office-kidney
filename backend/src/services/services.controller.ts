import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ServicesService } from './services.service';

@Controller('services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('services')
export class ServicesController {
  constructor(private services: ServicesService) {}

  @Get()
  list() {
    return this.services.getPlaceholder();
  }
}
