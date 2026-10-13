export type Role = 'REGISTRANT' | 'JUDGE' | 'ADMIN';
export type ProductStatus = 'DRAFT' | 'SUBMITTED' | 'SCORING' | 'COMPLETED';

export interface ProductCategory {
  id: string;
  name: string;
}

export interface ApiSuccess<T> {
  statusCode: number;
  data: T;
  message?: string;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiError {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: unknown;
  requestId: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;
