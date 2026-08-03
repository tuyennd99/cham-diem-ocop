import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { UserStatus } from '@prisma/client';
import { PERMISSION_LABELS } from '../constants/permission';
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
    const anyRequired =
      this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const effective = await this.repository.listEffectivePermissions(
      request.user.sub,
    );
    this.assertPermissions(effective, required, anyRequired);
    request.user.permissions = effective.permissions;
    request.user.organizationId = effective.organizationId;
    request.user.isAdmin = effective.isAdmin;
    delete (request.user as AccessTokenPayload & { isStaff?: boolean }).isStaff;
    return true;
  }

  assertPermissions(
    principal: EffectivePermissions | null,
    required: string[],
    anyRequired: string[] = [],
  ) {
    if (!principal || principal.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Insufficient permissions');
    }
    if (principal.isAdmin) return;
    const missing = required.filter(
      (code) => !principal.permissions.includes(code),
    );
    const missingAny =
      anyRequired.length > 0 &&
      !anyRequired.some((code) => principal.permissions.includes(code));
    if (missing.length || missingAny) {
      const label = (code: string) => PERMISSION_LABELS.get(code) ?? code;
      const parts: string[] = [];
      if (missing.length) parts.push(missing.map(label).join(', '));
      if (missingAny)
        parts.push(`một trong: ${anyRequired.map(label).join(', ')}`);
      throw new ForbiddenException(`Thiếu quyền: ${parts.join('; ')}`);
    }
  }
}
