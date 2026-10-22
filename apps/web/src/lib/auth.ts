import type { AppRole } from "../types/auth";

export { getSession, setSession, useSession } from "../stores/session-store";

export function homeFor(role: AppRole, registrantPath: "/my/products" | "/my/products/new" = "/my/products"):
  "/admin/products" | "/judge" | "/my/products" | "/my/products/new" {
  return role === "ADMIN" ? "/admin/products" : role === "JUDGE" ? "/judge" : registrantPath;
}

const utf8Encoder = new TextEncoder();

export function validatePasswordBytes(password: string): void {
  if (utf8Encoder.encode(password).length > 72) {
    throw new Error("Mật khẩu tối đa 72 byte UTF-8 (tiếng Việt có dấu chiếm nhiều byte hơn ký tự không dấu).");
  }
}
