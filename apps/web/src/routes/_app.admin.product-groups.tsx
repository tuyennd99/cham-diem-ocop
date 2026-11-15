import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { ADMIN_CATALOG_TAB } from '../constants/consts';
import { parseAdminCatalogSearch, toAdminLocalityApiQuery } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminProductGroupsPage } from '../pages/admin/AdminProductGroupsPage';

export const Route = createFileRoute('/_app/admin/product-groups')({
  beforeLoad: (args) => {
    requirePermission(STAFF_PERMISSION.VIEW)(args);
    if (args.search.tab === ADMIN_CATALOG_TAB.LOCALITIES) {
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
