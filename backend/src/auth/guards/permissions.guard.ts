import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../../users/entities/user.entity';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const classPerms =
      this.reflector.get<string[]>(PERMISSIONS_KEY, context.getClass()) || [];
    const methodPerms =
      this.reflector.get<string[]>(PERMISSIONS_KEY, context.getHandler()) || [];
    const requiredPermissions = [...new Set([...classPerms, ...methodPerms])];
    if (!requiredPermissions.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user: User }>();
    if (!user?.permissions?.length) return false;

    const userPermissionSlugs = user.permissions.map((p) => p.slug);
    return requiredPermissions.every((perm) =>
      userPermissionSlugs.includes(perm),
    );
  }
}
