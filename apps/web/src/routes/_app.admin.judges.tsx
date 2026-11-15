import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';

export const Route = createFileRoute('/_app/admin/judges')({
  beforeLoad: (args) => {
    requirePermission(STAFF_PERMISSION.MANAGE)(args);
    throw redirect({
      to: '/admin/users',
      search: { permission: STAFF_PERMISSION.SCORE },
      replace: true,
    });
  },
});
