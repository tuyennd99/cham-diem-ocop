import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';
import { AdminReportsPage } from '../pages/admin/AdminReportsPage';

export const Route = createFileRoute('/_app/admin/reports')({
  beforeLoad: requirePermission('VIEW'),
  component: AdminReportsPage,
});
