import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResumeFeatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const raw = this.config.get<string>('RESUME_MODULE_ENABLED');
    const enabled = raw === undefined ? true : !['0', 'false', 'off'].includes(raw.toLowerCase());
    if (!enabled) {
      throw new NotFoundException('Resume module is disabled');
    }
    return true;
  }
}
