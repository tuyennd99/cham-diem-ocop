# Unified Workspace Layout & Shared Product UI Plan

## Goal
Đồng bộ giao diện khu vực đăng nhập (`_app`: Admin, User/Registrant, Judge, Account) dùng chung một Workspace Shell (`data-admin-ui="true"`), tách các component Layout tái sử dụng và hợp nhất giao diện Hồ sơ sản phẩm (Tạo/Sửa, Danh sách, Chi tiết) giữa Admin và User theo phân quyền (`mode: 'owner' | 'admin'`).

## Tasks

- [x] **Task 1: Tách Shell Layout components (`apps/web/src/layouts/workspace/`)**
  - Tạo `WorkspaceNav.tsx` (chứa `AdminNavTooltip` + menu phân nhóm theo `role` / `staffPermissions`, bọc `React.memo`).
  - Tạo `WorkspaceSidebar.tsx` (quản lý collapse + `localStorage['admin_sidebar_collapsed']`) và `WorkspaceTopbar.tsx` (cô lập state `mobileMenuOpen` + mobile `Dialog` nav để tránh re-render `<Outlet />`).
  - Cập nhật `apps/web/src/layouts/AppLayout.tsx` lắp ghép `WorkspaceSidebar` + `WorkspaceTopbar`, luôn bật `data-admin-ui="true"` cho toàn bộ route thuộc `_app` (xóa nhánh `isAdmin` và `defaultNavContent` cũ).
  - → **Verify:** `pnpm --filter @ocop/web typecheck` pass; vào `/my/products/new` và `/admin/products` thấy cùng Sidebar tối có icon và Topbar đồng nhất.

- [x] **Task 2: Tạo Page-level Layout components tái sử dụng (`apps/web/src/layouts/PageLayout.tsx`)**
  - Tạo `PageContainer` (`.admin-page`), `PageHeader` (`.admin-page-heading` hỗ trợ `backLink`, `title`, `badge`, `description`, `actions`), `FilterPanel` (`.admin-form.filter-card`), và `PageSection` (`.admin-table-region`).
  - Export tập trung qua `apps/web/src/layouts/index.ts`.
  - → **Verify:** `pnpm --filter @ocop/web typecheck` pass.

- [x] **Task 3: Hợp nhất giao diện Tạo/Sửa hồ sơ (`apps/web/src/components/products/ProductDraftEditor.tsx`)**
  - Dùng chung `PageContainer` (`className="admin-draft-editor"`), `PageHeader` (có link `← Quay lại...` cho cả `owner` và `admin`), `FilterPanel` (`.admin-form.filter-card`), và lưới 2 cột `.admin-step-grid` / `.admin-step-span-2` cho cả `mode="owner"` và `mode="admin"`.
  - Bật `useBlocker` cảnh báo rời trang khi `dirty` cho cả `mode="owner"` và `mode="admin"`.
  - Chỉ hiển thị card *"Ngữ cảnh thao tác quản trị"* (chọn người đăng ký + lý do thao tác) khi `mode === 'admin'`.
  - → **Verify:** Mở `/my/products/new` và `/admin/registrations/new` hiển thị cùng bố cục card + form 2 cột + thanh bước đăng ký.

- [x] **Task 4: Hợp nhất giao diện Danh sách hồ sơ (`ProductListView` cho Admin & User)**
  - Chuẩn hóa logic hiển thị bảng sản phẩm tại `apps/web/src/pages/admin/AdminProductsPage.tsx` (hoặc component chung `apps/web/src/components/products/ProductListView.tsx`) hỗ trợ `mode: 'products' | 'registrations' | 'owner'` và dùng `PageContainer`, `PageHeader`, `FilterPanel`.
  - Khi `mode === 'owner'` (`apps/web/src/pages/registrant/MyProductsPage.tsx`): dùng chung `status-tabs`, thanh lọc từ khóa/danh mục/năm/loại đăng ký (lọc + phân trang client-side bằng `useMemo` trên `useMyProducts()`), hiển thị `DataTable` ẩn cột *"Người đăng ký"*, kèm nút thao tác `Mở hồ sơ`, `Sửa bản nháp`, `Nộp hồ sơ`, `Xóa` (với `ConfirmDialog`).
  - → **Verify:** Mở `/my/products` và `/admin/registrations` thấy cùng bố cục `StatusTabs` + `FilterPanel` + `DataTable`.

- [x] **Task 5: Hợp nhất giao diện Chi tiết hồ sơ (`ProductDetailView` cho Admin & User)**
  - Chuẩn hóa giao diện chi tiết có `Tabs` (`information`, `registration`, `files`, `progress`, `results`) dùng chung `PageContainer`, `PageHeader`, `PageSection`.
  - Khi `mode === 'owner'` (`apps/web/src/pages/registrant/MyProductDetailPage.tsx`): ẩn các trường/tab chỉ dành cho nội bộ (`Người tạo hồ sơ`, lịch sử sự kiện nội bộ nếu không có trong `RegistrantProduct`), hiển thị kết quả tổng hợp ở tab `Kết quả`, và dùng `ConfirmDialog` khi `Nộp hồ sơ` / `Xóa tệp` (không bắt nhập lý do quản trị).
  - → **Verify:** Mở `/my/products/$id` và `/admin/registrations/$id` thấy cùng cấu trúc Header + Badges + Tabs + `detail-facts`.

- [x] **Task 6: Áp dụng `PageContainer` & `PageHeader` cho trang Tài khoản và Giám khảo**
  - Cập nhật `AccountPage.tsx`, `ChangePasswordPage.tsx`, `JudgeQueuePage.tsx` sử dụng `PageContainer`, `PageHeader`, `PageSection` để đồng bộ hoàn toàn trong `_app`.
  - → **Verify:** Mở `/account`, `/account/password`, `/judge` không còn lệch font/margin với `/admin/*`.

- [x] **Task 7: Kiểm tra tổng thể (Verification)**
  - Chạy `pnpm --filter @ocop/web format:check`, `pnpm --filter @ocop/web typecheck`, `pnpm --filter @ocop/web build`.
  - Chạy toàn bộ test: `node apps/web/test/router.check.mjs`, `node apps/web/test/api-boundary.check.mjs`, `node apps/web/test/api-integration.check.mjs`, `node apps/web/test/print-layout.check.cjs`, và `pnpm --filter @ocop/web test`.
  - → **Verify:** Tất cả các lệnh đều exit `0`.

## Done When
- [x] Admin (`/admin/*`) và User (`/my/*`, `/account/*`, `/judge/*`) dùng chung 1 Workspace Shell (`WorkspaceSidebar`, `WorkspaceTopbar`) và bộ `PageContainer` / `PageHeader` / `PageSection` / `FilterPanel`.
- [x] Trang Tạo/Sửa (`/my/products/new`), Danh sách (`/my/products`), Chi tiết (`/my/products/$id`) của User có giao diện đồng nhất với Admin, chỉ khác các cột/trường và hộp thoại xác nhận theo quyền (`mode='owner'` vs `mode='admin'`).
- [x] Tối ưu re-render theo `/react-component-performance` (đóng/mở menu hoặc thu gọn sidebar không re-render nội dung trang; memo hóa columns và danh sách lọc).
- [x] Toàn bộ typecheck, build, và test suite của `@ocop/web` pass 100%.

## Notes
- Giữ nguyên toàn bộ URL routes trong `apps/web/src/routes/` và `routeTree.gen.ts` để không phá vỡ `router.check.mjs`.
- Ở `mode='owner'`, `PrivateAttachmentThumbnail` và `AttachmentLink` truyền `mode="owner"` để gọi đúng endpoint `/api/my/products/:id/attachments/:attachmentId`.
