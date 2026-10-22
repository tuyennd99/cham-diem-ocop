import type { OrganizationUnitSummary, Role, StaffPermission } from "@ocop/shared";
import type { Session, SessionUser } from "../types/auth";

const roles: Role[] = ["REGISTRANT", "JUDGE", "ADMIN", "VIEWER"];
const staffPermissions: StaffPermission[] = ["MANAGE", "VIEW", "SCORE"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOrganizationUnit(value: unknown): value is OrganizationUnitSummary {
  return isRecord(value) && typeof value.id === "string" && typeof value.code === "string" && typeof value.name === "string";
}

export function normalizeSession(value: unknown): Session | null {
  if (!isRecord(value) || typeof value.accessToken !== "string" || !isRecord(value.user)) return null;
  const user = value.user;
  if (typeof user.id !== "string" || !roles.includes(user.role as Role)) return null;

  const role = user.role as Role;
  const permissions: StaffPermission[] = Array.isArray(user.staffPermissions)
    ? user.staffPermissions.filter((permission): permission is StaffPermission => staffPermissions.includes(permission as StaffPermission))
    : role === "ADMIN" ? ["MANAGE", "VIEW"] : role === "JUDGE" ? ["SCORE"] : role === "VIEWER" ? ["VIEW"] : [];
  const effectivePermissions = role === "REGISTRANT" ? [] : [...new Set(permissions)];
  if (effectivePermissions.includes("MANAGE") && !effectivePermissions.includes("VIEW")) effectivePermissions.push("VIEW");

  const sessionUser: SessionUser = {
    id: user.id,
    email: typeof user.email === "string" ? user.email : "",
    fullName: typeof user.fullName === "string" ? user.fullName : "",
    phone: typeof user.phone === "string" ? user.phone : null,
    role,
    verified: user.verified === true,
    staffPermissions: effectivePermissions,
    organizationUnitId: typeof user.organizationUnitId === "string" ? user.organizationUnitId : null,
    organizationUnit: isOrganizationUnit(user.organizationUnit) ? user.organizationUnit : null,
  };
  return { accessToken: value.accessToken, user: sessionUser };
}

export function parseStoredSession(serialized: string | null): Session | null {
  if (!serialized) return null;
  try {
    return normalizeSession(JSON.parse(serialized) as unknown);
  } catch {
    return null;
  }
}

export function serializeSession(session: Session): string {
  return JSON.stringify(normalizeSession(session));
}

export function hasStaffPermission(
  user: Pick<SessionUser, "role" | "staffPermissions"> | null | undefined,
  permission: StaffPermission,
): boolean {
  if (!user || user.role === "REGISTRANT") return false;
  return user.staffPermissions.includes(permission) || (permission === "VIEW" && user.staffPermissions.includes("MANAGE"));
}
