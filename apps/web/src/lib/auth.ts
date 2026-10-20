import type { AppRole, Session } from "../types/auth";

export function homeFor(role: AppRole, registrantPath: "/my/products" | "/my/products/new" = "/my/products"):
  "/admin/products" | "/judge" | "/my/products" | "/my/products/new" {
  return role === "ADMIN" ? "/admin/products" : role === "JUDGE" ? "/judge" : registrantPath;
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

const utf8Encoder = new TextEncoder();

export function validatePasswordBytes(password: string): void {
  if (utf8Encoder.encode(password).length > 72) {
    throw new Error("Mật khẩu tối đa 72 byte UTF-8 (tiếng Việt có dấu chiếm nhiều byte hơn ký tự không dấu).");
  }
}

