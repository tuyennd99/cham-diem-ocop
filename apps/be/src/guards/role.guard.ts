import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, StaffPermission } from '@prisma/client';
import type { Request } from 'express';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../types/auth';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { effectiveStaffPermissions, effectiveUserRoles } from '../utils/staff-permissions';

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
    const permissions = this.reflector.getAllAndOverride<StaffPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required?.length && !adminOnly && !permissions?.length) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: AuthenticatedPrincipal }>().user;
    if (!user) {
      throw new ForbiddenException('Insufficient role');
    }
    const userPerms = effectiveStaffPermissions(user);
    const userRoles = effectiveUserRoles(user);
    const isAdmin = userPerms.includes(StaffPermission.MANAGE);

    if (adminOnly && !isAdmin) {
      throw new ForbiddenException('Insufficient role');
    }
    if (required?.length) {
      const hasRequiredRole = required.some((role) => userRoles.includes(role));
      if (!hasRequiredRole) {
        throw new ForbiddenException('Insufficient role');
      }
    }
    if (permissions?.some((permission) => !userPerms.includes(permission))) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
