import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';
import { AdminProductGroupsPage } from '../pages/admin/AdminProductGroupsPage';

export const Route = createFileRoute('/_app/admin/product-groups')({
  beforeLoad: requirePermission('VIEW'),
  component: AdminProductGroupsPage,
});
