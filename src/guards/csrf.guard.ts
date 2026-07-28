import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { isObjectLike } from 'lodash';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { AuthService } from '../services/auth.service';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;
    if (!origin || !env(process.env).allowedOrigins.includes(origin)) {
      throw this.forbidden('Origin is not allowed');
    }

    const header = request.headers['x-csrf-token'];
    const cookies = (request as unknown as { cookies?: unknown }).cookies;
    const cookie = isObjectLike(cookies)
      ? (cookies as Record<string, unknown>).csrf_token
      : undefined;
    if (
      typeof header !== 'string' ||
      typeof cookie !== 'string' ||
      !this.equal(header, cookie)
    ) {
      throw this.forbidden('Invalid CSRF token');
    }

    this.authService.assertCsrfToken(header);
    return true;
  }

  private equal(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private forbidden(message: string) {
    return new HttpException(
      { errorCode: 'CSRF_INVALID', message },
      HttpStatus.FORBIDDEN,
    );
  }
}
