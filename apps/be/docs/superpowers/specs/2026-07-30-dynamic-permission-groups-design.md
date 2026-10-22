# Thiết kế nhóm quyền động theo permission

**Ngày:** 2026-07-30  
**Phạm vi:** Backend `be`, frontend `fe`, PostgreSQL  
**Trạng thái:** Chờ người dùng review

## 1. Vấn đề

Database đang mô hình hóa RBAC động:

- User thuộc một Organization.
- User có thể thuộc nhiều PermissionGroup.
- Permission hiệu lực là hợp của permission từ mọi nhóm.

Ứng dụng lại suy ra đặc quyền từ mã nhóm cố định:

- `ADMIN` tạo `isAdmin`.
- `THUONG_TRUC` tạo `isStaff`.
- Frontend ép mọi user về `ADMIN`, `THUONG_TRUC`, `DON_VI` hoặc `VIEWER`.

Vì vậy hai nhóm có cùng tập permission vẫn có hành vi khác nhau. Nhóm mới không thể thay thế
`THUONG_TRUC`, dù được gán permission giống hệt. Việc cho phép tạo và xóa nhóm quyền do đó không
đúng với semantics hiện tại.

## 2. Nguyên tắc đã duyệt

Ngoại trừ nhóm hệ thống `ADMIN`:

> Hai user có cùng permission, cùng organization và cùng quan hệ với resource phải có cùng khả năng
> truy cập, không phụ thuộc tên, mã hoặc ID của PermissionGroup.

Ba khái niệm phải tách biệt:

1. **Permission**: capability và phạm vi được phép, ví dụ `tasks.update`.
2. **PermissionGroup**: bó permission có thể tạo, sửa, xóa và gán cho user.
3. **Resource scope**: quan hệ thực tế giữa organization và task/report, ví dụ cơ quan chủ trì hoặc
   phối hợp.

`CHU_TRI` và `PHOI_HOP` tiếp tục được suy từ quan hệ organization-task. Chúng không phải role của
user và không được lưu trong PermissionGroup.

## 3. Phương án

### 3.1 Permission quyết định hành vi

Backend không còn nhận diện `THUONG_TRUC`, `DON_VI` hoặc `VIEWER` bằng mã nhóm. Các nhóm này chỉ là
nhóm mặc định được seed và có thể được thay thế bởi nhóm khác có cùng permission.

`ADMIN` là ngoại lệ hệ thống duy nhất:

- `ADMIN` tiếp tục tạo cờ `isAdmin`.
- Admin được bypass permission và có global scope.
- Nhóm `ADMIN` không được đổi mã, đổi permission hoặc xóa.

Principal hiệu lực gồm:

- `sub`
- `organizationId`
- `permissions`
- `isAdmin`

`isStaff` bị loại khỏi contract và logic.

### 3.2 Permission có phạm vi

Giữ các permission hành động hiện có. Bổ sung hai permission phạm vi:

- `tasks.read.all`: xem task và dữ liệu report/file thuộc mọi organization.
- `dashboard.read.all`: xem dashboard/statistics toàn hệ thống.

Không có permission `*.all`, dữ liệu mặc định bị giới hạn theo organization và quan hệ với task.

Các hành động dùng permission hiện có:

- Tạo task: `tasks.create` và `tasks.assign`.
- Sửa task: `tasks.update`; thay đổi phân công cần thêm `tasks.assign`.
- Xóa task: `tasks.delete`.
- Đóng hoặc hủy kỳ: `tasks.close`.
- Hoàn thành task đột xuất: `tasks.complete`.
- Duyệt báo cáo tổng hợp: `consolidated.review`.

Các kiểm tra organization/task vẫn giữ nguyên. Ví dụ user có `progress.edit` chỉ được lập báo cáo
khi organization của họ là đơn vị phối hợp.

Nhóm mặc định `THUONG_TRUC` được seed thêm `tasks.read.all` và `dashboard.read.all`. Nếu xóa nhóm
này rồi tạo nhóm khác có cùng toàn bộ permission, nhóm mới có hành vi tương đương.

## 4. Thay đổi backend

### 4.1 Xác thực và principal

- Repository tiếp tục hợp permission từ mọi PermissionGroup.
- Chỉ kiểm mã `ADMIN` để tạo `isAdmin`.
- Không tạo hoặc phát hành `isStaff`.
- PermissionGuard tiếp tục nạp permission mới từ database ở mỗi request.

### 4.2 Guard và service

- Controller dùng `@Permissions(...)` cho capability tĩnh.
- Service kiểm tra organization, ownership, task relation và trạng thái resource.
- Xóa mọi nhánh `isStaff` và mọi so sánh mã `THUONG_TRUC`, `DON_VI`, `VIEWER`.
- Global task/report/file scope dùng `isAdmin || permissions.includes('tasks.read.all')`.
- Global dashboard/statistics scope dùng
  `isAdmin || permissions.includes('dashboard.read.all')`.

Backend là nguồn quyết định cuối cùng. Việc frontend ẩn menu hoặc button không thay thế kiểm tra
backend.

### 4.3 Xóa và tạo lại nhóm

- Nhóm thường chỉ được xóa khi không còn user được gán, giữ constraint hiện tại.
- Sau khi nhóm cũ bị xóa, nhóm mới có mã và tên khác nhưng cùng permission phải cho cùng kết quả.
- Mã nhóm thường không tham gia authorization.

## 5. Bảo vệ admin mặc định

### 5.1 Seed admin `id=1`

Database mới phải tạo user `admin` với `id=1`.

- Seed ghi rõ `id: 1` ở nhánh create.
- Sau insert ID tường minh, sequence của bảng users phải được đồng bộ để user tiếp theo không va
  chạm ID.
- Nếu database hiện có user ID 1 không phải `admin`, hoặc `admin` có ID khác, seed dừng với lỗi rõ
  ràng; không tự đổi primary key.

### 5.2 Không đổi role admin mặc định

Với user `id=1`:

- Không cho sửa `permissionGroupIds`.
- Không cho xóa hoặc khóa tài khoản.
- Các trường hồ sơ và mật khẩu vẫn được phép sửa theo API tương ứng.

Frontend disable phần Nhóm quyền và các action xóa/khóa cho user ID 1. Backend vẫn bắt buộc chặn
cùng hành vi; frontend chỉ giúp UX.

### 5.3 Bảo vệ nhóm `ADMIN`

- Không cho update hoặc delete PermissionGroup có mã `ADMIN`.
- Chỉ admin hiệu lực được gán hoặc gỡ nhóm `ADMIN` cho user khác.
- User ID 1 luôn phải giữ nhóm `ADMIN`.

## 6. Chống leo thang đặc quyền

Mọi kiểm tra thực hiện ở backend bằng permission hiệu lực mới nhất của actor.

Actor không phải admin:

- Không được gán nhóm `ADMIN`.
- Chỉ được tạo hoặc cập nhật nhóm có tập permission là tập con của permission hiệu lực của actor.
- Chỉ được gán cho user các nhóm mà toàn bộ permission là tập con của permission hiệu lực của actor.
- Không được dùng nhiều nhóm riêng lẻ để tạo hợp permission vượt quá permission hiệu lực của actor.

Admin được phép quản trị mọi nhóm thường và gán `ADMIN` cho user khác, nhưng không được làm mất nhóm
`ADMIN` của user ID 1.

Permission catalog vẫn do code/seed quản lý; API không cho tạo mã permission tùy ý.

## 7. Thay đổi frontend

### 7.1 Bỏ role cố định

- Bỏ kiểu `Role` gồm bốn giá trị khỏi auth và system user model.
- Bỏ `roleFromUser`, `ROLE_OPTIONS`, `isStaff`, `isViewerRole` và các heuristic tương tự.
- Hiển thị tên nhóm thật từ `permissionGroups` khi cần mô tả user.
- User mới chọn trực tiếp `permissionGroupIds` từ API.

### 7.2 Menu, route và action

Menu và route kiểm permission:

- Người dùng: `users.manage`
- Nhóm quyền: `permission_groups.manage`
- Đơn vị: `organizations.manage`
- Chương trình: `programs.manage`
- Dashboard/statistics: `dashboard.read`
- Lịch sử báo cáo: `report_history.read`

Button task/report kiểm permission hành động tương ứng. Không kiểm tên hoặc mã PermissionGroup.

`canSeeAllUnits` được tính từ `isAdmin`, `tasks.read.all` hoặc `dashboard.read.all` theo màn hình,
không từ role `VIEWER` hay `THUONG_TRUC`.

Frontend không coi thiếu một permission ghi là trạng thái read-only toàn ứng dụng. Mỗi màn hình kiểm
đúng capability của action.

## 8. API và lỗi

Giữ response envelope hiện tại. Bổ sung error code rõ nghĩa:

- `SYSTEM_GROUP_PROTECTED`: sửa/xóa nhóm `ADMIN`.
- `DEFAULT_ADMIN_PROTECTED`: đổi nhóm, khóa hoặc xóa user ID 1.
- `PRIVILEGE_ESCALATION`: actor cố cấp permission/group vượt quyền.

Các lỗi authorization trả HTTP 403. Xóa nhóm đang được gán tiếp tục trả HTTP 409.

Frontend hiển thị message từ API và không tự giả định lỗi dựa trên role.

## 9. Dữ liệu và tương thích

- Không cần thêm bảng hoặc cột mới.
- Thêm permission scope bằng dữ liệu seed.
- Giữ nguyên PermissionGroup, Permission và hai bảng nối hiện tại.
- Giữ các nhóm mặc định để tương thích dữ liệu, nhưng chỉ `ADMIN` là nhóm hệ thống.
- Existing user giữ nguyên membership.
- JWT cũ có thể chứa `isStaff`, nhưng PermissionGuard nạp lại principal từ database và không dùng
  cờ này. Access token mới không phát hành `isStaff`.

## 10. Kiểm thử

### Backend

- Hai nhóm khác mã nhưng cùng permission cho cùng kết quả authorization.
- Nhóm thay thế `THUONG_TRUC` thực hiện được create/update/delete/close task và consolidated review.
- `tasks.read.all` và `dashboard.read.all` mở đúng global scope; thiếu chúng giữ own-organization
  scope.
- Quan hệ chủ trì/phối hợp vẫn giới hạn progress và consolidated workflows.
- Không sửa/xóa nhóm `ADMIN`.
- Không đổi nhóm, khóa hoặc xóa user ID 1.
- Non-admin không tạo, sửa hoặc gán nhóm vượt tập permission của mình.
- Seed database mới tạo admin ID 1 và user tiếp theo không va chạm sequence.
- Seed fail rõ ràng khi ID 1 đã thuộc user khác.

### Frontend

- Nhóm tùy chỉnh không bị ép thành một trong bốn role cũ.
- Menu, route và button hiển thị theo permission.
- Hai user có cùng permission thấy cùng UI dù tên nhóm khác nhau.
- Form user ID 1 disable Nhóm quyền; action khóa/xóa không xuất hiện.
- Response 403 từ backend vẫn được hiển thị đúng.

### E2E

1. Tạo nhóm A với permission tương đương nhóm mặc định nghiệp vụ.
2. Gán nhóm A cho user và xác nhận các API/UI được phép.
3. Gỡ user khỏi nhóm A và xóa nhóm A.
4. Tạo nhóm B tên/mã khác nhưng permission giống A.
5. Gán nhóm B và xác nhận kết quả không đổi.

## 11. Không nằm trong phạm vi

- Permission deny.
- Permission do người dùng tự tạo.
- Scope tùy ý theo từng row ngoài organization/task relation hiện có.
- Thay đổi primary key của admin trong database đã tồn tại.
- Tách authorization thành service hoặc policy engine bên ngoài.

## 12. Tiêu chí hoàn thành

- Ngoài `ADMIN`, không còn authorization dựa trên mã PermissionGroup.
- Không còn `isStaff` trong principal, JWT, backend service hoặc frontend.
- Role/group mới có cùng permission cho cùng backend access và cùng frontend UI.
- Scope toàn hệ thống được biểu diễn bằng permission, không bằng tên nhóm.
- Admin mặc định và nhóm `ADMIN` được bảo vệ ở backend.
- Không thể cấp permission/group vượt quyền actor.
- Toàn bộ test, typecheck, lint và build khả dụng đều thành công.
