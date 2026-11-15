import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { parseAdminReportsSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminReportsPage } from '../pages/admin/AdminReportsPage';

export const Route = createFileRoute('/_app/admin/reports')({
  beforeLoad: requirePermission(STAFF_PERMISSION.VIEW),
  validateSearch: parseAdminReportsSearch,
  component: ReportsRoute,
});

function ReportsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminReportsPage
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
