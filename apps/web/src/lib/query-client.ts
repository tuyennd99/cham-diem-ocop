import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-error";
import { isClientError } from "../constants/http-status";
import { sessionStore } from "../stores/session-store";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // 4xx will not fix itself on retry; only retry network/5xx once.
      retry: (failureCount, error) => !(error instanceof ApiError && isClientError(error.status)) && failureCount < 1,
    },
  },
});

// Cached data belongs to one user: drop it whenever the signed-in user changes.
sessionStore.subscribe((state, previous) => {
  if (state.session?.user.id !== previous.session?.user.id) queryClient.clear();
});
