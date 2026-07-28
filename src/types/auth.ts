import type { UserStatus } from '../prisma/client';

export interface RequestMeta {
  organizationId?: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  position?: string | null;
  rank?: string | null;
  phone?: string | null;
  passwordHash: string;
  organizationId: number;
  organization: {
    id: number;
    code: string;
    name: string;
  };
  permissions: string[];
  isAdmin?: boolean;
  isStaff?: boolean;
  status: UserStatus;
  lockedUntil: Date | null;
  failedLoginCount: number;
  failedLoginWindowStartedAt: Date | null;
  deletedAt?: Date | null;
}

export interface AccessTokenPayload {
  sub: number;
  username: string;
  organizationId: number;
  permissions: string[];
  isAdmin?: boolean;
  isStaff?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  csrfToken: string;
  user: Omit<
    AuthUser,
    | 'passwordHash'
    | 'status'
    | 'lockedUntil'
    | 'failedLoginCount'
    | 'failedLoginWindowStartedAt'
    | 'deletedAt'
  >;
}

export interface RefreshSession {
  id: number;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthUser;
}
