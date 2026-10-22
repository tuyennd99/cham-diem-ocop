import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { SESSION_STORAGE_KEY } from "../constants/auth";
import type { Session } from "../types/auth";

export { SESSION_STORAGE_KEY };

function readSession(): Session | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) ?? "null");
    if (typeof value !== "object" || value === null) return null;
    const session = value as Partial<Session>;
    if (typeof session.accessToken !== "string" || typeof session.user?.id !== "string" ||
      !["REGISTRANT", "JUDGE", "ADMIN"].includes(session.user.role)) return null;
    return session as Session;
  } catch {
    return null;
  }
}

interface SessionState {
  session: Session | null;
}

// Vanilla store so non-React code (API client, router guards) can read it synchronously.
export const sessionStore = createStore<SessionState>(() => ({
  session: typeof window === "undefined" ? null : readSession(),
}));

export function getSession(): Session | null {
  return sessionStore.getState().session;
}

export function setSession(next: Session | null): void {
  if (next) window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
  else window.localStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStore.setState({ session: next });
}

export function useSession(): Session | null {
  return useStore(sessionStore, (state) => state.session);
}

// Keep tabs in sync: login/logout in another tab updates this one.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_STORAGE_KEY || event.key === null) sessionStore.setState({ session: readSession() });
  });
}
