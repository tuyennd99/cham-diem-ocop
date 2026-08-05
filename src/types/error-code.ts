export enum ErrorCode {
  SYSTEM_ERROR = 'IEM00', // Đã xảy ra lỗi, vui lòng thử lại sau
  INVALID_CREDENTIALS = 'IEM01', // Thông tin đăng nhập không hợp lệ
  USER_NOT_FOUND = 'IEM02', // User không tồn tại
  AUTH_FAILED = 'IEM03', // Lỗi xác thực
  REPORT_NOT_FOUND = 'IEM04', // Báo cáo không tồn tại
  REPORTING_SUBTASK_OR_ASSIGNMENT_HAS_CHANGED = 'IEM05', // Kỳ báo cáo hoặc phân công đã thay đổi
  ONLY_THE_LEAD_ORGANIZATION_MAY_CONSOLIDATE = 'IEM06', // Chỉ tổ chức chủ trì được tổng hợp báo cáo
  ONLY_AN_ASSIGNED_COLLABORATOR_MAY_REPORT = 'IEM07', // Chỉ đơn vị được phân công phối hợp mới được báo cáo
  TASK_ASSIGNMENT_CANNOT_BE_CHANGED = 'IEM08', // Không thể thay đổi phân công nhiệm vụ sau khi báo cáo đã được bắt đầu
  REPORT_WORKSPACE_NOT_FOUND = 'IEM09', // Không tìm thấy không gian báo cáo
  REPORTING_SUBTASK_NOT_FOUND = 'IEM10', // Không tìm thấy kỳ báo cáo
  INVALID_TASK_RESPONSIBILITY = 'IEM11', // Bạn không có quyền thực hiện hành động này
  REPORT_IS_OUTSIDE_YOUR_SCOPE = 'IEM12', // Báo cáo không nằm trong phạm vi của bạn
  ONLY_THE_LEAD_ORGANIZATION_MAY_REVIEW_PROGRESS = 'IEM13', // Chỉ tổ chức chủ trì được duyệt báo cáo tiến độ
  REPORTING_SUBTASK_IS_NOT_OPEN = 'IEM14',
  REPORT_IS_NOT_PENDING_REVIEW = 'IEM15',
  REPORT_IS_NOT_APPROVED = 'IEM16',
  TASK_CAN_ONLY_BE_ASSIGNED_BY_THE_CURRENT_ORGANIZATION = 'IEM17',
  TASK_CODE_ALREADY_EXISTS = 'IEM18',












}
