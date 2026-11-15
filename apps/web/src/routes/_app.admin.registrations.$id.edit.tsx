import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { ProductDraftEditor } from '../components/products/ProductDraftEditor';
import { PRODUCT_WORKSPACE_MODE } from '../constants/consts';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';

export const Route = createFileRoute('/_app/admin/registrations/$id/edit')({
  beforeLoad: requirePermission(STAFF_PERMISSION.MANAGE),
  validateSearch: parseAdminProductSearch,
  component: RegistrationEditorRoute,
});

function RegistrationEditorRoute() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  return (
    <ProductDraftEditor mode={PRODUCT_WORKSPACE_MODE.ADMIN} productId={id} returnSearch={search} />
  );
}
