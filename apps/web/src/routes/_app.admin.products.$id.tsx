import { createFileRoute } from '@tanstack/react-router';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminProductDetailPage } from '../pages/admin/AdminProductDetailPage';

export const Route = createFileRoute('/_app/admin/products/$id')({
  beforeLoad: requirePermission('VIEW'),
  validateSearch: parseAdminProductSearch,
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminProductDetailPage
      productId={id}
      mode='products'
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
