import { createFileRoute } from '@tanstack/react-router';
import { ProductDraftEditor } from '../components/products/ProductDraftEditor';
import { requirePermission } from '../lib/route-guards';

export const Route = createFileRoute('/_app/admin/registrations/new')({
  beforeLoad: requirePermission('MANAGE'),
  component: () => <ProductDraftEditor mode='admin' />,
});
