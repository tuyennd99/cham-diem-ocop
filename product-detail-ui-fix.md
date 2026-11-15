# Sửa UI/UX trang chi tiết hồ sơ OCOP

## Goal
Đồng bộ chiều cao 36px cho toàn bộ button trong `[data-admin-ui='true']`, lập lại phân cấp màu CTA vs Tabs, và gọn phần đầu trang + bảng thông tin trên `/my/products/$id` (và màn admin dùng chung).

## Tasks
- [x] Task 1: Chuẩn hóa box-model nút trong `apps/web/src/components/ui/button.tsx` và `apps/web/src/styles.css` — thêm `border border-transparent` cho `primary`/`destructive`, khóa `height: var(--admin-control-height)` (`36px`) và `line-height: 1` cho `[data-admin-ui='true'] .button[data-size='default']` (cả `<a>` lẫn `<button>`), giữ `size='xs'` ở `24px`, căn giữa topbar + `Điều hướng`, và gắn `admin-dialog` + `data-admin-ui='true'` cho portal dialog còn thiếu (`MySettingsPage.tsx`, `confirm-dialog.tsx`). → Verify: nút trong `.admin-actions` và dialog đều khớp `36px` desktop / `44px` mobile.
- [x] Task 2: Bổ sung kiểu destructive nhẹ trong `apps/web/src/components/ui/button.tsx` (hoặc `variant='destructive-outline'`) với nền `--surface`, viền/chữ `--destructive`, giữ `destructive` nền đặc cho `confirm-dialog.tsx`. → Verify: nút `Xóa bản nháp` / `Trả lại hồ sơ` ở header không còn tô đỏ đặc chói, dialog xác nhận vẫn giữ nút đỏ đặc.
- [x] Task 3: Sửa phân cấp nút ở `apps/web/src/pages/admin/AdminProductDetailPage.tsx` (lines 533–664) — nâng `Nộp hồ sơ` / `Nộp thay` lên `variant='primary'`, hạ `Sửa bản nháp` / `Sửa phiếu` xuống `variant='secondary'`, `In phiếu đăng ký` dùng `outline`, `Xóa bản nháp` / `Trả lại hồ sơ` dùng kiểu destructive nhẹ. → Verify: ở trạng thái `Bản nháp`, chỉ duy nhất `Nộp hồ sơ` có nền xanh `--accent`.
- [ ] Task 4: Đổi `TabsList` và `TabsTrigger` trong `apps/web/src/components/ui/tabs.tsx` từ pill xanh đặc `bg-primary` sang underline tab (`border-b-2 border-primary text-fg`) hoặc pill nhạt `bg-accent-soft text-accent`. → Verify: kiểm tra 4 trang dùng `TabsList` (`AdminProductDetailPage`, `AdminReportsPage`, `AdminScoringFormsPage`, `AdminUsersPage`) không trùng màu nút CTA.
- [ ] Task 5: Gọn header ở `apps/web/src/pages/admin/AdminProductDetailPage.tsx` (lines 521–529) và `apps/web/src/styles.css` — nâng cỡ mã hồ sơ từ `text-xs` lên `text-sm`, bỏ lặp `Người đăng ký` và `Phân loại` ở `description` để giảm rớt hàng `.admin-actions` trên desktop. → Verify: xem `/my/products/$id` ở `1440px`, tiêu đề gọn, mã `OCOP-000011` rõ hơn.
- [ ] Task 6: Cân mật độ `.detail-facts` trong `apps/web/src/styles.css` (lines 1157–1178, 2118–2120) — giới hạn bề rộng vùng nội dung `.detail-facts` hoặc điều chỉnh cột trên màn rộng mà vẫn rớt 1 cột ở `<= 767px`. → Verify: tab `Thông tin` ở `1440px` và `390px` cân đối, không tràn ngang.
- [ ] Task 7: Chạy `pnpm --filter @ocop/web format:check`, `pnpm --filter @ocop/web typecheck`, `pnpm --filter @ocop/web build`, và kiểm tra UI thực tế trên desktop + mobile cho `/my/products/$id` (owner) và `/admin/products/$id` (admin). → Verify: mọi check xanh 0 lỗi và ảnh chụp xác nhận button đều chiều cao, phân cấp rõ.

## Done When
- [ ] Mọi nút trong `.admin-actions` (`<a>` và `<button>`) bằng nhau tuyệt đối (`36px`), không lệch viền.
- [ ] Chỉ có 1 CTA chính (`Nộp hồ sơ`), nút xóa dịu hơn, tab active không trùng màu CTA.
- [ ] Typecheck, build, format pass và UI desktop/mobile đạt kiểm tra trực quan.

## Notes
- Không đổi hành vi `button.tsx` ngoài `[data-admin-ui='true']` khi chưa kiểm tra trang công khai (`PublicLayout`).
- Sau khi sửa `tabs.tsx`, bắt buộc rà 3 trang admin còn lại dùng `TabsList` (`AdminReportsPage`, `AdminScoringFormsPage`, `AdminUsersPage`).
