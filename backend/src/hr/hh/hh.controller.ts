import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { HhService } from './hh.service';

/** Public callback — no JWT required (user arrives from hh.ru redirect) */
@Controller('hr/hh/oauth')
export class HhOAuthCallbackController {
  constructor(private readonly hhService: HhService) {}

  private get frontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  @Get('callback')
  async oauthCallback(@Query('code') code: string, @Res() res: Response) {
    const base = this.frontendUrl;
    if (!code) {
      return res.redirect(`${base}/hr/hunter?error=no_code`);
    }
    try {
      await this.hhService.exchangeCode(code);
      return res.redirect(`${base}/hr/hunter?connected=true`);
    } catch {
      return res.redirect(`${base}/hr/hunter?error=auth_failed`);
    }
  }
}

/** Protected endpoints — require JWT + hr permission */
@Controller('hr/hh')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('hr')
export class HhController {
  constructor(private readonly hhService: HhService) {}

  @Get('auth-url')
  getOAuthUrl() {
    return { url: this.hhService.getAuthorizationUrl() };
  }

  @Get('status')
  getStatus() {
    return this.hhService.getStatus();
  }

  @Post('disconnect')
  async disconnect() {
    await this.hhService.disconnect();
    return { ok: true };
  }

  @Get('me')
  getMe() {
    return this.hhService.getMe();
  }

  @Get('vacancies')
  getVacancies(@Query('page') page?: string, @Query('per_page') perPage?: string) {
    return this.hhService.getVacancies({
      page: page ? parseInt(page, 10) : undefined,
      per_page: perPage ? parseInt(perPage, 10) : undefined,
    });
  }

  @Get('vacancies/:id')
  getVacancy(@Param('id') id: string) {
    return this.hhService.getVacancy(id);
  }

  @Get('vacancies/:id/stats')
  getVacancyStats(@Param('id') id: string) {
    return this.hhService.getVacancyStats(id);
  }

  @Get('negotiations')
  getNegotiations(@Query('page') page?: string, @Query('per_page') perPage?: string) {
    return this.hhService.getNegotiations({
      page: page ? parseInt(page, 10) : undefined,
      per_page: perPage ? parseInt(perPage, 10) : undefined,
    });
  }
}
