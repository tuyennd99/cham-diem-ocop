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
  message: string;
  requestId?: string;
}
