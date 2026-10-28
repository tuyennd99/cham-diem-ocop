# Kế hoạch sửa field-hint và MultiCombobox focus qua Label

## Goal
Tách `.field-hint` và `.field-optional` ra khỏi `<Label>` trong `FormField` (liên kết qua `aria-describedby`) và kích hoạt focus/mở `MultiCombobox` khi người dùng nhấn vào `<Label htmlFor>`.

## Tasks
- [x] Task 1: Mở rộng `FormField` (`apps/web/src/components/form-field.tsx`) thêm prop `hint?: ReactNode`, `hintId?: string`, `optional?: ReactNode`. `<Label>` chỉ chứa text label (và optional text trên cùng hàng), `hint` render thành `<p id={hintId} className='field-hint'>` nằm ngoài `<Label>` → Verify: Kiểm tra cấu trúc DOM của `FormField` không còn thẻ p/span hint bên trong `<Label>`.
- [x] Task 2: Cập nhật `LoginPage.tsx`, `RegisterPage.tsx` và `VerifyOtpPage.tsx` (`apps/web/src/pages/auth/`) chuyển toàn bộ hint/optional lồng trong `label` sang prop `hint` và `optional` của `FormField`; liên kết `Input` / `PasswordInput` tới `${id}-hint` qua `aria-describedby` → Verify: Chạy `Select-String -Path apps/web/src/pages/auth/*.tsx -Pattern 'field-hint'` xác nhận không còn `field-hint` nằm trong prop `label`.
- [x] Task 3: Bổ sung logic xử lý click trong `Label` (`apps/web/src/components/ui/label.tsx`) và hỗ trợ `disabled` trong `MultiCombobox` (`apps/web/src/components/multi-combobox.tsx`) để khi nhấn vào `Label` có `htmlFor` trỏ tới phần tử không phải native control (như `div[role='combobox']`), phần tử đó được `focus()` và `click()` mở danh sách chọn → Verify: Test click vào label trỏ tới `MultiCombobox` kích hoạt focus và mở popover combobox.
- [x] Task 4: Bọc `MultiCombobox` trong `AdminAssignmentsPage.tsx` (`apps/web/src/pages/admin/AdminAssignmentsPage.tsx`) bằng `FormField` có nhãn `Tiêu chí cụ thể` và truyền `id='assignment-specific-criteria'` → Verify: Kiểm tra mã nguồn `AdminAssignmentsPage.tsx` có `FormField` với `htmlFor='assignment-specific-criteria'` khớp `id` của `MultiCombobox`.
- [x] Task 5: Chạy kiểm tra TypeScript và build ứng dụng web với `pnpm --filter @ocop/web build` → Verify: Quá trình build hoàn tất thành công không có lỗi biên dịch.

## Done When
- [x] `<Label>` chỉ chứa tiêu đề nhãn, không còn chứa `.field-hint` hay control; mô tả được đặt ngoài `<Label>` và gắn kết bằng `aria-describedby`.
- [x] Nhấn vào `<Label>` của `MultiCombobox` tự động focus vào trigger và mở popover danh sách lựa chọn.
- [x] Lệnh `pnpm --filter @ocop/web build` hoàn thành không có lỗi.

## Notes
- `MultiCombobox` bắt buộc dùng `div[role='combobox']` thay vì `<button>` vì bên trong trigger có các nút `<Button>` xóa từng tag (chuẩn HTML cấm nút lồng trong nút).
- Trình duyệt chỉ kích hoạt native focus/click qua `htmlFor` đối với native form controls (`input`, `button`, `select`, `textarea`). Việc bổ sung xử lý click an toàn trong `Label` giải quyết triệt để cho mọi custom combobox mà không vi phạm chuẩn HTML.
