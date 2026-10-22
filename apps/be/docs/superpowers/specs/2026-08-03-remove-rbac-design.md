# Thiết kế gỡ bỏ RBAC, giữ một admin hệ thống

**Ngày:** 2026-08-03
**Phạm vi:** Backend `be`, frontend `fe`, PostgreSQL
**Trạng thái:** Đã duyệt thiết kế, chờ duyệt tài liệu

## 1. Mục tiêu

Gỡ hoàn toàn tính năng phân quyền động. Hệ thống chỉ còn hai loại tài khoản:

- Admin hệ thống duy nhất là user `id=1`.
- Mọi user còn lại là user nghiệp vụ, có cùng tập khả năng nhưng bị giới hạn dữ liệu và hành động theo quan hệ giữa đơn vị của user với task.

Giữ nguyên xác thực, quản lý tài khoản, khóa tài khoản, lịch sử tác giả và toàn bộ workflow nghiệp vụ hiện có.

## 2. Quy tắc truy cập

### 2.1 Admin

- `User.id === 1` là điều kiện duy nhất xác định admin.
- Admin được truy cập mọi endpoint `/system/*`.
- Admin xem và thao tác mọi task, báo cáo, file và kỳ báo cáo, không phụ thuộc đơn vị.
- Không được xóa, khóa hoặc xóa mềm admin mặc định.

### 2.2 User nghiệp vụ

- Không được truy cập endpoint hoặc màn hình `/system/*`.
- Được xem task khi `organizationId` của user trùng một trong các quan hệ:
  - `Task.assigningOrganizationId` — đơn vị giao việc;
  - `Task.leadOrganizationId` — đơn vị chủ trì;
  - `TaskCollaborator.organizationId` — đơn vị phối hợp.
- Danh sách task phải lọc tại database. Truy cập trực tiếp task ngoài phạm vi trả `404` để không lộ sự tồn tại.
- Các user trong cùng đơn vị có cùng quyền trên task liên quan; không bổ sung quan hệ task-user.

### 2.3 Workflow theo vai trò đơn vị

- Đơn vị giao việc: tạo, sửa, xóa, đóng hoặc hoàn thành task; duyệt báo cáo tổng hợp.
- Đơn vị chủ trì: lập và gửi báo cáo tổng hợp; duyệt hoặc trả lại báo cáo tiến độ.
- Đơn vị phối hợp: lập và gửi báo cáo tiến độ.
- Cả ba loại đơn vị được xem task và dữ liệu liên quan.
- Khi user thường tạo task, đơn vị giao việc bắt buộc là đơn vị của user. Admin được chọn bất kỳ đơn vị giao việc nào.
- Backend là nguồn quyết định cuối cùng. Frontend chỉ ẩn hoặc hiện route, menu và action theo `isAdmin` và quan hệ task.

## 3. Kiến trúc xác thực và kiểm soát truy cập

Giữ nguyên:

- đăng nhập và đổi mật khẩu;
- access token, refresh token và refresh rotation;
- CSRF, throttling và các kiểm tra JWT hiện có;
- trạng thái `ACTIVE`/`LOCKED`, `deletedAt` và refresh sessions.

Thay `PermissionGuard` bằng guard trạng thái tài khoản dùng chung cho HTTP:

1. Đọc user hiện tại từ database bằng `sub` trên token.
2. Từ chối user không tồn tại, bị khóa, không còn `ACTIVE` hoặc đã xóa mềm.
3. Nạp `organizationId` mới nhất từ database vào principal.
4. Gán `isAdmin = user.id === 1`.

WebSocket handshake phải thực hiện cùng kiểm tra trạng thái tài khoản, không tin `organizationId` hoặc `isAdmin` cũ trong token.

Auth principal và response user bỏ trường `permissions`. `isAdmin` tiếp tục là giá trị dẫn xuất, không lưu trong database.

## 4. Gỡ RBAC

### 4.1 Database

Gỡ khỏi Prisma schema:

- `Permission`;
- `PermissionGroup`;
- `PermissionGroupPermission`;
- `UserPermissionGroup`;
- relation `User.permissionGroups`.

Thêm migration tiến xóa bảng theo thứ tự:

1. `user_permission_groups`;
2. `permission_group_permissions`;
3. `permission_groups`;
4. `permissions`.

Không xóa user cũ. Task, báo cáo, file, audit log và dữ liệu lịch sử tiếp tục giữ nguyên foreign key tới user.

### 4.2 Backend

- Xóa permission constants, decorators và logic tổng hợp permission.
- Xóa API CRUD permission group và API danh mục permission.
- Bỏ `permissionGroupIds` khỏi DTO, repository và service quản lý user.
- Bảo vệ toàn bộ `/system/*` bằng kiểm tra admin duy nhất.
- Thay các nhánh `isAdmin || permissions.includes(...)` bằng kiểm tra admin hoặc quan hệ organization-task tương ứng.
- Tập trung điều kiện phạm vi task tại truy vấn repository và điều kiện workflow tại service; không lặp guard ở controller.
- Giữ audit cho quản trị user, đơn vị, chương trình và mọi thay đổi nghiệp vụ.

### 4.3 Frontend

- Xóa menu, route và trang “Phân quyền”.
- Xóa API client, types, constants, hook và helper chỉ phục vụ permission.
- Bỏ chọn nhóm quyền khỏi form tạo/sửa user.
- Route `/system/*` chỉ hiển thị và cho phép truy cập khi `user.isAdmin === true`.
- Menu và nút nghiệp vụ dựa trên quan hệ task trả về từ backend; admin luôn được phép.
- Không dùng việc ẩn UI thay cho kiểm tra backend.

## 5. Seed và dữ liệu hiện có

- Seed chỉ tạo admin `id=1` khi chưa tồn tại và bảo đảm sequence user không va chạm.
- Seed không tạo permission, permission group hoặc membership.
- Seed không tự reset mật khẩu của admin đã tồn tại.
- Mật khẩu admin khởi tạo ở môi trường production phải đến từ secret bắt buộc; không dùng mật khẩu fallback.
- Mọi user hiện có giữ nguyên trạng thái và tự động trở thành user nghiệp vụ sau khi RBAC bị gỡ.
- Trước migration phá hủy bảng RBAC, ghi nhận số dòng và tạo backup phục hồi được.

## 6. API và lỗi

- Token thiếu, sai hoặc hết hạn: `401`.
- Tài khoản bị khóa, xóa mềm hoặc không còn hoạt động: `403`.
- Non-admin truy cập `/system/*`: `403`.
- Task ngoài phạm vi đơn vị: `404` cho cả đọc và mutation.
- Vi phạm vai trò đơn vị trong workflow của task liên quan: `403`.
- Giữ response envelope và error-code pattern hiện có; không tạo lớp lỗi mới chỉ cho thay đổi này.

Các endpoint sau bị xóa:

- `/system/permission-groups` và các endpoint con;
- `/system/permissions`.

Endpoint quản lý user, đơn vị và chương trình tiếp tục tồn tại, chỉ admin được gọi.

## 7. Trình tự triển khai

1. Thêm account-state guard cho HTTP và WebSocket, chuyển principal sang `isAdmin` dẫn xuất.
2. Chuyển toàn bộ kiểm tra nghiệp vụ sang quan hệ organization-task; giữ schema RBAC tạm thời nhưng không còn đọc.
3. Gỡ UI/API/types/decorators/service dành riêng cho RBAC.
4. Chạy toàn bộ kiểm thử và triển khai code không còn phụ thuộc bảng RBAC.
5. Backup và chạy migration xóa bốn bảng RBAC.
6. Chạy smoke test đăng nhập, system administration và workflow task/report sau migration.

Thứ tự code trước, migration sau tránh lỗi khi có instance phiên bản cũ và cho phép rollback code trước khi xóa dữ liệu RBAC.

## 8. Kiểm thử

### Backend

- Admin `id=1` bypass phạm vi task và truy cập mọi `/system/*`.
- User thường nhận `403` với mọi `/system/*`.
- User bị khóa hoặc xóa mềm bị chặn ngay trên HTTP và WebSocket dù token chưa hết hạn.
- User thuộc đơn vị giao việc, chủ trì hoặc phối hợp nhìn thấy task; user thuộc đơn vị ngoài task không nhìn thấy.
- Mỗi loại đơn vị thực hiện đúng action workflow và bị chặn với action của loại đơn vị khác.
- Admin không thể bị khóa, xóa hoặc xóa mềm.
- Seed chạy lặp không đổi mật khẩu admin và không tái tạo RBAC.
- Prisma migration chạy thành công trên database có và không có membership RBAC.

### Frontend

- Không còn route/menu/trang “Phân quyền”.
- Form user không còn trường nhóm quyền.
- Non-admin không thấy system navigation và bị redirect nếu nhập URL trực tiếp.
- Action trên task hiển thị theo quan hệ đơn vị; admin thấy mọi action hợp lệ.
- Auth hoạt động khi response không còn `permissions`.

### E2E tối thiểu

1. Admin đăng nhập, quản trị user/đơn vị/chương trình và thao tác một task bất kỳ.
2. User đơn vị giao việc tạo task và quản lý vòng đời task.
3. User phối hợp lập, gửi báo cáo tiến độ.
4. User chủ trì duyệt báo cáo tiến độ, lập và gửi báo cáo tổng hợp.
5. User đơn vị giao việc duyệt báo cáo tổng hợp.
6. User đơn vị ngoài task không thấy task; user bị khóa mất truy cập ngay.

## 9. Ngoài phạm vi

- Gán user riêng lẻ vào task.
- Tạo loại admin thứ hai hoặc giao diện chuyển quyền admin.
- Permission tùy chỉnh, permission deny hoặc policy engine ngoài ứng dụng.
- Thay đổi workflow báo cáo, trạng thái task hoặc mô hình đơn vị hiện tại.
- Xóa user cũ hoặc làm mất thông tin tác giả lịch sử.

## 10. Tiêu chí hoàn thành

- Không còn model, bảng, API, UI hoặc runtime branch dựa trên permission/permission group.
- Chỉ user `id=1` truy cập system administration và có phạm vi nghiệp vụ toàn hệ thống.
- Mọi user thường có cùng khả năng nghiệp vụ, được giới hạn chính xác theo quan hệ đơn vị-task.
- User ngoài task không thể liệt kê, đọc hoặc mutation task đó.
- Tài khoản khóa/xóa mềm bị vô hiệu ngay trên HTTP và WebSocket.
- Dữ liệu task, báo cáo, file, audit và lịch sử user không mất.
- Seed, migration, test, typecheck, lint và build khả dụng đều thành công.
