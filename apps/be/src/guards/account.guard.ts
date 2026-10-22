import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthRepository } from '../repositories/auth.repository';
import type { AccessTokenPayload } from '../types/auth';
import { effectiveStaffPermissions } from '../utils/staff-permissions';

@Injectable()
export class AccountGuard implements CanActivate {
  constructor(private readonly repository: AuthRepository) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();
    if (!request.user) return true;
    const user = await this.repository.findUserById(request.user.sub);
    if (!user?.verified || !user.isActive || request.user.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Authentication required');
    }
    request.user.email = user.email;
    request.user.role = user.role;
    Object.assign(request.user, {
      staffPermissions: effectiveStaffPermissions(user),
      organizationUnitId: user.organizationUnitId,
      organizationUnit: user.organizationUnit,
    });
    return true;
  }
}
