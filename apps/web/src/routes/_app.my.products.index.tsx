import { createFileRoute } from '@tanstack/react-router';
import { requireRole } from '../lib/route-guards';
import { MyProductsPage } from '../pages/registrant/MyProductsPage';

export const Route = createFileRoute('/_app/my/products/')({
  beforeLoad: requireRole('REGISTRANT'),
  component: MyProductsPage,
});
