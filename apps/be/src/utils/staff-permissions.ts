import { Role, StaffPermission } from '@prisma/client';

export function effectiveStaffPermissions(user: { role: Role; staffPermissions: StaffPermission[] }): StaffPermission[] {
  if (user.role === Role.REGISTRANT) return [];
  const permissions = [...new Set(user.staffPermissions)];
  if (permissions.includes(StaffPermission.MANAGE) && !permissions.includes(StaffPermission.VIEW)) {
    permissions.push(StaffPermission.VIEW);
  }
  return permissions;
}
