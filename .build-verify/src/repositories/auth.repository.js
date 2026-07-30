"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const authUserInclude = client_1.Prisma.validator()({
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
});
let AuthRepository = class AuthRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findUserByUsername(username) {
        const user = await this.prisma.user.findFirst({
            where: { username, deletedAt: null },
            include: authUserInclude,
        });
        return user ? this.toAuthUser(user) : null;
    }
    async findUserById(id) {
        const user = await this.prisma.user.findFirst({
            where: { id, deletedAt: null },
            include: authUserInclude,
        });
        return user ? this.toAuthUser(user) : null;
    }
    async recordUnknownLoginFailure(username, meta) {
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
    async registerFailedLogin(userId, now, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const rows = await transaction.$queryRaw(client_1.Prisma.sql`
          SELECT "failedLoginCount", "failedLoginWindowStartedAt",
                 "status", "lockedUntil"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `);
            const current = rows[0];
            if (!current)
                throw new Error('User not found');
            const failedAudit = {
                data: {
                    actorId: userId,
                    action: 'AUTH_LOGIN_FAILED',
                    entityType: 'User',
                    entityId: userId,
                    reason: 'INVALID_CREDENTIALS',
                    ...this.auditMeta(meta),
                },
            };
            if (current.status === 'LOCKED') {
                await transaction.auditLog.create(failedAudit);
                return { locked: true, lockedUntil: current.lockedUntil };
            }
            const insideWindow = current.failedLoginWindowStartedAt != null &&
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
                    status: locked ? 'LOCKED' : 'ACTIVE',
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
    async unlockAutomatically(userId, expectedLockedUntil, now, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const rows = await transaction.$queryRaw(client_1.Prisma.sql`
          SELECT "id", "status", "lockedUntil"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `);
            const current = rows[0];
            if (!current ||
                current.status !== 'LOCKED' ||
                !current.lockedUntil ||
                current.lockedUntil.getTime() !== expectedLockedUntil.getTime() ||
                current.lockedUntil > now) {
                return false;
            }
            await transaction.user.update({
                where: { id: userId },
                data: {
                    status: 'ACTIVE',
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
    async completeLogin(userId, expectedPasswordHash, tokenHash, expiresAt, now, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const rows = await transaction.$queryRaw(client_1.Prisma.sql`
          SELECT "id", "passwordHash", "status", "deletedAt"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `);
            const current = rows[0];
            if (!current ||
                current.passwordHash !== expectedPasswordHash ||
                current.status !== 'ACTIVE' ||
                current.deletedAt != null) {
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
    async findSessionByHash(tokenHash) {
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
    async rotateSession(sessionId, userId, tokenHash, expiresAt, now, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const users = await transaction.$queryRaw(client_1.Prisma.sql`
          SELECT "id", "status", "deletedAt"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `);
            if (!users[0] ||
                (users[0].status !== undefined && users[0].status !== 'ACTIVE') ||
                users[0].deletedAt != null) {
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
            if (revoked.count !== 1)
                return false;
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
    async revokeSession(sessionId, userId, now, reason, meta) {
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
    async revokeAllSessions(userId, now, reason, meta) {
        await this.prisma.$transaction(async (transaction) => {
            await transaction.$queryRaw(client_1.Prisma.sql`
          SELECT "id"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `);
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
    async changePassword(userId, expectedPasswordHash, newPasswordHash, now, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const rows = await transaction.$queryRaw(client_1.Prisma.sql`
          SELECT "id", "passwordHash", "status", "deletedAt"
          FROM "users"
          WHERE "id" = ${userId}
          FOR UPDATE
        `);
            const current = rows[0];
            if (!current ||
                current.passwordHash !== expectedPasswordHash ||
                current.status !== 'ACTIVE' ||
                current.deletedAt != null) {
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
    toAuthUser(user) {
        const groupCodes = user.permissionGroups.map(({ permissionGroup }) => permissionGroup.code);
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
            permissions: [
                ...new Set(user.permissionGroups.flatMap(({ permissionGroup }) => permissionGroup.permissions.map(({ permission }) => permission.code))),
            ],
            isAdmin: groupCodes.includes(ROLE.ADMIN),
            isStaff: groupCodes.includes('THUONG_TRUC'),
            status: user.status,
            lockedUntil: user.lockedUntil,
            failedLoginCount: user.failedLoginCount,
            failedLoginWindowStartedAt: user.failedLoginWindowStartedAt,
            deletedAt: user.deletedAt,
        };
    }
    auditMeta(meta) {
        return {
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            requestId: meta.requestId && /^[A-Za-z0-9._-]{1,100}$/.test(meta.requestId)
                ? meta.requestId
                : (0, node_crypto_1.randomUUID)(),
        };
    }
};
exports.AuthRepository = AuthRepository;
exports.AuthRepository = AuthRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthRepository);
//# sourceMappingURL=auth.repository.js.map