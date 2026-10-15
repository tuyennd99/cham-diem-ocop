import { Injectable } from '@nestjs/common';
import { OtpPurpose, Prisma, Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from '../constants/auth';
import type { PublicUser } from '../types/auth';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<(PublicUser & { isActive: boolean; tokenVersion: number }) | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, phone: true, role: true, verified: true, isActive: true, tokenVersion: true },
    });
  }

  findCredentialsById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { password: true, verified: true, isActive: true },
    });
  }

  changePassword(id: string, currentPasswordHash: string, newPasswordHash: string) {
    return this.prisma.user.updateMany({
      where: { id, password: currentPasswordHash, verified: true, isActive: true },
      data: { password: newPasswordHash, tokenVersion: { increment: 1 } },
    });
  }

  createRegistrant(data: Pick<User, 'email' | 'password' | 'fullName' | 'phone'>) {
    return this.prisma.user.create({
      data: { ...data, role: Role.REGISTRANT, verified: false },
    });
  }

  async saveOtp(email: string, purpose: OtpPurpose, codeHash: string, userId?: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.otpCode.updateMany({
        where: { email, purpose, usedAt: null },
        data: { usedAt: now },
      });
      await tx.otpCode.create({
        data: { email, purpose, code: codeHash, expiresAt, userId },
      });
    });
  }

  async consumeOtp(
    email: string,
    purpose: OtpPurpose,
    codeHash: string,
    newPasswordHash?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string; code: string; attempts: number; expiresAt: Date; usedAt: Date | null }[]
      >(Prisma.sql`
        SELECT "id", "code", "attempts", "expiresAt", "usedAt"
        FROM ${databaseObject('otp_codes')}
        WHERE "email" = ${email} AND "purpose" = ${purpose}::${databaseObject('OtpPurpose')}
        ORDER BY "createdAt" DESC
        LIMIT 1 FOR UPDATE
      `);
      const otp = rows[0];
      const now = new Date();
      if (!otp || otp.usedAt || otp.expiresAt <= now || otp.attempts >= OTP_MAX_ATTEMPTS) return false;

      if (!this.equal(otp.code, codeHash)) {
        const attempts = otp.attempts + 1;
        await tx.otpCode.update({
          where: { id: otp.id },
          data: { attempts, ...(attempts >= OTP_MAX_ATTEMPTS ? { usedAt: now } : {}) },
        });
        return false;
      }

      await tx.otpCode.update({ where: { id: otp.id }, data: { usedAt: now } });
      if (purpose === OtpPurpose.REGISTER) {
        const result = await tx.user.updateMany({
          where: { email, role: Role.REGISTRANT, verified: false },
          data: { verified: true },
        });
        return result.count === 1;
      }
      if (!newPasswordHash) return false;
      const result = await tx.user.updateMany({
        where: { email, verified: true, isActive: true },
        data: { password: newPasswordHash, tokenVersion: { increment: 1 } },
      });
      return result.count === 1;
    });
  }

  private equal(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
