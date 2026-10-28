import { createRouter } from '@tanstack/react-router';
import PageSpin from '@/components/page-spin';
import { getSession } from './lib/auth';
import { queryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  context: { getSession, queryClient },
  defaultPendingComponent: PageSpin,
  defaultPreload: 'intent',
  scrollRestoration: true,
});
