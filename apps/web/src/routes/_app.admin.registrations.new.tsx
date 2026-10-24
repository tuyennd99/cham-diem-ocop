import { createFileRoute } from '@tanstack/react-router';
import { ProductDraftEditor } from '../components/products/ProductDraftEditor';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';

export const Route = createFileRoute('/_app/admin/registrations/new')({
  beforeLoad: requirePermission('MANAGE'),
  validateSearch: parseAdminProductSearch,
  component: NewRegistrationRoute,
});

function NewRegistrationRoute() {
  const search = Route.useSearch();
  return <ProductDraftEditor mode='admin' returnSearch={search} />;
}
