import { createFileRoute } from '@tanstack/react-router';
import AdminFilterError from '@/components/admin-filter-error';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminProductsPage } from '../pages/admin/AdminProductsPage';

export const Route = createFileRoute('/_app/admin/registrations/')({
  beforeLoad: requirePermission('VIEW'),
  validateSearch: parseAdminProductSearch,
  errorComponent: RegistrationsFilterError,
  component: RegistrationsRoute,
});

function RegistrationsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminProductsPage
      mode='registrations'
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}

function RegistrationsFilterError() {
  return <AdminFilterError mode='registrations' />;
}
