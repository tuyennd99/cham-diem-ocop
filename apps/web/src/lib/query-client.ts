import { QueryClient } from '@tanstack/react-query';
import { isClientError } from '../constants/http-status';
import { sessionStore } from '../stores/session-store';
import { ApiError } from './api-error';
import { getSessionScope } from './session-contract';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // 4xx will not fix itself on retry; only retry network/5xx once.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && isClientError(error.status)) && failureCount < 1,
      },
    },
  });
}

export const queryClient = createQueryClient();

// Drafts and staff lookups are private to the current identity, token, and permissions.
sessionStore.subscribe((state, previous) => {
  if (getSessionScope(state.session) !== getSessionScope(previous.session)) queryClient.clear();
});
