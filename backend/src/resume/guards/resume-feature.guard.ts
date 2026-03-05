import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResumeFeatureGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const enabled = this.config.get<string>('RESUME_MODULE_ENABLED');
    if (enabled === 'false') {
      throw new NotFoundException('Resume module is disabled');
    }
    return true;
  }
}
