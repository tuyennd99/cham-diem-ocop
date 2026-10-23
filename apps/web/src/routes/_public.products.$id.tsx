import { createFileRoute } from '@tanstack/react-router';
import { PublicProductDetailPage } from '../pages/public/PublicProductDetailPage';

export const Route = createFileRoute('/_public/products/$id')({ component: ProductPage });

function ProductPage() {
  const { id } = Route.useParams();
  return <PublicProductDetailPage id={id} />;
}
