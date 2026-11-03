import { createFileRoute } from '@tanstack/react-router';
import { parseAdminLocalitiesSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminLocalitiesPage } from '../pages/admin/AdminLocalitiesPage';

export const Route = createFileRoute('/_app/admin/localities')({
  beforeLoad: requirePermission('VIEW'),
  validateSearch: parseAdminLocalitiesSearch,
  component: LocalitiesRoute,
});

function LocalitiesRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminLocalitiesPage
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
