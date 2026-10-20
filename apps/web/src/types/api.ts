export interface ApiResult<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}
