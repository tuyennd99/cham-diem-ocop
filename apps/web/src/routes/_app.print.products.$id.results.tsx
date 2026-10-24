import { createFileRoute } from '@tanstack/react-router';
import { requireAuthenticated } from '../lib/route-guards';
import { ProductResultsPrintPreviewPage } from '../pages/print/PrintPreviewPages';

function RouteComponent() {
  const { id } = Route.useParams();
  return <ProductResultsPrintPreviewPage productId={id} />;
}

export const Route = createFileRoute('/_app/print/products/$id/results')({
  beforeLoad: requireAuthenticated(),
  component: RouteComponent,
});
