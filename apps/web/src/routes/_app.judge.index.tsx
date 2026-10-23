import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '../lib/route-guards';
import { JudgeQueuePage } from '../pages/judge/JudgeQueuePage';

export const Route = createFileRoute('/_app/judge/')({
  beforeLoad: requirePermission('SCORE'),
  component: JudgeQueuePage,
});
