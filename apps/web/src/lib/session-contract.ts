import {
  STAFF_PERMISSION,
  USER_ROLE,
  type OrganizationUnitSummary,
  type Role,
  type StaffPermission,
} from '@ocop/shared';
import type { Session, SessionUser } from '../types/auth';

const roles: Role[] = [USER_ROLE.REGISTRANT, USER_ROLE.JUDGE, USER_ROLE.ADMIN, USER_ROLE.VIEWER];
const staffPermissions: StaffPermission[] = [
  STAFF_PERMISSION.MANAGE,
  STAFF_PERMISSION.VIEW,
  STAFF_PERMISSION.SCORE,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOrganizationUnit(value: unknown): value is OrganizationUnitSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.name === 'string'
  );
}

const LEGACY_ROLE_PERMISSIONS: Partial<Record<Role, readonly StaffPermission[]>> = {
  [USER_ROLE.ADMIN]: [STAFF_PERMISSION.MANAGE, STAFF_PERMISSION.VIEW],
  [USER_ROLE.JUDGE]: [STAFF_PERMISSION.SCORE],
  [USER_ROLE.VIEWER]: [STAFF_PERMISSION.VIEW],
};

function resolveStaffPermissions(role: Role, rawPermissions: unknown): StaffPermission[] {
  if (role === USER_ROLE.REGISTRANT) return [];
  const permissions = Array.isArray(rawPermissions)
    ? rawPermissions.filter((permission): permission is StaffPermission =>
        staffPermissions.includes(permission as StaffPermission),
      )
    : [...(LEGACY_ROLE_PERMISSIONS[role] ?? [])];
  const effective = [...new Set(permissions)];
  if (effective.includes(STAFF_PERMISSION.MANAGE) && !effective.includes(STAFF_PERMISSION.VIEW)) {
    effective.push(STAFF_PERMISSION.VIEW);
  }
  return effective;
}

export function normalizeSession(value: unknown): Session | null {
  if (!isRecord(value) || typeof value.accessToken !== 'string' || !isRecord(value.user))
    return null;
  const user = value.user;
  if (typeof user.id !== 'string' || !roles.includes(user.role as Role)) return null;

  const role = user.role as Role;
  const rawRoles: Role[] = Array.isArray(user.roles)
    ? user.roles.filter((r): r is Role => roles.includes(r as Role))
    : [role];
  const effectivePermissions = resolveStaffPermissions(role, user.staffPermissions);

  const derivedRoles = new Set<Role>(rawRoles.length ? rawRoles : [role]);
  if (effectivePermissions.includes(STAFF_PERMISSION.MANAGE)) {
    derivedRoles.add(USER_ROLE.ADMIN);
    derivedRoles.add(USER_ROLE.VIEWER);
  }
  if (effectivePermissions.includes(STAFF_PERMISSION.VIEW)) {
    derivedRoles.add(USER_ROLE.VIEWER);
  }
  if (effectivePermissions.includes(STAFF_PERMISSION.SCORE)) {
    derivedRoles.add(USER_ROLE.JUDGE);
    derivedRoles.delete(USER_ROLE.REGISTRANT);
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: typeof user.email === 'string' ? user.email : '',
    fullName: typeof user.fullName === 'string' ? user.fullName : '',
    phone: typeof user.phone === 'string' ? user.phone : null,
    role,
    roles: [...derivedRoles],
    verified: user.verified === true,
    staffPermissions: effectivePermissions,
    organizationUnitId:
      typeof user.organizationUnitId === 'string' ? user.organizationUnitId : null,
    organizationUnit: isOrganizationUnit(user.organizationUnit) ? user.organizationUnit : null,
  };
  return { accessToken: value.accessToken, user: sessionUser };
}

export function parseStoredSession(serialized: string | null): Session | null {
  if (!serialized) return null;
  try {
    return normalizeSession(JSON.parse(serialized) as unknown);
  } catch {
    return null;
  }
}

export function serializeSession(session: Session): string {
  return JSON.stringify(normalizeSession(session));
}

export function getSessionScope(session: Session | null): string {
  if (!session) return '';
  return [
    session.user.id,
    session.accessToken,
    [...session.user.staffPermissions].sort().join(','),
  ].join(':');
}

export function hasStaffPermission(
  user: Pick<SessionUser, 'role' | 'staffPermissions'> | null | undefined,
  permission: StaffPermission,
): boolean {
  if (!user || user.role === USER_ROLE.REGISTRANT) return false;
  return (
    user.staffPermissions.includes(permission) ||
    (permission === STAFF_PERMISSION.VIEW &&
      user.staffPermissions.includes(STAFF_PERMISSION.MANAGE))
  );
}

export function hasRoleAccess(
  user: Pick<SessionUser, 'role' | 'roles' | 'staffPermissions'> | null | undefined,
  role: Role,
): boolean {
  if (!user) return false;
  if (role === USER_ROLE.REGISTRANT) {
    if (user.role === USER_ROLE.JUDGE || hasStaffPermission(user, STAFF_PERMISSION.SCORE)) {
      return false;
    }
    return (
      user.role === USER_ROLE.REGISTRANT || Boolean(user.roles?.includes(USER_ROLE.REGISTRANT))
    );
  }
  if (user.role === role || user.roles?.includes(role)) return true;
  if (role === USER_ROLE.ADMIN && hasStaffPermission(user, STAFF_PERMISSION.MANAGE)) return true;
  if (role === USER_ROLE.VIEWER && hasStaffPermission(user, STAFF_PERMISSION.VIEW)) return true;
  if (role === USER_ROLE.JUDGE && hasStaffPermission(user, STAFF_PERMISSION.SCORE)) return true;
  return false;
}
