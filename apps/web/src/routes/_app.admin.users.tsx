import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { parseAdminUsersSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';

export const Route = createFileRoute('/_app/admin/users')({
  validateSearch: parseAdminUsersSearch,
  beforeLoad: requirePermission(STAFF_PERMISSION.MANAGE),
  component: UsersRoute,
});

function UsersRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminUsersPage
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
