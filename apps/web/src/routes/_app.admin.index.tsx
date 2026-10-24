import { createFileRoute } from '@tanstack/react-router';
import { parseAdminDashboardSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';

export const Route = createFileRoute('/_app/admin/')({
  beforeLoad: requirePermission('VIEW'),
  validateSearch: parseAdminDashboardSearch,
  component: AdminDashboardRoute,
});

function AdminDashboardRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminDashboardPage
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
