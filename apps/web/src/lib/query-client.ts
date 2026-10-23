import { QueryClient } from '@tanstack/react-query';
import { isClientError } from '../constants/http-status';
import { sessionStore } from '../stores/session-store';
import { ApiError } from './api-error';

export const queryClient = new QueryClient({
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

function sessionScope(session: ReturnType<typeof sessionStore.getState>['session']) {
  if (!session) return '';
  return [
    session.user.id,
    session.accessToken,
    [...session.user.staffPermissions].sort().join(','),
  ].join(':');
}

// Drafts and staff lookups are private to the current identity, token, and permissions.
sessionStore.subscribe((state, previous) => {
  if (sessionScope(state.session) !== sessionScope(previous.session)) queryClient.clear();
});
