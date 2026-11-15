import { USER_ROLE } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { requireRole } from '../lib/route-guards';
import { MyProductDetailPage } from '../pages/registrant/MyProductDetailPage';

export const Route = createFileRoute('/_app/my/products/$id/')({
  beforeLoad: requireRole(USER_ROLE.REGISTRANT),
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { id } = Route.useParams();
  return <MyProductDetailPage productId={id} />;
}
