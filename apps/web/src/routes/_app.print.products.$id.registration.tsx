import { createFileRoute } from '@tanstack/react-router';
import { parseAdminProductPrintSearch } from '../lib/admin-search';
import { requireAuthenticated } from '../lib/route-guards';
import { ProductRegistrationPrintPreviewPage } from '../pages/print/PrintPreviewPages';

function RouteComponent() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  return <ProductRegistrationPrintPreviewPage productId={id} search={search} />;
}

export const Route = createFileRoute('/_app/print/products/$id/registration')({
  beforeLoad: requireAuthenticated(),
  validateSearch: parseAdminProductPrintSearch,
  component: RouteComponent,
});
