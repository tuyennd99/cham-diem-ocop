import { createFileRoute } from '@tanstack/react-router';
import { parseAdminCatalogSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminProductGroupsPage } from '../pages/admin/AdminProductGroupsPage';

export const Route = createFileRoute('/_app/admin/product-groups')({
  beforeLoad: requirePermission('VIEW'),
  validateSearch: parseAdminCatalogSearch,
  component: ProductGroupsRoute,
});

function ProductGroupsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminProductGroupsPage
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
