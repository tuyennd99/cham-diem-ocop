import { Injectable } from '@nestjs/common';
import { uniq } from 'lodash';
import { Prisma, UserStatus } from '../prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, RefreshSession, RequestMeta } from '../types/auth';

const authUserInclude = {
  organization: { select: { id: true, code: true, name: true } },
  permissionGroups: {
    select: {
      permissionGroup: {
        select: {
          code: true,
          permissions: {
            select: { permission: { select: { code: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type AuthUserPayload = Prisma.UserGetPayload<{
  include: typeof authUserInclude;
}>;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByUsername(username: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
      include: authUserInclude,
    });
    return user ? this.toAuthUser(user) : null;
  }

  async findUserById(id: number): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: authUserInclude,
    });
    return user ? this.toAuthUser(user) : null;
  }

  async recordUnknownLoginFailure(username: string, meta: RequestMeta) {
    await this.prisma.auditLog.create({
      data: {
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        reason: 'UNKNOWN_USERNAME',
        afterData: { username },
        ...this.auditMeta(meta),
      },
    });
  }

  async registerFailedLogin(userId: number, now: Date, meta: RequestMeta) {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        {
          failedLoginCount: number;
          failedLoginWindowStartedAt: Date | null;
          status: UserStatus;
          lockedUntil: Date | null;
        }[]
      >(
        Prisma.sql`
          SELECT "failedLoginCount", "failedLoginWindowStartedAt",
                 "status", "lockedUntil"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `,
      );
      const current = rows[0];
      if (!current) throw new Error('User not found');
      const failedAudit = {
        data: {
          actorId: userId,
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'User',
          entityId: userId,
          reason: 'INVALID_CREDENTIALS',
          ...this.auditMeta(meta),
        },
      } satisfies Prisma.AuditLogCreateArgs;
      if (current.status === UserStatus.LOCKED) {
        await transaction.auditLog.create(failedAudit);
        return { locked: true, lockedUntil: current.lockedUntil };
      }

      const insideWindow =
        current.failedLoginWindowStartedAt != null &&
        now.getTime() - current.failedLoginWindowStartedAt.getTime() <= 60_000;
      const failedLoginCount = insideWindow ? current.failedLoginCount + 1 : 1;
      const windowStartedAt = insideWindow
        ? current.failedLoginWindowStartedAt
        : now;
      const locked = failedLoginCount >= 5;
      const lockedUntil = locked ? new Date(now.getTime() + 5 * 60_000) : null;

      await transaction.user.update({
        where: { id: userId },
        data: {
          status: locked ? UserStatus.LOCKED : UserStatus.ACTIVE,
          failedLoginCount,
          failedLoginWindowStartedAt: windowStartedAt,
          ...(locked
            ? {
                lockedAt: now,
                lockedUntil,
                lockReason: 'FIVE_FAILED_LOGINS',
              }
            : {}),
        },
      });
      await transaction.auditLog.create(failedAudit);

      if (locked) {
        await transaction.refreshSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.auditLog.create({
          data: {
            actorId: userId,
            action: 'AUTH_ACCOUNT_LOCKED',
            entityType: 'User',
            entityId: userId,
            reason: 'FIVE_FAILED_LOGINS',
            ...this.auditMeta(meta),
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId: userId,
            action: 'AUTH_SESSION_REVOKED',
            entityType: 'RefreshSession',
            reason: 'ACCOUNT_LOCKED',
            ...this.auditMeta(meta),
          },
        });
      }

      return { locked, lockedUntil };
    });
  }

  async unlockAutomatically(
    userId: number,
    expectedLockedUntil: Date,
    now: Date,
    meta: RequestMeta,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        { id: number; status: UserStatus; lockedUntil: Date | null }[]
      >(
        Prisma.sql`
          SELECT "id", "status", "lockedUntil"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `,
      );
      const current = rows[0];
      if (
        !current ||
        current.status !== UserStatus.LOCKED ||
        !current.lockedUntil ||
        current.lockedUntil.getTime() !== expectedLockedUntil.getTime() ||
        current.lockedUntil > now
      ) {
        return false;
      }

      await transaction.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.ACTIVE,
          lockedAt: null,
          lockedUntil: null,
          lockReason: null,
          failedLoginCount: 0,
          failedLoginWindowStartedAt: null,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_ACCOUNT_UNLOCKED',
          entityType: 'User',
          entityId: userId,
          reason: 'AUTOMATIC_TIMEOUT',
          ...this.auditMeta(meta),
        },
      });
      return true;
    });
  }

  async completeLogin(
    userId: number,
    expectedPasswordHash: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
    meta: RequestMeta,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        {
          id: number;
          passwordHash: string;
          status: UserStatus;
          deletedAt: Date | null;
        }[]
      >(
        Prisma.sql`
          SELECT "id", "passwordHash", "status", "deletedAt"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `,
      );
      const current = rows[0];
      if (
        !current ||
        current.passwordHash !== expectedPasswordHash ||
        current.status !== UserStatus.ACTIVE ||
        current.deletedAt != null
      ) {
        return false;
      }

      await transaction.user.update({
        where: { id: userId },
        data: {
          failedLoginCount: 0,
          failedLoginWindowStartedAt: null,
        },
      });
      await transaction.refreshSession.create({
        data: { userId, tokenHash, expiresAt },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_LOGIN_SUCCEEDED',
          entityType: 'User',
          entityId: userId,
          afterData: { loggedInAt: now.toISOString() },
          ...this.auditMeta(meta),
        },
      });
      return true;
    });
  }

  async findSessionByHash(tokenHash: string): Promise<RefreshSession | null> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: { include: authUserInclude } },
    });
    return session
      ? {
          id: session.id,
          expiresAt: session.expiresAt,
          revokedAt: session.revokedAt,
          user: this.toAuthUser(session.user),
        }
      : null;
  }

  async rotateSession(
    sessionId: number,
    userId: number,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
    meta: RequestMeta,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const users = await transaction.$queryRaw<
        { id: number; status?: UserStatus; deletedAt?: Date | null }[]
      >(
        Prisma.sql`
          SELECT "id", "status", "deletedAt"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `,
      );
      if (
        !users[0] ||
        (users[0].status !== undefined &&
          users[0].status !== UserStatus.ACTIVE) ||
        users[0].deletedAt != null
      ) {
        return false;
      }

      const revoked = await transaction.refreshSession.updateMany({
        where: {
          id: sessionId,
          userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });
      if (revoked.count !== 1) return false;

      await transaction.refreshSession.create({
        data: { userId, tokenHash, expiresAt },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_SESSION_REVOKED',
          entityType: 'RefreshSession',
          entityId: sessionId,
          reason: 'ROTATED',
          ...this.auditMeta(meta),
        },
      });
      return true;
    });
  }

  async revokeSession(
    sessionId: number,
    userId: number,
    now: Date,
    reason: string,
    meta: RequestMeta,
  ) {
    await this.prisma.$transaction([
      this.prisma.refreshSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_SESSION_REVOKED',
          entityType: 'RefreshSession',
          entityId: sessionId,
          reason,
          ...this.auditMeta(meta),
        },
      }),
    ]);
  }

  async revokeAllSessions(
    userId: number,
    now: Date,
    reason: string,
    meta: RequestMeta,
  ) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`
          SELECT "id"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `,
      );
      await transaction.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_SESSION_REVOKED',
          entityType: 'RefreshSession',
          reason,
          ...this.auditMeta(meta),
        },
      });
    });
  }

  async changePassword(
    userId: number,
    expectedPasswordHash: string,
    newPasswordHash: string,
    now: Date,
    meta: RequestMeta,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        {
          id: number;
          passwordHash: string;
          status: UserStatus;
          deletedAt: Date | null;
        }[]
      >(
        Prisma.sql`
          SELECT "id", "passwordHash", "status", "deletedAt"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `,
      );
      const current = rows[0];
      if (
        !current ||
        current.passwordHash !== expectedPasswordHash ||
        current.status !== UserStatus.ACTIVE ||
        current.deletedAt != null
      ) {
        return false;
      }

      await transaction.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });
      await transaction.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_PASSWORD_CHANGED',
          entityType: 'User',
          entityId: userId,
          ...this.auditMeta(meta),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_SESSION_REVOKED',
          entityType: 'RefreshSession',
          reason: 'PASSWORD_CHANGED',
          ...this.auditMeta(meta),
        },
      });
      return true;
    });
  }

  private toAuthUser(user: AuthUserPayload): AuthUser {
    const groupCodes = user.permissionGroups.map(
      ({ permissionGroup }) => permissionGroup.code,
    );
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      position: user.position,
      rank: user.rank,
      phone: user.phone,
      passwordHash: user.passwordHash,
      organizationId: user.organizationId,
      organization: user.organization,
      permissions: uniq(
        user.permissionGroups.flatMap(({ permissionGroup }) =>
          permissionGroup.permissions.map(({ permission }) => permission.code),
        ),
      ),
      isAdmin: groupCodes.includes('ADMIN'),
      isStaff: groupCodes.includes('THUONG_TRUC'),
      status: user.status,
      lockedUntil: user.lockedUntil,
      failedLoginCount: user.failedLoginCount,
      failedLoginWindowStartedAt: user.failedLoginWindowStartedAt,
      deletedAt: user.deletedAt,
    };
  }

  private auditMeta(meta: RequestMeta) {
    return {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId:
        meta.requestId && /^[A-Za-z0-9._-]{1,100}$/.test(meta.requestId)
          ? meta.requestId
          : randomUUID(),
    };
  }
}
