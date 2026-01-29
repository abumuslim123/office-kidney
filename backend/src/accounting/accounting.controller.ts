import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AccountingService } from './accounting.service';

@Controller('accounting')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('accounting')
export class AccountingController {
  constructor(private accounting: AccountingService) {}

  @Get()
  list() {
    return this.accounting.getPlaceholder();
  }
}
