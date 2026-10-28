import { createFileRoute } from '@tanstack/react-router';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminProductDetailPage } from '../pages/admin/AdminProductDetailPage';

export const Route = createFileRoute('/_app/admin/registrations/$id/')({
  beforeLoad: requirePermission('VIEW'),
  validateSearch: parseAdminProductSearch,
  component: RegistrationDetailRoute,
});

function RegistrationDetailRoute() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminProductDetailPage
      productId={id}
      mode='registrations'
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
