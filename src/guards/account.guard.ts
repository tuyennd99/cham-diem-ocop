import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserStatus } from '@prisma/client';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { AuthRepository } from '../repositories/auth.repository';
import { AccessTokenPayload } from '../types/auth';

@Injectable()
export class AccountGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly repository: AuthRepository,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenPayload }>();
    if (!request.user) return true;

    const user = await this.repository.findUserById(request.user.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is inactive');
    }
    request.user.organizationId = user.organizationId;
    request.user.isAdmin = user.id === 1;

    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (adminOnly && !request.user.isAdmin) {
      throw new ForbiddenException('System administration requires admin');
    }
    return true;
  }
}
