import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, Role, StaffPermission } from '@prisma/client';
import type { AdminUserSortBy, OrganizationUnitSortBy } from '@ocop/shared';
import { USER_KIND } from '../constants/auth';
import {
  ADMIN_USER_SORT_BY,
  ORGANIZATION_UNIT_SORT_BY,
  SORT_DIRECTION,
} from '../constants/products';
import type {
  AdminUsersQueryDto,
  CreateAdminUserDto,
  CreateOrganizationUnitDto,
  OrganizationUnitsQueryDto,
  UpdateAdminUserProfileDto,
  UpdateAdminUserStatusDto,
  UpdateOrganizationUnitDto,
} from '../dtos/admin-users.dto';
import {
  computePaginationSkip,
  computeSafePaginationSkip,
  MAX_DB_INT4,
} from '../dtos/common.dto';
import { type OrderByBuilder, resolveOrderBy } from '../prisma/order-by';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import type { RequestMeta } from '../types/auth';
import { writeAudit } from '../utils/audit-log';
import {
  applyStaffAccess,
  assertStaffManager,
  createStaff,
  lockStaffMutation,
} from '../utils/staff-access';

const ADMIN_USER_ORDER_BY: Record<
  AdminUserSortBy,
  OrderByBuilder<Prisma.UserOrderByWithRelationInput>
> = {
  [ADMIN_USER_SORT_BY.FULL_NAME]: (dir = SORT_DIRECTION.ASC) => [
    { fullName: dir },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_USER_SORT_BY.EMAIL]: (dir = SORT_DIRECTION.ASC) => [
    { email: dir },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_USER_SORT_BY.UNIT]: (dir = SORT_DIRECTION.ASC) => [
    { organizationUnit: { name: dir } },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_USER_SORT_BY.VERIFIED]: (dir = SORT_DIRECTION.ASC) => [
    { verified: dir },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_USER_SORT_BY.IS_ACTIVE]: (dir = SORT_DIRECTION.ASC) => [
    { isActive: dir },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_USER_SORT_BY.CREATED_AT]: (dir = SORT_DIRECTION.DESC) => [
    { createdAt: dir },
    { id: dir },
  ],
};

const DEFAULT_ADMIN_USER_ORDER_BY: Prisma.UserOrderByWithRelationInput[] = [
  { createdAt: SORT_DIRECTION.DESC },
  { id: SORT_DIRECTION.DESC },
];

const ORGANIZATION_UNIT_ORDER_BY: Record<
  OrganizationUnitSortBy,
  OrderByBuilder<Prisma.OrganizationUnitOrderByWithRelationInput>
> = {
  [ORGANIZATION_UNIT_SORT_BY.CODE]: (dir = SORT_DIRECTION.ASC) => [
    { code: dir },
    { id: SORT_DIRECTION.ASC },
  ],
  [ORGANIZATION_UNIT_SORT_BY.NAME]: (dir = SORT_DIRECTION.ASC) => [
    { name: dir },
    { id: SORT_DIRECTION.ASC },
  ],
  [ORGANIZATION_UNIT_SORT_BY.MANAGING_AGENCY]: (dir = SORT_DIRECTION.ASC) => [
    { managingAgency: { name: dir } },
    { order: SORT_DIRECTION.ASC },
    { id: SORT_DIRECTION.ASC },
  ],
  [ORGANIZATION_UNIT_SORT_BY.DESCRIPTION]: (dir = SORT_DIRECTION.ASC) => [
    { description: { sort: dir, nulls: 'last' } },
    { order: SORT_DIRECTION.ASC },
    { id: SORT_DIRECTION.ASC },
  ],
  [ORGANIZATION_UNIT_SORT_BY.IS_ACTIVE]: (dir = SORT_DIRECTION.ASC) => [
    { isActive: dir },
    { order: SORT_DIRECTION.ASC },
    { id: SORT_DIRECTION.ASC },
  ],
  [ORGANIZATION_UNIT_SORT_BY.ORDER]: (dir = SORT_DIRECTION.ASC) => [
    { order: dir },
    { id: SORT_DIRECTION.ASC },
  ],
};

const DEFAULT_ORGANIZATION_UNIT_ORDER_BY: Prisma.OrganizationUnitOrderByWithRelationInput[] =
  [{ order: SORT_DIRECTION.ASC }, { id: SORT_DIRECTION.ASC }];

const unitSummarySelect = {
  id: true,
  code: true,
  name: true,
  managingAgencyId: true,
  managingAgency: { select: { id: true, code: true, name: true } },
} as const;

const adminUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  roles: true,
  staffPermissions: true,
  organizationUnitId: true,
  organizationUnit: { select: unitSummarySelect },
  verified: true,
  isActive: true,
  createdAt: true,
} as const;

const organizationUnitSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  order: true,
  isActive: true,
  managingAgencyId: true,
  managingAgency: { select: { id: true, code: true, name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: AdminUsersQueryDto) {
    const {
      page,
      limit,
      q,
      permission,
      role,
      organizationUnitId,
      isActive,
      verified,
      kind,
      sortBy,
      sortDirection,
    } = query;
    const skip = computePaginationSkip(page, limit);
    const conditions: Prisma.UserWhereInput[] = [];
    if (q) {
      conditions.push({
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (permission === StaffPermission.VIEW) {
      conditions.push({
        OR: [
          { staffPermissions: { has: StaffPermission.VIEW } },
          { staffPermissions: { has: StaffPermission.MANAGE } },
        ],
        role: { not: Role.REGISTRANT },
      });
    } else if (permission) {
      conditions.push({
        staffPermissions: { has: permission },
        role: { not: Role.REGISTRANT },
      });
    }
    if (role) {
      conditions.push({
        OR: [{ role }, { roles: { has: role } }],
      });
    }
    const where: Prisma.UserWhereInput = {
      ...(kind
        ? kind === USER_KIND.STAFF
          ? { role: { not: Role.REGISTRANT } }
          : {
              OR: [
                { role: Role.REGISTRANT },
                { roles: { has: Role.REGISTRANT } },
              ],
            }
        : {}),
      ...(organizationUnitId ? { organizationUnitId } : {}),
      ...(isActive === undefined ? {} : { isActive }),
      ...(verified === undefined ? {} : { verified }),
      ...(conditions.length ? { AND: conditions } : {}),
    };
    const orderBy = resolveOrderBy(
      sortBy,
      sortDirection,
      ADMIN_USER_ORDER_BY,
      DEFAULT_ADMIN_USER_ORDER_BY,
    );
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.user.findMany({
          where,
          select: adminUserSelect,
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.user.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { data, total };
  }

  findUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: adminUserSelect,
    });
  }

  createUser(input: CreateAdminUserDto, actorId: string, meta: RequestMeta) {
    return this.prisma.$transaction((tx) =>
      createStaff(tx, { ...input, phone: input.phone ?? null }, actorId, meta),
    );
  }

  updateUserProfile(
    id: string,
    input: UpdateAdminUserProfileDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, ...inputChanges } = input;
    const changes = Object.fromEntries(
      Object.entries(inputChanges).filter(([, value]) => value !== undefined),
    ) as Omit<UpdateAdminUserProfileDto, 'reason'>;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await tx.user.findUnique({
        where: { id },
        select: adminUserSelect,
      });
      if (!before) return null;
      if (!Object.keys(changes).length) return before;
      const after = await tx.user.update({
        where: { id },
        data: changes,
        select: adminUserSelect,
      });
      await writeAudit(tx, {
        actorId,
        action: 'user.profile_update',
        entityType: 'User',
        entityId: id,
        beforeData: before,
        afterData: after,
        reason,
        ...meta,
      });
      return after;
    });
  }

  updateUserStatus(
    id: string,
    input: UpdateAdminUserStatusDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await assertStaffManager(tx, actorId);
        const current = await tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            role: true,
            roles: true,
            staffPermissions: true,
            organizationUnitId: true,
            isActive: true,
            verified: true,
          },
        });
        if (!current) return null;
        if (
          current.role === Role.REGISTRANT &&
          current.staffPermissions.length === 0
        ) {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE`,
          );
          const before = await tx.user.findUnique({
            where: { id },
            select: {
              id: true,
              role: true,
              roles: true,
              staffPermissions: true,
              organizationUnitId: true,
              isActive: true,
              verified: true,
            },
          });
          if (!before) return null;
          if (
            before.role === Role.REGISTRANT &&
            before.staffPermissions.length === 0
          ) {
            if (before.isActive === input.isActive) {
              return tx.user.findUnique({
                where: { id },
                select: adminUserSelect,
              });
            }
            const after = await tx.user.update({
              where: { id },
              data: {
                isActive: input.isActive,
                tokenVersion: { increment: 1 },
              },
              select: adminUserSelect,
            });
            await writeAudit(tx, {
              actorId,
              action: 'user.status_update',
              entityType: 'User',
              entityId: id,
              beforeData: {
                role: before.role,
                isActive: before.isActive,
                verified: before.verified,
              },
              afterData: {
                role: after.role,
                isActive: after.isActive,
                verified: after.verified,
              },
              reason: input.reason,
              requestId: meta.requestId,
              ipAddress: meta.ipAddress,
              userAgent: meta.userAgent,
            });
            return after;
          }
        }
        await lockStaffMutation(tx);
        await assertStaffManager(tx, actorId);
        const lockedCurrent = await tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            role: true,
            roles: true,
            staffPermissions: true,
            organizationUnitId: true,
            isActive: true,
            verified: true,
          },
        });
        if (!lockedCurrent) return null;
        if (
          lockedCurrent.role !== Role.REGISTRANT ||
          lockedCurrent.staffPermissions.length > 0
        ) {
          await applyStaffAccess(
            tx,
            id,
            {
              staffPermissions: lockedCurrent.staffPermissions,
              roles: lockedCurrent.roles,
              organizationUnitId: lockedCurrent.organizationUnitId,
              isActive: input.isActive,
              reason: input.reason,
            },
            actorId,
            meta,
            'user.status_update',
          );
          return tx.user.findUnique({ where: { id }, select: adminUserSelect });
        }
        if (lockedCurrent.isActive === input.isActive) {
          return tx.user.findUnique({ where: { id }, select: adminUserSelect });
        }
        const after = await tx.user.update({
          where: { id },
          data: { isActive: input.isActive, tokenVersion: { increment: 1 } },
          select: adminUserSelect,
        });
        await writeAudit(tx, {
          actorId,
          action: 'user.status_update',
          entityType: 'User',
          entityId: id,
          beforeData: {
            role: lockedCurrent.role,
            isActive: lockedCurrent.isActive,
            verified: lockedCurrent.verified,
          },
          afterData: {
            role: after.role,
            isActive: after.isActive,
            verified: after.verified,
          },
          reason: input.reason,
          ...meta,
        });
        return after;
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  findUserRole(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
  }

  resetUserPassword(
    id: string,
    password: string,
    reason: string,
    actorId: string,
    meta: RequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await tx.user.findUnique({
        where: { id },
        select: { id: true, email: true, verified: true },
      });
      if (!before) return null;
      const after = await tx.user.update({
        where: { id },
        data: { password, tokenVersion: { increment: 1 } },
        select: adminUserSelect,
      });
      await writeAudit(tx, {
        actorId,
        action: 'user.password_reset',
        entityType: 'User',
        entityId: id,
        beforeData: before,
        afterData: {
          email: after.email,
          verified: after.verified,
          passwordReset: true,
        },
        reason,
        ...meta,
      });
      return after;
    });
  }

  async listOrganizationUnits(query: OrganizationUnitsQueryDto) {
    const {
      page,
      limit,
      q,
      isActive,
      managingAgencyId,
      sortBy,
      sortDirection,
    } = query;
    const skip = computeSafePaginationSkip(page, limit);
    const where: Prisma.OrganizationUnitWhereInput = {
      isActive,
      ...(managingAgencyId ? { managingAgencyId } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (skip > MAX_DB_INT4) {
      return {
        data: [],
        total: await this.prisma.organizationUnit.count({ where }),
      };
    }
    const orderBy = resolveOrderBy(
      sortBy,
      sortDirection,
      ORGANIZATION_UNIT_ORDER_BY,
      DEFAULT_ORGANIZATION_UNIT_ORDER_BY,
    );
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.organizationUnit.findMany({
          where,
          select: organizationUnitSelect,
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.organizationUnit.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { data, total };
  }

  createOrganizationUnit(
    input: CreateOrganizationUnitDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      if (data.managingAgencyId) {
        const agency = await tx.managingAgency.findUnique({
          where: { id: data.managingAgencyId },
          select: { id: true, isActive: true },
        });
        if (!agency || !agency.isActive) {
          throw new BadRequestException(
            'Managing agency is inactive or not found',
          );
        }
      }
      const unit = await tx.organizationUnit.create({
        data,
        select: organizationUnitSelect,
      });
      await writeAudit(tx, {
        actorId,
        action: 'organization_unit.create',
        entityType: 'OrganizationUnit',
        entityId: unit.id,
        afterData: unit,
        reason,
        ...meta,
      });
      return unit;
    });
  }

  updateOrganizationUnit(
    id: string,
    input: UpdateOrganizationUnitDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, ...changes } = input;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('organization_units')} WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await tx.organizationUnit.findUnique({
        where: { id },
        select: organizationUnitSelect,
      });
      if (!before) throw new NotFoundException('Organization unit not found');
      if (changes.managingAgencyId) {
        const agency = await tx.managingAgency.findUnique({
          where: { id: changes.managingAgencyId },
          select: { id: true, isActive: true },
        });
        if (!agency || !agency.isActive) {
          throw new BadRequestException(
            'Managing agency is inactive or not found',
          );
        }
      }
      if (before.isActive && changes.isActive === false) {
        const unitJudges = await tx.user.findMany({
          where: {
            organizationUnitId: id,
            role: { not: Role.REGISTRANT },
            staffPermissions: { has: StaffPermission.SCORE },
            isActive: true,
            verified: true,
          },
          select: { id: true },
        });
        if (unitJudges.length > 0) {
          const judgeIds = unitJudges.map((j) => j.id);
          const openStatuses = [
            ProductStatus.SUBMITTED,
            ProductStatus.APPROVED,
            ProductStatus.SCORING,
          ];
          const openProductAssignments = await tx.productJudgeAssignment.count({
            where: {
              judgeId: { in: judgeIds },
              isActive: true,
              product: { status: { in: openStatuses } },
            },
          });
          const openCategoryAssignments = await tx.product.count({
            where: {
              status: { in: openStatuses },
              judgeAssignments: { none: {} },
              category: {
                assignments: { some: { judgeId: { in: judgeIds } } },
              },
            },
          });
          if (openProductAssignments > 0 || openCategoryAssignments > 0) {
            throw new ConflictException(
              'Reassign open products before deactivating organization unit',
            );
          }
        }
      }
      const after = await tx.organizationUnit.update({
        where: { id },
        data: changes,
        select: organizationUnitSelect,
      });
      await writeAudit(tx, {
        actorId,
        action: 'organization_unit.update',
        entityType: 'OrganizationUnit',
        entityId: id,
        beforeData: before,
        afterData: after,
        reason,
        ...meta,
      });
      return after;
    });
  }
}
