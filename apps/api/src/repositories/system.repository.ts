import { ConflictException, Injectable } from '@nestjs/common';
import { EntityStatus, Prisma, UserStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';

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
} satisfies Prisma.UserSelect;

const organizationSummary = { id: true, code: true, name: true } as const;
const programInclude = {
  assigningOrganization: { select: organizationSummary },
  leadOrganization: { select: organizationSummary },
  collaborators: {
    include: { organization: { select: organizationSummary } },
    orderBy: { organizationId: 'asc' as const },
  },
  tasks: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    include: {
      workspaces: {
        include: { versions: { select: { status: true } } },
      },
    },
  },
} satisfies Prisma.ProgramInclude;

type ProgramPayload = Prisma.ProgramGetPayload<{
  include: typeof programInclude;
}>;

interface CreateUserData {
  username: string;
  fullName: string;
  position?: string;
  rank?: string;
  phone?: string;
  passwordHash: string;
  organizationId: number;
}

interface UpdateUserData {
  username?: string;
  fullName?: string;
  position?: string;
  rank?: string;
  phone?: string;
  organizationId?: number;
}

interface OrganizationData {
  code?: string;
  name?: string;
  isAssigningAuthority?: boolean;
  isExecutingUnit?: boolean;
  status?: EntityStatus;
}

interface ProgramData {
  code?: string;
  name?: string;
  description?: string;
  assigningOrganizationId?: number;
  leadOrganizationId?: number;
  collaboratorOrganizationIds?: number[];
  status?: EntityStatus;
}

@Injectable()
export class SystemRepository {
  constructor(private readonly prisma: PrismaService) {}

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
      const before = await transaction.user.findUniqueOrThrow({
        where: { id },
        select: userPublicSelect,
      });
      const user = await transaction.user.update({
        where: { id },
        data,
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

  findOrganizationsByIds(ids: number[]) {
    return this.prisma.organization.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        status: true,
        isAssigningAuthority: true,
        isExecutingUnit: true,
      },
    });
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

  async listPrograms() {
    const rows = await this.prisma.program.findMany({
      include: programInclude,
      orderBy: { code: 'asc' },
    });
    return rows.map((row) => this.toProgram(row));
  }

  async findProgramById(id: number) {
    const row = await this.prisma.program.findUnique({
      where: { id },
      include: programInclude,
    });
    return row ? this.toProgram(row) : null;
  }

  findProgramByCode(code: string) {
    return this.prisma.program.findUnique({ where: { code } });
  }

  createProgram(
    data: Required<
      Pick<
        ProgramData,
        'code' | 'name' | 'assigningOrganizationId' | 'leadOrganizationId'
      >
    > &
      ProgramData,
    actorId: number,
    meta: RequestMeta,
  ) {
    const { collaboratorOrganizationIds = [], ...program } = data;
    return this.createAudited(
      'Program',
      'SYSTEM_PROGRAM_CREATED',
      actorId,
      meta,
      async (transaction) => {
        const row = await transaction.program.create({
          data: {
            ...program,
            collaborators: {
              create: collaboratorOrganizationIds.map((organizationId) => ({
                organizationId,
              })),
            },
          },
          include: programInclude,
        });
        return this.toProgram(row);
      },
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
      async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "programs" WHERE "id" = ${id} FOR UPDATE`,
        );
        const before = await transaction.program.findUniqueOrThrow({
          where: { id },
          select: {
            assigningOrganizationId: true,
            leadOrganizationId: true,
            collaborators: { select: { organizationId: true } },
          },
        });
        const assignmentChanged =
          (data.assigningOrganizationId !== undefined &&
            data.assigningOrganizationId !== before.assigningOrganizationId) ||
          (data.leadOrganizationId !== undefined &&
            data.leadOrganizationId !== before.leadOrganizationId) ||
          (data.collaboratorOrganizationIds !== undefined &&
            !this.sameIds(
              data.collaboratorOrganizationIds,
              before.collaborators.map(({ organizationId }) => organizationId),
            ));
        if (
          assignmentChanged &&
          (await transaction.task.count({
            where: {
              programId: id,
              OR: [
                { closedAt: { not: null } },
                { completedAt: { not: null } },
                { workspaces: { some: {} } },
              ],
            },
          })) > 0
        ) {
          throw new ConflictException(
            'Program assignment cannot be changed after reporting starts',
          );
        }
        if (data.collaboratorOrganizationIds !== undefined) {
          await transaction.programCollaborator.deleteMany({
            where: { programId: id },
          });
          if (data.collaboratorOrganizationIds.length > 0) {
            await transaction.programCollaborator.createMany({
              data: data.collaboratorOrganizationIds.map((organizationId) => ({
                programId: id,
                organizationId,
              })),
            });
          }
        }
        const program = { ...data };
        delete program.collaboratorOrganizationIds;
        const row = await transaction.program.update({
          where: { id },
          data: program,
          include: programInclude,
        });
        return this.toProgram(row);
      },
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
    };
  }

  private toProgram(row: ProgramPayload) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      status: row.status,
      assigningOrganizationId: row.assigningOrganizationId,
      leadOrganizationId: row.leadOrganizationId,
      collaboratorOrganizationIds: row.collaborators.map(
        ({ organizationId }) => organizationId,
      ),
      assigningOrganization: row.assigningOrganization,
      leadOrganization: row.leadOrganization,
      collaboratorOrganizations: row.collaborators.map(
        ({ organization }) => organization,
      ),
      tasks: row.tasks.map(({ workspaces, ...task }) => ({
        ...task,
        hasReports: workspaces.some((workspace) =>
          workspace.versions.some((version) => version.status !== 'DRAFT'),
        ),
        workspaces: workspaces.map((workspace) => ({
          id: workspace.id,
          kind: workspace.kind,
          ownerOrganizationId: workspace.ownerOrganizationId,
          ownerUserId: workspace.ownerUserId,
          status: workspace.status,
        })),
      })),
    };
  }

  private sameIds(left: number[], right: number[]) {
    const a = [...left].sort((x, y) => x - y);
    const b = [...right].sort((x, y) => x - y);
    return (
      a.length === b.length && a.every((value, index) => value === b[index])
    );
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
