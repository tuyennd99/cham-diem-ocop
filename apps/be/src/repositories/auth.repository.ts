import { Injectable } from '@nestjs/common';
import { OtpPurpose, PendingAuthKind, Prisma, Role } from '@prisma/client';
import type { PendingAuth } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from '../constants/auth';
import type { PublicUser } from '../types/auth';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, include: { organizationUnit: { select: { id: true, code: true, name: true } } } });
  }

  createGoogleChallenge(data: Prisma.PendingAuthUncheckedCreateInput) {
    return this.prisma.pendingAuth.create({ data });
  }

  findGoogleChallenge(tokenHash: string) {
    return this.prisma.pendingAuth.findUnique({ where: { tokenHash, kind: PendingAuthKind.GOOGLE_CHALLENGE } });
  }

  async consumeGoogleChallenge(
    tokenHash: string,
    identity: { sub: string; email: string; authoritative: boolean },
    intent: 'login' | 'register',
    nextPending: Prisma.PendingAuthUncheckedCreateInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingAuth[]>(Prisma.sql`
        SELECT * FROM ${databaseObject('pending_auth')}
        WHERE "tokenHash" = ${tokenHash} AND "kind" = 'GOOGLE_CHALLENGE'
        FOR UPDATE
      `);
      const challenge = rows[0];
      if (!challenge || challenge.expiresAt <= new Date()) return { status: 'invalid' as const };
      const include = { organizationUnit: { select: { id: true, code: true, name: true } } };
      const linked = await tx.user.findUnique({ where: { googleSub: identity.sub }, include });
      if (linked && intent === 'register') return { status: 'used_sub' as const };
      const user = linked ?? await tx.user.findUnique({ where: { email: identity.email }, include });
      if (user && intent === 'register') return { status: 'email_exists' as const };
      if (user && (!user.verified || !user.isActive)) return { status: 'unavailable' as const };
      if (user && !linked && user.googleSub) return { status: 'collision' as const };

      if (user && (linked || identity.authoritative)) {
        if (!linked) {
          const updated = await tx.user.updateMany({
            where: { id: user.id, googleSub: null, verified: true, isActive: true },
            data: { googleSub: identity.sub },
          });
          if (updated.count !== 1) return { status: 'collision' as const };
        }
        await tx.pendingAuth.delete({ where: { id: challenge.id } });
        return { status: 'session' as const, user };
      }
      const pending = await tx.pendingAuth.create({ data: {
        ...nextPending,
        kind: user ? PendingAuthKind.GOOGLE_LINK : PendingAuthKind.GOOGLE_PROFILE,
        userId: user?.id ?? null,
        ...(!user ? { otpHash: null, otpExpiresAt: null, resendAvailableAt: null } : {}),
      } });
      await tx.pendingAuth.delete({ where: { id: challenge.id } });
      return { status: 'pending' as const, pending };
    });
  }

  findUserById(id: string): Promise<(PublicUser & { isActive: boolean; tokenVersion: number }) | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, phone: true, role: true, verified: true, isActive: true, tokenVersion: true,
        staffPermissions: true, organizationUnitId: true, organizationUnit: { select: { id: true, code: true, name: true } } },
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

  createPendingRegistration(data: Prisma.PendingAuthUncheckedCreateInput) {
    return this.prisma.pendingAuth.create({ data });
  }

  findPendingRegistration(tokenHash: string) {
    return this.prisma.pendingAuth.findUnique({ where: { tokenHash, kind: PendingAuthKind.EMAIL_REGISTER } });
  }

  async consumePendingRegistration(tokenHash: string, codeHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingAuth[]>(Prisma.sql`
        SELECT * FROM ${databaseObject('pending_auth')}
        WHERE "tokenHash" = ${tokenHash} AND "kind" = 'EMAIL_REGISTER'
        FOR UPDATE
      `);
      const pending = rows[0];
      const now = new Date();
      if (!pending || pending.expiresAt <= now || !pending.otpExpiresAt || pending.otpExpiresAt <= now ||
        !pending.otpHash || pending.attempts >= OTP_MAX_ATTEMPTS) return false;
      if (!this.equal(pending.otpHash, codeHash)) {
        // Return instead of throwing so the failed attempt is committed.
        await tx.pendingAuth.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
        return false;
      }
      if (!pending.email || !pending.fullName || !pending.passwordHash) return false;
      await tx.user.create({ data: {
        email: pending.email, fullName: pending.fullName, phone: pending.phone,
        password: pending.passwordHash, role: Role.REGISTRANT, verified: true,
      } });
      await tx.pendingAuth.delete({ where: { id: pending.id } });
      return true;
    });
  }

  async replacePendingRegistrationOtp(tokenHash: string, otpHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingAuth[]>(Prisma.sql`
        SELECT * FROM ${databaseObject('pending_auth')}
        WHERE "tokenHash" = ${tokenHash} AND "kind" = 'EMAIL_REGISTER'
        FOR UPDATE
      `);
      const pending = rows[0];
      const now = new Date();
      if (!pending || pending.expiresAt <= now) return { status: 'invalid' as const };
      if (pending.resendAvailableAt && pending.resendAvailableAt > now) return { status: 'cooldown' as const };
      const updated = await tx.pendingAuth.update({
        where: { id: pending.id },
        data: {
          otpHash, attempts: 0,
          otpExpiresAt: new Date(Math.min(now.getTime() + OTP_TTL_MS, pending.expiresAt.getTime())),
          resendAvailableAt: new Date(now.getTime() + 60_000),
        },
      });
      return { status: 'ok' as const, pending: updated };
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
          where: { email, role: Role.REGISTRANT, verified: false, isActive: true },
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
