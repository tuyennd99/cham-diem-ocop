import {
  ConflictException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env';
import { AuthRepository } from '../repositories/auth.repository';
import { MailService } from './mail.service';
import { OtpService } from './otp.service';
import type { AccessTokenPayload, PublicUser } from '../types/auth';

const PASSWORD_ROUNDS = 12;
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

  async me(userId: string): Promise<PublicUser> {
    const user = await this.repository.findUserById(userId);
    if (!user?.verified || !user.isActive) throw new UnauthorizedException('Authentication required');
    return this.publicUser(user);
  }

  private async issueToken(payload: AccessTokenPayload, user: PublicUser) {
    const expiresIn = 7 * 24 * 60 * 60;
    return {
      accessToken: await this.jwtService.signAsync(payload, {
        secret: env(process.env).jwtSecret,
        algorithm: 'HS256',
        issuer: 'ocop-api',
        audience: 'ocop-web',
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
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      verified: user.verified,
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private assertPassword(password: string) {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('Password must be at most 72 UTF-8 bytes');
    }
  }

  private isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
