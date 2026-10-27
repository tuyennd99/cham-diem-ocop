# Báo cáo xác minh: Admin Density and Sidebar Fix (2026-10-25)

## 1. Bối cảnh và mục tiêu

- **Kế hoạch:** `docs/superpowers/plans/2026-10-25-admin-density-and-sidebar-fix.md`
- **Đặc tả:** `docs/superpowers/specs/2026-10-25-admin-density-review.md`, `design.md` (mục 4 và 6)
- **Branch:** `main` (`HEAD` gốc: `c990c05d5807e4cd9ff00d1f9ba9c482918df975`)

---

## 2. Bảng đối chiếu số đo thực tế trước → sau theo từng trang & viewport

| Trang / trạng thái | Viewport | Control trước → sau | Width trước → sau | Panel / sidebar | Kết quả / bằng chứng |
| --- | --- | --- | --- | --- | --- |
| `/admin?year=2026` (Tổng quan — sidebar mở) | `1440px` / `2560px` | Input/Select/Button `44px` → `36px`; Toggle `32×44` → `32×32` | Năm `351px`/`719px` → `112px`; Tháng `351px`/`719px` → `144px`; Nhóm `351px`/`719px` → `260px` | Panel lọc `162px`/`178px` (2 lớp padding) → `88px` (1 lớp, `innerPadding: 0px`); Sidebar `248px` | PASS (`pass: true, failures: []`) |
| `/admin?year=2026` (Tổng quan — sidebar thu gọn) | `1440px` | Control `36px`; Toggle `32×32` | Năm `112px`; Tháng `144px`; Nhóm `260px` | Sidebar `72px`; `aria-expanded="false"`, `aria-controls="admin-desktop-navigation"` | PASS (`pass: true, failures: []`) |
| `/admin/products` & `/admin/registrations` | `1440px` | Input/Select/Button `44px` → `36px`; Tab trạng thái `36px` | Tìm kiếm `q`: `320px`; Nhóm lớn: `260px`; Phân loại: `260px` | 1 panel lọc (`.admin-filter-panel`), nút hành động chung hàng | PASS (`present: true`, đúng `role` & `width`) |
| `/admin/registrations/new` (Trình nhập 3 bước) | `2560px` | Input tìm chủ thể `101px` → `36px`; Label `189px` → `62px`; Select `36px`; Textarea `96px` | Editor `2233px` → `960px` (`max-width: 960px; justify-self: start`) | `.admin-step-grid` `align-items: start`, không kéo giãn input khi cột cạnh có lỗi/phân trang | PASS (`editorWidth: 960, regSearchHeight: 36`) |
| `/admin/scoring-forms` (Tab Bộ phiếu & Phiếu thực tế) | `1440px` | Input/Select/Button `44px` → `36px`; TabsTrigger `38px` → `36px` | Tìm kiếm `q`: `320px`; Nhóm: `260px`; Trạng thái: `176px` | 1 panel lọc, giữ nguyên bộ lọc nâng cao (`productId`, `judgeId`) | PASS (`present: true`, đúng `role` & `width`) |
| `/admin/users` & `?tab=units` | `1440px` | Input/Select/Button `44px` → `36px`; TabsTrigger `36px` | Tìm kiếm `q`: `320px`; Loại/Trạng thái: `176px` | 1 panel lọc ở tab Người dùng; standalone `.admin-filters` ở tab Đơn vị; Dialog form `margin-top: 0` | PASS (`present: true`, đúng `role` & `width`) |
| `/admin/reports` (Báo cáo thống kê) | `1440px` | Input/Select/Button `44px` → `36px`; TabsTrigger `36px` | Năm: `112px`; Tháng: `144px`; Nhóm dòng (`groupBy`): `260px` | 1 panel lọc (`.no-print`), giữ nguyên 16/13 cột và `@media print` | PASS (`present: true`, đúng `role` & `width`) |
| `/admin/product-groups` & `?tab=localities` | `1440px` | Input/Select/Button `44px` → `36px` | Danh mục `q`: `320px`, Trạng thái: `176px`; Địa bàn `q`: `320px`, Loại/Trạng thái: `176px` | Cây nhóm `256px` bên trái, standalone `.admin-filters` bên phải | PASS (`present: true`, đúng `role` & `width`) |
| `/admin/assignments` (Phân công) | `1440px` | Select/Button `36px` | Nhóm lớn & Phân loại: `data-filter-width="group"` (`260px`) | `.assignment-editor` padding `16px`, `.admin-assignment-sticky-bar` padding `12px 16px` | PASS (giữ nguyên scope/checkbox/replace) |
| Sidebar thu gọn chuyển sang Tablet `768px` | `768px` | Nút `Điều hướng` hiện, sidebar desktop ẩn | `mainWidth`: trước sửa bị bó `72px` (`72px 681px`) → sau sửa `768px` (`100%`, `mainLeft: 0`) | Drawer mở/đóng bình thường, hiển thị đầy đủ nhãn (`drawerLinkSpanDisplay: "block"`) | PASS (`clientWidth: 768, mainWidth: 768`) |
| Mobile / Touch (`pointer: coarse`) | `375px` & `320px` | Control tự động nâng lên `44px`, font nhập `16px` | Các trường lọc `flex-basis: 100%` (1 cột), không tràn ngang (`overflow: false`) | Padding nội dung `16px`, bảng cuộn cục bộ trong `.admin-table-region` | PASS (`yearHeight: 44, overflow: false`) |
| Chi tiết hồ sơ & Kết quả chấm (`/admin/products/$id`) | — | Chưa kiểm tra trực tiếp bằng dữ liệu thật trên trình duyệt — DB local hiện không có bản ghi sản phẩm đã nộp và không tạo bản ghi giả theo ràng buộc toàn cục | — | Đã kiểm chứng qua unit test (`scoring-print.test.ts`, `admin-search.test.ts`) và `typecheck`/`build` | Chưa kiểm tra trình duyệt có dữ liệu — DB không có hồ sơ mẫu |

---

## 3. Kiểm tra tương tác Sidebar & Khả năng tiếp cận (Task 5)

- **Toggle & Persistence (`1440px`):**
  - Mở rộng `248px` (`aria-expanded="true"`, `aria-controls="admin-desktop-navigation"`) → Bấm thu gọn `72px` (`aria-expanded="false"`, `localStorage.getItem("admin_sidebar_collapsed") === "true"`).
  - Giá trị đang gõ trong ô tìm kiếm (`draftPreserved: true`) và query trên URL (`urlPreserved: true`) được giữ nguyên khi đóng/mở sidebar.
- **Accessible Name & Keyboard Tooltip:**
  - Khi thu gọn, nhãn `<span>` dùng kỹ thuật visually-hidden (`clip-path: inset(50%)`, `spanDisplay: "block"`), giữ nguyên accessible name (`accessibleText: "Tổng quan"`).
  - Nhấn phím `Tab` vào liên kết điều hướng khi thu gọn hiển thị Radix Tooltip (`tooltipText: "Tổng quan"`) qua `Tooltip.Portal` (`.admin-nav-tooltip`), không bị cắt bởi `overflow` của sidebar.

---

## 4. Kết quả chạy lệnh kiểm tra (Task 6 Step 1)

- `pnpm --filter @ocop/web typecheck`: **PASS (exit 0)**
- `pnpm --filter @ocop/web build`: **PASS (exit 0, built in 840ms)**
- `pnpm --filter @ocop/api exec node --import tsx --test ../web/test/session-contract.test.ts ../web/test/admin-users.test.ts ../web/test/admin-catalogs.test.ts ../web/test/product-draft-save.test.ts ../web/test/product-editor-categories.test.ts ../web/test/scoring-print.test.ts ../web/test/admin-reports-dashboard.test.ts ../web/test/admin-search.test.ts ../web/test/admin-date.test.ts ../web/test/admin-assignment-form.test.ts`: **PASS (40/40 tests, 0 failures, exit 0)**
- `git diff --check`: **PASS (exit 0)**

---

## 5. Phạm vi và giới hạn bảo toàn

- Không thay đổi API, quyền, query key, payload, logic lưu nháp hay bản in.
- Giữ nguyên các thay đổi chưa commit có trước của người dùng tại `PublicLayout.tsx`, `LoginPage.tsx`, `routes/__root.tsx`.
