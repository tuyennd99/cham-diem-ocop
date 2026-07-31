export enum ErrorCode {
  SYSTEM_ERROR = 'IEM00', // Đã xảy ra lỗi, vui lòng thử lại sau
  INVALID_CREDENTIALS = 'IEM01', // Thông tin đăng nhập không hợp lệ
  USER_NOT_FOUND = 'IEM02', // User không tồn tại
  AUTH_FAILED = 'IEM03', // Lỗi xác thực
}
