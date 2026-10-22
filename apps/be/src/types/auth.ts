import type { Role, StaffPermission } from '@prisma/client';
import type { OrganizationUnitSummary } from '@ocop/shared';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedPrincipal extends AccessTokenPayload {
  staffPermissions: StaffPermission[];
  organizationUnitId: string | null;
  organizationUnit: OrganizationUnitSummary | null;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  verified: boolean;
  staffPermissions: StaffPermission[];
  organizationUnitId: string | null;
  organizationUnit: OrganizationUnitSummary | null;
}
