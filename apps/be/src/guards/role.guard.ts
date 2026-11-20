import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, StaffPermission } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../types/auth';
import {
  PERMISSIONS_ANY_KEY,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import {
  effectiveStaffPermissions,
  effectiveUserRoles,
} from '../utils/staff-permissions';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const permissions = this.reflector.getAllAndOverride<StaffPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const permissionsAny = this.reflector.getAllAndOverride<StaffPermission[]>(
      PERMISSIONS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length && !permissions?.length && !permissionsAny?.length)
      return true;

    const user = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedPrincipal }>().user;
    if (!user) {
      throw new ForbiddenException('Insufficient role');
    }
    const userPerms = effectiveStaffPermissions(user);
    const userRoles = effectiveUserRoles(user);

    if (required?.length) {
      const hasRequiredRole = required.some((role) => userRoles.includes(role));
      if (!hasRequiredRole) {
        throw new ForbiddenException('Insufficient role');
      }
    }
    if (permissions?.some((permission) => !userPerms.includes(permission))) {
      throw new ForbiddenException('Insufficient role');
    }
    if (
      permissionsAny?.length &&
      !permissionsAny.some((permission) => userPerms.includes(permission))
    ) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
