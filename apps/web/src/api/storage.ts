import type { User } from '@/types/auth';
import type { AuthSession, AuthTokens } from './types';
import {
  AUTH_USER_STORAGE_KEY,
  AUTH_ACCESS_TOKEN_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_REFRESH_TOKEN_STORAGE_KEY,
} from '@/constants/auth';

const isBrowser = () => typeof window !== 'undefined';

// Hydrate từ localStorage để giữ phiên qua lần reload trang (không phải gọi refresh).
// ponytail: access token nằm trong localStorage nên đọc được bằng JS -> rủi ro XSS;
// đổi sang cookie httpOnly nếu cần siết bảo mật.
let accessToken: string | null = isBrowser()
  ? localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY)
  : null;

const getCookie = (name: string) => {
  if (!isBrowser()) return null;

  const cookie = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));

  if (!cookie) return null;

  return decodeURIComponent(cookie.slice(name.length + 1));
};

// Phiên đã kết thúc (bấm đăng xuất, hoặc refresh thất bại) khác với "access
// token hết hạn": mọi request còn bay của trang cũ không được phép refresh +
// replay để hồi sinh phiên. Bật bằng endAuthSession(), tắt khi có token mới.
let loggedOut = false;

export const isLoggedOut = () => loggedOut;

export const getAccessToken = () => accessToken;

export const getCsrfToken = () => getCookie('csrf_token');

export const getStoredUser = (): User | null => {
  if (!isBrowser()) return null;

  const savedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser) as User;
  } catch {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return null;
  }
};

export const persistAuthTokens = (tokens: AuthTokens) => {
  loggedOut = false;
  accessToken = tokens.accessToken;
  if (!isBrowser()) return;
  localStorage.setItem(AUTH_ACCESS_TOKEN_STORAGE_KEY, tokens.accessToken);
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
};

export const persistAuthUser = (user: User) => {
  if (!isBrowser()) return;

  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
};

export const persistAuthSession = ({ user, ...tokens }: AuthSession) => {
  persistAuthTokens(tokens);
  persistAuthUser(user);
};

export const clearAuthSession = () => {
  loggedOut = false;
  accessToken = null;
  if (!isBrowser()) return;

  localStorage.removeItem(AUTH_ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
};

/** Kết thúc phiên: xoá phiên + chặn refresh/replay cho tới lần login sau. */
export const endAuthSession = () => {
  clearAuthSession();
  loggedOut = true;
};
