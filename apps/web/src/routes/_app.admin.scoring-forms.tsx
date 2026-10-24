import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '../lib/route-guards';
import { AdminScoringFormsPage } from '../pages/admin/AdminScoringFormsPage';

export const Route = createFileRoute('/_app/admin/scoring-forms')({
  beforeLoad: requireAnyPermission('VIEW', 'SCORE'),
  component: AdminScoringFormsPage,
});
