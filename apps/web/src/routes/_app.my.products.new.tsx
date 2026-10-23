import { createFileRoute } from '@tanstack/react-router';
import { ProductDraftEditor } from '../components/products/ProductDraftEditor';
import { requireRole } from '../lib/route-guards';

export const Route = createFileRoute('/_app/my/products/new')({
  beforeLoad: requireRole('REGISTRANT'),
  component: () => <ProductDraftEditor mode='owner' />,
});
