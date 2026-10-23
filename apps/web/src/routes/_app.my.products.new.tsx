import { createFileRoute } from '@tanstack/react-router';
import { requireRole } from '../lib/route-guards';
import { ProductEditorPage } from '../pages/registrant/ProductEditorPage';

export const Route = createFileRoute('/_app/my/products/new')({
  beforeLoad: requireRole('REGISTRANT'),
  component: () => <ProductEditorPage />,
});
