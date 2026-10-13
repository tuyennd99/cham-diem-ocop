export type AppRole = "REGISTRANT" | "JUDGE" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: AppRole;
  verified: boolean;
}

export interface Session {
  accessToken: string;
  user: SessionUser;
}

const storageKey = "ocop-session";

function readSession(): Session | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (typeof value !== "object" || value === null) return null;
    const session = value as Partial<Session>;
    if (typeof session.accessToken !== "string" || typeof session.user?.id !== "string" ||
      !["REGISTRANT", "JUDGE", "ADMIN"].includes(session.user.role)) return null;
    return session as Session;
  } catch {
    return null;
  }
}

let session: Session | null = typeof window === "undefined" ? null : readSession();

export function getSession(): Session | null {
  return session;
}

export function setSession(next: Session | null): void {
  session = next;
  if (next) window.localStorage.setItem(storageKey, JSON.stringify(next));
  else window.localStorage.removeItem(storageKey);
}
