import { createFileRoute } from '@tanstack/react-router';
import { requireAuthenticated } from '../lib/route-guards';
import { ProductRegistrationPrintPreviewPage } from '../pages/print/PrintPreviewPages';

function RouteComponent() {
  const { id } = Route.useParams();
  return <ProductRegistrationPrintPreviewPage productId={id} />;
}

export const Route = createFileRoute('/_app/print/products/$id/registration')({
  beforeLoad: requireAuthenticated(),
  component: RouteComponent,
});
