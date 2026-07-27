import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { env } from '../config/env';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AccessTokenPayload } from '../types/auth';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenPayload }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw this.unauthorized();

    try {
      const payload: unknown = await this.jwtService.verifyAsync(token, {
        secret: env(process.env).jwtSecret,
        algorithms: ['HS256'],
        issuer: 'congan-api',
        audience: 'congan-web',
      });
      if (!this.isAccessTokenPayload(payload)) throw this.unauthorized();
      request.user = payload;
      return true;
    } catch {
      throw this.unauthorized();
    }
  }

  private isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
    if (typeof value !== 'object' || value === null) return false;
    const payload = value as Record<string, unknown>;
    return (
      Number.isInteger(payload.sub) &&
      Number.isInteger(payload.organizationId) &&
      typeof payload.iat === 'number' &&
      Number.isFinite(payload.iat) &&
      typeof payload.exp === 'number' &&
      Number.isFinite(payload.exp) &&
      typeof payload.username === 'string' &&
      Array.isArray(payload.permissions) &&
      payload.permissions.every((permission) => typeof permission === 'string')
    );
  }

  private unauthorized() {
    return new HttpException(
      { errorCode: 'UNAUTHORIZED', message: 'Authentication required' },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
