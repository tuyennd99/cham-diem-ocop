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
  registrationToken: string;
  code: string;
}
export interface LegacyVerifyOtpInput {
  email: string;
  code: string;
}
export interface ResetPasswordInput extends LegacyVerifyOtpInput {
  newPassword: string;
}
export interface RegistrationTokenInput {
  registrationToken: string;
}
export interface OtpTiming {
  otpExpiresAt: string;
  resendAvailableAt: string;
}
export interface RegistrationResponse extends RegistrationTokenInput, OtpTiming {
  email: string;
  expiresAt: string;
}
export interface RegistrationStatus extends OtpTiming {
  mode: 'register' | 'google-link';
  email: string;
  expiresAt: string;
}
export interface PendingRegistration extends RegistrationResponse {
  mode: RegistrationStatus['mode'];
}
export interface GoogleInput {
  challengeToken: string;
  credential: string;
  intent: 'login' | 'register';
}
export interface GoogleRegisterInput extends RegistrationTokenInput {
  fullName: string;
  phone?: string;
}
export interface GoogleSessionResult extends LoginResponse {
  kind: 'session';
  expiresIn: number;
}
export interface GoogleProfileResult extends RegistrationTokenInput {
  kind: 'profile';
  email: string;
  suggestedName: string | null;
}
export type GoogleResult =
  GoogleSessionResult | GoogleProfileResult | (RegistrationResponse & { kind: 'link_otp' });
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
export interface MessageResponse {
  message: string;
}
