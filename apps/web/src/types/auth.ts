import type { OrganizationUnitSummary, Role, StaffPermission } from '@ocop/shared';

export type AppRole = Role;

export interface SessionUser {
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

export type User = SessionUser;

export interface Session {
  accessToken: string;
  user: SessionUser;
}

export interface LoginResponse {
  accessToken: string;
  user: SessionUser;
}

export interface LoginInput {
  email: string;
  password: string;
}
export interface RegisterInput extends LoginInput {
  fullName: string;
  phone?: string;
}
export interface VerifyOtpInput {
  email: string;
  code: string;
}
export interface ResetPasswordInput extends VerifyOtpInput {
  newPassword: string;
}
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
export interface MessageResponse {
  message: string;
}
