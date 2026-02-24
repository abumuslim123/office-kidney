import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Bitrix24Service } from './bitrix24.service';
import { UpdateBitrix24SettingsDto } from './dto/update-bitrix24-settings.dto';

@Controller('bitrix24')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('bitrix24')
export class Bitrix24Controller {
  constructor(private bitrix24: Bitrix24Service) {}

  @Get('settings')
  async getSettings() {
    return this.bitrix24.getSettings();
  }

  @Put('settings')
  async updateSettings(@Body() dto: UpdateBitrix24SettingsDto) {
    return this.bitrix24.updateSettings({ webhookUrl: dto.webhookUrl });
  }

  @Get('lists/:listId/elements')
  async getListElements(
    @Param('listId') listId: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('search') search?: string,
  ) {
    if (!listId) throw new BadRequestException('listId required');
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '25', 10) || 25));
    const start = (page - 1) * limit;
    const { elements, total } = await this.bitrix24.getListElements(listId, {
      start,
      limit,
      search: search?.trim() || undefined,
    });
    return { elements, total, page, limit };
  }

  @Post('lists/:listId/elements')
  async addListElement(
    @Param('listId') listId: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (!listId) throw new BadRequestException('listId required');
    const result = await this.bitrix24.addListElement(listId, body);
    return { result };
  }

  @Delete('lists/:listId/elements/:elementId')
  async deleteListElement(
    @Param('listId') listId: string,
    @Param('elementId') elementId: string,
  ) {
    if (!listId || !elementId) throw new BadRequestException('listId and elementId required');
    await this.bitrix24.deleteListElement(listId, elementId);
    return { success: true };
  }
}
