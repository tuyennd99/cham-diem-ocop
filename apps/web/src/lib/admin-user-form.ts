import type { Role, StaffPermission } from '@ocop/shared';
import type { UpdateAdminUserStaffAccessInput } from '../types/admin';
import { hasStaffPermission } from './session-contract';

export function staffPermissionsForForm(input: StaffPermission[]): StaffPermission[] {
  const permissions = [...new Set(input)];
  if (permissions.includes('MANAGE') && !permissions.includes('VIEW')) permissions.push('VIEW');
  return permissions;
}

export function staffAccessPayloadForForm(
  input: UpdateAdminUserStaffAccessInput,
): UpdateAdminUserStaffAccessInput {
  return {
    staffPermissions: staffPermissionsForForm(input.staffPermissions),
    organizationUnitId: input.organizationUnitId,
    reason: input.reason,
  };
}

export function staffAccessWouldRevokeSession(
  current:
    | {
        role: Role;
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
    (['MANAGE', 'VIEW', 'SCORE'] as const).some(
      (permission) =>
        hasStaffPermission(current, permission) !== hasStaffPermission(nextAccess, permission),
    )
  );
}
