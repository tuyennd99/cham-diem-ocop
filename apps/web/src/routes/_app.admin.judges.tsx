import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';
import { AdminJudgesPage } from '../pages/admin/AdminJudgesPage';

export const Route = createFileRoute('/_app/admin/judges')({
  beforeLoad: requirePermission('MANAGE'),
  component: AdminJudgesPage,
});
