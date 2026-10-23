import { createFileRoute, redirect } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';

export const Route = createFileRoute('/_app/admin/judges')({
  beforeLoad: (args) => {
    requirePermission('MANAGE')(args);
    throw redirect({ to: '/admin/users', search: { permission: 'SCORE' }, replace: true });
  },
});
