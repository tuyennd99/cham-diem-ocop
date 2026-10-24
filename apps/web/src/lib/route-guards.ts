import type { Role, StaffPermission } from '@ocop/shared';
import { redirect } from '@tanstack/react-router';
import type { RouterContext } from '../types/router-context';
import { hasStaffPermission } from './session-contract';

export function requireRole(role: Role) {
  return ({ context }: { context: RouterContext }) => {
    const session = context.getSession();
    if (!session) throw redirect({ to: '/login' });
    if (session.user.role !== role) {
      throw redirect({ to: '/403' });
    }
  };
}

export function requirePermission(permission: StaffPermission) {
  return ({ context }: { context: RouterContext }) => {
    const session = context.getSession();
    if (!session) throw redirect({ to: '/login' });
    if (!hasStaffPermission(session.user, permission)) throw redirect({ to: '/403' });
  };
}

export function requireAnyPermission(...permissions: StaffPermission[]) {
  return ({ context }: { context: RouterContext }) => {
    const session = context.getSession();
    if (!session) throw redirect({ to: '/login' });
    if (!permissions.some((permission) => hasStaffPermission(session.user, permission))) {
      throw redirect({ to: '/403' });
    }
  };
}

export function requireAuthenticated() {
  return ({ context }: { context: RouterContext }) => {
    const session = context.getSession();
    if (!session) throw redirect({ to: '/login' });
  };
}
