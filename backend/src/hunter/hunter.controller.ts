import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { HunterService } from './hunter.service';
import { HhCallbackDto } from './dto/hh-callback.dto';

@Controller('hunter')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('hr')
export class HunterController {
  constructor(private hunter: HunterService) {}

  @Get('status')
  async getStatus() {
    return this.hunter.getStatus();
  }

  @Get('auth-url')
  async getAuthUrl() {
    return this.hunter.getAuthUrl();
  }

  @Post('callback')
  async callback(@Body() dto: HhCallbackDto) {
    return this.hunter.exchangeCode(dto.code);
  }

  @Post('disconnect')
  async disconnect() {
    return this.hunter.disconnect();
  }

  @Get('dashboard')
  async getDashboard() {
    return this.hunter.getDashboard();
  }

  @Get('vacancies')
  async getVacancies() {
    return this.hunter.getVacancies();
  }

  @Get('vacancies/:id/negotiations')
  async getVacancyNegotiations(@Param('id') id: string) {
    return this.hunter.getVacancyNegotiations(id);
  }
}
