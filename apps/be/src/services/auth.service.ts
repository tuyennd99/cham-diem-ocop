import {
  ConflictException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, PendingAuthKind, Role, StaffPermission } from '@prisma/client';
import type { OrganizationUnitSummary } from '@ocop/shared';
import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { env } from '../config/env';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_AUDIENCE,
  JWT_ISSUER,
  PASSWORD_MAX_BYTES,
  PASSWORD_ROUNDS,
  OTP_TTL_MS,
} from '../constants/auth';
import { AuthRepository } from '../repositories/auth.repository';
import { MailService } from './mail.service';
import { OtpService } from './otp.service';
import { GoogleIdentityService } from './google-identity.service';
import type { AccessTokenPayload, PublicUser } from '../types/auth';
import { effectiveStaffPermissions } from '../utils/staff-permissions';

const DUMMY_BCRYPT_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), PASSWORD_ROUNDS);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly googleIdentityService: GoogleIdentityService,
  ) {}

  async googleChallenge() {
    if (!env(process.env).googleClientId) throw new ServiceUnavailableException('Google sign-in is not configured');
    const challengeToken = randomBytes(32).toString('hex');
    const nonce = randomBytes(32).toString('hex');
    const now = new Date();
    await this.repository.createGoogleChallenge({
      kind: PendingAuthKind.GOOGLE_CHALLENGE, tokenHash: this.hashToken(challengeToken), nonceHash: this.hashToken(nonce),
      createdAt: now, expiresAt: new Date(now.getTime() + 5 * 60_000),
    });
    return { challengeToken, nonce };
  }

  async google(input: { challengeToken: string; credential: string; intent: 'login' | 'register' }) {
    if (!env(process.env).googleClientId) throw new ServiceUnavailableException('Google sign-in is not configured');
    const tokenHash = this.hashToken(input.challengeToken);
    const challenge = await this.repository.findGoogleChallenge(tokenHash);
    if (!challenge?.nonceHash || challenge.expiresAt <= new Date()) throw new UnauthorizedException('Invalid or expired Google challenge');
    const identity = await this.googleIdentityService.verify(input.credential, challenge.nonceHash);
    const registrationToken = randomBytes(32).toString('hex');
    const id = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const now = new Date();
    let result: Awaited<ReturnType<AuthRepository['consumeGoogleChallenge']>>;
    try {
      result = await this.repository.consumeGoogleChallenge(tokenHash, identity, input.intent, {
        id, kind: PendingAuthKind.GOOGLE_PROFILE, tokenHash: this.hashToken(registrationToken),
        email: identity.email, googleSub: identity.sub, fullName: identity.suggestedName,
        otpHash: createHmac('sha256', env(process.env).jwtSecret).update(`${id}:GOOGLE_LINK:${code}`).digest('hex'),
        createdAt: now, expiresAt: new Date(now.getTime() + 15 * 60_000),
        otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS), resendAvailableAt: new Date(now.getTime() + 60_000),
      });
    } catch (error) {
      if (this.isUniqueConstraint(error)) throw new ConflictException('Google account is already linked; sign in again');
      throw error;
    }
    if (result.status === 'used_sub') throw new ConflictException('Tài khoản Google này đã được dùng');
    if (result.status === 'email_exists') throw new ConflictException('Email đã được đăng ký; hãy đăng nhập để liên kết tài khoản Google');
    if (result.status === 'collision') throw new ConflictException('Google account is already linked; sign in again');
    if (result.status === 'invalid') throw new UnauthorizedException('Invalid or expired Google challenge');
    if (result.status === 'unavailable') throw new UnauthorizedException('Account is unavailable');
    if (result.status === 'session') {
      const user = result.user;
      return { kind: 'session' as const, ...await this.issueToken({
        sub: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion,
      }, this.publicUser(user)) };
    }
    const pending = result.pending;
    if (pending.kind === PendingAuthKind.GOOGLE_PROFILE) {
      return { kind: 'profile' as const, registrationToken, email: pending.email, suggestedName: pending.fullName };
    }
    try {
      await this.mailService.sendOtp(pending.email!, code, 'GOOGLE_LINK');
    } catch {
      throw new InternalServerErrorException('Could not send verification email');
    }
    return { kind: 'link_otp' as const, registrationToken, email: pending.email, expiresAt: pending.expiresAt,
      otpExpiresAt: pending.otpExpiresAt, resendAvailableAt: pending.resendAvailableAt };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) {
    const email = this.normalizeEmail(input.email);
    this.assertPassword(input.password);
    if (await this.repository.findUserByEmail(email)) throw new ConflictException('Email is already registered');
    const { registrationToken, pending, code } = await this.otpService.issueRegistration({
      email, passwordHash: await bcrypt.hash(input.password, PASSWORD_ROUNDS),
      fullName: input.fullName.trim(), phone: input.phone?.trim() || null,
    });
    await this.sendRegistrationOtp(email, code);
    return { registrationToken, email, expiresAt: pending.expiresAt,
      otpExpiresAt: pending.otpExpiresAt, resendAvailableAt: pending.resendAvailableAt };
  }

  registrationStatus(registrationToken: string) {
    return this.otpService.registrationStatus(registrationToken);
  }

  async verifyOtp(registrationToken: string, code: string) {
    try {
      await this.otpService.verifyRegistration(registrationToken, code);
    } catch (error) {
      if (this.isUniqueConstraint(error)) throw new ConflictException('Email is already registered');
      throw error;
    }
    return { message: 'Registration completed' };
  }

  async resendRegistrationOtp(registrationToken: string) {
    const { pending, code } = await this.otpService.resendRegistration(registrationToken);
    await this.sendRegistrationOtp(pending.email!, code);
    return { message: 'Verification code sent', otpExpiresAt: pending.otpExpiresAt, resendAvailableAt: pending.resendAvailableAt };
  }

  private async sendRegistrationOtp(email: string, code: string) {
    try {
      await this.mailService.sendOtp(email, code, 'REGISTER');
    } catch {
      throw new InternalServerErrorException('Could not send verification email');
    }
  }

  async verifyLegacyRegistration(email: string, code: string) {
    await this.otpService.verify(this.normalizeEmail(email), OtpPurpose.REGISTER, code);
    return { message: 'Account verified' };
  }

  async resendLegacyRegistrationOtp(rawEmail: string) {
    const email = this.normalizeEmail(rawEmail);
    const user = await this.repository.findUserByEmail(email);
    if (user?.role === Role.REGISTRANT && !user.verified && user.isActive) {
      try {
        const code = await this.otpService.issue(email, OtpPurpose.REGISTER, user.id);
        await this.mailService.sendOtp(email, code, 'REGISTER');
      } catch {
        this.logger.error('Registration verification email could not be sent');
      }
    }
    return { message: 'If an unverified account exists, a verification code has been sent' };
  }

  async login(rawEmail: string, password: string) {
    const email = this.normalizeEmail(rawEmail);
    const user = await this.repository.findUserByEmail(email);
    if (!user?.password) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.verified || !user.isActive) throw new UnauthorizedException('Account is unavailable');
    return this.issueToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    }, this.publicUser(user));
  }

  async forgotPassword(rawEmail: string) {
    const email = this.normalizeEmail(rawEmail);
    const user = await this.repository.findUserByEmail(email);
    if (user?.verified && user.isActive) {
      try {
        const code = await this.otpService.issue(email, OtpPurpose.RESET_PASSWORD, user.id);
        await this.mailService.sendOtp(email, code, 'RESET_PASSWORD');
      } catch {
        this.logger.error('Password reset email could not be sent');
      }
    }
    return { message: 'If the account exists, a reset code has been sent' };
  }

  async resetPassword(rawEmail: string, code: string, newPassword: string) {
    this.assertPassword(newPassword);
    await this.otpService.verify(
      this.normalizeEmail(rawEmail),
      OtpPurpose.RESET_PASSWORD,
      code,
      await bcrypt.hash(newPassword, PASSWORD_ROUNDS),
    );
    return { message: 'Password reset' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    this.assertPassword(currentPassword);
    this.assertPassword(newPassword);
    const user = await this.repository.findCredentialsById(userId);
    if (user?.verified && user.isActive && !user.password) throw new BadRequestException('Use forgot password to set an application password');
    if (!user?.verified || !user.isActive || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      throw new BadRequestException('New password must be different');
    }
    const updated = await this.repository.changePassword(
      userId,
      user.password,
      await bcrypt.hash(newPassword, PASSWORD_ROUNDS),
    );
    if (!updated.count) throw new ConflictException('Password changed; sign in again');
    return { message: 'Password changed' };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.repository.findUserById(userId);
    if (!user?.verified || !user.isActive) throw new UnauthorizedException('Authentication required');
    return this.publicUser(user);
  }

  private async issueToken(payload: AccessTokenPayload, user: PublicUser) {
    const expiresIn = ACCESS_TOKEN_TTL_SECONDS;
    return {
      accessToken: await this.jwtService.signAsync(payload, {
        secret: env(process.env).jwtSecret,
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn,
      }),
      expiresIn,
      user,
    };
  }

  private publicUser(user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    role: Role;
    verified: boolean;
    staffPermissions: StaffPermission[];
    organizationUnitId: string | null;
    organizationUnit: OrganizationUnitSummary | null;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      verified: user.verified,
      staffPermissions: effectiveStaffPermissions(user),
      organizationUnitId: user.organizationUnitId,
      organizationUnit: user.organizationUnit,
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private assertPassword(password: string) {
    if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
      throw new BadRequestException(`Password must be at most ${PASSWORD_MAX_BYTES} UTF-8 bytes`);
    }
  }

  private isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
