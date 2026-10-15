import type { Role } from '@prisma/client';

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

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  verified: boolean;
}
