import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import { createHmac, randomInt } from 'node:crypto';
import { env } from '../config/env';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable()
export class OtpService {
  constructor(private readonly repository: AuthRepository) {}

  async issue(email: string, purpose: OtpPurpose, userId?: string) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
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
