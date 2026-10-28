import type { User } from '@/types/auth';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  statusCode: number;
  message?: string;
  data?: T;
  meta?: PaginationMeta;
  errorCode?: string;
  cause?: unknown;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface AuthSession extends AuthTokens {
  user: User;
}
