import { createFileRoute, redirect } from '@tanstack/react-router';
import { parseAdminCatalogSearch, toAdminLocalityApiQuery } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminProductGroupsPage } from '../pages/admin/AdminProductGroupsPage';

export const Route = createFileRoute('/_app/admin/product-groups')({
  beforeLoad: (args) => {
    requirePermission('VIEW')(args);
    if (args.search.tab === 'localities') {
      throw redirect({
        to: '/admin/localities',
        search: toAdminLocalityApiQuery(args.search),
        replace: true,
      });
    }
  },
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
