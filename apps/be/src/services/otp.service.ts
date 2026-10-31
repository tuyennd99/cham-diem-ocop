import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { OtpPurpose, PendingAuthKind } from '@prisma/client';
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { OTP_TTL_MS } from '../constants/auth';
import { env } from '../config/env';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable()
export class OtpService {
  constructor(private readonly repository: AuthRepository) {}

  async issueRegistration(snapshot: { email: string; fullName: string; phone: string | null; passwordHash: string }) {
    const id = randomUUID();
    const registrationToken = randomBytes(32).toString('hex');
    const code = this.generateCode();
    const now = new Date();
    const pending = await this.repository.createPendingRegistration({
      id, kind: PendingAuthKind.EMAIL_REGISTER, tokenHash: this.hashToken(registrationToken), ...snapshot,
      otpHash: this.hash(id, OtpPurpose.REGISTER, code),
      createdAt: now, expiresAt: new Date(now.getTime() + 15 * 60_000),
      otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS), resendAvailableAt: new Date(now.getTime() + 60_000),
    });
    return { registrationToken, code, pending };
  }

  async registrationStatus(registrationToken: string) {
    const pending = await this.repository.findPendingRegistration(this.hashToken(registrationToken));
    if (!pending || pending.expiresAt <= new Date()) throw new UnauthorizedException('Invalid or expired registration');
    return { mode: 'register' as const, email: pending.email, expiresAt: pending.expiresAt,
      otpExpiresAt: pending.otpExpiresAt, resendAvailableAt: pending.resendAvailableAt };
  }

  async verifyRegistration(registrationToken: string, code: string) {
    const tokenHash = this.hashToken(registrationToken);
    const pending = await this.repository.findPendingRegistration(tokenHash);
    const valid = pending && await this.repository.consumePendingRegistration(tokenHash, this.hash(pending.id, OtpPurpose.REGISTER, code));
    if (!valid) throw new UnauthorizedException('Invalid or expired verification code');
  }

  async resendRegistration(registrationToken: string) {
    const tokenHash = this.hashToken(registrationToken);
    const pending = await this.repository.findPendingRegistration(tokenHash);
    if (!pending) throw new UnauthorizedException('Invalid or expired registration');
    let code: string;
    let otpHash: string;
    do {
      code = this.generateCode();
      otpHash = this.hash(pending.id, OtpPurpose.REGISTER, code);
    } while (otpHash === pending.otpHash);
    const result = await this.repository.replacePendingRegistrationOtp(tokenHash, otpHash);
    if (result.status === 'cooldown') throw new HttpException('Please wait before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    if (result.status !== 'ok') throw new UnauthorizedException('Invalid or expired registration');
    return { pending: result.pending, code };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateCode() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  async issue(email: string, purpose: OtpPurpose, userId?: string) {
    const code = this.generateCode();
    await this.repository.saveOtp(email, purpose, this.hash(email, purpose, code), userId);
    return code;
  }

  async verify(email: string, purpose: OtpPurpose, code: string, passwordHash?: string) {
    const valid = await this.repository.consumeOtp(
      email,
      purpose,
      this.hash(email, purpose, code),
      passwordHash,
    );
    if (!valid) throw new UnauthorizedException('Invalid or expired verification code');
  }

  private hash(email: string, purpose: OtpPurpose, code: string) {
    return createHmac('sha256', env(process.env).jwtSecret)
      .update(`${email}:${purpose}:${code}`)
      .digest('hex');
  }
}
