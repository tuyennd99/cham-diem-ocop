// HTTP status BE trả về (khớp be/src: HttpStatus + các *Exception đang dùng).
// Dùng cho interceptor/retry, không phải bảng tra đầy đủ RFC — thêm khi BE
// thực sự trả thêm mã mới.
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

/** Lỗi nghiệp vụ (4xx): retry vô nghĩa. */
export const isClientError = (status?: number) =>
  status !== undefined &&
  status >= HTTP_STATUS.BAD_REQUEST &&
  status < HTTP_STATUS.INTERNAL_SERVER_ERROR;
