import type { StaffPermission } from '@ocop/shared';

export function staffPermissionsForForm(input: StaffPermission[]): StaffPermission[] {
  const permissions = [...new Set(input)];
  if (permissions.includes('MANAGE') && !permissions.includes('VIEW')) permissions.push('VIEW');
  return permissions;
}
