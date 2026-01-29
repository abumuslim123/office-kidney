import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AgentsService } from './agents.service';

@Controller('agents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('agents')
export class AgentsController {
  constructor(private agents: AgentsService) {}

  @Get()
  list() {
    return this.agents.getPlaceholder();
  }
}
