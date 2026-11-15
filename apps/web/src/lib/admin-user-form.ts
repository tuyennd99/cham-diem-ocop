import { STAFF_PERMISSION, type Role, type StaffPermission } from '@ocop/shared';
import type { UpdateAdminUserStaffAccessInput } from '../types/admin';
import { hasStaffPermission } from './session-contract';

export function staffPermissionsForForm(input: StaffPermission[]): StaffPermission[] {
  const permissions = [...new Set(input)];
  if (permissions.includes(STAFF_PERMISSION.MANAGE) && !permissions.includes(STAFF_PERMISSION.VIEW))
    permissions.push(STAFF_PERMISSION.VIEW);
  return permissions;
}

export function staffAccessPayloadForForm(
  input: UpdateAdminUserStaffAccessInput,
): UpdateAdminUserStaffAccessInput {
  return {
    staffPermissions: staffPermissionsForForm(input.staffPermissions),
    ...(input.roles ? { roles: [...new Set(input.roles)] } : {}),
    organizationUnitId: input.organizationUnitId,
    reason: input.reason,
  };
}

export function staffAccessWouldRevokeSession(
  current:
    | {
        role: Role;
        roles?: Role[];
        staffPermissions: StaffPermission[];
        organizationUnitId: string | null;
      }
    | null
    | undefined,
  next: UpdateAdminUserStaffAccessInput,
): boolean {
  if (!current) return false;
  const nextAccess = { ...current, staffPermissions: next.staffPermissions };
  return (
    current.organizationUnitId !== next.organizationUnitId ||
    ([STAFF_PERMISSION.MANAGE, STAFF_PERMISSION.VIEW, STAFF_PERMISSION.SCORE] as const).some(
      (permission) =>
        hasStaffPermission(current, permission) !== hasStaffPermission(nextAccess, permission),
    )
  );
}
