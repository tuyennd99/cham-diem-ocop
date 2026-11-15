import type { ReactNode } from 'react';
import {
  dehydrate,
  hydrate,
  QueryClientProvider,
  type DehydratedState,
  type QueryClient,
} from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import PageSpin from '@/components/page-spin';
import { getSession } from './lib/auth';
import { createQueryClient, queryClient as defaultQueryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';
import type { Session } from './types/auth';

export interface CreateAppRouterOptions {
  queryClient?: QueryClient;
  getSession?: () => Session | null;
  origin?: string;
}

export function createAppRouter(options: CreateAppRouterOptions = {}) {
  const rqClient = options.queryClient ?? createQueryClient();
  const resolveSession =
    options.getSession ?? (typeof window === 'undefined' ? () => null : getSession);

  return createRouter({
    routeTree,
    context: {
      getSession: resolveSession,
      queryClient: rqClient,
      requestOrigin: options.origin,
    },
    origin: options.origin,
    defaultPendingComponent: PageSpin,
    defaultPreload: 'intent',
    scrollRestoration: true,
    Wrap: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={rqClient}>{children}</QueryClientProvider>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dehydrate: (): any => ({
      queryClientState: dehydrate(rqClient),
    }),
    hydrate: (dehydrated: { queryClientState?: DehydratedState } | undefined) => {
      if (dehydrated?.queryClientState) {
        hydrate(rqClient, dehydrated.queryClientState);
      }
    },
  });
}

export function getRouter() {
  return createAppRouter();
}

export const router = createAppRouter({
  queryClient: defaultQueryClient,
  getSession,
});
