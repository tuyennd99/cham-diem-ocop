import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { parseAdminProductPrintSearch } from '../lib/admin-search';
import { requireAnyPermission } from '../lib/route-guards';
import { AdminEvaluationPrintPreviewPage } from '../pages/print/PrintPreviewPages';

function RouteComponent() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  return <AdminEvaluationPrintPreviewPage evaluationId={id} search={search} />;
}

export const Route = createFileRoute('/_app/print/evaluations/$id')({
  beforeLoad: requireAnyPermission(STAFF_PERMISSION.VIEW, STAFF_PERMISSION.SCORE),
  validateSearch: parseAdminProductPrintSearch,
  component: RouteComponent,
});
