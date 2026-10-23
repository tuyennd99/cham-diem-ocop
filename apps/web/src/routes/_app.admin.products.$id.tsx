import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';
import { AdminProductDetailPage } from '../pages/admin/AdminProductDetailPage';

export const Route = createFileRoute('/_app/admin/products/$id')({
  beforeLoad: requirePermission('VIEW'),
  component: ResultsRoute,
});

function ResultsRoute() {
  const { id } = Route.useParams();
  return <AdminProductDetailPage productId={id} mode='products' />;
}
