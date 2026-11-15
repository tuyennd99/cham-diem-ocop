import { USER_ROLE } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requireRole } from '../lib/route-guards';
import { MyProductsPage } from '../pages/registrant/MyProductsPage';

export const Route = createFileRoute('/_app/my/products/')({
  beforeLoad: requireRole(USER_ROLE.REGISTRANT),
  validateSearch: parseAdminProductSearch,
  component: MyProductsRoute,
});

function MyProductsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <MyProductsPage
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
