import type { Session } from "./auth";

export interface RouterContext {
  getSession: () => Session | null;
}
