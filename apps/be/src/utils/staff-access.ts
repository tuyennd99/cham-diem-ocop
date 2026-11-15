import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, ProductStatus, Role, StaffPermission } from '@prisma/client';
import type { User } from '@prisma/client';
import type { UpdateStaffAccessDto } from '../dtos/admin.dto';
import type { RequestMeta } from '../types/auth';
import { databaseObject } from '../prisma/sql';
import { writeAudit } from './audit-log';
import {
  effectiveStaffPermissions,
  effectiveUserRoles,
  resolveRolesAndPermissions,
} from './staff-permissions';

export type StaffAccessRecord = Pick<
  User,
  | 'id'
  | 'role'
  | 'roles'
  | 'staffPermissions'
  | 'organizationUnitId'
  | 'isActive'
  | 'verified'
>;

const accessSelect = {
  id: true,
  role: true,
  roles: true,
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
      roles: true,
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

export async function assertStaffViewerOrManager(
  tx: Prisma.TransactionClient,
  actorId: string,
) {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: {
      role: true,
      roles: true,
      staffPermissions: true,
      isActive: true,
      verified: true,
    },
  });
  const perms = actor ? effectiveStaffPermissions(actor) : [];
  if (
    !actor?.isActive ||
    !actor.verified ||
    (!perms.includes(StaffPermission.VIEW) &&
      !perms.includes(StaffPermission.MANAGE))
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
    staffPermissions?: StaffPermission[];
    roles?: Role[];
    reason: string;
  },
  actorId: string,
  meta: RequestMeta,
  action = 'user.create',
) {
  await lockStaffMutation(tx);
  await assertStaffManager(tx, actorId);
  const resolved = resolveRolesAndPermissions({
    roles: input.roles,
    staffPermissions: input.staffPermissions,
    currentRole: Role.VIEWER,
  });
  if (!resolved.staffPermissions.length && !resolved.roles.includes(Role.REGISTRANT)) {
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
      role: resolved.role,
      roles: resolved.roles,
      staffPermissions: resolved.staffPermissions,
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
      roles: true,
      staffPermissions: true,
      organizationUnitId: true,
      organizationUnit: {
        select: {
          id: true,
          code: true,
          name: true,
          managingAgencyId: true,
          managingAgency: { select: { id: true, code: true, name: true } },
        },
      },
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
    where: {
      id,
      OR: [
        { role: { not: Role.REGISTRANT } },
        ...(Array.isArray(input.roles) && input.roles.length > 0 ? [{ id }] : []),
      ],
    },
    select: accessSelect,
  });
  if (!before) return null;
  const isActive = input.isActive ?? before.isActive;
  const currentPermissions = effectiveStaffPermissions(before);
  const currentRoles = effectiveUserRoles(before);

  const sanitizedDefaultRoles =
    input.roles === undefined
      ? currentRoles.filter(
          (r) =>
            !(
              r === Role.REGISTRANT &&
              input.staffPermissions?.includes(StaffPermission.SCORE)
            ),
        )
      : undefined;

  const resolved = resolveRolesAndPermissions({
    roles: input.roles,
    staffPermissions: input.staffPermissions,
    currentRole: before.role,
    currentRoles: sanitizedDefaultRoles,
  });
  const permissions = resolved.staffPermissions;
  const roles = resolved.roles;

  if (isActive && !permissions.length && !roles.includes(Role.REGISTRANT)) {
    throw new BadRequestException(
      'Active staff must have at least one permission',
    );
  }
  if (
    before.organizationUnitId &&
    input.organizationUnitId === null &&
    !roles.includes(Role.REGISTRANT)
  ) {
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
    currentPermissions.includes(StaffPermission.MANAGE) &&
    (!isActive || !permissions.includes(StaffPermission.MANAGE))
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
  const role = permissions.length
    ? resolved.role
    : roles.includes(Role.REGISTRANT)
      ? Role.REGISTRANT
      : before.role;
  const changed =
    before.role !== role ||
    before.isActive !== isActive ||
    before.organizationUnitId !== input.organizationUnitId ||
    currentPermissions.length !== permissions.length ||
    currentPermissions.some(
      (permission) => !permissions.includes(permission),
    ) ||
    currentRoles.length !== roles.length ||
    currentRoles.some((r) => !roles.includes(r));
  if (!changed) return before;
  if (
    currentPermissions.includes(StaffPermission.SCORE) &&
    (!isActive || !permissions.includes(StaffPermission.SCORE))
  ) {
    const [openCategoryProducts, openProductAssignments] = await Promise.all([
      tx.product.count({
        where: {
          status: {
            in: [
              ProductStatus.SUBMITTED,
              ProductStatus.APPROVED,
              ProductStatus.SCORING,
            ],
          },
          category: { assignments: { some: { judgeId: id } } },
        },
      }),
      tx.productJudgeAssignment.count({
        where: {
          judgeId: id,
          isActive: true,
          product: {
            status: {
              in: [
                ProductStatus.SUBMITTED,
                ProductStatus.APPROVED,
                ProductStatus.SCORING,
              ],
            },
          },
        },
      }),
    ]);
    if (openCategoryProducts || openProductAssignments) {
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
      roles,
      staffPermissions: permissions,
      organizationUnitId: input.organizationUnitId,
      isActive,
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
