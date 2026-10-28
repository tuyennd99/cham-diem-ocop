import { createFileRoute } from '@tanstack/react-router';
import AdminFilterError from '@/components/admin-filter-error';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminProductsPage } from '../pages/admin/AdminProductsPage';

export const Route = createFileRoute('/_app/admin/products/')({
  beforeLoad: requirePermission('VIEW'),
  validateSearch: parseAdminProductSearch,
  errorComponent: ProductsFilterError,
  component: ProductsRoute,
});

function ProductsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminProductsPage
      mode='products'
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}

function ProductsFilterError() {
  return <AdminFilterError mode='products' />;
}
