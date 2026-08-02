export enum ErrorCode {
  SYSTEM_ERROR = 'IEM00', // Đã xảy ra lỗi, vui lòng thử lại sau
  INVALID_CREDENTIALS = 'IEM01', // Thông tin đăng nhập không hợp lệ
  USER_NOT_FOUND = 'IEM02', // User không tồn tại
  AUTH_FAILED = 'IEM03', // Lỗi xác thực
  REPORT_NOT_FOUND = 'IEM04', // Báo cáo không tồn tại
  REPORTING_PERIOD_OR_ASSIGNMENT_HAS_CHANGED = 'IEM05', // Kỳ báo cáo hoặc phân công đã thay đổi
  ONLY_THE_LEAD_ORGANIZATION_MAY_CONSOLIDATE = 'IEM06', // Chỉ tổ chức chủ trì được tổng hợp báo cáo
  ONLY_AN_ASSIGNED_COLLABORATOR_MAY_REPORT = 'IEM07',
  REPORT_WORKSPACE_NOT_FOUND = 'IEM08',
  REPORTING_PERIOD_NOT_FOUND = 'IEM09',
}
