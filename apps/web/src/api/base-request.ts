import axios, { type AxiosRequestConfig } from 'axios';
import { API, API_BASE } from '../constants/api';
import { HTTP_STATUS } from '../constants/http-status';
import { ApiError } from '../lib/api-error';
import { getSession, setSession } from '../stores/session-store';
import type { ApiResult } from '../types/api';

const baseRequest = axios.create({ baseURL: API_BASE });
const publicAuthUrls = new Set<string>(
  Object.values(API.auth).filter((url) => url !== API.auth.me && url !== API.auth.changePassword),
);

baseRequest.interceptors.request.use((config) => {
  const token = getSession()?.accessToken;
  if (publicAuthUrls.has(config.url ?? '')) config.headers.delete('Authorization');
  else if (token) config.headers.set('Authorization', `Bearer ${token}`);
  if (config.data instanceof FormData) config.headers.setContentType(false);
  return config;
});

baseRequest.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.response) return Promise.reject(error);
    const status = error.response.status;
    let body: unknown = error.response.data;
    if (body instanceof Blob) {
      body = await body
        .text()
        .then((text) => {
          try {
            return JSON.parse(text) as unknown;
          } catch {
            return null;
          }
        })
        .catch(() => null);
    }
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : `Request failed (${status})`;
    const session = getSession();
    const sentAuthorization = error.config?.headers.get('Authorization');
    const wrongPassword =
      error.config?.url === API.auth.changePassword && message === 'Current password is incorrect';
    if (
      status === HTTP_STATUS.UNAUTHORIZED &&
      session &&
      sentAuthorization === `Bearer ${session.accessToken}` &&
      !wrongPassword
    ) {
      setSession(null);
      window.location.replace('/login');
    }
    return Promise.reject(new ApiError(message, status));
  },
);

export async function requestJson<T>(config: AxiosRequestConfig): Promise<ApiResult<T>> {
  const response = await baseRequest.request<unknown>(config);
  const body = response.data === '' ? null : response.data;
  if (typeof body === 'object' && body !== null && 'data' in body) {
    return {
      data: body.data as T,
      ...('meta' in body ? { meta: body.meta as ApiResult<T>['meta'] } : {}),
    };
  }
  return { data: body as T };
}

export async function requestBlob(path: string): Promise<Blob> {
  return (await baseRequest.get<Blob>(path, { responseType: 'blob' })).data;
}

export default baseRequest;
