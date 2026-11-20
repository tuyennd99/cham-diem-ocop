# Thiết kế: Ẩn tab Sản phẩm với Chủ trì và chuyển cột Thao tác sang icon + nút Duyệt nhanh

Ngày: 18/11/2026

## 1. Mục đích và bối cảnh
- Vai trò **Chủ trì** (`VIEW`, không có `MANAGE`) chỉ có nhiệm vụ xem và xét duyệt hồ sơ đăng ký đã nộp, không có quyền tạo/sửa bản nháp. Việc hiển thị đồng thời 2 tab menu **Sản phẩm** (`/admin/products`) và **Phiếu đăng ký** (`/admin/registrations`) với nội dung giống hệt nhau gây dư thừa.
- Bảng danh sách ở chế độ Chủ trì / Quản trị hiện dùng nút chữ (`Mở hồ sơ`, `Sửa phiếu`) chiếm diện tích ngang và thiếu thao tác **Duyệt hồ sơ** nhanh ngay trên bảng cho các hồ sơ đang ở trạng thái `SUBMITTED`.

## 2. Mục tiêu và phi mục tiêu
- **Mục tiêu:**
  1. Ẩn mục menu **Sản phẩm** khỏi thanh điều hướng của Chủ trì (`!canManage`), chỉ giữ mục **Phiếu đăng ký** (`/admin/registrations`). Quản trị (`canManage`) vẫn thấy cả hai mục.
  2. Chuyển các nút trong cột **Thao tác** của `AdminProductsPage` (chế độ `!isOwner`) sang nút icon (`size="icon-sm"` có `Tooltip`), đồng bộ với giao diện của Người đăng ký.
  3. Bổ sung nút icon **Duyệt hồ sơ** (`CheckCircle2`) trên dòng có trạng thái `SUBMITTED`, mở hộp thoại xác nhận duyệt (nhập ghi chú tùy chọn) và gọi `adminProductsApi.approve(id, reason)`.
- **Phi mục tiêu:**
  - Không xóa route `/admin/products` hoặc chặn quyền `VIEW` ở route guard để tránh làm gãy các liên kết drill-down từ Dashboard, Báo cáo thống kê và các bài kiểm thử SSR/router.

## 3. Các phương án đã cân nhắc
1. **Phương án 1 (Đã chọn):** Giữ route/guard `/admin/products`, ẩn mục menu **Sản phẩm** khi `!canManage` trong `WorkspaceNav`, `AppSidebar`, `PublicLayout`, và nâng cấp cột **Thao tác** trong `AdminProductsPage` sang icon + hộp thoại Duyệt nhanh.
2. **Phương án 2:** Xóa hẳn route `/admin/products` hoặc đổi guard sang `MANAGE`. Loại vì làm gãy drill-down từ Dashboard/Báo cáo thống kê đối với Chủ trì.

## 4. Thiết kế chi tiết
- **Điều hướng (`WorkspaceNav.tsx`, `app-sidebar.tsx`, `PublicLayout.tsx`):**
  - Chỉ render mục `/admin/products` ("Sản phẩm") khi `canManage === true`.
  - Trong `PublicLayout.tsx`, khi `canView && !canManage`, menu người dùng trỏ tới `/admin/registrations` với nhãn `"Phiếu đăng ký"`.
- **Cột Thao tác & Duyệt nhanh (`AdminProductsPage.tsx`):**
  - Nhánh `!isOwner` trong `productColumns` dùng `<div className='admin-table-actions admin-table-actions--icons min-w-24'>`:
    - Icon `Eye`: `Mở hồ sơ` (`/admin/products/$id` hoặc `/admin/registrations/$id`).
    - Icon `CheckCircle2`: `Duyệt hồ sơ` (hiển thị khi `canView && product.status === PRODUCT_STATUS.SUBMITTED`).
    - Icon `Pencil`: `Sửa phiếu` (hiển thị khi `canManage && (product.status === PRODUCT_STATUS.DRAFT || product.status === PRODUCT_STATUS.RETURNED)`).
  - Hộp thoại xác nhận duyệt hồ sơ (`Dialog`): cho phép nhập ghi chú tùy chọn (`maxLength={255}`), gọi `adminProductsApi.approve(product.id, reason || undefined)`, invalidate `queryKeys.adminProducts.all`, `queryKeys.admin.all`, `queryKeys.judge.all`, `queryKeys.myProducts.all`, `queryKeys.publicProducts.all`, và hiện thông báo `toast.success`.
