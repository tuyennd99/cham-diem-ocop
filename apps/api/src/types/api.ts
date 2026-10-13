export type ApiSuccess<T> = {
  statusCode: number;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
}

export type ApiError = {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: unknown;
  requestId: string;
}
