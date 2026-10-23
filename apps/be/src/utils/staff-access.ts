import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Role, StaffPermission } from '@prisma/client';
import type { User } from '@prisma/client';
import type { UpdateStaffAccessDto } from '../dtos/admin.dto';
import type { RequestMeta } from '../types/auth';
import { databaseObject } from '../prisma/sql';
import { writeAudit } from './audit-log';
import { effectiveStaffPermissions, staffRole } from './staff-permissions';

export type StaffAccessRecord = Pick<
  User,
  | 'id'
  | 'role'
  | 'staffPermissions'
  | 'organizationUnitId'
  | 'isActive'
  | 'verified'
>;

const accessSelect = {
  id: true,
  role: true,
  staffPermissions: true,
  organizationUnitId: true,
  isActive: true,
  verified: true,
} as const;

export async function lockStaffMutation(tx: Prisma.TransactionClient) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM ${databaseObject('product_categories')} ORDER BY "id" FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM ${databaseObject('users')}
      WHERE "role" <> ${Role.REGISTRANT}::${databaseObject('Role')} ORDER BY "id" FOR UPDATE`,
  );
}

export async function assertStaffManager(
  tx: Prisma.TransactionClient,
  actorId: string,
) {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: {
      role: true,
      staffPermissions: true,
      isActive: true,
      verified: true,
    },
  });
  if (
    !actor?.isActive ||
    !actor.verified ||
    !effectiveStaffPermissions(actor).includes(StaffPermission.MANAGE)
  ) {
    throw new ForbiddenException('Insufficient permission');
  }
}

async function lockActiveUnit(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM ${databaseObject('organization_units')} WHERE "id" = ${id} FOR UPDATE`,
  );
  const unit = await tx.organizationUnit.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  if (!unit) throw new BadRequestException('Organization unit must be active');
}

export async function createStaff(
  tx: Prisma.TransactionClient,
  input: {
    email: string;
    fullName: string;
    phone: string | null;
    password: string;
    organizationUnitId: string;
    staffPermissions: StaffPermission[];
    reason: string;
  },
  actorId: string,
  meta: RequestMeta,
  action = 'user.create',
) {
  await lockStaffMutation(tx);
  await assertStaffManager(tx, actorId);
  const staffPermissions = effectiveStaffPermissions({
    role: Role.VIEWER,
    staffPermissions: input.staffPermissions,
  });
  if (!staffPermissions.length) {
    throw new BadRequestException(
      'Active staff must have at least one permission',
    );
  }
  await lockActiveUnit(tx, input.organizationUnitId);
  if (
    await tx.user.findFirst({
      where: { email: { equals: input.email, mode: 'insensitive' } },
      select: { id: true },
    })
  ) {
    throw new ConflictException('Email is already registered');
  }
  const user = await tx.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      password: input.password,
      role: staffRole(staffPermissions),
      staffPermissions,
      organizationUnitId: input.organizationUnitId,
      verified: true,
      isActive: true,
    },
    select: {
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
    },
  });
  await writeAudit(tx, {
    actorId,
    action,
    entityType: 'User',
    entityId: user.id,
    afterData: user,
    reason: input.reason,
    ...meta,
  });
  return user;
}

export async function applyStaffAccess(
  tx: Prisma.TransactionClient,
  id: string,
  input: UpdateStaffAccessDto,
  actorId: string,
  meta: RequestMeta,
  action = 'user.staff_access_update',
): Promise<StaffAccessRecord | null> {
  await assertStaffManager(tx, actorId);
  const before = await tx.user.findFirst({
    where: { id, role: { not: Role.REGISTRANT } },
    select: accessSelect,
  });
  if (!before) return null;
  const permissions = effectiveStaffPermissions({
    role: before.role,
    staffPermissions: input.staffPermissions,
  });
  const currentPermissions = effectiveStaffPermissions(before);
  if (input.isActive && !permissions.length) {
    throw new BadRequestException(
      'Active staff must have at least one permission',
    );
  }
  if (before.organizationUnitId && input.organizationUnitId === null) {
    throw new BadRequestException('Organization unit cannot be cleared');
  }
  if (
    input.organizationUnitId !== null &&
    input.organizationUnitId !== before.organizationUnitId
  ) {
    await lockActiveUnit(tx, input.organizationUnitId);
  }
  if (
    before.isActive &&
    before.verified &&
    before.staffPermissions.includes(StaffPermission.MANAGE) &&
    (!input.isActive || !permissions.includes(StaffPermission.MANAGE))
  ) {
    const others = await tx.user.count({
      where: {
        id: { not: before.id },
        role: { not: Role.REGISTRANT },
        isActive: true,
        verified: true,
        staffPermissions: { has: StaffPermission.MANAGE },
      },
    });
    if (!others) {
      throw new ConflictException(
        'Cannot remove the last active verified MANAGE account',
      );
    }
  }
  const role = permissions.length ? staffRole(permissions) : before.role;
  const changed =
    before.role !== role ||
    before.isActive !== input.isActive ||
    before.organizationUnitId !== input.organizationUnitId ||
    currentPermissions.length !== permissions.length ||
    currentPermissions.some(
      (permission) => !permissions.includes(permission),
    );
  if (!changed) return before;
  if (
    before.staffPermissions.includes(StaffPermission.SCORE) &&
    (!input.isActive || !permissions.includes(StaffPermission.SCORE))
  ) {
    const openProducts = await tx.product.count({
      where: {
        status: { in: ['SUBMITTED', 'SCORING'] },
        category: { assignments: { some: { judgeId: id } } },
      },
    });
    if (openProducts) {
      throw new ConflictException(
        'Reassign open products before removing scoring access',
      );
    }
    await tx.judgeAssignment.deleteMany({ where: { judgeId: id } });
  }
  const after = await tx.user.update({
    where: { id },
    data: {
      role,
      staffPermissions: permissions,
      organizationUnitId: input.organizationUnitId,
      isActive: input.isActive,
      tokenVersion: { increment: 1 },
    },
    select: accessSelect,
  });
  await writeAudit(tx, {
    actorId,
    action,
    entityType: 'User',
    entityId: id,
    beforeData: before,
    afterData: after,
    reason: input.reason,
    ...meta,
  });
  return after;
}
