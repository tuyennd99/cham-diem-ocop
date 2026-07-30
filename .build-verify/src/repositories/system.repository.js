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
exports.SystemRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const userPublicSelect = client_1.Prisma.validator()({
    id: true,
    username: true,
    fullName: true,
    position: true,
    rank: true,
    phone: true,
    organizationId: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    organization: { select: { id: true, code: true, name: true } },
    permissionGroups: {
        select: {
            permissionGroup: { select: { id: true, code: true, name: true } },
        },
    },
});
const permissionGroupInclude = client_1.Prisma.validator()({
    permissions: {
        select: {
            permission: {
                select: { id: true, code: true, name: true, description: true },
            },
        },
    },
});
let SystemRepository = class SystemRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listEffectivePermissions(userId) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            select: {
                status: true,
                organizationId: true,
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
            },
        });
        if (!user)
            return null;
        return {
            status: user.status,
            organizationId: user.organizationId,
            isAdmin: user.permissionGroups.some(({ permissionGroup }) => permissionGroup.code === ROLE.ADMIN),
            isStaff: user.permissionGroups.some(({ permissionGroup }) => permissionGroup.code === 'THUONG_TRUC'),
            permissions: [
                ...new Set(user.permissionGroups.flatMap(({ permissionGroup }) => permissionGroup.permissions.map(({ permission }) => permission.code))),
            ],
        };
    }
    listUsers() {
        return this.prisma.user.findMany({
            where: { deletedAt: null },
            select: userPublicSelect,
            orderBy: { username: 'asc' },
        });
    }
    findUserById(id) {
        return this.prisma.user.findFirst({
            where: { id, deletedAt: null },
            select: userPublicSelect,
        });
    }
    findUserByUsername(username) {
        return this.prisma.user.findFirst({
            where: { username, deletedAt: null },
            select: userPublicSelect,
        });
    }
    async createUser(data, actorId, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const user = await transaction.user.create({
                data: {
                    username: data.username,
                    fullName: data.fullName,
                    position: data.position,
                    rank: data.rank,
                    phone: data.phone,
                    passwordHash: data.passwordHash,
                    organizationId: data.organizationId,
                    permissionGroups: {
                        create: data.permissionGroupIds.map((permissionGroupId) => ({
                            permissionGroupId,
                        })),
                    },
                },
                select: userPublicSelect,
            });
            await transaction.auditLog.create({
                data: {
                    actorId,
                    organizationId: user.organizationId,
                    action: 'SYSTEM_USER_CREATED',
                    entityType: 'User',
                    entityId: user.id,
                    afterData: {
                        username: user.username,
                        organizationId: user.organizationId,
                        permissionGroupIds: data.permissionGroupIds,
                    },
                    ...this.auditMeta(meta),
                },
            });
            return user;
        });
    }
    async updateUser(id, data, actorId, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const { permissionGroupIds, ...fields } = data;
            const before = await transaction.user.findUniqueOrThrow({
                where: { id },
                select: userPublicSelect,
            });
            const user = await transaction.user.update({
                where: { id },
                data: {
                    ...fields,
                    ...(permissionGroupIds === undefined
                        ? {}
                        : {
                            permissionGroups: {
                                deleteMany: {},
                                create: permissionGroupIds.map((permissionGroupId) => ({
                                    permissionGroupId,
                                })),
                            },
                        }),
                },
                select: userPublicSelect,
            });
            await transaction.auditLog.create({
                data: {
                    actorId,
                    organizationId: user.organizationId,
                    action: 'SYSTEM_USER_UPDATED',
                    entityType: 'User',
                    entityId: id,
                    beforeData: this.userAudit(before),
                    afterData: this.userAudit(user),
                    ...this.auditMeta(meta),
                },
            });
            return user;
        });
    }
    async deleteUser(id, actorId, now, meta) {
        await this.prisma.$transaction(async (transaction) => {
            await transaction.user.update({
                where: { id },
                data: { deletedAt: now },
            });
            await this.revokeSessions(transaction, id, now);
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: 'SYSTEM_USER_DELETED',
                    entityType: 'User',
                    entityId: id,
                    ...this.auditMeta(meta),
                },
            });
        });
    }
    async lockUser(id, actorId, reason, now, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const user = await transaction.user.update({
                where: { id },
                data: {
                    status: 'LOCKED',
                    lockedAt: now,
                    lockedUntil: null,
                    lockReason: reason,
                },
                select: userPublicSelect,
            });
            await this.revokeSessions(transaction, id, now);
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: 'SYSTEM_USER_LOCKED',
                    entityType: 'User',
                    entityId: id,
                    reason,
                    ...this.auditMeta(meta),
                },
            });
            return user;
        });
    }
    async unlockUser(id, actorId, now, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const user = await transaction.user.update({
                where: { id },
                data: {
                    status: 'ACTIVE',
                    lockedAt: null,
                    lockedUntil: null,
                    lockReason: null,
                    failedLoginCount: 0,
                    failedLoginWindowStartedAt: null,
                },
                select: userPublicSelect,
            });
            await this.revokeSessions(transaction, id, now);
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: 'SYSTEM_USER_UNLOCKED',
                    entityType: 'User',
                    entityId: id,
                    ...this.auditMeta(meta),
                },
            });
            return user;
        });
    }
    async resetUserPassword(id, actorId, passwordHash, now, meta) {
        await this.prisma.$transaction(async (transaction) => {
            await transaction.user.update({
                where: { id },
                data: { passwordHash },
            });
            await this.revokeSessions(transaction, id, now);
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: 'SYSTEM_USER_PASSWORD_RESET',
                    entityType: 'User',
                    entityId: id,
                    ...this.auditMeta(meta),
                },
            });
        });
    }
    listOrganizations() {
        return this.prisma.organization.findMany({ orderBy: { code: 'asc' } });
    }
    findOrganizationById(id) {
        return this.prisma.organization.findUnique({ where: { id } });
    }
    findOrganizationByCode(code) {
        return this.prisma.organization.findUnique({ where: { code } });
    }
    createOrganization(data, actorId, meta) {
        return this.createAudited('Organization', 'SYSTEM_ORGANIZATION_CREATED', actorId, meta, (transaction) => transaction.organization.create({ data }));
    }
    updateOrganization(id, data, actorId, meta) {
        return this.updateAudited('Organization', 'SYSTEM_ORGANIZATION_UPDATED', id, actorId, meta, (transaction) => transaction.organization.update({ where: { id }, data }));
    }
    deleteOrganization(id, actorId, meta) {
        return this.deleteAudited('Organization', 'SYSTEM_ORGANIZATION_DELETED', id, actorId, meta, (transaction) => transaction.organization.delete({ where: { id } }));
    }
    listPrograms() {
        return this.prisma.program.findMany({ orderBy: { code: 'asc' } });
    }
    findProgramById(id) {
        return this.prisma.program.findUnique({ where: { id } });
    }
    findProgramByCode(code) {
        return this.prisma.program.findUnique({ where: { code } });
    }
    createProgram(data, actorId, meta) {
        return this.createAudited('Program', 'SYSTEM_PROGRAM_CREATED', actorId, meta, (transaction) => transaction.program.create({ data }));
    }
    updateProgram(id, data, actorId, meta) {
        return this.updateAudited('Program', 'SYSTEM_PROGRAM_UPDATED', id, actorId, meta, (transaction) => transaction.program.update({ where: { id }, data }));
    }
    deleteProgram(id, actorId, meta) {
        return this.deleteAudited('Program', 'SYSTEM_PROGRAM_DELETED', id, actorId, meta, (transaction) => transaction.program.delete({ where: { id } }));
    }
    async listPermissionGroups() {
        const groups = await this.prisma.permissionGroup.findMany({
            include: permissionGroupInclude,
            orderBy: { code: 'asc' },
        });
        return groups.map((group) => this.toPermissionGroup(group));
    }
    async findPermissionGroupById(id) {
        const group = await this.prisma.permissionGroup.findUnique({
            where: { id },
            include: permissionGroupInclude,
        });
        return group ? this.toPermissionGroup(group) : null;
    }
    async findPermissionGroupByCode(code) {
        const group = await this.prisma.permissionGroup.findUnique({
            where: { code },
            include: permissionGroupInclude,
        });
        return group ? this.toPermissionGroup(group) : null;
    }
    findPermissionGroupsByIds(ids) {
        return this.prisma.permissionGroup.findMany({
            where: { id: { in: ids } },
            select: { id: true },
        });
    }
    findPermissionsByIds(ids) {
        return this.prisma.permission.findMany({
            where: { id: { in: ids } },
            select: { id: true },
        });
    }
    async createPermissionGroup(data, actorId, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const group = await transaction.permissionGroup.create({
                data: {
                    code: data.code,
                    name: data.name,
                    description: data.description,
                    permissions: {
                        create: data.permissionIds.map((permissionId) => ({
                            permissionId,
                        })),
                    },
                },
                include: permissionGroupInclude,
            });
            await this.writeAudit(transaction, actorId, 'SYSTEM_PERMISSION_GROUP_CREATED', 'PermissionGroup', group.id, meta);
            return this.toPermissionGroup(group);
        });
    }
    async updatePermissionGroup(id, data, actorId, meta) {
        return this.prisma.$transaction(async (transaction) => {
            const { permissionIds, ...fields } = data;
            const group = await transaction.permissionGroup.update({
                where: { id },
                data: {
                    ...fields,
                    ...(permissionIds === undefined
                        ? {}
                        : {
                            permissions: {
                                deleteMany: {},
                                create: permissionIds.map((permissionId) => ({
                                    permissionId,
                                })),
                            },
                        }),
                },
                include: permissionGroupInclude,
            });
            await this.writeAudit(transaction, actorId, 'SYSTEM_PERMISSION_GROUP_UPDATED', 'PermissionGroup', id, meta);
            return this.toPermissionGroup(group);
        });
    }
    deletePermissionGroup(id, actorId, meta) {
        return this.prisma.$transaction(async (transaction) => {
            await transaction.$queryRaw(client_1.Prisma.sql`
          SELECT "id"
          FROM "permission_groups"
          WHERE "id" = ${id}
          FOR UPDATE
        `);
            const assignedUsers = await transaction.userPermissionGroup.count({
                where: { permissionGroupId: id },
            });
            if (assignedUsers > 0) {
                throw new common_1.ConflictException('Permission group is assigned to users');
            }
            const group = await transaction.permissionGroup.delete({ where: { id } });
            await this.writeAudit(transaction, actorId, 'SYSTEM_PERMISSION_GROUP_DELETED', 'PermissionGroup', id, meta);
            return group;
        });
    }
    listPermissions() {
        return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
    }
    revokeSessions(transaction, userId, now) {
        return transaction.refreshSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: now },
        });
    }
    createAudited(entityType, action, actorId, meta, create) {
        return this.prisma.$transaction(async (transaction) => {
            const entity = await create(transaction);
            await this.writeAudit(transaction, actorId, action, entityType, entity.id, meta);
            return entity;
        });
    }
    updateAudited(entityType, action, entityId, actorId, meta, update) {
        return this.prisma.$transaction(async (transaction) => {
            const entity = await update(transaction);
            await this.writeAudit(transaction, actorId, action, entityType, entityId, meta);
            return entity;
        });
    }
    deleteAudited(entityType, action, entityId, actorId, meta, remove) {
        return this.prisma.$transaction(async (transaction) => {
            const entity = await remove(transaction);
            await this.writeAudit(transaction, actorId, action, entityType, entityId, meta);
            return entity;
        });
    }
    writeAudit(transaction, actorId, action, entityType, entityId, meta) {
        return transaction.auditLog.create({
            data: {
                actorId,
                action,
                entityType,
                entityId,
                ...this.auditMeta(meta),
            },
        });
    }
    toPermissionGroup(group) {
        const { permissions, ...fields } = group;
        return {
            ...fields,
            permissions: permissions.map(({ permission }) => permission),
        };
    }
    userAudit(user) {
        return {
            username: user.username,
            fullName: user.fullName,
            position: user.position,
            rank: user.rank,
            phone: user.phone,
            organizationId: user.organizationId,
            permissionGroupIds: user.permissionGroups.map(({ permissionGroup }) => permissionGroup.id),
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
exports.SystemRepository = SystemRepository;
exports.SystemRepository = SystemRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SystemRepository);
//# sourceMappingURL=system.repository.js.map