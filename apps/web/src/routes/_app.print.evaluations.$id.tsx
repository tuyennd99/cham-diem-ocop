import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '../lib/route-guards';
import { AdminEvaluationPrintPreviewPage } from '../pages/print/PrintPreviewPages';

function RouteComponent() {
  const { id } = Route.useParams();
  return <AdminEvaluationPrintPreviewPage evaluationId={id} />;
}

export const Route = createFileRoute('/_app/print/evaluations/$id')({
  beforeLoad: requireAnyPermission('VIEW', 'SCORE'),
  component: RouteComponent,
});
