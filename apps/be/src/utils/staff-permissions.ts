import { BadRequestException } from '@nestjs/common';
import { Role, StaffPermission } from '@prisma/client';

export function effectiveStaffPermissions(user: { role: Role; staffPermissions: StaffPermission[] }): StaffPermission[] {
  if (user.role === Role.REGISTRANT) return [];
  const permissions = [...new Set(user.staffPermissions)];
  if (permissions.includes(StaffPermission.MANAGE) && !permissions.includes(StaffPermission.VIEW)) {
    permissions.push(StaffPermission.VIEW);
  }
  return permissions;
}

export function staffRole(permissions: StaffPermission[]): Role {
  if (permissions.includes(StaffPermission.MANAGE)) return Role.ADMIN;
  if (permissions.includes(StaffPermission.SCORE)) return Role.JUDGE;
  if (permissions.includes(StaffPermission.VIEW)) return Role.VIEWER;
  throw new BadRequestException('Staff must have at least one permission');
}
