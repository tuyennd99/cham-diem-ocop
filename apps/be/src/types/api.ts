import type { PaginatedMeta } from '@ocop/shared';

export type ApiSuccess<T> = {
  statusCode: number;
  data: T;
  meta?: PaginatedMeta;
  message?: string;
};

export type ApiError = {
  statusCode: number;
  message: string;
  requestId?: string;
};
