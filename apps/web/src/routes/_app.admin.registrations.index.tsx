import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';
import { AdminProductsPage } from '../pages/admin/AdminProductsPage';

export const Route = createFileRoute('/_app/admin/registrations/')({
  beforeLoad: requirePermission('VIEW'),
  component: () => <AdminProductsPage mode='registrations' />,
});
