# Thiết kế gỡ bỏ nhóm người dùng

**Ngày:** 2026-07-29  
**Phạm vi:** Backend `be`, frontend `fe`, cơ sở dữ liệu PostgreSQL  
**Trạng thái:** Đã được duyệt

## Mục tiêu

Gỡ hoàn toàn tính năng nhóm người dùng vì tính năng này bị thừa. Task quay lại
chỉ lưu và hiển thị danh sách đơn vị phối hợp. Việc gỡ không được làm thay đổi
`task_collaborators` hoặc `collaboratorOrganizationIds` đã lưu.

Không cần xuất hay giữ lại dữ liệu trong các bảng nhóm người dùng.

## Ràng buộc

- Làm trực tiếp trên nhánh `dev` của hai repository.
- Không dùng `git reset`, không viết lại lịch sử và không revert nguyên commit.
- Giữ nguyên migration `0003_user_groups` vì không xác định được migration này
  đã chạy ở môi trường dùng chung hay chưa.
- Giữ mọi thay đổi chưa commit không liên quan đang có ở backend và frontend.
- Giữ các bản sửa baseline độc lập, gồm frontend baseline và xử lý CORS/CSRF
  backend.
- Khi commit, chỉ stage file hoặc hunk thuộc việc gỡ tính năng.

## Phương án

Thực hiện gỡ tiến bằng commit mới.

Phương án này an toàn với database đã từng chạy migration `0003`, không làm thay
đổi lịch sử nhánh `dev`, và cho phép tách các hunk của tính năng khỏi những thay
đổi chưa commit đang chồng lên cùng file.

Không chọn:

- Revert các commit tính năng, vì các commit sửa lỗi và thay đổi khác đã xen kẽ.
- Đưa nhánh về trước tính năng rồi chọn lại commit, vì có nguy cơ mất thay đổi và
  viết lại lịch sử nhánh dùng chung.

## Database

Giữ `prisma/migrations/0003_user_groups/migration.sql`.

Thêm migration tiến `0004_remove_user_groups`. Migration xoá bảng theo thứ tự
khóa ngoại:

1. `task_user_groups`
2. `user_group_members`
3. `user_groups`

Migration không đọc, cập nhật hoặc xoá dữ liệu trong `task_collaborators`.

Gỡ khỏi Prisma schema:

- Model `TaskUserGroup`
- Model `UserGroupMember`
- Model `UserGroup`
- Relation nhóm trên `Task`
- Relation nhóm trên `User`

Không bổ sung cơ chế backup hoặc chuyển đổi dữ liệu nhóm.

## Backend

Gỡ toàn bộ bề mặt API và logic chỉ phục vụ nhóm:

- CRUD `/system/user-groups`
- Lookup `/tasks/lookups/user-groups`
- DTO tạo/sửa nhóm
- `userGroupIds` trong DTO và representation của task
- Service và repository quản trị nhóm
- Service và repository lookup, kiểm tra, lưu và đọc nhóm trên task
- Audit action và mapping chỉ dùng cho nhóm
- Xử lý xoá membership khi xoá user

Sau khi gỡ:

- Task create/update không nhận `userGroupIds`.
- Task detail/list không trả `userGroupIds` hoặc thông tin nhóm.
- Quyền và API quản trị user, đơn vị, nhóm quyền và chương trình/nghị quyết giữ
  nguyên.
- Tạo/sửa task tiếp tục sử dụng `collaboratorOrganizationIds` làm nguồn dữ liệu
  duy nhất cho đơn vị phối hợp.

Các thay đổi backend chưa commit về Swagger, response decorator và response
interceptor được giữ nguyên. Những file chồng lấn phải được chỉnh theo từng hunk,
không phục hồi toàn file về một commit cũ.

## Frontend

Gỡ phần quản trị nhóm:

- Trang và route “Nhóm người dùng”
- Mục menu tương ứng
- API client, query key và type của nhóm
- Form quản trị nhóm
- Nhánh `user-groups` trong CRUD dùng chung

Gỡ phần nhóm khỏi task:

- Bộ chọn nhóm
- Nút “Cập nhật lại từ nhóm”
- Cảnh báo nhóm không có đơn vị
- Logic quy đổi nhóm thành danh sách đơn vị
- Query lookup nhóm trên trang tạo và sửa task
- `userGroupIds` trong type, state, mapper và payload task

Form task chỉ còn bộ chọn đơn vị phối hợp. Dữ liệu đơn vị phối hợp hiện có được
đọc và gửi lại như trước.

Giữ nguyên các thay đổi chưa commit không liên quan, gồm:

- Validate mã nhiệm vụ
- Danh sách lựa chọn chương trình/nghị quyết
- Cải tiến combobox
- Cải tiến form CRUD dùng chung
- DataTable server-side

Các file chỉ tồn tại để phục vụ tính năng nhóm, gồm
`src/pages/system/components/user-group-form.tsx` và
`src/pages/system/user-groups/index.tsx`, sẽ bị xoá.

## Tài liệu

Xoá spec và implementation plan cũ của tính năng nhóm:

- `be/docs/superpowers/specs/2026-07-29-user-groups-task-selection-design.md`
- `be/docs/superpowers/plans/2026-07-29-user-groups-task-selection.md`

Giữ spec gỡ bỏ này và implementation plan gỡ bỏ được lập sau khi spec được duyệt.

## Kiểm thử

Gỡ các test chỉ kiểm tra nhóm và cập nhật fixture/test dùng chung để không còn
`userGroupIds`.

Chạy các kiểm tra sau:

### Backend

- Prisma format
- Prisma validate
- Unit tests
- E2E tests
- Database E2E tests nếu môi trường PostgreSQL kiểm thử sẵn sàng
- Lint
- Build

### Frontend

- Unit/component tests
- Lint
- Build

### Kiểm tra tồn dư

Tìm trên source, test, schema và cấu hình để xác nhận không còn:

- `UserGroup`
- `UserGroupMember`
- `TaskUserGroup`
- `userGroupIds`
- `/system/user-groups`
- `/tasks/lookups/user-groups`
- Route hoặc menu “Nhóm người dùng”

Migration `0003_user_groups` và tài liệu lịch sử Git được phép còn chuỗi tìm
kiếm. Migration `0004_remove_user_groups` phải còn tên các bảng để thực hiện
việc xoá.

Nếu database E2E không thể chạy vì môi trường thiếu PostgreSQL hoặc
`TEST_DATABASE_URL`, kết quả bàn giao phải nêu rõ giới hạn này. Mọi kiểm tra còn
lại phải thành công trước khi coi việc gỡ hoàn tất.

## Tiêu chí hoàn thành

- Database mới chạy toàn bộ migration sẽ tạo rồi xoá sạch ba bảng nhóm.
- Database đã chạy `0003` có thể áp dụng migration mới để xoá sạch ba bảng nhóm.
- Backend không còn API, DTO, service, repository hoặc task payload liên quan
  đến nhóm.
- Frontend không còn màn hình, route, menu, API client hoặc điều khiển task liên
  quan đến nhóm.
- Đơn vị phối hợp đã lưu trên task không bị thay đổi.
- Các thay đổi chưa commit không liên quan được giữ nguyên.
- Các kiểm tra khả dụng đều thành công và không còn tham chiếu tính năng ngoài
  các ngoại lệ lịch sử đã nêu.
