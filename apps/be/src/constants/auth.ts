export const PASSWORD_ROUNDS = 12;
export const PASSWORD_MAX_BYTES = 72;
export const JWT_ISSUER = 'ocop-api';
export const JWT_AUDIENCE = 'ocop-web';
export const JWT_ALGORITHM = 'HS256' as const;
export const AUTH_SCHEME_BEARER = 'Bearer';
export const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

export const PRISMA_ERROR_CODE = {
  VALUE_TOO_LONG: 'P2000',
  UNIQUE_CONSTRAINT: 'P2002',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
  RECORD_NOT_FOUND: 'P2025',
  WRITE_CONFLICT: 'P2034',
} as const;

export const USER_KIND = {
  STAFF: 'STAFF',
  REGISTRANT: 'REGISTRANT',
} as const;
export type UserKind = (typeof USER_KIND)[keyof typeof USER_KIND];

export const GOOGLE_AUTH_INTENT = {
  LOGIN: 'login',
  REGISTER: 'register',
} as const;
export type GoogleAuthIntent =
  (typeof GOOGLE_AUTH_INTENT)[keyof typeof GOOGLE_AUTH_INTENT];

export const GOOGLE_CHALLENGE_STATUS = {
  INVALID: 'invalid',
  USED_SUB: 'used_sub',
  EMAIL_EXISTS: 'email_exists',
  UNAVAILABLE: 'unavailable',
  COLLISION: 'collision',
  SESSION: 'session',
  PENDING: 'pending',
} as const;

export const GOOGLE_RESULT_KIND = {
  SESSION: 'session',
  PROFILE: 'profile',
  LINK_OTP: 'link_otp',
} as const;

export const OTP_VERIFY_STATUS = {
  OK: 'ok',
  INVALID: 'invalid',
  LOCKED: 'locked',
  COOLDOWN: 'cooldown',
  COLLISION: 'collision',
  SESSION: 'session',
} as const;

export const REGISTRATION_VERIFICATION_MODE = {
  REGISTER: 'register',
  GOOGLE_LINK: 'google-link',
} as const;

export const MAIL_OTP_PURPOSE = {
  REGISTER: 'REGISTER',
  RESET_PASSWORD: 'RESET_PASSWORD',
  GOOGLE_LINK: 'GOOGLE_LINK',
} as const;
export type MailOtpPurpose =
  (typeof MAIL_OTP_PURPOSE)[keyof typeof MAIL_OTP_PURPOSE];
