import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { hashPassword, verifyPassword } from '../../prisma/seed/password';
import { requireSecret } from '../config/env';
import { AuthRepository } from '../repositories/auth.repository';
import {
  AccessTokenPayload,
  AuthResult,
  AuthUser,
  RequestMeta,
} from '../types/auth';

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_LIFETIME_MS = 3 * 24 * 60 * 60_000;
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$+V/bhD/sS9k7L7dE3QRhBw$hdZ3VKkQ7UjdKulRRi9TNLfCzTXEcLrHeiwzYScJFBQ';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    username: string,
    password: string,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const now = new Date();
    const user = await this.repository.findUserByUsername(username.trim());
    if (!user) {
      await verifyPassword(DUMMY_PASSWORD_HASH, password);
      await this.repository.recordUnknownLoginFailure(username.trim(), meta);
      throw this.unauthorized();
    }

    await this.ensureAccountAvailable(user, now, meta);
    if (!(await verifyPassword(user.passwordHash, password))) {
      await this.handleFailedLogin(user, meta);
    }

    const refreshExpiresAt = new Date(now.getTime() + REFRESH_LIFETIME_MS);
    const refreshToken = randomBytes(32).toString('base64url');
    const completed = await this.repository.completeLogin(
      user.id,
      user.passwordHash,
      this.hashRefreshToken(refreshToken),
      refreshExpiresAt,
      now,
      meta,
    );
    if (!completed) throw this.unauthorized();
    return this.buildAuthResult(user, refreshToken, refreshExpiresAt);
  }

  async refresh(
    rawRefreshToken: string,
    csrfToken: string,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    this.assertCsrfToken(csrfToken);
    const now = new Date();
    const session = await this.repository.findSessionByHash(
      this.hashRefreshToken(rawRefreshToken),
    );
    if (!session) throw this.unauthorized('Invalid refresh token');

    if (session.revokedAt) {
      await this.repository.revokeAllSessions(
        session.user.id,
        now,
        'REFRESH_TOKEN_REUSE',
        meta,
      );
      throw this.unauthorized('Invalid refresh token');
    }
    if (session.expiresAt <= now) {
      await this.repository.revokeSession(
        session.id,
        session.user.id,
        now,
        'REFRESH_EXPIRED',
        meta,
      );
      throw this.unauthorized('Refresh token expired');
    }
    if (session.user.status !== 'ACTIVE' || session.user.deletedAt != null) {
      await this.repository.revokeAllSessions(
        session.user.id,
        now,
        'ACCOUNT_UNAVAILABLE',
        meta,
      );
      throw this.locked();
    }

    const refreshToken = randomBytes(32).toString('base64url');
    const rotated = await this.repository.rotateSession(
      session.id,
      session.user.id,
      this.hashRefreshToken(refreshToken),
      session.expiresAt,
      now,
      meta,
    );
    if (!rotated) {
      await this.repository.revokeAllSessions(
        session.user.id,
        now,
        'REFRESH_TOKEN_REUSE',
        meta,
      );
      throw this.unauthorized('Invalid refresh token');
    }

    return this.buildAuthResult(session.user, refreshToken, session.expiresAt);
  }

  async logout(
    rawRefreshToken: string | undefined,
    csrfToken: string,
    meta: RequestMeta,
  ) {
    this.assertCsrfToken(csrfToken);
    if (!rawRefreshToken) return;

    const session = await this.repository.findSessionByHash(
      this.hashRefreshToken(rawRefreshToken),
    );
    if (session) {
      await this.repository.revokeSession(
        session.id,
        session.user.id,
        new Date(),
        'LOGOUT',
        meta,
      );
    }
  }

  async profile(userId: number) {
    const user = await this.repository.findUserById(userId);
    if (!user || user.status !== 'ACTIVE') throw this.unauthorized();
    return this.publicUser(user);
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ) {
    const user = await this.repository.findUserById(userId);
    if (!user || user.status !== 'ACTIVE') throw this.unauthorized();
    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw this.unauthorized('Current password is incorrect');
    }

    const changed = await this.repository.changePassword(
      user.id,
      user.passwordHash,
      await hashPassword(newPassword),
      new Date(),
      meta,
    );
    if (changed === false) throw this.unauthorized();
  }

  createCsrfToken() {
    const value = randomBytes(32).toString('base64url');
    return `${value}.${this.signCsrf(value)}`;
  }

  assertCsrfToken(token: string) {
    const separator = token.lastIndexOf('.');
    if (separator < 1) throw this.csrfError();
    const value = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    const expected = this.signCsrf(value);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw this.csrfError();
    }
  }

  private async ensureAccountAvailable(
    user: AuthUser,
    now: Date,
    meta: RequestMeta,
  ) {
    if (user.status !== 'LOCKED') return;
    if (!user.lockedUntil || user.lockedUntil > now) throw this.locked();

    await this.repository.unlockAutomatically(
      user.id,
      user.lockedUntil,
      now,
      meta,
    );
    user.status = 'ACTIVE';
    user.lockedUntil = null;
    user.failedLoginCount = 0;
    user.failedLoginWindowStartedAt = null;
  }

  private async handleFailedLogin(user: AuthUser, meta: RequestMeta) {
    const now = new Date();
    const { locked } = await this.repository.registerFailedLogin(
      user.id,
      now,
      meta,
    );
    if (locked) throw this.locked();
    throw this.unauthorized();
  }

  private async buildAuthResult(
    user: AuthUser,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): Promise<AuthResult> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      organizationId: user.organizationId,
      permissions: user.permissions,
      isAdmin: Boolean(user.isAdmin),
      isStaff: Boolean(user.isStaff),
    };
    return {
      accessToken: await this.jwtService.signAsync(payload, {
        secret: this.jwtSecret(),
        algorithm: 'HS256',
        issuer: 'congan-api',
        audience: 'congan-web',
        expiresIn: '15m',
      }),
      expiresIn: ACCESS_TOKEN_SECONDS,
      refreshToken,
      refreshExpiresAt,
      csrfToken: this.createCsrfToken(),
      user: this.publicUser(user),
    };
  }

  private publicUser(user: AuthUser) {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      position: user.position,
      rank: user.rank,
      phone: user.phone,
      organizationId: user.organizationId,
      organization: user.organization,
      permissions: user.permissions,
      isAdmin: Boolean(user.isAdmin),
      isStaff: Boolean(user.isStaff),
    };
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private signCsrf(value: string) {
    return createHmac('sha256', this.csrfSecret())
      .update(value)
      .digest('base64url');
  }

  private csrfSecret() {
    return requireSecret(
      'CSRF_SECRET',
      this.configService.get<string>('CSRF_SECRET'),
    );
  }

  private jwtSecret() {
    return requireSecret(
      'JWT_SECRET',
      this.configService.get<string>('JWT_SECRET'),
    );
  }

  private unauthorized(message = 'Invalid username or password') {
    return new HttpException(
      { errorCode: 'INVALID_CREDENTIALS', message },
      HttpStatus.UNAUTHORIZED,
    );
  }

  private locked() {
    return new HttpException(
      { errorCode: 'ACCOUNT_LOCKED', message: 'Account is locked' },
      423,
    );
  }

  private csrfError() {
    return new HttpException(
      { errorCode: 'CSRF_INVALID', message: 'Invalid CSRF token' },
      HttpStatus.FORBIDDEN,
    );
  }
}
