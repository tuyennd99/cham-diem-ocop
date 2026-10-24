import { createFileRoute } from '@tanstack/react-router';
import { requireAnyPermission } from '../lib/route-guards';
import { BlankCriteriaPrintPreviewPage } from '../pages/print/PrintPreviewPages';

function RouteComponent() {
  const { id } = Route.useParams();
  return <BlankCriteriaPrintPreviewPage criteriaSetId={id} />;
}

export const Route = createFileRoute('/_app/print/criteria-sets/$id')({
  beforeLoad: requireAnyPermission('VIEW', 'SCORE'),
  component: RouteComponent,
});
