import { Injectable } from '@nestjs/common';
import { OtpPurpose, PendingAuthKind, Prisma, Role } from '@prisma/client';
import type { PendingAuth } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import {
  GOOGLE_AUTH_INTENT,
  GOOGLE_CHALLENGE_STATUS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  OTP_VERIFY_STATUS,
  type GoogleAuthIntent,
} from '../constants/auth';
import type { PublicUser } from '../types/auth';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, include: { organizationUnit: { select: { id: true, code: true, name: true, managingAgencyId: true, managingAgency: { select: { id: true, code: true, name: true } } } } } });
  }

  findSeedAccounts() {
    return this.prisma.user.findMany({
      where: {
        email: { endsWith: '@ocop.test', mode: 'insensitive' },
        verified: true,
        isActive: true,
      },
      orderBy: [{ phone: 'asc' }, { email: 'asc' }],
      select: {
        email: true,
        fullName: true,
        role: true,
        roles: true,
        staffPermissions: true,
      },
    });
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
    intent: GoogleAuthIntent,
    nextPending: Prisma.PendingAuthUncheckedCreateInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingAuth[]>(Prisma.sql`
        SELECT * FROM ${databaseObject('pending_auth')}
        WHERE "tokenHash" = ${tokenHash} AND "kind" = 'GOOGLE_CHALLENGE'
        FOR UPDATE
      `);
      const challenge = rows[0];
      if (!challenge || challenge.expiresAt <= new Date()) {
        return { status: GOOGLE_CHALLENGE_STATUS.INVALID };
      }
      const include = { organizationUnit: { select: { id: true, code: true, name: true, managingAgencyId: true, managingAgency: { select: { id: true, code: true, name: true } } } } };
      const linked = await tx.user.findUnique({ where: { googleSub: identity.sub }, include });
      if (linked && intent === GOOGLE_AUTH_INTENT.REGISTER) {
        return { status: GOOGLE_CHALLENGE_STATUS.USED_SUB };
      }
      const user = linked ?? await tx.user.findUnique({ where: { email: identity.email }, include });
      if (user && intent === GOOGLE_AUTH_INTENT.REGISTER) {
        return { status: GOOGLE_CHALLENGE_STATUS.EMAIL_EXISTS };
      }
      if (user && (!user.verified || !user.isActive)) {
        return { status: GOOGLE_CHALLENGE_STATUS.UNAVAILABLE };
      }
      if (user && !linked && user.googleSub) {
        return { status: GOOGLE_CHALLENGE_STATUS.COLLISION };
      }

      if (user && (linked || identity.authoritative)) {
        if (!linked) {
          const updated = await tx.user.updateMany({
            where: { id: user.id, googleSub: null, verified: true, isActive: true },
            data: { googleSub: identity.sub },
          });
          if (updated.count !== 1) {
            return { status: GOOGLE_CHALLENGE_STATUS.COLLISION };
          }
        }
        await tx.pendingAuth.delete({ where: { id: challenge.id } });
        return { status: GOOGLE_CHALLENGE_STATUS.SESSION, user };
      }
      const pending = await tx.pendingAuth.create({ data: {
        ...nextPending,
        kind: user ? PendingAuthKind.GOOGLE_LINK : PendingAuthKind.GOOGLE_PROFILE,
        userId: user?.id ?? null,
        ...(!user ? { otpHash: null, otpExpiresAt: null, resendAvailableAt: null } : {}),
      } });
      await tx.pendingAuth.delete({ where: { id: challenge.id } });
      return { status: GOOGLE_CHALLENGE_STATUS.PENDING, pending };
    });
  }

  findUserById(id: string): Promise<(PublicUser & { isActive: boolean; tokenVersion: number }) | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, phone: true, role: true, roles: true, verified: true, isActive: true, tokenVersion: true,
        staffPermissions: true, organizationUnitId: true, organizationUnit: { select: { id: true, code: true, name: true, managingAgencyId: true, managingAgency: { select: { id: true, code: true, name: true } } } } },
    });
  }

  updateProfile(
    id: string,
    data: { fullName: string; phone: string | null },
  ): Promise<PublicUser & { isActive: boolean; tokenVersion: number }> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        roles: true,
        verified: true,
        isActive: true,
        tokenVersion: true,
        staffPermissions: true,
        organizationUnitId: true,
        organizationUnit: { select: { id: true, code: true, name: true, managingAgencyId: true, managingAgency: { select: { id: true, code: true, name: true } } } },
      },
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

  findPendingRegistration(tokenHash: string, kinds: PendingAuthKind[] = [PendingAuthKind.EMAIL_REGISTER, PendingAuthKind.GOOGLE_REGISTER]) {
    return this.prisma.pendingAuth.findUnique({ where: { tokenHash, kind: { in: kinds } } });
  }

  async pendingRegistrationStatus(tokenHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingAuth[]>(Prisma.sql`
        SELECT * FROM ${databaseObject('pending_auth')}
        WHERE "tokenHash" = ${tokenHash} AND "kind" IN ('EMAIL_REGISTER', 'GOOGLE_REGISTER', 'GOOGLE_LINK')
        FOR UPDATE
      `);
      const pending = rows[0];
      if (!pending || pending.expiresAt <= new Date()) {
        return { status: OTP_VERIFY_STATUS.INVALID };
      }
      if (pending.attempts >= OTP_MAX_ATTEMPTS) {
        return { status: OTP_VERIFY_STATUS.LOCKED };
      }
      return { status: OTP_VERIFY_STATUS.OK, pending };
    });
  }

  async startGoogleRegistration(tokenHash: string, profile: { fullName: string; phone: string | null }, otpHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingAuth[]>(Prisma.sql`
        SELECT * FROM ${databaseObject('pending_auth')}
        WHERE "tokenHash" = ${tokenHash} AND "kind" = 'GOOGLE_PROFILE' FOR UPDATE
      `);
      const pending = rows[0];
      const now = new Date();
      if (!pending || pending.expiresAt <= now || !pending.email || !pending.googleSub) return null;
      return tx.pendingAuth.update({ where: { id: pending.id }, data: {
        ...profile, kind: PendingAuthKind.GOOGLE_REGISTER, otpHash, attempts: 0,
        otpExpiresAt: new Date(Math.min(now.getTime() + OTP_TTL_MS, pending.expiresAt.getTime())),
        resendAvailableAt: new Date(now.getTime() + 60_000),
      } });
    });
  }

  async consumeGoogleLink(tokenHash: string, codeHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingAuth[]>(Prisma.sql`
        SELECT * FROM ${databaseObject('pending_auth')}
        WHERE "tokenHash" = ${tokenHash} AND "kind" = 'GOOGLE_LINK' FOR UPDATE
      `);
      const pending = rows[0];
      const now = new Date();
      if (pending && pending.attempts >= OTP_MAX_ATTEMPTS) {
        return { status: OTP_VERIFY_STATUS.LOCKED };
      }
      if (!pending || pending.expiresAt <= now || !pending.otpExpiresAt || pending.otpExpiresAt <= now ||
        !pending.otpHash || !pending.userId || !pending.email || !pending.googleSub) {
        return { status: OTP_VERIFY_STATUS.INVALID };
      }
      if (!this.equal(pending.otpHash, codeHash)) {
        await tx.pendingAuth.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
        return {
          status:
            pending.attempts + 1 >= OTP_MAX_ATTEMPTS
              ? OTP_VERIFY_STATUS.LOCKED
              : OTP_VERIFY_STATUS.INVALID,
        };
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${pending.userId} FOR UPDATE`);
      const include = { organizationUnit: { select: { id: true, code: true, name: true, managingAgencyId: true, managingAgency: { select: { id: true, code: true, name: true } } } } };
      const user = await tx.user.findUnique({ where: { id: pending.userId }, include });
      if (!user || !user.isActive || !user.verified || user.email !== pending.email || user.googleSub !== null ||
        pending.expiresAt <= new Date() || pending.otpExpiresAt <= new Date()) {
        return { status: OTP_VERIFY_STATUS.INVALID };
      }
      if (await tx.user.findUnique({ where: { googleSub: pending.googleSub } })) {
        return { status: OTP_VERIFY_STATUS.COLLISION };
      }
      const updated = await tx.user.update({ where: { id: user.id }, data: { googleSub: pending.googleSub }, include });
      await tx.pendingAuth.delete({ where: { id: pending.id } });
      return { status: OTP_VERIFY_STATUS.SESSION, user: updated };
    });
  }

  async consumePendingRegistration(tokenHash: string, codeHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingAuth[]>(Prisma.sql`
        SELECT * FROM ${databaseObject('pending_auth')}
        WHERE "tokenHash" = ${tokenHash} AND "kind" IN ('EMAIL_REGISTER', 'GOOGLE_REGISTER')
        FOR UPDATE
      `);
      const pending = rows[0];
      const now = new Date();
      if (pending && pending.attempts >= OTP_MAX_ATTEMPTS) return OTP_VERIFY_STATUS.LOCKED;
      if (!pending || pending.expiresAt <= now || !pending.otpExpiresAt || pending.otpExpiresAt <= now ||
        !pending.otpHash) return false;
      if (!this.equal(pending.otpHash, codeHash)) {
        // Return instead of throwing so the failed attempt is committed.
        await tx.pendingAuth.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
        return pending.attempts + 1 >= OTP_MAX_ATTEMPTS ? OTP_VERIFY_STATUS.LOCKED : false;
      }
      if (!pending.email || !pending.fullName ||
        (pending.kind === PendingAuthKind.EMAIL_REGISTER ? !pending.passwordHash : !pending.googleSub)) return false;
      await tx.user.create({ data: {
        email: pending.email, fullName: pending.fullName, phone: pending.phone,
        password: pending.kind === PendingAuthKind.EMAIL_REGISTER ? pending.passwordHash : null,
        googleSub: pending.kind === PendingAuthKind.GOOGLE_REGISTER ? pending.googleSub : null,
        role: Role.REGISTRANT, roles: [Role.REGISTRANT], verified: true,
      } });
      await tx.pendingAuth.delete({ where: { id: pending.id } });
      return true;
    });
  }

  async replacePendingRegistrationOtp(tokenHash: string, otpHash: string, kinds: PendingAuthKind[] = [PendingAuthKind.EMAIL_REGISTER, PendingAuthKind.GOOGLE_REGISTER]) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingAuth[]>(Prisma.sql`
        SELECT * FROM ${databaseObject('pending_auth')}
        WHERE "tokenHash" = ${tokenHash} AND "kind"::text IN (${Prisma.join(kinds)})
        FOR UPDATE
      `);
      const pending = rows[0];
      const now = new Date();
      if (pending && pending.attempts >= OTP_MAX_ATTEMPTS) {
        return { status: OTP_VERIFY_STATUS.LOCKED };
      }
      if (!pending || pending.expiresAt <= now) {
        return { status: OTP_VERIFY_STATUS.INVALID };
      }
      if (pending.resendAvailableAt && pending.resendAvailableAt > now) {
        return { status: OTP_VERIFY_STATUS.COOLDOWN };
      }
      const updated = await tx.pendingAuth.update({
        where: { id: pending.id },
        data: {
          otpHash,
          otpExpiresAt: new Date(Math.min(now.getTime() + OTP_TTL_MS, pending.expiresAt.getTime())),
          resendAvailableAt: new Date(now.getTime() + 60_000),
        },
      });
      return { status: OTP_VERIFY_STATUS.OK, pending: updated };
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
