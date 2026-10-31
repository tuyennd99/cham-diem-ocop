import { GoneException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
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

  async issueGoogleRegistration(registrationToken: string, profile: { fullName: string; phone: string | null }) {
    const tokenHash = this.hashToken(registrationToken);
    const snapshot = await this.repository.findPendingRegistration(tokenHash, [PendingAuthKind.GOOGLE_PROFILE]);
    if (!snapshot) throw new UnauthorizedException('Invalid or expired registration');
    const code = this.generateCode();
    const pending = await this.repository.startGoogleRegistration(tokenHash, profile, this.hash(snapshot.id, OtpPurpose.REGISTER, code));
    if (!pending) throw new UnauthorizedException('Invalid or expired registration');
    return { registrationToken, pending, code };
  }

  async verifyGoogleLink(registrationToken: string, code: string) {
    const tokenHash = this.hashToken(registrationToken);
    const pending = await this.repository.findPendingRegistration(tokenHash, [PendingAuthKind.GOOGLE_LINK]);
    if (!pending) throw new UnauthorizedException('Invalid or expired verification code');
    const result = await this.repository.consumeGoogleLink(tokenHash, this.hash(pending.id, 'GOOGLE_LINK', code));
    if (result.status === 'locked') throw new GoneException('Invalid or expired registration; restart Google sign-in');
    if (result.status === 'invalid') throw new UnauthorizedException('Invalid or expired verification code');
    return result;
  }

  async registrationStatus(registrationToken: string) {
    const result = await this.repository.pendingRegistrationStatus(this.hashToken(registrationToken));
    if (result.status === 'locked') throw new GoneException('Invalid or expired registration; restart verification');
    if (result.status !== 'ok') throw new UnauthorizedException('Invalid or expired registration');
    const pending = result.pending;
    return { mode: pending.kind === PendingAuthKind.GOOGLE_LINK ? 'google-link' as const : 'register' as const, email: pending.email, expiresAt: pending.expiresAt,
      otpExpiresAt: pending.otpExpiresAt, resendAvailableAt: pending.resendAvailableAt };
  }

  async verifyRegistration(registrationToken: string, code: string) {
    const tokenHash = this.hashToken(registrationToken);
    const pending = await this.repository.findPendingRegistration(tokenHash);
    const valid = pending && await this.repository.consumePendingRegistration(tokenHash, this.hash(pending.id, OtpPurpose.REGISTER, code));
    if (valid === 'locked') throw new GoneException('Invalid or expired registration; register again');
    if (!valid) throw new UnauthorizedException('Invalid or expired verification code');
  }

  async resendRegistration(registrationToken: string, purpose: 'REGISTER' | 'GOOGLE_LINK' = 'REGISTER') {
    const tokenHash = this.hashToken(registrationToken);
    const kinds = purpose === 'GOOGLE_LINK' ? [PendingAuthKind.GOOGLE_LINK] : undefined;
    const pending = await this.repository.findPendingRegistration(tokenHash, kinds);
    if (!pending) throw new UnauthorizedException('Invalid or expired registration');
    let code: string;
    let otpHash: string;
    do {
      code = this.generateCode();
      otpHash = this.hash(pending.id, purpose, code);
    } while (otpHash === pending.otpHash);
    const result = await this.repository.replacePendingRegistrationOtp(tokenHash, otpHash, kinds);
    if (result.status === 'locked') throw new GoneException('Invalid or expired registration; restart verification');
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

  private hash(email: string, purpose: OtpPurpose | 'GOOGLE_LINK', code: string) {
    return createHmac('sha256', env(process.env).jwtSecret)
      .update(`${email}:${purpose}:${code}`)
      .digest('hex');
  }
}
