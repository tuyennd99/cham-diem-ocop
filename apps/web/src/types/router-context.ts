import type { QueryClient } from "@tanstack/react-query";
import type { Session } from "./auth";

export interface RouterContext {
  getSession: () => Session | null;
  queryClient: QueryClient;
}
