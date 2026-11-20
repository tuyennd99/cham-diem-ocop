import type { PaginatedMeta } from '@ocop/shared';

export type ApiPaginationMeta = PaginatedMeta;

export interface ApiResult<T, M = ApiPaginationMeta> {
  data: T;
  meta?: M;
}
