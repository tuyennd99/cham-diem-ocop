import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';
import { JudgeEvaluationPage } from '../pages/judge/JudgeEvaluationPage';

export const Route = createFileRoute('/_app/judge/products/$id')({
  beforeLoad: requirePermission(STAFF_PERMISSION.SCORE),
  component: JudgeProductPage,
});

function JudgeProductPage() {
  const { id } = Route.useParams();
  return <JudgeEvaluationPage productId={id} />;
}
