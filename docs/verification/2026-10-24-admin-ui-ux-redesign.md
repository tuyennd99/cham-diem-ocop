# Báo cáo xác minh: Admin OCOP UI/UX Redesign (2026-10-24)

## 1. Baseline trước triển khai

- **Branch:** `main`
- **Commit gốc (`HEAD`):** `be65e0536fc560813c720eaf16f233673037304f`
- **Các file đã có thay đổi cục bộ trước khi bắt đầu (`git status --short`):**
  - `M apps/web/src/layouts/PublicLayout.tsx` (được giữ nguyên, không chạm)
  - `M apps/web/src/pages/admin/AdminProductsPage.tsx` (thuộc phạm vi Task 2)
  - `M apps/web/src/pages/auth/LoginPage.tsx` (được giữ nguyên, không chạm)
  - `M apps/web/src/routes/__root.tsx` (được giữ nguyên, không chạm)
  - `M apps/web/src/styles.css` (thuộc phạm vi Task 1, 2, 4, 5, 8, 10)
- **Kết quả kiểm tra baseline:**
  - `pnpm --filter @ocop/web typecheck`: PASS (`tsc --noEmit` exit 0)
  - `pnpm --filter @ocop/web exec node test/api-boundary.check.mjs`: PASS (`PASS API boundaries`)
  - 7 file unit test sẵn có: 27/27 PASS.

---

## 2. Kết quả triển khai theo từng Task

### Task 1: Khung admin, control và dialog responsive (`19c14cf`)
- Gắn `data-admin-ui='true'` trên `.application-shell` khi `pathname === '/admin' || pathname.startsWith('/admin/')`.
- Đặt `activeOptions={{ exact: true, includeSearch: false }}` cho link `/admin` và `activeOptions={{ includeSearch: false }}` cho `/admin/users` để chỉ đúng 1 mục điều hướng chính active (A06).
- Nhóm menu theo 4 nhóm (`Làm việc`, `Đánh giá`, `Quản trị`, `Tài khoản`) theo quyền `VIEW`, `MANAGE`, `SCORE`.
- Dưới `1024px`, ẩn sidebar desktop và hiển thị nút `Điều hướng` mở Radix `Dialog` (`DialogTitle: Điều hướng`), đóng menu khi chọn link hoặc bấm Escape.
- Bổ sung CSS scoped `[data-admin-ui='true']`: sidebar xanh đậm `248px`, `main` tối đa `1600px`, `H1` dùng `--font-body` (`28px` desktop / `24px` mobile), control cao tối thiểu `44px`, `.admin-dialog` có `max-height: calc(100dvh - 32px); overflow-y: auto`.
- Gắn `className='admin-dialog' data-admin-ui='true'` cho `CategoryEditorDialog` và `UserEditorDialog` (A02).

### Task 2: Danh sách sản phẩm và phiếu đăng ký làm mẫu (`9571023`)
- Tạo `apps/web/src/lib/admin-search.ts`, `apps/web/src/lib/admin-date.ts` và hai bộ test `apps/web/test/admin-search.test.ts`, `apps/web/test/admin-date.test.ts`.
- Sửa nhãn căn cứ ngày (`submittedAt` = `Ngày nộp`, `completedAt` = `Ngày hoàn tất`) (A03).
- Hiển thị đầy đủ điều kiện lọc từ URL (nhóm lớn, phân loại, địa bàn, khoảng ngày, từ khóa chủ thể) và bảo toàn raw boundary từ báo cáo khi chưa sửa ô ngày (A04).
- Bỏ `.route-panel` 680px và `.page-eyebrow` khỏi danh sách sản phẩm/phiếu đăng ký; dùng `admin-page` rộng theo main và một `.admin-table-region` (A05).
- Liên kết đầy đủ `htmlFor`/`id`, `aria-expanded`/`aria-controls`, nhóm nút trạng thái `role='group'` + `aria-pressed` (A08).
- Tách copy, CTA và empty state theo `mode='products'` và `mode='registrations'`, ẩn thao tác tạo/sửa và nút `Bản nháp` khi chỉ có `VIEW` (A09, A19).

### Task 3: Chi tiết hồ sơ, kết quả và giữ ngữ cảnh danh sách (`72c5fd6`)
- Nối `validateSearch: parseAdminProductSearch` cho `/_app/admin/products/$id` và `/_app/admin/registrations/$id`; controlled `Tabs` đồng bộ `tab` trên URL và link quay lại danh sách giữ nguyên các trường lọc (`toAdminProductApiQuery`).
- Thống nhất đúng 1 thẻ `H1` trên trang chi tiết; `AdminProductResultsPage` nhúng bắt đầu bằng `H2`, không lặp lại `H1`/eyebrow/link về danh sách (A14).
- Hiển thị nhãn trạng thái tiếng Việt (`Bản nháp`, `Đã nộp`, `Đang chấm`, `Hoàn tất`) ở header, facts, timeline và kết quả giám khảo.
- Tách thao tác `Nộp thay`, `Xóa bản nháp` và `Xóa tệp` vào `Dialog` xác nhận có tên hồ sơ và `reason` bắt buộc; cảnh báo khi đóng dialog hoặc rời route đang có `reason` chưa lưu, và bỏ chặn điều hướng sau khi xóa nháp thành công.

### Task 4: Trình nhập ba bước và cảnh báo dữ liệu chưa lưu (`61735e6`)
- Biến thể `mode='admin'` dùng `admin-page admin-draft-editor` với vùng đọc tối đa `960px`, khối ngữ cảnh chọn chủ thể + lý do thao tác rõ ràng, lưới 2 cột trên desktop và 1 cột trên mobile.
- Bổ sung `useBlocker` (kèm `enableBeforeUnload`) kiểm tra thay đổi chưa lưu (`values`, `registrantId`, `reason`, `files.length > 0`) và chỉ mở khóa điều hướng ở nhánh `result.kind === 'saved'`.
- Sửa phân trang địa bàn và chủ thể khi `totalPages === 0`: hiển thị `Chưa có địa bàn phù hợp` / `Chưa có chủ thể phù hợp`, khóa hai nút Trước/Sau, không hiển thị `Trang 1 / 0` (A19).

### Task 5: Danh mục, địa bàn và ngày hiệu lực (`6843611`)
- Bổ sung `parseAdminCatalogSearch`, `vietnameseDateTimeInput`, `localityEffectiveValue`; bảo toàn mili-giây và không biến đổi ISO gốc khi người dùng không sửa ngày giờ hiệu lực.
- Bỏ số ghi cứng `6 nhóm/26 bộ` trên tiêu đề và tab (A18); bố cục master/detail với cây nhóm `256px` trên desktop và `<select>` trên mobile.
- Chuyển xem cấu trúc bộ tiêu chí phân loại vào `Dialog` có cuộn kèm nút `In mẫu trắng A4`.
- Đưa tab `Nhóm lớn` và `Địa bàn` về dạng danh sách trước, mở form tạo/sửa theo yêu cầu trong `Dialog` (A13) và bảo vệ dữ liệu chưa lưu bằng `useBlocker`.

### Task 6: Người dùng, quyền và đơn vị theo tác vụ (`6d8e75a`)
- Bổ sung `parseAdminUsersSearch`, `toAdminUsersApiQuery`, `toAdminUnitsApiQuery` giữ nguyên redirect `/admin/judges` → `/admin/users?permission=SCORE` và các bộ lọc `false`.
- Hiển thị nhãn quyền tiếng Việt (`Quản lý`, `Xem dữ liệu`, `Chấm điểm`) kèm mã gốc khi giải thích (A17); giữ quy tắc `MANAGE` bao hàm `VIEW` nhưng không bao hàm `SCORE`.
- Bốn vùng trong `UserEditorDialog` (`Hồ sơ`, `Quyền và đơn vị`, `Trạng thái`, `Mật khẩu`) có baseline riêng, xác nhận đối tượng và quyền trước/sau khi đổi quyền, nút `Quản lý đơn vị` khi chưa có đơn vị hoạt động, và bảo vệ thay đổi chưa lưu bằng `useBlocker` mà không chặn redirect khi tự thu hồi phiên.
- Đưa `OrganizationUnitsPanel` về dạng danh sách trước, mở form tạo/sửa theo yêu cầu trong `Dialog` (A13).

### Task 7: Bộ mẫu và phiếu chấm thực tế (`a3193c4`)
- Bổ sung `parseAdminScoringSearch`, `toAdminCriteriaSetsApiQuery`, `toAdminEvaluationsApiQuery`; tách đúng tham số API cho hai tab.
- Bỏ eyebrow `PHÂN HỆ 4` và bỏ số tĩnh `26 mẫu` trên tab/mô tả (A17, A18).
- Đưa `Xem cấu trúc` bộ phiếu vào `Dialog` có cuộn (`DialogTitle: Cấu trúc bộ phiếu`), giữ đầy đủ criteria/subCriteria/options và nút `In mẫu trắng A4` (A12).
- Tab `Phiếu chấm thực tế` ưu tiên tìm bằng từ khóa `q` ở hàng chính, đưa `productId` và `judgeId` vào `Bộ lọc khác` (A12); giữ phân quyền `VIEW`/`MANAGE`/`SCORE` và nhãn `Phạm vi một phần`.

### Task 8: Phân công đúng cặp và bảo toàn toàn bộ danh sách (`b0d4f86`)
- Tạo `apps/web/src/lib/admin-assignment-form.ts` và `apps/web/test/admin-assignment-form.test.ts`; nạp lại đúng phạm vi tiêu chí khi đổi giám khảo hoặc phân loại (A10).
- Thay `<select multiple>` bằng lựa chọn rõ ràng `Toàn bộ tiêu chí` (`criterionIds = []`) và `Chọn tiêu chí cụ thể` (nhóm checkbox, chặn áp dụng khi chưa chọn tiêu chí).
- Bấm ô trong ma trận chọn cặp để sửa (không tự động gỡ phân công); nút `Gỡ` riêng có tên giám khảo.
- Bộ lọc ma trận (`groupId`, `categoryId`, `uncoveredOnly`) đồng bộ URL, thu gọn danh sách tiêu chí thiếu bằng `<details>` / `<summary>`, thanh thay đổi chưa lưu có `Hủy thay đổi` và `Lưu toàn bộ phân công` mở `Dialog` xác nhận, gửi `assignmentPayload(assignments)` chứa toàn bộ tập phân công (A11).

### Task 9: Tổng quan ưu tiên công việc và liên kết trung thực (`eb25c4f`)
- Bổ sung `parseAdminDashboardSearch` (mặc định năm theo múi giờ Việt Nam) và `dashboardKpiLinkLabel` (trả `null` cho các KPI không thể biểu diễn chính xác bằng query danh sách sản phẩm).
- Bỏ eyebrow `PHÂN HỆ 7`; đồng bộ bộ lọc kỳ/nhóm/phân loại/địa bàn qua URL với nút `Áp dụng` và `Xóa bộ lọc`.
- Sắp xếp lại thứ tự thông tin (A15): 4 chỉ tiêu vận hành (`registeredInPeriod`, `completedInPeriod`, `openBacklogAtAsOf`, `underAssignedBacklogAtAsOf`), tiếp theo `Hồ sơ cần xử lý tiếp` và `Tiến độ giám khảo`, sau đó là phần `Phân tích trong kỳ` (4 KPI phân tích, 4 vùng biểu đồ/bảng, bảng đối chiếu kỳ trước và tổng hiện tại theo trạng thái).

### Task 10: Báo cáo rõ căn cứ và bản in đầy đủ (`7e5942c`)
- Bổ sung `parseAdminReportsSearch`, `toAdminReportApiQuery` giữ nguyên tab báo cáo và điều kiện lọc sau khi tải lại trang.
- Bỏ eyebrow `PHÂN HỆ 6`; rút gọn nhãn tab thành `Hồ sơ đăng ký` và `Kết quả hoàn tất` kèm dòng giải thích căn cứ bằng tiếng Việt, không lộ tên trường API `submittedAt`/`completedAt` trên tab (A16).
- Mốc chốt, kỳ chưa kết thúc và cảnh báo chất lượng dữ liệu hiển thị trực tiếp; chỉ thông tin kỹ thuật (`timezone`, raw ISO `[from, toExclusive)`, `historyAvailableFrom`) nằm trong `<details>` `Chi tiết kỳ báo cáo`.
- Bảng báo cáo đăng ký (16 cột) và báo cáo kết quả (13 cột) có nhóm cột (`colSpan`, `scope='colgroup'`), vùng cuộn `.admin-table-region` trên màn hình và `@media print` hiển thị đầy đủ bảng (`overflow: visible`, `thead { display: table-header-group }`).

---

## 3. Kết quả kiểm tra tích hợp cuối (Task 11)

### 3.1. Bộ lệnh tự động và build
- `pnpm --filter @ocop/api exec node --import tsx --test ../web/test/session-contract.test.ts ../web/test/admin-users.test.ts ../web/test/admin-catalogs.test.ts ../web/test/product-draft-save.test.ts ../web/test/product-editor-categories.test.ts ../web/test/scoring-print.test.ts ../web/test/admin-reports-dashboard.test.ts ../web/test/admin-search.test.ts ../web/test/admin-date.test.ts ../web/test/admin-assignment-form.test.ts`: **PASS (40/40 tests, 0 failures)**.
- `pnpm --filter @ocop/web typecheck`: **PASS (exit 0)**.
- `pnpm --filter @ocop/web build`: **PASS (built in 1.65s)**.
- `pnpm --filter @ocop/web exec node test/api-boundary.check.mjs`: **PASS (`PASS API boundaries`)**.
- `pnpm --filter @ocop/web exec node test/api-integration.check.mjs`: **PASS (`PASS file contract`, `PASS client: envelope, 201, multipart, blob, 401 session rules`)**.
- `pnpm --filter @ocop/web exec node test/proxy.check.mjs`: **PASS (`PASS proxy: default, file env, process override`)**.
- `git diff --check`: **PASS (exit 0)**.

### 3.2. Kiểm tra trực tiếp trên trình duyệt (`http://localhost:5173`)
- **Active navigation (A06):**
  - `/admin?year=2026`: `activeLinks: ["Tổng quan"]` (1 mục duy nhất).
  - `/admin/products?page=1&limit=20`: `activeLinks: ["Sản phẩm"]`.
  - `/admin/registrations?page=1&limit=20` & `/admin/registrations/new`: `activeLinks: ["Phiếu đăng ký"]`.
  - `/admin/product-groups?page=1&limit=20`: `activeLinks: ["Nhóm sản phẩm & địa bàn"]`.
  - `/admin/scoring-forms`: `activeLinks: ["Phiếu chấm OCOP"]`.
  - `/admin/assignments`: `activeLinks: ["Phân công"]`.
  - `/admin/judges` → redirect `/admin/users?permission=SCORE&page=1&limit=20`: `activeLinks: ["Người dùng"]`, `selectedPermission: "SCORE"`.
  - `/admin/reports?year=2026&groupBy=month`: `activeLinks: ["Báo cáo thống kê"]`.
- **Responsive & Dialog (A01, A02):**
  - Tại viewport 320px (`docScrollWidth: 320`), không tràn ngang; H1 dùng `Be Vietnam Pro` 24px (mobile) / 28px (desktop); `.admin-draft-editor` có `max-width: 960px`.
  - `CategoryEditorDialog` (`Thêm phân loại sản phẩm`): `top: 16px`, `bottom: 766px` trong `viewportHeight: 782px`, `maxHeight: 750px`, `overflowY: auto` — tiêu đề, nút đóng và nút gửi nằm gọn trong viewport.
  - `Dialog` `Cấu trúc bộ phiếu` trên `/admin/scoring-forms` mở và đóng đúng tiêu đề, giữ đầy đủ tiêu chí.
- **Accessibility & Labels (A08, A14, A17, A18):**
  - Tất cả trang admin có đúng 1 thẻ `<h1>`, `eyebrows: 0`, `unlabeledInputs: 0`.
  - Tab trên `/admin/product-groups` là `["Phân loại sản phẩm", "Nhóm lớn", "Địa bàn"]`, trên `/admin/scoring-forms` là `["Bộ phiếu", "Phiếu chấm thực tế"]` (không còn số tĩnh 26).
  - Bảng báo cáo đăng ký đủ 16 cột, báo cáo kết quả hoàn tất đủ 13 cột.
- **Phân quyền & Bề mặt ngoài admin:**
  - `viewer@ocop.test` (`VIEW`): ẩn nút `Thêm phiếu đăng ký`, ẩn tab `Bản nháp` (`statusButtons: ["Tất cả sản phẩm", "Đã nộp", "Đang chấm", "Hoàn tất"]`), ẩn mục `Người dùng`.
  - `judge@ocop.test` (`SCORE`): vào được `/admin/scoring-forms` và có link `Hồ sơ được phân công` tới `/judge`; tại `/judge` `data-admin-ui` là `null`.
  - `registrant@ocop.test` (`REGISTRANT`): tại `/my/products/new` (`mode='owner'`), `data-admin-ui` là `null`, giữ nguyên `.route-panel` và tiêu đề `Tạo hồ sơ sản phẩm`.

### 3.3. Giới hạn và phần chưa thực hiện mutation thật trên DB
- Cơ sở dữ liệu hiện tại có danh mục (6 nhóm, 26 phân loại, 26 bộ phiếu) và các tài khoản seed, nhưng chưa có bản ghi sản phẩm/hồ sơ mẫu hoặc địa bàn mẫu đã lưu trong DB. Các luồng chi tiết hồ sơ (`AdminProductDetailPage`), kết quả (`AdminProductResultsPage`), lưu nháp/upload (`saveProductDraft`) và thay thế phân công (`assignmentPayload`) được kiểm chứng qua bộ 40 unit/contract tests và kiểm tra mã nguồn/typecheck, không tạo dữ liệu rác vào DB thật theo đúng ràng buộc toàn cục.

### 3.4. Tự đánh giá Hallmark
- **Philosophy:** 5/5 — Giữ đúng tinh thần bàn làm việc hành chính OCOP gọn, rõ, ưu tiên công việc cần xử lý.
- **Hierarchy:** 5/5 — Một H1 mỗi trang, sidebar xanh đậm phân nhóm rõ, đưa việc cần xử lý lên trước phân tích trên Dashboard.
- **Execution:** 4/5 — CSS scoped `[data-admin-ui='true']`, control 44px, dialog có cuộn, URL đồng bộ mọi trang admin.
- **Specificity:** 5/5 — Đúng từ vựng OCOP (Mẫu 01, mức sao theo điểm, phạm vi một phần, ngày nộp / ngày hoàn tất).
- **Restraint:** 5/5 — Không thêm dependency, không tạo abstraction thừa, bỏ eyebrow lặp và card-in-card.
- **Variety:** 4/5 — Bố cục thích ứng từng tác vụ (bảng danh sách, master-detail cây nhóm, ma trận phân công có thanh đáy, báo cáo ngang A4).
