import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { HrService } from './hr.service';

@Controller('public/events-calendar')
export class HrPublicController {
  constructor(private hr: HrService) {}

  @Get(':token')
  async getEvents(
    @Param('token') token: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const enabled = await this.hr.isShareEnabled(token);
    if (!enabled) {
      throw new NotFoundException('Доступ отключён или ссылка недействительна');
    }
    if (!startDate || !endDate) {
      throw new NotFoundException('startDate and endDate are required');
    }
    return this.hr.findEventsByDateRange(startDate, endDate);
  }
}
