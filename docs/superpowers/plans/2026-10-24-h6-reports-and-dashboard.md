# H6 — Statistical Reports & Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai Phân hệ 6 (Báo cáo thống kê `/admin/reports` với 2 báo cáo theo kỳ đăng ký và kỳ hoàn tất, múi giờ `Asia/Ho_Chi_Minh`, `dataQuality`, so sánh kỳ trước, in A4 ngang) và Phân hệ 7 (Nâng cấp `/admin` Analytics Dashboard với 8 KPI, 4 vùng biểu đồ, bảng đối chiếu kỳ trước, drill-down và giữ nguyên bảng Hồ sơ cần xử lý / Tiến độ giám khảo) trên `D:\project\chamdiemocop`.

**Architecture:** Tái sử dụng một bộ tính toán kỳ thời gian nửa kín `[from, toExclusive)` theo múi giờ `Asia/Ho_Chi_Minh` (`+07:00`) và phép tổng hợp BE dùng chung cho `/api/admin/reports/registrations`, `/api/admin/reports/results`, và `/api/admin/dashboard`. Mọi chỉ tiêu trong một request đọc trên cùng mốc chốt `asOf = min(toExclusive, generatedAt)` trong transaction `RepeatableRead`, xác định trạng thái tại `asOf` từ `ProductStatusEvent` (`createdAt < asOf`, `sequence DESC`), và công bố minh bạch `dataQuality` + `historyAvailableFrom` thay vì bịa số 0 cho kỳ lịch sử thiếu nhật ký.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS 11, Prisma 7, PostgreSQL, React 19, Vite 8, TanStack Router & Query, Tailwind CSS v4, Jest, `node:test`/`tsx`.

**Spec:** `docs/superpowers/specs/2026-10-17-admin-modules-spec.md` (mục 9, 10, 11–14: `REP-01..05`, `DASH-01..02`).

## Global Constraints

- Thư mục làm việc: `D:\project\chamdiemocop` (nhánh `main` sau khi gộp H3–H5).
- Múi giờ báo cáo cố định: `Asia/Ho_Chi_Minh` (`+07:00`). Kỳ chọn chuyển thành khoảng nửa kín `[from, toExclusive)`; một hồ sơ đúng `00:00:00+07:00` ngày đầu tháng sau thuộc tháng sau.
- Mốc chốt: `asOf = min(toExclusive, generatedAt)`. Trạng thái tại `asOf` đọc từ sự kiện `ProductStatusEvent` có `createdAt < asOf` theo `sequence` lớn nhất; nếu hồ sơ nộp trước khi có nhật ký trạng thái (`statusEvents` rỗng và `asOf < generatedAt`), xếp vào `missingStatusHistoryCount` thay vì suy từ trạng thái hiện tại.
- Đơn vị đếm: `COUNT(DISTINCT product.id)`; không nhân bản khi hồ sơ có nhiều `attachments` hoặc nhiều `evaluations`; `DRAFT` không tính vào số đã đăng ký.
- Ngưỡng đạt theo điểm: kết quả hoàn tất hợp lệ có `finalScore >= 50` (`starRating` 3, 4, 5) là đạt ngưỡng; `finalScore < 50` (`starRating` 1, 2) là chưa đạt; hồ sơ chưa chấm xong tách riêng (không tính vào chưa đạt).
- Nhãn mức 5 sao: hiển thị **"Mức điểm 5 sao"** (kèm chú thích đề nghị xem xét 5 sao theo điểm, không gọi là đã công nhận 5 sao).
- Không lấy trung bình các tỷ lệ phần trăm của từng xã/nhóm để tính tỷ lệ toàn tỉnh; tính lại từ tổng tử số và tổng mẫu số.
- Kỳ hiện tại chưa kết thúc (`generatedAt < toExclusive`): chỉ so sánh với phần thời gian tương ứng của kỳ trước (`isPartialPeriod: true`); mẫu số kỳ trước bằng `0` không tạo tỷ lệ tăng vô hạn (`deltaPercent: null`, hiển thị chênh lệch tuyệt đối và nhãn `"Mới phát sinh / Không có số kỳ trước"`).
- Tuân thủ nghiêm `apps/web/test/api-boundary.check.mjs`: chỉ file trong `apps/web/src/api/*` được import `baseRequest` hoặc `API`.

## Review Focus

1. **Ví dụ chuẩn `REP-02` trong Spec (mục 14, dòng 394):**
   - Hồ sơ A nộp `31/01` và hoàn tất `02/02` với `3 sao` (`finalScore = 60`);
   - Hồ sơ B nộp `10/01` và hoàn tất `20/01` với `2 sao` (`finalScore = 40`);
   - Hồ sơ C nộp `12/01`, đang chấm (`SCORING`) tại cuối tháng 1;
   - Hồ sơ D vẫn nháp (`DRAFT`).
   - Kết quả bắt buộc: Báo cáo Đăng ký tháng 1 có `3` hồ sơ (`0` chờ chấm hoặc `1` đang chấm tùy thời점 sự kiện SCORING của A/C trước `01/02T00:00:00+07:00`, `1` hoàn tất chưa đạt); Báo cáo Kết quả tháng 1 có `1` hoàn tất chưa đạt; Báo cáo Kết quả tháng 2 có `1` hoàn tất đạt (`3 sao`) dù tháng 2 không có hồ sơ nộp mới.
2. **Biên `00:00:00+07:00` và năm nhuận (`REP-04`):**
   - Sự kiện lúc `2026-02-01T00:00:00+07:00` (`2026-01-31T17:00:00.000Z`) thuộc tháng 2/2026, không thuộc kỳ tháng 1/2026 (`[2026-01-01T00:00:00+07:00, 2026-02-01T00:00:00+07:00)`).
   - Tháng 2 năm nhuận (`2024-02` → `29` ngày) và năm thường (`2026-02` → `28` ngày) tính đúng `toExclusive = 2024-03-01T00:00:00+07:00` / `2026-03-01T00:00:00+07:00`.
3. **Không nhân bản khi hồ sơ có nhiều ảnh và nhiều phiếu chấm (`REP-01`):**
   - Một sản phẩm có 3 ảnh và 2 giám khảo nộp phiếu chỉ được đếm `1` lần trong mọi dòng nhóm và tổng cuối bảng.
4. **Đối chiếu bất biến (`REP-05`):**
   - `completedValidCount === starCounts[1] + starCounts[2] + starCounts[3] + starCounts[4] + starCounts[5] === passedCount + failedCount`.
   - Trong báo cáo Đăng ký: `registeredCount === waitingCount + scoringCount + completedCount + missingStatusHistoryCount`.
   - Tổng các dòng khi nhóm theo `locality` hoặc `group` hoặc `category` hoặc `month` khớp chính xác với `totals` toàn hệ thống.
5. **KPI tồn tại mốc chốt (`KPI 7 & 8` trong `DASH-01`):**
   - KPI 7 (`openBacklogAtAsOf`) và KPI 8 (`underAssignedBacklogAtAsOf`) tính trên toàn bộ hồ sơ đã nộp trước `asOf` và chưa hoàn tất tại `asOf` (kể cả nộp trước kỳ đang chọn); khi xem kỳ quá khứ thiếu lịch sử phân công/trạng thái, KPI 8 đánh dấu `availability: 'INSUFFICIENT_HISTORY'` và UI hiển thị `"Chưa đủ dữ liệu"` thay vì hiện `0`.

---

### Task 1: Shared Contracts cho Báo cáo thống kê & Analytics Dashboard (`packages/shared`)

**Files:**
- Modify: `D:\project\chamdiemocop\packages\shared\src\index.ts`

**Interfaces:**
- Produces:
  - `ReportGroupBy`: `'month' | 'year' | 'locality' | 'group' | 'category'`
  - `AdminReportFilterQuery`: `{ year?: number; month?: number; localityType?: LocalityType; localityId?: string; groupId?: string; categoryId?: string; registrationType?: ProductRegistrationType; assessmentYear?: number }`
  - `AdminReportQuery`: `AdminReportFilterQuery & { groupBy?: ReportGroupBy }`
  - `ReportPeriodMetadata`: `{ timezone: 'Asia/Ho_Chi_Minh'; year: number; month: number | null; from: string; toExclusive: string; asOf: string; generatedAt: string; isPartialPeriod: boolean; previousPeriod: { label: string; from: string; toExclusive: string; comparisonToExclusive: string; asOf: string }; historyAvailableFrom: string | null }`
  - `ReportDataQuality`: `{ unmappedLocalityCount: number; missingSubmittedAtCount: number; missingCompletedAtCount: number; missingStatusHistoryCount: number; invalidResultCount: number; assignmentHistoryAvailable: boolean }`
  - `StarBreakdown`: `{ 1: number; 2: number; 3: number; 4: number; 5: number }`
  - `PeriodComparisonDelta`: `{ current: number | null; previous: number | null; deltaAbsolute: number | null; deltaPercent: number | null; comparisonNote: 'OK' | 'NO_PRIOR_DATA' | 'INSUFFICIENT_HISTORY' }`
  - `RegistrationReportRow`: `{ key: string; label: string; drillDown: Partial<AdminProductQuery>; registeredCount: number; waitingCount: number; scoringCount: number; completedCount: number; completedValidCount: number; passedCount: number; failedCount: number; passRate: number | null; averageScore: number | null; starCounts: StarBreakdown; distinctRegistrantCount: number; unmappedLocalityCount: number; missingDataCount: number }`
  - `RegistrationReportResponse`: `{ kind: 'REGISTRATIONS'; period: ReportPeriodMetadata; filtersApplied: AdminReportQuery; groupBy: ReportGroupBy; totals: RegistrationReportRow; previousTotals: RegistrationReportRow; comparison: Record<'registeredCount' | 'completedCount' | 'passedCount' | 'failedCount', PeriodComparisonDelta>; rows: RegistrationReportRow[]; dataQuality: ReportDataQuality }`
  - `ResultsReportRow`: `{ key: string; label: string; drillDown: Partial<AdminProductQuery>; completedCount: number; completedValidCount: number; passedCount: number; failedCount: number; passRate: number | null; averageScore: number | null; starCounts: StarBreakdown; distinctRegistrantCount: number; unmappedLocalityCount: number; invalidResultCount: number }`
  - `ResultsReportResponse`: `{ kind: 'RESULTS'; period: ReportPeriodMetadata; filtersApplied: AdminReportQuery; groupBy: ReportGroupBy; totals: ResultsReportRow; previousTotals: ResultsReportRow; comparison: Record<'completedCount' | 'passedCount' | 'failedCount' | 'star5Count', PeriodComparisonDelta>; rows: ResultsReportRow[]; dataQuality: ReportDataQuality }`
  - `DashboardKpiItem`: `{ id: 'registeredInPeriod' | 'completedInPeriod' | 'passedInPeriod' | 'failedInPeriod' | 'passRateInPeriod' | 'fiveStarInPeriod' | 'openBacklogAtAsOf' | 'underAssignedBacklogAtAsOf'; label: string; basisLabel: string; unit: 'COUNT' | 'PERCENT'; value: number | null; previousValue: number | null; deltaAbsolute: number | null; deltaPercent: number | null; availability: 'AVAILABLE' | 'NO_PRIOR_DATA' | 'INSUFFICIENT_HISTORY'; drillDown: Partial<AdminProductQuery> }`
  - `AdminAnalyticsDashboardResponse`: `{ period: ReportPeriodMetadata; filtersApplied: AdminReportFilterQuery; dataQuality: ReportDataQuality; kpis: DashboardKpiItem[]; charts: { monthlyTrend: Array<{ month: number; label: string; registeredCount: number; completedCount: number; from: string; toExclusive: string }>; byProductGroup: Array<{ groupId: string; groupCode: string; groupName: string; registeredCount: number; completedCount: number; categories: Array<{ categoryId: string; categoryName: string; registeredCount: number; completedCount: number }> }>; cohortProgress: { registeredCount: number; waitingCount: number; scoringCount: number; completedCount: number; missingStatusHistoryCount: number }; starDistribution: Array<{ stars: 1 | 2 | 3 | 4 | 5; label: string; count: number; percentage: number | null }> }; comparisonTable: DashboardKpiItem[]; productsByStatus: Record<ProductStatus, number>; judges: Array<{ judgeId: string; fullName: string; assigned: number; submitted: number; pending: number }>; needsAttention: Array<{ id: string; name: string; status: 'SUBMITTED' | 'SCORING'; submittedAt: string | null; category: { id: string; name: string; groupName: string }; assignedJudgeCount: number; submittedEvaluationCount: number; pendingEvaluationCount: number; missingCriteriaCount: number }> }`

- [ ] **Step 1: Add H6 report and analytics dashboard contracts to `packages/shared/src/index.ts`**
- [ ] **Step 2: Run typecheck on api and web**
  - Run: `pnpm --filter @ocop/api typecheck && pnpm --filter @ocop/web typecheck`
  - Expected: PASS

---

### Task 2: Engine Tổng hợp Báo cáo & Analytics Dashboard + API Endpoints (`apps/be`)

**Files:**
- Create: `D:\project\chamdiemocop\apps\be\src\utils\reporting.ts`
- Create: `D:\project\chamdiemocop\apps\be\src\utils\reporting.spec.ts`
- Create: `D:\project\chamdiemocop\apps\be\src\dtos\admin-reports.dto.ts`
- Create: `D:\project\chamdiemocop\apps\be\src\controllers\admin-reports.controller.ts`
- Modify: `D:\project\chamdiemocop\apps\be\src\controllers\admin.controller.ts`
- Modify: `D:\project\chamdiemocop\apps\be\src\controllers\index.ts`
- Modify: `D:\project\chamdiemocop\apps\be\src\services\admin.service.ts`
- Modify: `D:\project\chamdiemocop\apps\be\src\repositories\admin.repository.ts`
- Create: `D:\project\chamdiemocop\apps\be\test\admin-reports-dashboard.db-spec.ts`
- Modify: `D:\project\chamdiemocop\apps\be\test\openapi.db-spec.ts`

**Interfaces:**
- Endpoints produced:
  1. `GET /api/admin/reports/registrations` (`@Permissions(StaffPermission.VIEW)` — cho phép cả `MANAGE` và `VIEW`)
  2. `GET /api/admin/reports/results` (`@Permissions(StaffPermission.VIEW)`)
  3. `GET /api/admin/dashboard` (Mở rộng nhận `@Query() query: AdminDashboardQueryDto`, giữ nguyên `productsByStatus`, `judges`, `needsAttention` tương thích ngược và bổ sung đầy đủ `period`, `filtersApplied`, `dataQuality`, `kpis`, `charts`, `comparisonTable`).

- [ ] **Step 1: Viết unit test đỏ `apps/be/src/utils/reporting.spec.ts`**
  - Kiểm tra `resolveVietnamPeriod(year, month, now)`:
    - Biên `00:00:00+07:00` chuyển sang UTC chính xác (`2026-01-01T00:00:00+07:00` = `2025-12-31T17:00:00.000Z`).
    - Năm nhuận `2024-02` vs `2026-02` (`REP-04`).
    - Kỳ hiện tại chưa kết thúc (`now < toExclusive`) tính `comparisonToExclusive` của kỳ trước cùng độ dài elapsed (`isPartialPeriod = true`).
  - Kiểm tra ví dụ chuẩn `REP-02` (Hồ sơ A nộp 31/01 hoàn tất 02/02 3 sao; B nộp 10/01 hoàn tất 20/01 2 sao; C nộp 12/01 đang chấm; D nháp):
    - Tháng 1 Đăng ký: `registeredCount = 3`, `completedCount = 1`, `failedCount = 1`, `passedCount = 0`.
    - Tháng 1 Kết quả: `completedCount = 1`, `failedCount = 1`.
    - Tháng 2 Kết quả: `completedCount = 1`, `passedCount = 1`, `starCounts[3] = 1`.
  - Kiểm tra đối chiếu `REP-01`, `REP-03`, `REP-05` và `DASH-01` (KPI 8 trả `INSUFFICIENT_HISTORY` khi `asOf < generatedAt` và thiếu lịch sử phân công).
- [ ] **Step 2: Chạy Jest xác nhận `reporting.spec.ts` fail (Red), implement `apps/be/src/utils/reporting.ts` và chạy PASS (Green)**
- [ ] **Step 3: Implement `admin-reports.dto.ts`, `admin-reports.controller.ts`, mở rộng `AdminController.dashboard`, `AdminService`, `AdminRepository`**
- [ ] **Step 4: Viết DB spec `apps/be/test/admin-reports-dashboard.db-spec.ts` & cập nhật `apps/be/test/openapi.db-spec.ts`**
- [ ] **Step 5: Chạy unit test, build, typecheck, OpenAPI check, DB spec và commit**

---

### Task 3: Giao diện Báo cáo thống kê (`/admin/reports`, In A4 ngang) & Nâng cấp Analytics Dashboard (`/admin`) (`apps/web`)

**Files:**
- Modify: `D:\project\chamdiemocop\apps\web\src\constants\api.ts`
- Modify: `D:\project\chamdiemocop\apps\web\src\constants\query-key.ts`
- Modify: `D:\project\chamdiemocop\apps\web\src\types\admin.ts`
- Modify: `D:\project\chamdiemocop\apps\web\src\api\admin.ts`
- Modify: `D:\project\chamdiemocop\apps\web\src\queries\admin.ts`
- Create: `D:\project\chamdiemocop\apps\web\src\pages\admin\AdminReportsPage.tsx`
- Modify: `D:\project\chamdiemocop\apps\web\src\pages\admin\AdminDashboardPage.tsx`
- Modify: `D:\project\chamdiemocop\apps\web\src\pages\admin\AdminProductsPage.tsx`
- Create: `D:\project\chamdiemocop\apps\web\src\routes\_app.admin.reports.tsx`
- Modify: `D:\project\chamdiemocop\apps\web\src\layouts\AppLayout.tsx`
- Modify: `D:\project\chamdiemocop\apps\web\src\styles.css`
- Create: `D:\project\chamdiemocop\apps\web\test\admin-reports-dashboard.test.ts`
- Create: `D:\project\chamdiemocop\docs\verification\2026-10-24-h6-reports-and-dashboard.md`

**Interfaces:**
- Produces:
  - Route `/_app/admin/reports` (`beforeLoad: requirePermission('VIEW')`):
    - Bộ lọc chung: Năm, Tháng (Cả năm hoặc Tháng 1..12), Nhóm theo (`month | year | locality | group | category`), Loại địa bàn (`COMMUNE | WARD`), Địa bàn cụ thể, Nhóm sản phẩm, Phân loại, Loại đăng ký (`FIRST | UPGRADE | REASSESSMENT`), Năm đánh giá khai báo.
    - Chuyển đổi 2 báo cáo: **Đăng ký theo kỳ** (`submittedAt`) và **Kết quả chấm theo kỳ** (`completedAt`).
    - Bảng số liệu có dòng Tổng cuối bảng, thẻ So sánh kỳ trước, hộp cảnh báo `dataQuality` / `historyAvailableFrom`, nút **In báo cáo A4 ngang**, và bấm vào số liệu drill-down sang `/admin/products` mang theo bộ lọc.
  - Màn `/admin` (`AdminDashboardPage.tsx`):
    - Bộ lọc chung (Năm, Tháng, Loại địa bàn, Địa bàn, Nhóm, Phân loại, Loại đăng ký) + nút Tải lại.
    - Lưới **8 KPI** (2 hàng × 4 cột) đúng thứ tự Mục 10.2 của Spec, có nhãn căn cứ thời gian (`Trong kỳ` vs `Tại mốc chốt`), chênh lệch kỳ trước và link drill-down.
    - **4 vùng biểu đồ** (kèm bảng dữ liệu accessible cho bàn phím/screen reader):
      1. Xu hướng đăng ký và hoàn tất theo tháng (2 chuỗi độc lập).
      2. Hồ sơ theo nhóm sản phẩm (chuyển đổi Đăng ký / Hoàn tất, bấm nhóm mở xem phân loại).
      3. Tiến độ của hồ sơ đăng ký trong kỳ (thanh ngang cohort Chờ chấm / Đang chấm / Hoàn tất tại `asOf`).
      4. Cơ cấu mức sao theo điểm (1–5 sao của kết quả hoàn tất trong kỳ).
    - Bảng đối chiếu KPI với kỳ trước + giữ nguyên bảng **Tiến độ giám khảo** và **Hồ sơ cần xử lý tiếp** (sắp theo ngày nộp lâu nhất, báo rõ thiếu phân công / thiếu phiếu).

- [ ] **Step 1: Viết test đỏ `apps/web/test/admin-reports-dashboard.test.ts`**
- [ ] **Step 2: Implement API client, query hooks, `AdminReportsPage.tsx`, nâng cấp `AdminDashboardPage.tsx`, route `_app.admin.reports.tsx`, menu `AppLayout.tsx`, và CSS `@media print` A4 ngang**
- [ ] **Step 3: Chạy toàn bộ test web/API, typecheck, build và commit**
