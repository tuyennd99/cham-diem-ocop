import { BadRequestException } from '@nestjs/common';
import { Role, StaffPermission } from '@prisma/client';

export function effectiveStaffPermissions(user: {
  role: Role;
  roles?: Role[];
  staffPermissions: StaffPermission[];
}): StaffPermission[] {
  const roles = user.roles ?? [];
  const hasStaffRole =
    user.role !== Role.REGISTRANT ||
    roles.some((r) => r !== Role.REGISTRANT) ||
    user.staffPermissions.length > 0;
  if (!hasStaffRole) return [];
  const permissions = [...new Set(user.staffPermissions)];
  if (
    roles.includes(Role.ADMIN) &&
    !permissions.includes(StaffPermission.MANAGE)
  ) {
    permissions.push(StaffPermission.MANAGE);
  }
  if (
    roles.includes(Role.VIEWER) &&
    !permissions.includes(StaffPermission.VIEW)
  ) {
    permissions.push(StaffPermission.VIEW);
  }
  if (
    roles.includes(Role.JUDGE) &&
    !permissions.includes(StaffPermission.SCORE)
  ) {
    permissions.push(StaffPermission.SCORE);
  }
  if (
    permissions.includes(StaffPermission.MANAGE) &&
    !permissions.includes(StaffPermission.VIEW)
  ) {
    permissions.push(StaffPermission.VIEW);
  }
  if (
    user.role === Role.REGISTRANT &&
    !roles.some((r) => r !== Role.REGISTRANT)
  ) {
    return [];
  }
  return permissions;
}

export function effectiveUserRoles(user: {
  role: Role;
  roles?: Role[];
  staffPermissions: StaffPermission[];
}): Role[] {
  const result = new Set<Role>();
  if (user.role === Role.REGISTRANT) {
    result.add(Role.REGISTRANT);
  }
  const perms = effectiveStaffPermissions(user);
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    for (const r of user.roles) {
      if (r === Role.REGISTRANT) {
        if (
          !perms.includes(StaffPermission.SCORE) &&
          user.role !== Role.JUDGE
        ) {
          result.add(Role.REGISTRANT);
        }
      } else if (
        (r === Role.ADMIN && perms.includes(StaffPermission.MANAGE)) ||
        (r === Role.VIEWER && perms.includes(StaffPermission.VIEW)) ||
        (r === Role.JUDGE && perms.includes(StaffPermission.SCORE))
      ) {
        result.add(r);
      }
    }
  }
  if (perms.includes(StaffPermission.MANAGE)) result.add(Role.ADMIN);
  if (perms.includes(StaffPermission.VIEW)) result.add(Role.VIEWER);
  if (perms.includes(StaffPermission.SCORE)) result.add(Role.JUDGE);
  if (!result.size) result.add(user.role);
  return [...result];
}

export function resolveRolesAndPermissions(input: {
  roles?: Role[];
  staffPermissions?: StaffPermission[];
  currentRole?: Role;
  currentRoles?: Role[];
}): {
  role: Role;
  roles: Role[];
  staffPermissions: StaffPermission[];
} {
  let roles = input.roles ? [...new Set(input.roles)] : undefined;
  let perms = input.staffPermissions
    ? [...new Set(input.staffPermissions)]
    : undefined;

  if (roles && roles.length > 0) {
    if (roles.includes(Role.REGISTRANT) && roles.includes(Role.JUDGE)) {
      throw new BadRequestException(
        'Một tài khoản không được đồng thời có vai trò Người dùng (REGISTRANT) và Giám khảo (JUDGE).',
      );
    }
    const derivedPerms = new Set<StaffPermission>(perms ?? []);
    if (roles.includes(Role.ADMIN)) derivedPerms.add(StaffPermission.MANAGE);
    if (roles.includes(Role.VIEWER)) derivedPerms.add(StaffPermission.VIEW);
    if (roles.includes(Role.JUDGE)) derivedPerms.add(StaffPermission.SCORE);
    if (derivedPerms.has(StaffPermission.MANAGE)) {
      derivedPerms.add(StaffPermission.VIEW);
    }
    if (
      derivedPerms.has(StaffPermission.SCORE) &&
      roles.includes(Role.REGISTRANT)
    ) {
      throw new BadRequestException(
        'Một tài khoản không được đồng thời có vai trò Người dùng (REGISTRANT) và Giám khảo (JUDGE).',
      );
    }
    perms = [...derivedPerms];
  } else if (perms) {
    if (
      perms.includes(StaffPermission.MANAGE) &&
      !perms.includes(StaffPermission.VIEW)
    ) {
      perms.push(StaffPermission.VIEW);
    }
    const derivedRoles = new Set<Role>();
    const hadRegistrant =
      input.currentRoles?.includes(Role.REGISTRANT) ||
      (input.currentRole === Role.REGISTRANT && !perms.length);
    if (hadRegistrant) {
      if (perms.includes(StaffPermission.SCORE)) {
        throw new BadRequestException(
          'Một tài khoản không được đồng thời có vai trò Người dùng (REGISTRANT) và Giám khảo (JUDGE).',
        );
      }
      derivedRoles.add(Role.REGISTRANT);
    }
    if (perms.includes(StaffPermission.MANAGE)) derivedRoles.add(Role.ADMIN);
    if (perms.includes(StaffPermission.SCORE)) derivedRoles.add(Role.JUDGE);
    if (perms.includes(StaffPermission.VIEW)) derivedRoles.add(Role.VIEWER);
    roles = [...derivedRoles];
  } else {
    roles =
      input.currentRoles ??
      (input.currentRole ? [input.currentRole] : [Role.REGISTRANT]);
    perms = [];
  }

  if (
    roles.includes(Role.REGISTRANT) &&
    (roles.includes(Role.JUDGE) || perms.includes(StaffPermission.SCORE))
  ) {
    throw new BadRequestException(
      'Một tài khoản không được đồng thời có vai trò Người dùng (REGISTRANT) và Giám khảo (JUDGE).',
    );
  }

  const primaryRole = perms.includes(StaffPermission.MANAGE)
    ? Role.ADMIN
    : perms.includes(StaffPermission.SCORE)
      ? Role.JUDGE
      : perms.includes(StaffPermission.VIEW)
        ? Role.VIEWER
        : roles.includes(Role.REGISTRANT)
          ? Role.REGISTRANT
          : (input.currentRole ?? Role.VIEWER);

  return {
    role: primaryRole,
    roles,
    staffPermissions: perms,
  };
}
