import { createRouter } from '@tanstack/react-router';
import { getSession } from './lib/auth';
import { queryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  context: { getSession, queryClient },
  scrollRestoration: true,
});
