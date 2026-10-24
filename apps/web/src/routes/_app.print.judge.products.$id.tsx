import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';
import { JudgeEvaluationPrintPreviewPage } from '../pages/print/PrintPreviewPages';

function RouteComponent() {
  const { id } = Route.useParams();
  return <JudgeEvaluationPrintPreviewPage productId={id} />;
}

export const Route = createFileRoute('/_app/print/judge/products/$id')({
  beforeLoad: requirePermission('SCORE'),
  component: RouteComponent,
});
