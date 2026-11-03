# Kế hoạch triển khai: Chuyển Địa bàn thành Sự kiện, tự sinh mã `XP<số_thứ_tự>` và tách 2 khoảng thời gian

> **Spec đối chiếu:** [`docs/superpowers/specs/2026-11-03-locality-events-spec.md`](../specs/2026-11-03-locality-events-spec.md)

## Ranh giới kiểm thử (Testing Seams)

1. **Seam 1 — HTTP API & Database (`apps/be/test/admin-catalogs.db-spec.ts`, `apps/be/src/dtos/admin-catalogs.dto.spec.ts`)**: kiểm tra toàn trình từ DTO validation, tự sinh mã `XP<số_thứ_tự>` khi tạo mới, kiểm tra trùng lặp **Thời gian sự kiện** trên cùng cặp `(provinceName, name)` (ví dụ Xã A `01/05–31/10/2026` chặn `01/10–31/12/2026` bằng `409 Conflict`, cho phép `01/11–31/12/2026`), kiểm tra **Thời gian mở đăng ký** nằm trong **Thời gian sự kiện**, và lọc sự kiện mở đăng ký trên `GET /localities` + `submitDraft`.
2. **Seam 2 — Frontend Form & API Contract (`apps/web/test/admin-catalogs.test.ts`, `apps/web/test/form-contract.typecheck.tsx`)**: kiểm tra kiểu dữ liệu shared contract, form Sự kiện không yêu cầu nhập mã khi tạo mới, có trường Tên sự kiện, 2 trường khoảng thời gian (`disablePast`) và nút hành động căn phải.

---

## Danh sách Tickets (Vertical Slices)

### Ticket 1: Mở rộng Schema, Shared Contract, tự sinh mã `XP<số_thứ_tự>` và tách 2 khoảng thời gian trên API Sự kiện
- **Blocked by**: None (có thể bắt đầu ngay)
- **What it delivers**:
  - Bổ sung `eventName`, `registrationFrom`, `registrationTo` vào bảng `localities` (migration giữ nguyên dữ liệu cũ, backfill `eventName` từ `name` và `registrationFrom`/`registrationTo` từ `effectiveFrom`/`effectiveTo`).
  - Cập nhật `@ocop/shared` (`LocalityRecord`, `CreateLocalityInput`, `UpdateLocalityInput`) và `CreateLocalityDto` / `UpdateLocalityDto`:
    - `code` không còn bắt buộc trong payload tạo mới (`POST /admin/localities`); backend tự tính số thứ tự tiếp theo và cấp mã duy nhất `XP<số_thứ_tự>` (ví dụ thứ tự 14 → `XP14`, thứ tự 234 → `XP234`).
    - Thêm `eventName` bắt buộc, giữ `effectiveFrom`/`effectiveTo` làm **Thời gian sự kiện** và thêm `registrationFrom`/`registrationTo` làm **Thời gian mở đăng ký**.
  - Kiểm tra ràng buộc `registrationFrom` – `registrationTo` nằm trong `effectiveFrom` – `effectiveTo` và kiểm tra chống giao nhau (overlap) khoảng **Thời gian sự kiện** giữa các bản ghi của cùng `(provinceName, name)` khi tạo mới và khi cập nhật (`409 Conflict`).
  - Cập nhật `seed/sample-data.ts` và pass toàn bộ unit/DB tests cho DTO & `POST/PUT /admin/localities`.

### Ticket 2: Áp dụng Thời gian mở đăng ký cho cổng tra cứu công khai và luồng đăng ký/nộp hồ sơ sản phẩm
- **Blocked by**: Ticket 1
- **What it delivers**:
  - Cập nhật `GET /localities` (public) và `lockActiveLocality` trong `ProductsRepository` để kiểm tra thời điểm hiện tại nằm trong khoảng **Thời gian mở đăng ký** (`registrationFrom <= now < registrationTo`, fallback về `effectiveFrom`/`effectiveTo` nếu bản ghi lịch sử để trống).
  - Cập nhật hiển thị lựa chọn trên `ProductDraftEditor` để người đăng ký thấy rõ Tên sự kiện kèm Xã/Phường và Tỉnh/Thành phố khi chọn.
  - Bổ sung test kiểm chứng sự kiện đang trong Thời gian sự kiện nhưng ngoài Thời gian mở đăng ký sẽ không mở cho nộp hồ sơ mới.

### Ticket 3: Cập nhật giao diện quản trị từ "Địa bàn" sang "Sự kiện" với Tên sự kiện và 2 khoảng thời gian
- **Blocked by**: Ticket 1
- **What it delivers**:
  - Đổi nhãn menu điều hướng, tiêu đề trang, bộ lọc, cột bảng và hộp thoại tại `/admin/localities` từ "Địa bàn" sang "Sự kiện".
  - Trong `LocalityFormDialog`:
    - Ẩn ô nhập mã khi thêm mới (hệ thống tự sinh `XP<số_thứ_tự>`), chỉ hiển thị mã chỉ đọc (`disabled`) khi sửa.
    - Thêm trường bắt buộc **Tên sự kiện**.
    - Tách 2 trường chọn khoảng ngày đều bật `disablePast`: **Thời gian sự kiện** và **Thời gian mở đăng ký** (validate Thời gian mở đăng ký nằm trong Thời gian sự kiện và không chọn ngày quá khứ).
    - Nút `Lưu` và `Đóng` căn phải (`justify-end`).
  - Cập nhật bảng danh sách hiển thị Mã sự kiện (`XP...`), Tên sự kiện, Xã/Phường, Tỉnh/Thành phố, Thời gian sự kiện, Thời gian mở đăng ký và Trạng thái.
