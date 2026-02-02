import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { HrService } from './hr.service';

@Controller('public/lists')
export class HrListsPublicController {
  constructor(private hr: HrService) {}

  @Get(':token')
  async getList(@Param('token') token: string) {
    const list = await this.hr.findListByShareToken(token);
    if (!list) {
      throw new NotFoundException('Доступ отключён или ссылка недействительна');
    }
    return list;
  }

  @Get(':token/entries')
  async getEntries(
    @Param('token') token: string,
    @Query('search') search?: string,
    @Query() query?: Record<string, string>,
  ) {
    const list = await this.hr.findListByShareToken(token);
    if (!list) {
      throw new NotFoundException('Доступ отключён или ссылка недействительна');
    }
    const filters: Record<string, string> = {};
    for (const [key, value] of Object.entries(query || {})) {
      if (key.startsWith('f_') && key.length > 2) {
        filters[key.slice(2)] = value;
      }
    }
    return this.hr.findEntriesByList(list.id, filters, search);
  }
}
