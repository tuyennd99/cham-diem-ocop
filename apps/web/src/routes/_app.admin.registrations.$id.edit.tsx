import { createFileRoute } from '@tanstack/react-router';
import { ProductDraftEditor } from '../components/products/ProductDraftEditor';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';

export const Route = createFileRoute('/_app/admin/registrations/$id/edit')({
  beforeLoad: requirePermission('MANAGE'),
  validateSearch: parseAdminProductSearch,
  component: RegistrationEditorRoute,
});

function RegistrationEditorRoute() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  return <ProductDraftEditor mode='admin' productId={id} returnSearch={search} />;
}
