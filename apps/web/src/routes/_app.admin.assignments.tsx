import { createFileRoute } from '@tanstack/react-router';
import { parseAdminAssignmentSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminAssignmentsPage } from '../pages/admin/AdminAssignmentsPage';

export const Route = createFileRoute('/_app/admin/assignments')({
  beforeLoad: requirePermission('VIEW'),
  validateSearch: parseAdminAssignmentSearch,
  component: AssignmentsRoute,
});

function AssignmentsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminAssignmentsPage
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
