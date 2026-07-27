import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { ChangePasswordDto, LoginDto } from '../dtos/auth.dto';
import { CsrfGuard } from '../guards/csrf.guard';
import { AuthService } from '../services/auth.service';
import type {
  AccessTokenPayload,
  AuthResult,
  RequestMeta,
} from '../types/auth';

const REFRESH_MAX_AGE_MS = 3 * 24 * 60 * 60_000;
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      body.username,
      body.password,
      this.requestMeta(request),
    );
    this.setAuthCookies(response, result);
    return this.publicResult(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Headers('x-csrf-token') csrfToken: string,
    @Req() request: Request & { cookies?: Record<string, unknown> },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(
      this.cookie(request, 'refresh_token') ?? '',
      csrfToken,
      this.requestMeta(request),
    );
    this.setAuthCookies(response, result);
    return this.publicResult(result);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async logout(
    @Headers('x-csrf-token') csrfToken: string,
    @Req() request: Request & { cookies?: Record<string, unknown> },
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(
      this.cookie(request, 'refresh_token'),
      csrfToken,
      this.requestMeta(request),
    );
    this.clearAuthCookies(response);
    return { success: true };
  }

  @Get('profile')
  @ApiBearerAuth()
  profile(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.profile(user.sub);
  }

  @Patch('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: ChangePasswordDto,
    @Req() request: Request,
  ) {
    await this.authService.changePassword(
      user.sub,
      body.currentPassword,
      body.newPassword,
      this.requestMeta(request),
    );
    return { success: true };
  }

  private setAuthCookies(response: Response, result: AuthResult) {
    const options = {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: Math.min(
        REFRESH_MAX_AGE_MS,
        Math.max(0, result.refreshExpiresAt.getTime() - Date.now()),
      ),
    };
    response.cookie('refresh_token', result.refreshToken, {
      ...options,
      httpOnly: true,
      path: REFRESH_COOKIE_PATH,
    });
    response.cookie('csrf_token', result.csrfToken, {
      ...options,
      httpOnly: false,
      path: '/',
    });
  }

  private clearAuthCookies(response: Response) {
    const options = {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
    response.clearCookie('refresh_token', {
      ...options,
      httpOnly: true,
      path: REFRESH_COOKIE_PATH,
    });
    response.clearCookie('csrf_token', {
      ...options,
      httpOnly: false,
      path: '/',
    });
  }

  private publicResult({ accessToken, expiresIn, user }: AuthResult) {
    return { accessToken, expiresIn, user };
  }

  private cookie(request: Request, name: string) {
    const cookies = (request as unknown as { cookies?: unknown }).cookies;
    const value =
      typeof cookies === 'object' && cookies !== null
        ? (cookies as Record<string, unknown>)[name]
        : undefined;
    return typeof value === 'string' ? value : undefined;
  }

  private requestMeta(request: Request): RequestMeta {
    const requestId = request.headers['x-request-id'];
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId:
        typeof requestId === 'string' &&
        /^[A-Za-z0-9._-]{1,100}$/.test(requestId)
          ? requestId
          : undefined,
    };
  }
}
