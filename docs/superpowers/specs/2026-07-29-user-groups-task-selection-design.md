# Thiết kế nhóm người dùng khi giao nhiệm vụ

## Mục tiêu

Cho phép quản trị viên tạo nhóm gồm nhiều người dùng. Khi tạo hoặc sửa nhiệm
vụ, người giao việc có thể chọn nhóm để bổ sung nhanh các đơn vị phối hợp, đồng
thời vẫn có thể thêm hoặc xóa từng đơn vị thủ công.

Task lưu cả nhóm đã chọn và ảnh chụp danh sách đơn vị phối hợp. Thay đổi thành
viên nhóm không tự động thay đổi task đã tồn tại.

## Ngoài phạm vi

- Không giao nhiệm vụ trực tiếp cho từng user.
- Không thay đổi quyền báo cáo, thông báo hoặc phạm vi truy cập đang dựa trên
  đơn vị.
- Không lưu nguồn gốc từng đơn vị đến từ nhóm nào.
- Không tự động xóa đơn vị khi xóa nhóm khỏi task hoặc khi thành viên nhóm thay
  đổi.

## Mô hình dữ liệu

Thêm các model Prisma:

### `UserGroup`

- `id`: khóa chính tự tăng.
- `name`: tên nhóm, duy nhất, tối đa 255 ký tự.
- `description`: mô tả tùy chọn.
- `createdAt`, `updatedAt`.
- Quan hệ nhiều-nhiều với `User` qua `UserGroupMember`.
- Quan hệ nhiều-nhiều với `Task` qua `TaskUserGroup`.

### `UserGroupMember`

- `userGroupId`.
- `userId`.
- Khóa chính ghép `(userGroupId, userId)`.
- Xóa nhóm thì xóa các dòng thành viên.

### `TaskUserGroup`

- `taskId`.
- `userGroupId`.
- Khóa chính ghép `(taskId, userGroupId)`.
- Xóa task thì xóa quan hệ.
- Không xóa nhóm đang được task tham chiếu; API trả lỗi xung đột để tên nhóm
  vẫn hiển thị được trên màn hình sửa task.

`TaskCollaborator` tiếp tục là danh sách đơn vị phối hợp có hiệu lực và là
nguồn dữ liệu duy nhất cho báo cáo, thông báo và phân quyền task.

## API quản trị nhóm

Dùng quyền `users.manage`, không tạo permission mới:

- `GET /system/user-groups`
- `GET /system/user-groups/:id`
- `POST /system/user-groups`
- `PATCH /system/user-groups/:id`
- `DELETE /system/user-groups/:id`

Payload ghi:

```json
{
  "name": "Tổ công tác A",
  "description": "Nhóm phối hợp liên đơn vị",
  "userIds": [1, 2, 3]
}
```

Backend chuẩn hóa khoảng trắng tên, kiểm tra tên không rỗng/không trùng, loại
trùng `userIds` ở biên DTO và xác nhận mọi user tồn tại, chưa bị xóa. Thành viên
bị khóa vẫn được giữ trong cấu hình nhóm nhưng không được dùng khi quy đổi cho
task.

Tạo, sửa và xóa nhóm được ghi `AuditLog` theo mẫu CRUD hệ thống hiện có.

## Lookup cho form task

Thêm `GET /tasks/lookups/user-groups`, dùng quyền `tasks.read`, trả dữ liệu tối
thiểu:

```json
[
  {
    "id": 10,
    "name": "Tổ công tác A",
    "organizationIds": [2, 5]
  }
]
```

`organizationIds` là tập duy nhất từ thành viên thỏa tất cả điều kiện:

- User có `status = ACTIVE`.
- User chưa bị xóa.
- Organization có `status = ACTIVE`.
- Organization có `isExecutingUnit = true`.

Nhóm không có đơn vị hợp lệ vẫn được trả về với mảng rỗng để frontend giải
thích rõ lý do không thể bổ sung.

## API task

Mở rộng payload tạo/sửa task với:

```json
{
  "userGroupIds": [10, 12],
  "collaboratorOrganizationIds": [2, 5, 8]
}
```

Backend:

- Xác nhận `userGroupIds` là duy nhất và các nhóm tồn tại.
- Chỉ lưu quan hệ `TaskUserGroup`; không tự quy đổi lại đơn vị.
- Tiếp tục xác thực `collaboratorOrganizationIds` bằng quy tắc hiện có.
- Trả `userGroupIds` và thông tin nhóm tối thiểu trong task view để màn hình sửa
  hiển thị lại.

Frontend chịu trách nhiệm tạo ảnh chụp đơn vị trước khi gửi. Backend không tin
dữ liệu đơn vị một cách mù quáng vì quy tắc xác thực task hiện tại vẫn được giữ
nguyên.

## Giao diện

### Quản trị nhóm

Thêm mục “Nhóm người dùng” trong khu vực quản trị hệ thống. Danh sách hỗ trợ
tạo, sửa, xóa theo mẫu CRUD hiện có. Form gồm:

- Tên nhóm.
- Mô tả.
- Bộ chọn nhiều user, hiển thị họ tên và đơn vị.

Chỉ user chưa bị xóa xuất hiện trong bộ chọn. User bị khóa vẫn hiển thị để quản
trị viên nhận biết thành viên đang được giữ nhưng có trạng thái khóa.

### Form task

Thêm hai phần độc lập:

1. “Nhóm người dùng”: bộ chọn nhiều nhóm, được lưu vào `userGroupIds`.
2. “Đơn vị phối hợp”: bộ chọn nhiều hiện có, là danh sách cuối cùng được lưu.

Khi chọn thêm một nhóm, frontend hợp nhất `organizationIds` hiện tại của nhóm
vào `collaboratorOrganizationIds`, loại trùng và loại đơn vị chủ trì. Người dùng
có thể tiếp tục thêm hoặc xóa từng đơn vị.

Khi sửa task:

- Các nhóm đã lưu được chọn lại.
- Các đơn vị đã lưu được hiển thị nguyên trạng.
- Không tự động quy đổi lại nhóm khi tải form.

Nút “Bổ sung đơn vị mới từ nhóm” hợp nhất lại các `organizationIds` hiện tại
của toàn bộ nhóm đang chọn. Nút này không xóa đơn vị cũ. Đơn vị không còn phù
hợp được người dùng xóa trực tiếp bằng nút xóa trên chip đơn vị.

Xóa một nhóm khỏi task không tự xóa đơn vị, vì không lưu nguồn gốc đơn vị và
một đơn vị có thể được chọn thủ công hoặc xuất hiện trong nhiều nhóm.

Nếu nhóm không có đơn vị hợp lệ, frontend giữ nhóm được chọn nhưng thông báo
“Nhóm không có thành viên hoạt động thuộc đơn vị thực hiện”.

## Luồng dữ liệu

### Tạo task

1. Frontend tải lookup đơn vị và nhóm.
2. Người dùng chọn nhóm; frontend bổ sung các đơn vị hợp lệ.
3. Người dùng chỉnh danh sách đơn vị cuối cùng.
4. Frontend gửi `userGroupIds` và `collaboratorOrganizationIds`.
5. Backend xác thực và lưu `TaskUserGroup` cùng `TaskCollaborator` trong giao
   dịch tạo task hiện có.

### Sửa task

1. Frontend tải nhóm và đơn vị đã lưu trên task.
2. Không tự đồng bộ với thành viên nhóm hiện tại.
3. Nếu người dùng bấm “Bổ sung đơn vị mới từ nhóm”, frontend chỉ hợp nhất các
   đơn vị hiện tại.
4. Backend thay thế hai tập quan hệ theo payload đã xác thực.

## Xử lý lỗi

- Tên nhóm trùng: `409 Conflict`.
- User hoặc nhóm không tồn tại: `400 Bad Request`.
- Xóa nhóm đang được task sử dụng: `409 Conflict`.
- Nhóm không có đơn vị hợp lệ: không chặn lưu nhóm; frontend cảnh báo khi dùng
  trên form task.
- Đơn vị chủ trì xuất hiện do nhóm: frontend loại trước khi gửi; backend vẫn
  chặn bằng kiểm tra hiện có.

## Kiểm thử

Backend:

- CRUD nhóm và cập nhật thành viên.
- Không cho tên trùng hoặc user không tồn tại.
- Lookup loại user bị khóa/xóa, organization không hoạt động/không thực hiện,
  đồng thời loại trùng organization.
- Tạo/sửa task lưu và trả lại `userGroupIds` mà không tự đổi
  `collaboratorOrganizationIds`.
- Không cho xóa nhóm đang được task sử dụng.

Frontend:

- Chọn nhóm hợp nhất đơn vị, loại trùng và loại đơn vị chủ trì.
- Vẫn thêm/xóa đơn vị thủ công.
- Mở form sửa hiển thị nhóm và đơn vị đã lưu mà không tự đồng bộ.
- Nút bổ sung chỉ thêm đơn vị hiện tại, không xóa đơn vị cũ.
- Hiển thị cảnh báo cho nhóm không có đơn vị hợp lệ.

