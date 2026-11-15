import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { parseAdminScoringSearch } from '../lib/admin-search';
import { requireAnyPermission } from '../lib/route-guards';
import { AdminScoringFormsPage } from '../pages/admin/AdminScoringFormsPage';

export const Route = createFileRoute('/_app/admin/scoring-forms')({
  beforeLoad: requireAnyPermission(STAFF_PERMISSION.VIEW, STAFF_PERMISSION.SCORE),
  validateSearch: parseAdminScoringSearch,
  component: ScoringFormsRoute,
});

function ScoringFormsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminScoringFormsPage
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
