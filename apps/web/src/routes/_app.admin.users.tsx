import type { StaffPermission } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';

export const Route = createFileRoute('/_app/admin/users')({
  validateSearch: (search: Record<string, unknown>) => ({
    permission: ['MANAGE', 'VIEW', 'SCORE'].includes(String(search.permission))
      ? (search.permission as StaffPermission)
      : undefined,
  }),
  beforeLoad: requirePermission('MANAGE'),
  component: AdminUsersPage,
});
