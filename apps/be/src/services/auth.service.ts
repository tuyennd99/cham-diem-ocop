import {
  ConflictException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, Role, StaffPermission } from '@prisma/client';
import type { OrganizationUnitSummary } from '@ocop/shared';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_AUDIENCE,
  JWT_ISSUER,
  PASSWORD_MAX_BYTES,
  PASSWORD_ROUNDS,
} from '../constants/auth';
import { AuthRepository } from '../repositories/auth.repository';
import { MailService } from './mail.service';
import { OtpService } from './otp.service';
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
  ) {}

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) {
    const email = this.normalizeEmail(input.email);
    this.assertPassword(input.password);
    let user;
    try {
      user = await this.repository.createRegistrant({
        email,
        password: await bcrypt.hash(input.password, PASSWORD_ROUNDS),
        fullName: input.fullName.trim(),
        phone: input.phone?.trim() || null,
      });
    } catch (error) {
      if (this.isUniqueConstraint(error)) throw new ConflictException('Email is already registered');
      throw error;
    }

    const code = await this.otpService.issue(email, OtpPurpose.REGISTER, user.id);
    try {
      await this.mailService.sendOtp(email, code, 'REGISTER');
    } catch {
      throw new InternalServerErrorException('Could not send verification email');
    }
    return { message: 'Verification code sent' };
  }

  async verifyOtp(email: string, code: string) {
    await this.otpService.verify(this.normalizeEmail(email), OtpPurpose.REGISTER, code);
    return { message: 'Account verified' };
  }

  async resendRegistrationOtp(rawEmail: string) {
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
    if (!user) {
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
