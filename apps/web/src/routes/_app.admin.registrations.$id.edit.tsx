import { createFileRoute } from '@tanstack/react-router';
import { ProductDraftEditor } from '../components/products/ProductDraftEditor';
import { requirePermission } from '../lib/route-guards';

export const Route = createFileRoute('/_app/admin/registrations/$id/edit')({
  beforeLoad: requirePermission('MANAGE'),
  component: RegistrationEditorRoute,
});

function RegistrationEditorRoute() {
  const { id } = Route.useParams();
  return <ProductDraftEditor mode='admin' productId={id} />;
}
