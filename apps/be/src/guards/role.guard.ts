import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AccessTokenPayload } from '../types/auth';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required?.length && !adminOnly) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>().user;
    if (!user || (adminOnly && user.role !== Role.ADMIN) || (required?.length && !required.includes(user.role))) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
