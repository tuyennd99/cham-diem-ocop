import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { PRODUCT_WORKSPACE_MODE } from '../constants/consts';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminProductDetailPage } from '../pages/admin/AdminProductDetailPage';

export const Route = createFileRoute('/_app/admin/registrations/$id/')({
  beforeLoad: requirePermission(STAFF_PERMISSION.VIEW),
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
      mode={PRODUCT_WORKSPACE_MODE.REGISTRATIONS}
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
