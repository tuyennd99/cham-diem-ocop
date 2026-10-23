import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, StaffPermission } from '@prisma/client';
import type { AdminUsersQueryDto, CreateAdminUserDto, ResetAdminUserPasswordDto, UpdateAdminUserProfileDto, UpdateAdminUserStatusDto } from '../dtos/admin-users.dto';
import type {
  CreateOrganizationUnitDto,
  OrganizationUnitsQueryDto,
  UpdateOrganizationUnitDto,
} from '../dtos/admin-users.dto';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import type { RequestMeta } from '../types/auth';
import { writeAudit } from '../utils/audit-log';
import { applyStaffAccess, assertStaffManager, createStaff, lockStaffMutation } from '../utils/staff-access';

const adminUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  staffPermissions: true,
  organizationUnitId: true,
  organizationUnit: { select: { id: true, code: true, name: true } },
  verified: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: AdminUsersQueryDto) {
    const { page, limit, q, permission, organizationUnitId, isActive, verified, kind } = query;
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
      throw new BadRequestException('Pagination exceeds the safe integer range');
    }
    const conditions: Prisma.UserWhereInput[] = [];
    if (q) {
      conditions.push({ OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ] });
    }
    if (permission === StaffPermission.VIEW) {
      conditions.push({ OR: [
        { staffPermissions: { has: StaffPermission.VIEW } },
        { staffPermissions: { has: StaffPermission.MANAGE } },
      ] });
    } else if (permission) {
      conditions.push({ staffPermissions: { has: permission } });
    }
    const where: Prisma.UserWhereInput = {
      ...(kind ? { role: kind === 'STAFF' ? { not: Role.REGISTRANT } : Role.REGISTRANT } : {}),
      ...(organizationUnitId ? { organizationUnitId } : {}),
      ...(isActive === undefined ? {} : { isActive }),
      ...(verified === undefined ? {} : { verified }),
      ...(conditions.length ? { AND: conditions } : {}),
    };
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.user.findMany({
          where,
          select: adminUserSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
    return this.prisma.$transaction(async (tx) => {
      await lockStaffMutation(tx);
      await assertStaffManager(tx, actorId);
      const current = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          role: true,
          staffPermissions: true,
          organizationUnitId: true,
          isActive: true,
          verified: true,
        },
      });
      if (!current) return null;
      if (current.role !== Role.REGISTRANT) {
        await applyStaffAccess(
          tx,
          id,
          {
            staffPermissions: current.staffPermissions,
            organizationUnitId: current.organizationUnitId,
            isActive: input.isActive,
            reason: input.reason,
          },
          actorId,
          meta,
          'user.status_update',
        );
        return tx.user.findUnique({ where: { id }, select: adminUserSelect });
      }
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await tx.user.findUnique({
        where: { id },
        select: { id: true, role: true, isActive: true, verified: true },
      });
      if (!before) return null;
      if (before.isActive === input.isActive) {
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
        beforeData: before,
        afterData: { role: after.role, isActive: after.isActive, verified: after.verified },
        reason: input.reason,
        ...meta,
      });
      return after;
    }, { timeout: 15000, maxWait: 10000 });
  }

  findUserRole(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { role: true } });
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
        afterData: { email: after.email, verified: after.verified, passwordReset: true },
        reason,
        ...meta,
      });
      return after;
    });
  }

  async listOrganizationUnits(query: OrganizationUnitsQueryDto) {
    const { page, limit, q, isActive } = query;
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'Pagination exceeds the safe integer range',
      );
    }
    const where: Prisma.OrganizationUnitWhereInput = {
      isActive,
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.organizationUnit.findMany({
          where,
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
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
      const unit = await tx.organizationUnit.create({ data });
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
      const before = await tx.organizationUnit.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Organization unit not found');
      const after = await tx.organizationUnit.update({
        where: { id },
        data: changes,
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
