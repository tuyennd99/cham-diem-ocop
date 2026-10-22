import type { Role, StaffPermission } from "@ocop/shared";
import { hasStaffPermission } from "./session-contract";

export { getSession, setSession, useSession } from "../stores/session-store";

export function homeFor(role: Role, staffPermissions: StaffPermission[] = [], registrantPath: "/my/products" | "/my/products/new" = "/my/products"):
  "/admin/products" | "/judge" | "/my/products" | "/my/products/new" {
  const user = { role, staffPermissions };
  if (hasStaffPermission(user, "MANAGE")) return "/admin/products";
  if (hasStaffPermission(user, "SCORE")) return "/judge";
  if (hasStaffPermission(user, "VIEW")) return "/admin/products";
  return registrantPath;
}

const utf8Encoder = new TextEncoder();

export function validatePasswordBytes(password: string): void {
  if (utf8Encoder.encode(password).length > 72) {
    throw new Error("Mật khẩu tối đa 72 byte UTF-8 (tiếng Việt có dấu chiếm nhiều byte hơn ký tự không dấu).");
  }
}
