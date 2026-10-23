import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';
import { AdminAssignmentsPage } from '../pages/admin/AdminAssignmentsPage';

export const Route = createFileRoute('/_app/admin/assignments')({
  beforeLoad: requirePermission('VIEW'),
  component: AdminAssignmentsPage,
});
