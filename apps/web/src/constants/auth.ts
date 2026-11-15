export const SESSION_STORAGE_KEY = 'ocop-session';
export const PENDING_EMAIL_STORAGE_KEY = 'ocop.pendingEmail';
export const AUTH_USER_STORAGE_KEY = 'auth_user';
export const AUTH_ACCESS_TOKEN_STORAGE_KEY = 'auth_access_token';
export const AUTH_TOKEN_STORAGE_KEY = 'auth_token';
export const AUTH_REFRESH_TOKEN_STORAGE_KEY = 'auth_refresh_token';
export const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = 'admin_sidebar_collapsed';

export const REGISTRATION_VERIFICATION_MODE = {
  REGISTER: 'register',
  GOOGLE_LINK: 'google-link',
} as const;

export const GOOGLE_AUTH_INTENT = {
  LOGIN: 'login',
  REGISTER: 'register',
} as const;

export const GOOGLE_RESULT_KIND = {
  SESSION: 'session',
  PROFILE: 'profile',
  LINK_OTP: 'link_otp',
} as const;

export const GOOGLE_SIGN_IN_PHASE = {
  LOADING: 'loading',
  READY: 'ready',
  WAITING: 'waiting',
  POSTING: 'posting',
  ERROR: 'error',
} as const;

export const VERIFICATION_STATE_KIND = {
  LEGACY: 'legacy',
  PENDING: 'pending',
  ERROR: 'error',
} as const;

export const AUTH_FRAME_MODE = {
  LOGIN: 'login',
  REGISTER: 'register',
} as const;
