import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import AdminFilterError from '@/components/admin-filter-error';
import { PRODUCT_WORKSPACE_MODE } from '../constants/consts';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminProductsPage } from '../pages/admin/AdminProductsPage';

export const Route = createFileRoute('/_app/admin/products/')({
  beforeLoad: requirePermission(STAFF_PERMISSION.VIEW),
  validateSearch: parseAdminProductSearch,
  errorComponent: ProductsFilterError,
  component: ProductsRoute,
});

function ProductsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminProductsPage
      mode={PRODUCT_WORKSPACE_MODE.PRODUCTS}
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}

function ProductsFilterError() {
  return <AdminFilterError mode={PRODUCT_WORKSPACE_MODE.PRODUCTS} />;
}
