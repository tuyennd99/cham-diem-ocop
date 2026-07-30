import { ConflictException, Injectable } from '@nestjs/common';
import { uniq } from 'lodash';
import { Prisma, UserStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';
import { ADMIN_GROUP_CODE } from '../constants/role';

const userPublicSelect = {
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
} satisfies Prisma.UserSelect;

const permissionGroupInclude = {
  permissions: {
    select: {
      permission: {
        select: { id: true, code: true, name: true, description: true },
      },
    },
  },
} satisfies Prisma.PermissionGroupInclude;

type PermissionGroupPayload = Prisma.PermissionGroupGetPayload<{
  include: typeof permissionGroupInclude;
}>;

export interface EffectivePermissions {
  status: UserStatus;
  isAdmin: boolean;
  organizationId: number;
  permissions: string[];
}

interface CreateUserData {
  username: string;
  fullName: string;
  position?: string;
  rank?: string;
  phone?: string;
  passwordHash: string;
  organizationId: number;
  permissionGroupIds: number[];
}

interface UpdateUserData {
  username?: string;
  fullName?: string;
  position?: string;
  rank?: string;
  phone?: string;
  organizationId?: number;
  permissionGroupIds?: number[];
}

interface OrganizationData {
  code?: string;
  name?: string;
  isAssigningAuthority?: boolean;
  isExecutingUnit?: boolean;
  status?: string;
}

interface ProgramData {
  code?: string;
  name?: string;
  description?: string;
  status?: string;
}

interface PermissionGroupData {
  code?: string;
  name?: string;
  description?: string;
  permissionIds?: number[];
}

@Injectable()
export class SystemRepository {
  constructor(private readonly prisma: PrismaService) { }

  async listEffectivePermissions(
    userId: number,
  ): Promise<EffectivePermissions | null> {
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
    if (!user) return null;

    const groupCodes = user.permissionGroups.map(
      ({ permissionGroup }) => permissionGroup.code,
    );
    return {
      status: user.status,
      organizationId: user.organizationId,
      isAdmin: groupCodes.includes(ADMIN_GROUP_CODE),
      permissions: uniq(
        user.permissionGroups.flatMap(({ permissionGroup }) =>
          permissionGroup.permissions.map(({ permission }) => permission.code),
        ),
      ),
    };
  }

  listUsers() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: userPublicSelect,
      orderBy: { username: 'asc' },
    });
  }

  findUserById(id: number) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userPublicSelect,
    });
  }

  findUserByUsername(username: string) {
    return this.prisma.user.findFirst({
      where: { username, deletedAt: null },
      select: userPublicSelect,
    });
  }

  findUsersByIds(ids: number[]) {
    return this.prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
  }

  async createUser(data: CreateUserData, actorId: number, meta: RequestMeta) {
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

  async updateUser(
    id: number,
    data: UpdateUserData,
    actorId: number,
    meta: RequestMeta,
  ) {
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

  async deleteUser(id: number, actorId: number, now: Date, meta: RequestMeta) {
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

  async lockUser(
    id: number,
    actorId: number,
    reason: string,
    now: Date,
    meta: RequestMeta,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id },
        data: {
          status: UserStatus.LOCKED,
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

  async unlockUser(id: number, actorId: number, now: Date, meta: RequestMeta) {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id },
        data: {
          status: UserStatus.ACTIVE,
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

  async resetUserPassword(
    id: number,
    actorId: number,
    passwordHash: string,
    now: Date,
    meta: RequestMeta,
  ) {
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

  findOrganizationById(id: number) {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  findOrganizationByCode(code: string) {
    return this.prisma.organization.findUnique({ where: { code } });
  }

  createOrganization(
    data: Required<Pick<OrganizationData, 'code' | 'name'>> & OrganizationData,
    actorId: number,
    meta: RequestMeta,
  ) {
    return this.createAudited(
      'Organization',
      'SYSTEM_ORGANIZATION_CREATED',
      actorId,
      meta,
      (transaction) => transaction.organization.create({ data }),
    );
  }

  updateOrganization(
    id: number,
    data: OrganizationData,
    actorId: number,
    meta: RequestMeta,
  ) {
    return this.updateAudited(
      'Organization',
      'SYSTEM_ORGANIZATION_UPDATED',
      id,
      actorId,
      meta,
      (transaction) => transaction.organization.update({ where: { id }, data }),
    );
  }

  deleteOrganization(id: number, actorId: number, meta: RequestMeta) {
    return this.deleteAudited(
      'Organization',
      'SYSTEM_ORGANIZATION_DELETED',
      id,
      actorId,
      meta,
      (transaction) => transaction.organization.delete({ where: { id } }),
    );
  }

  listPrograms() {
    return this.prisma.program.findMany({ orderBy: { code: 'asc' } });
  }

  findProgramById(id: number) {
    return this.prisma.program.findUnique({ where: { id } });
  }

  findProgramByCode(code: string) {
    return this.prisma.program.findUnique({ where: { code } });
  }

  createProgram(
    data: Required<Pick<ProgramData, 'code' | 'name'>> & ProgramData,
    actorId: number,
    meta: RequestMeta,
  ) {
    return this.createAudited(
      'Program',
      'SYSTEM_PROGRAM_CREATED',
      actorId,
      meta,
      (transaction) => transaction.program.create({ data }),
    );
  }

  updateProgram(
    id: number,
    data: ProgramData,
    actorId: number,
    meta: RequestMeta,
  ) {
    return this.updateAudited(
      'Program',
      'SYSTEM_PROGRAM_UPDATED',
      id,
      actorId,
      meta,
      (transaction) => transaction.program.update({ where: { id }, data }),
    );
  }

  deleteProgram(id: number, actorId: number, meta: RequestMeta) {
    return this.deleteAudited(
      'Program',
      'SYSTEM_PROGRAM_DELETED',
      id,
      actorId,
      meta,
      (transaction) => transaction.program.delete({ where: { id } }),
    );
  }

  async listPermissionGroups() {
    const groups = await this.prisma.permissionGroup.findMany({
      include: permissionGroupInclude,
      orderBy: { code: 'asc' },
    });
    return groups.map((group) => this.toPermissionGroup(group));
  }

  async findPermissionGroupById(id: number) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id },
      include: permissionGroupInclude,
    });
    return group ? this.toPermissionGroup(group) : null;
  }

  async findPermissionGroupByCode(code: string) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { code },
      include: permissionGroupInclude,
    });
    return group ? this.toPermissionGroup(group) : null;
  }

  findPermissionGroupsByIds(ids: number[]) {
    return this.prisma.permissionGroup.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
  }

  findPermissionsByIds(ids: number[]) {
    return this.prisma.permission.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
  }

  async createPermissionGroup(
    data: Required<
      Pick<PermissionGroupData, 'code' | 'name' | 'permissionIds'>
    > &
      PermissionGroupData,
    actorId: number,
    meta: RequestMeta,
  ) {
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
      await this.writeAudit(
        transaction,
        actorId,
        'SYSTEM_PERMISSION_GROUP_CREATED',
        'PermissionGroup',
        group.id,
        meta,
      );
      return this.toPermissionGroup(group);
    });
  }

  async updatePermissionGroup(
    id: number,
    data: PermissionGroupData,
    actorId: number,
    meta: RequestMeta,
  ) {
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
      await this.writeAudit(
        transaction,
        actorId,
        'SYSTEM_PERMISSION_GROUP_UPDATED',
        'PermissionGroup',
        id,
        meta,
      );
      return this.toPermissionGroup(group);
    });
  }

  deletePermissionGroup(id: number, actorId: number, meta: RequestMeta) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`
          SELECT "id"
          FROM "permission_groups"
          WHERE "id" = ${id}
          FOR UPDATE
        `,
      );
      const assignedUsers = await transaction.userPermissionGroup.count({
        where: { permissionGroupId: id },
      });
      if (assignedUsers > 0) {
        throw new ConflictException('Permission group is assigned to users');
      }
      const group = await transaction.permissionGroup.delete({ where: { id } });
      await this.writeAudit(
        transaction,
        actorId,
        'SYSTEM_PERMISSION_GROUP_DELETED',
        'PermissionGroup',
        id,
        meta,
      );
      return group;
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  private revokeSessions(
    transaction: Prisma.TransactionClient,
    userId: number,
    now: Date,
  ) {
    return transaction.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private createAudited<T extends { id: number }>(
    entityType: string,
    action: string,
    actorId: number,
    meta: RequestMeta,
    create: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const entity = await create(transaction);
      await this.writeAudit(
        transaction,
        actorId,
        action,
        entityType,
        entity.id,
        meta,
      );
      return entity;
    });
  }

  private updateAudited<T>(
    entityType: string,
    action: string,
    entityId: number,
    actorId: number,
    meta: RequestMeta,
    update: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const entity = await update(transaction);
      await this.writeAudit(
        transaction,
        actorId,
        action,
        entityType,
        entityId,
        meta,
      );
      return entity;
    });
  }

  private deleteAudited<T>(
    entityType: string,
    action: string,
    entityId: number,
    actorId: number,
    meta: RequestMeta,
    remove: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const entity = await remove(transaction);
      await this.writeAudit(
        transaction,
        actorId,
        action,
        entityType,
        entityId,
        meta,
      );
      return entity;
    });
  }

  private writeAudit(
    transaction: Prisma.TransactionClient,
    actorId: number,
    action: string,
    entityType: string,
    entityId: number,
    meta: RequestMeta,
  ) {
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

  private toPermissionGroup(group: PermissionGroupPayload) {
    const { permissions, ...fields } = group;
    return {
      ...fields,
      permissions: permissions.map(({ permission }) => permission),
    };
  }

  private userAudit(
    user: Prisma.UserGetPayload<{ select: typeof userPublicSelect }>,
  ) {
    return {
      username: user.username,
      fullName: user.fullName,
      position: user.position,
      rank: user.rank,
      phone: user.phone,
      organizationId: user.organizationId,
      permissionGroupIds: user.permissionGroups.map(
        ({ permissionGroup }) => permissionGroup.id,
      ),
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
