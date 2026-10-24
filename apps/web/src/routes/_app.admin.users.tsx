import { createFileRoute } from '@tanstack/react-router';
import { parseAdminUsersSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';

export const Route = createFileRoute('/_app/admin/users')({
  validateSearch: parseAdminUsersSearch,
  beforeLoad: requirePermission('MANAGE'),
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
