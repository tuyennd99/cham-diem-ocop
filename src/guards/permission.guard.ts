import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { UserStatus } from '@prisma/client';
import {
  EffectivePermissions,
  SystemRepository,
} from '../repositories/system.repository';
import { AccessTokenPayload } from '../types/auth';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly repository: SystemRepository,
  ) { }

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenPayload }>();
    if (!request.user) return true;

    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const effective = await this.repository.listEffectivePermissions(
      request.user.sub,
    );
    this.assertPermissions(effective, required);
    request.user.permissions = effective.permissions;
    request.user.organizationId = effective.organizationId;
    request.user.isAdmin = effective.isAdmin;
    delete (request.user as AccessTokenPayload & { isStaff?: boolean }).isStaff;
    return true;
  }

  assertPermissions(
    principal: EffectivePermissions | null,
    required: string[],
  ) {
    if (
      !principal ||
      principal.status !== UserStatus.ACTIVE ||
      (!principal.isAdmin &&
        required.some((code) => !principal.permissions.includes(code)))
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
