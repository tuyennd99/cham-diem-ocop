export type AppRole = "PRODUCER" | "JUDGE" | "ADMIN";

export interface Session {
  role: AppRole;
}

// ponytail: in-memory demo session, replace with server-backed auth before production.
let session: Session | null = null;

export function getSession(): Session | null {
  return session;
}

export function setSession(next: Session | null): void {
  session = next;
}
