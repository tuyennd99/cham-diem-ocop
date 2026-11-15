import { USER_ROLE } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { ProductDraftEditor } from '../components/products/ProductDraftEditor';
import { PRODUCT_WORKSPACE_MODE } from '../constants/consts';
import { requireRole } from '../lib/route-guards';

export const Route = createFileRoute('/_app/my/products/$id/edit')({
  beforeLoad: requireRole(USER_ROLE.REGISTRANT),
  component: EditRoute,
});

function EditRoute() {
  const { id } = Route.useParams();
  return <ProductDraftEditor mode={PRODUCT_WORKSPACE_MODE.OWNER} productId={id} />;
}
