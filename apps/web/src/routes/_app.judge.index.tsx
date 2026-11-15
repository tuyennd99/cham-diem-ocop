import { STAFF_PERMISSION } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { parseJudgeQueueSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { JudgeQueuePage } from '../pages/judge/JudgeQueuePage';

export const Route = createFileRoute('/_app/judge/')({
  beforeLoad: requirePermission(STAFF_PERMISSION.SCORE),
  validateSearch: parseJudgeQueueSearch,
  component: JudgeQueueRoute,
});

function JudgeQueueRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <JudgeQueuePage
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
