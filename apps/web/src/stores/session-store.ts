import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { SESSION_STORAGE_KEY } from '../constants/auth';
import { normalizeSession, parseStoredSession, serializeSession } from '../lib/session-contract';
import type { Session } from '../types/auth';

export { SESSION_STORAGE_KEY };

function readSession(): Session | null {
  try {
    return parseStoredSession(window.localStorage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return null;
  }
}

interface SessionState {
  session: Session | null;
}

// Vanilla store so non-React code (API client, router guards) can read it synchronously.
export const sessionStore = createStore<SessionState>(() => ({
  session: typeof window === 'undefined' ? null : readSession(),
}));

export function getSession(): Session | null {
  return sessionStore.getState().session;
}

export function setSession(next: Session | null): void {
  const normalized = next ? normalizeSession(next) : null;
  if (normalized) window.localStorage.setItem(SESSION_STORAGE_KEY, serializeSession(normalized));
  else window.localStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStore.setState({ session: normalized });
}

export function useSession(): Session | null {
  return useStore(sessionStore, (state) => state.session);
}

// Keep tabs in sync: login/logout in another tab updates this one.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_STORAGE_KEY || event.key === null)
      sessionStore.setState({ session: readSession() });
  });
}
