# H5 — Scoring Forms & 4 A4 Print Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh màn danh mục Nhóm/Phân loại/Địa bàn (`/admin/product-groups` còn thiếu từ H4-B3), phân hệ Phiếu chấm OCOP (`/admin/scoring-forms`: tra cứu 26 bộ phiếu và danh sách phiếu đã chấm) cùng 5 endpoint `print-data` và 4 biểu mẫu in A4 chuẩn (Mẫu phiếu trắng, Phiếu chấm sản phẩm, Bảng tổng hợp kết quả, Phiếu đăng ký Mẫu 01) trên worktree `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop`.

**Architecture:** Giữ nguyên mô hình dữ liệu H3/H4 (`CriteriaSet`, `Product.registrationSnapshot`, `Evaluation.submissionSnapshot`). Bổ sung các endpoint đọc bộ phiếu, danh sách phiếu chấm và dữ liệu in (`print-data`) kiểm quyền chặt tại `apps/be` (hỗ trợ cả `MANAGE`, `VIEW`, `SCORE` và `REGISTRANT` theo đúng ma trận mục 3.1 & 7.3 của Spec). Tại `apps/web`, hoàn thiện trang `/admin/product-groups`, tạo `/admin/scoring-forms` và 1 khung in A4 dùng chung (`@media print` trong `styles.css`, lặp `thead`, `break-inside: avoid` cho hàng tiêu chí) cho cả 4 loại biểu mẫu mà không đưa token vào URL hay phát sinh URL công khai cho tệp private.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS 11, Prisma 7, PostgreSQL, React 19, Vite 8, TanStack Router & Query, Tailwind CSS v4, Jest, `node:test`/`tsx`.

**Spec:** `docs/superpowers/specs/2026-10-17-admin-modules-spec.md` (mục 3, 5, 7, 8.3, 11–14) & `docs/superpowers/plans/2026-10-22-h4-catalogs.md` (Task B3).

## Global Constraints

- Làm việc trên worktree: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop`
- Không tạo 26 trang chấm/in độc lập hoặc copy công thức tính điểm vào FE; điểm cuối và mức sao lấy nguyên từ BE (`finalScore`, `starRating`).
- Không làm tròn điểm trước xếp sao: `89.99` vẫn hiển thị đúng giá trị dưới ngưỡng (không làm tròn thành `90.00`) bên cạnh mức `4 sao`.
- Kết quả `90–100` điểm (`starRating === 5`) phải hiển thị nhãn **"Mức điểm 5 sao / Đề nghị xem xét 5 sao"**, không in thành giấy chứng nhận đã công nhận.
- Phiếu chưa nộp (`IN_PROGRESS` hoặc `DRAFT`) khi in phải có nhãn **"BẢN NHÁP — CHƯA NỘP"** (hoặc **"BẢN NHÁP"** cho phiếu đăng ký); mẫu trắng có nhãn **"MẪU PHIẾU TRẮNG"**.
- Phần tiêu chí ngoài phạm vi phân công trên phiếu chấm cá nhân phải đánh dấu rõ **"Ngoài phạm vi phân công"**, không biến thành `0` điểm và không quy đổi tổng phạm vi một phần thành sao cuối cùng.
- Bản in lấy dữ liệu đã lưu / snapshot từ BE (`RegistrationSnapshotV1` và `Evaluation.submissionSnapshot` bao gồm cả định dạng `version: 1` mới và `schemaVersion: 1, provenance: 'PRE_UPGRADE'` từ migration `0011`); thay đổi tên người chấm, đơn vị hoặc danh mục về sau không làm đổi nội dung phiếu lịch sử đã nộp.
- Không đưa token vào URL in và không tạo URL static public cho tệp private; ảnh chọn in trên Phiếu đăng ký tải qua API có kiểm quyền bằng Blob/ObjectURL.
- Tuân thủ nghiêm `apps/web/test/api-boundary.check.mjs`: chỉ file trong `apps/web/src/api/*` được import `baseRequest` hoặc `API`.

## Review Focus

1. **Tương thích 2 định dạng `submissionSnapshot` của `Evaluation` (`version: 1` lúc submit mới vs `schemaVersion: 1, provenance: 'PRE_UPGRADE'` từ migration `0011`):** Bộ chuẩn hóa `print-data` ở BE phải đọc được cả 2 định dạng snapshot mà không crash và giữ cờ `historicalValuesVerified: false` khi là dữ liệu trước nâng cấp.
2. **Định dạng điểm số sát ngưỡng (`89.99` điểm, `4 sao`):** Hàm format điểm trên UI/bản in không được dùng `.toFixed(0)` hay làm tròn `89.995`/`89.99` lên `90` hoặc `90.00` gây mâu thuẫn với `4 sao`; cắt/hiển thị tối đa 2 chữ số thập phân hướng xuống (`Math.floor(score * 100) / 100`) hoặc giữ nguyên số thực BE trả.
3. **Quyền đọc bộ phiếu & dữ liệu in của tài khoản chỉ có `SCORE` hoặc `VIEW` hoặc `REGISTRANT`:**
   - `VIEW` chỉ đọc/in được phiếu chấm `SUBMITTED` và hồ sơ khác `DRAFT` (trả `404` nếu truy cập nháp).
   - `SCORE` đứng riêng chỉ đọc/in được `criteria-sets` thuộc phân công active của mình và phiếu chấm của chính mình (`/judge/products/:id/evaluation/print-data` hoặc `/admin/evaluations/:id/print-data` khi là tác giả).
   - Chủ thể (`REGISTRANT`) đọc được dữ liệu in Phiếu đăng ký Mẫu 01 và Bảng tổng hợp kết quả của hồ sơ thuộc sở hữu mình.
4. **Phiếu chấm một phần (`assignedCriterionIds` con của bộ tiêu chí):** Bản in hiển thị đầy đủ cấu trúc bộ phiếu, các tiêu chí ngoài phạm vi ghi rõ `"Ngoài phạm vi phân công"`, dòng tổng ghi `"Tổng điểm trong phạm vi phân công: X / Y điểm"` và tuyệt đối không hiển thị mức sao từ điểm tổng một phần.
5. **Chưa hoàn tất (`status !== 'COMPLETED'`) khi in Bảng tổng hợp kết quả:** Chỉ in bảng tiến độ các phiếu đã nộp và thông báo `"Hồ sơ chưa hoàn tất chấm điểm — chưa có kết quả cuối cùng"`, không tự suy diễn điểm cuối hay mức sao.

---

### Task 1: Đóng gói fix dọn file upload H4 & Bổ sung Shared Contracts cho H5 (`packages/shared`)

**Files:**
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\packages\shared\src\index.ts`

**Interfaces:**
- Produces:
  - `AdminCriteriaSetQuery`: `{ page?: number; limit?: number; q?: string; groupId?: string; isActive?: boolean }`
  - `AdminCriteriaSetRecord`: `{ id: string; categoryId: string; categoryName: string; groupId: string; groupCode: string; groupName: string; classificationGroup: string; classificationSubgroup: string | null; name: string | null; source: string | null; version: string; sourceHash: string | null; isActive: boolean; criterionCount: number; maxScore: number }`
  - `AdminCriteriaSetDetail`: `AdminCriteriaSetRecord & { criteria: CatalogCriterion[] }`
  - `AdminEvaluationQuery`: `{ page?: number; limit?: number; q?: string; productId?: string; groupId?: string; categoryId?: string; judgeId?: string; status?: 'IN_PROGRESS' | 'SUBMITTED' }`
  - `AdminEvaluationRecord`: `{ id: string; status: 'IN_PROGRESS' | 'SUBMITTED'; total: number | null; scopeMaxScore: number; assignedCriterionCount: number; totalCriterionCount: number; isPartialScope: boolean; submittedAt: string | null; updatedAt: string; product: { id: string; name: string; status: ProductStatus; categoryId: string; categoryName: string; groupId: string; groupName: string }; judge: { id: string; fullName: string; email: string; organizationUnitName: string | null } }`
  - `BlankCriteriaPrintData`: `{ kind: 'BLANK_CRITERIA'; generatedAt: string; criteriaSet: AdminCriteriaSetDetail }`
  - `EvaluationPrintCriterionRow`: `{ criterionId: string; code: string; name: string; sectionCode: string; sectionName: string; maxScore: number; inScope: boolean; subCriteria: Array<{ subCriterionId: string; code: string; content: string; maxPoints: number; selectedOptionId: string | null; selectedLabel: string | null; points: number | null; note: string | null; options: ScoreOption[] }> }`
  - `EvaluationPrintData`: `{ kind: 'EVALUATION'; generatedAt: string; evaluationId: string | null; status: 'IN_PROGRESS' | 'SUBMITTED'; isDraft: boolean; provenance: 'SNAPSHOT_V1' | 'PRE_UPGRADE' | 'LIVE_DRAFT'; submittedAt: string | null; product: { id: string; name: string; categoryName: string; groupName: string; entityName: string | null }; judge: { id: string; fullName: string; organizationUnitName: string | null }; criteriaSet: { id: string; name: string | null; source: string | null; version: string | null; sourceHash: string | null }; isPartialScope: boolean; total: number; scopeMaxScore: number; criteria: EvaluationPrintCriterionRow[] }`
  - `ProductResultsPrintData`: `{ kind: 'PRODUCT_RESULTS'; generatedAt: string; product: { id: string; name: string; status: ProductStatus; submittedAt: string | null; completedAt: string | null; entityName: string | null; localityName: string | null; provinceName: string | null; categoryName: string; groupName: string; finalScore: number | null; starRating: number | null; starLabel: string | null }; criteriaSet: { id: string; name: string | null; source: string | null; version: string } | null; evaluations: Array<{ id: string; judgeId: string; judgeName: string; organizationUnitName: string | null; status: 'IN_PROGRESS' | 'SUBMITTED'; submittedAt: string | null; isPartialScope: boolean; total: number | null; scopeMaxScore: number; criterionScores: Record<string, number | null> }>; criteriaSummary: Array<{ criterionId: string; code: string; name: string; maxScore: number; averageScore: number | null }> }`
  - `RegistrationPrintData`: `{ kind: 'REGISTRATION'; generatedAt: string; isDraft: boolean; hasSubmissionSnapshot: boolean; product: { id: string; name: string; description: string | null; status: ProductStatus; submittedAt: string | null; createdAt: string }; registrant: { id: string; fullName: string; email: string; phone: string | null }; category: { id: string; name: string; groupName: string; classificationGroup: string; classificationSubgroup: string | null }; locality: { id: string; code: string; name: string; type: LocalityType; provinceName: string } | null; formData: Partial<ProductApplicationForm>; attachments: ProductAttachment[] }`

- [ ] **Step 1: Commit working-tree upload cleanup fix from H4 PostgreSQL follow-up**
  - Run `git status` and commit the existing verified changes in `apps/be/src/utils/private-storage.ts`, `apps/be/test/*`, `docs/verification/2026-10-22-h4-admin-modules.md`.
- [ ] **Step 2: Add H5 scoring-forms and print-data interfaces to `packages/shared/src/index.ts`**
- [ ] **Step 3: Run typecheck on shared, api, and web**
  - Run: `pnpm --filter @ocop/api typecheck && pnpm --filter @ocop/web typecheck`
  - Expected: PASS

---

### Task 2: Backend API cho Bộ phiếu, Danh sách phiếu chấm & 5 Endpoint `print-data` (`apps/be`)

**Files:**
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\dtos\admin-scoring.dto.ts`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\utils\print-data.ts`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\utils\print-data.spec.ts`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\controllers\admin-scoring.controller.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\controllers\admin-products.controller.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\controllers\judge.controller.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\controllers\my-products.controller.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\controllers\index.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\services\admin.service.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\repositories\admin.repository.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\services\evaluations.service.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\repositories\evaluations.repository.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\services\products.service.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\src\repositories\products.repository.ts`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\test\admin-scoring-print.db-spec.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\be\test\openapi.db-spec.ts`

**Interfaces:**
- Endpoints produced:
  1. `GET /api/admin/criteria-sets` (`VIEW` hoặc `SCORE` hiệu lực; nếu chỉ có `SCORE` mà không có `VIEW`, chỉ trả các bộ thuộc phân công của user; hỗ trợ `page, limit, q, groupId, isActive`)
  2. `GET /api/admin/criteria-sets/:id` (`VIEW` hoặc `SCORE` được phân công; trả `AdminCriteriaSetDetail` gồm đầy đủ `criteria -> subCriteria -> options` theo `order ASC`)
  3. `GET /api/admin/criteria-sets/:id/print-data` (`VIEW` hoặc `SCORE` được phân công; trả `BlankCriteriaPrintData`)
  4. `GET /api/admin/evaluations` (`VIEW` hoặc `SCORE`; `MANAGE` thấy cả `IN_PROGRESS` & `SUBMITTED`, `VIEW` chỉ thấy `SUBMITTED`, `SCORE` đứng riêng chỉ thấy phiếu của chính mình; hỗ trợ lọc `q, productId, groupId, categoryId, judgeId, status, page, limit`)
  5. `GET /api/admin/evaluations/:id/print-data` (`MANAGE` đọc mọi phiếu; `VIEW` chỉ đọc phiếu `SUBMITTED`; `SCORE` đọc phiếu của chính mình; trả `EvaluationPrintData` ưu tiên đọc từ `submissionSnapshot` khi `status === 'SUBMITTED'`)
  6. `GET /api/judge/products/:id/evaluation/print-data` (`SCORE` được phân công trên sản phẩm `:id`; trả `EvaluationPrintData` cho phiếu nháp hoặc đã nộp của chính giám khảo)
  7. `GET /api/admin/products/:id/registration-print-data` (`MANAGE` đọc cả nháp & đã nộp; `VIEW` chỉ đọc hồ sơ khác `DRAFT`; trả `RegistrationPrintData` ưu tiên đọc từ `registrationSnapshot` khi đã nộp)
  8. `GET /api/admin/products/:id/results/print-data` (`MANAGE` hoặc `VIEW` cho hồ sơ khác `DRAFT`; trả `ProductResultsPrintData`, khi `status !== 'COMPLETED'` thì `finalScore: null, starRating: null, starLabel: null`)
  9. `GET /api/my/products/:id/registration-print-data` & `GET /api/my/products/:id/results/print-data` (`REGISTRANT` sở hữu hồ sơ `:id`; trả cùng cấu trúc `RegistrationPrintData` / `ProductResultsPrintData`)

- [ ] **Step 1: Viết unit test `apps/be/src/utils/print-data.spec.ts` (Red)**
  - Kiểm tra `formatStarPrintLabel(finalScore, starRating)`:
    - `finalScore = 89.99, starRating = 4` → giữ điểm hiển thị `"89.99"` và nhãn `"Mức điểm 4 sao"`.
    - `finalScore = 90, starRating = 5` → nhãn `"Mức điểm 5 sao / Đề nghị xem xét 5 sao"` (không có chữ "đã công nhận").
  - Kiểm tra `buildEvaluationPrintData` đọc đúng cả snapshot `version: 1` (từ `EvaluationsRepository.submit`) và `schemaVersion: 1, provenance: 'PRE_UPGRADE'` (từ migration `0011`), đánh dấu `inScope: false` cho tiêu chí ngoài `assignedCriterionIds` và tính đúng `scopeMaxScore`.
  - Kiểm tra `buildRegistrationPrintData` ưu tiên `registrationSnapshot` khi hồ sơ đã nộp (đổi tên chủ thể/địa bàn/danh mục hiện tại không làm đổi dữ liệu in).
- [ ] **Step 2: Chạy Jest xác nhận `print-data.spec.ts` fail, sau đó implement `apps/be/src/utils/print-data.ts` và chạy PASS**
- [ ] **Step 3: Implement DTOs, Repository, Service và Controller cho `admin-scoring`, `admin-products`, `judge`, `my-products`**
- [ ] **Step 4: Viết DB spec `apps/be/test/admin-scoring-print.db-spec.ts` và cập nhật `apps/be/test/openapi.db-spec.ts`**
  - Kiểm tra `FORM-01..02`, `PRINT-01..03`, `FILE-01` (phần `print-data` kiểm quyền 401/403/404 cho `MANAGE`, `VIEW`, `SCORE`, `REGISTRANT`).
  - Kiểm tra đổi tên đơn vị/người chấm/địa bàn/danh mục sau khi nộp không làm thay đổi output của `registration-print-data` và `evaluations/:id/print-data`.
- [ ] **Step 5: Chạy unit test, build, OpenAPI check, DB spec và commit**
  - Run:
    ```powershell
    pnpm --filter @ocop/api test --runInBand
    pnpm --filter @ocop/api build
    pnpm --filter @ocop/api typecheck
    pnpm --filter @ocop/api test:db --runTestsByPath test/openapi.db-spec.ts test/admin-scoring-print.db-spec.ts
    ```

---

### Task 3: Hoàn thiện Màn hình Nhóm sản phẩm & Địa bàn `/admin/product-groups` (H4-B3 bàn giao sang H5) + Nút In mẫu trắng

**Files:**
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\api\admin-catalogs.ts`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\queries\admin-catalogs.ts`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\pages\admin\AdminProductGroupsPage.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\pages\admin\CategoryEditorDialog.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\pages\admin\LocalitiesPanel.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\routes\_app.admin.product-groups.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\test\admin-catalogs.test.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\constants\api.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\constants\query-key.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\api\index.ts`

**Interfaces:**
- Produces:
  - `adminCatalogsApi`: `{ groups, createGroup, updateGroup, categories, category, createCategory, updateCategory, localities, createLocality, updateLocality }`
  - Route `/_app/admin/product-groups` (`beforeLoad: requirePermission('VIEW')`) với nút **In mẫu trắng** liên kết trực tiếp sang trang in của Task 4.

- [ ] **Step 1: Viết test `apps/web/test/admin-catalogs.test.ts` kiểm tra truyền tham số `isActive: false` và các route catalog**
- [ ] **Step 2: Implement `adminCatalogsApi`, `queries/admin-catalogs.ts`, `AdminProductGroupsPage.tsx`, `CategoryEditorDialog.tsx`, `LocalitiesPanel.tsx`, và route `_app.admin.product-groups.tsx`**
- [ ] **Step 3: Chạy Node test và kiểm tra `api-boundary.check.mjs`**
  - Run:
    ```powershell
    pnpm --filter @ocop/api exec node --import tsx --test ../web/test/admin-catalogs.test.ts
    pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
    ```

---

### Task 4: Màn hình Phiếu chấm OCOP (`/admin/scoring-forms`) & 4 Biểu mẫu In A4 (`apps/web`)

**Files:**
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\api\scoring-print.ts`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\queries\scoring-print.ts`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\lib\print-format.ts`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\components\print\OcopPrintSheets.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\pages\admin\AdminScoringFormsPage.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\pages\print\PrintPreviewPages.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\routes\_app.admin.scoring-forms.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\routes\_app.print.criteria-sets.$id.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\routes\_app.print.evaluations.$id.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\routes\_app.print.judge.products.$id.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\routes\_app.print.products.$id.registration.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\routes\_app.print.products.$id.results.tsx`
- Create: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\test\scoring-print.test.ts`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\layouts\AppLayout.tsx`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\pages\admin\AdminProductDetailPage.tsx`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\pages\admin\AdminProductResultsPage.tsx`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\pages\judge\JudgeEvaluationPage.tsx`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\pages\registrant\MyProductDetailPage.tsx`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\apps\web\src\styles.css`
- Modify: `C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop\docs\verification\2026-10-22-h4-admin-modules.md`

**Interfaces:**
- Produces:
  - `formatExactScore(score: number | null | undefined): string` (hiển thị chính xác `89.99` → `"89.99"`, không làm tròn thành `"90.00"`).
  - `formatStarRatingLabel(starRating: number | null | undefined): string` (`5` → `"Mức điểm 5 sao / Đề nghị xem xét 5 sao"`, `4` → `"Mức điểm 4 sao"`, `null` → `"Chưa xếp sao"`).
  - `/admin/scoring-forms`:
    - Tab **Bộ phiếu (26 mẫu)**: lọc theo từ khóa, nhóm sản phẩm, trạng thái; xem chi tiết cấu trúc `Phần → Tiêu chí → Tiểu tiêu chí → Lựa chọn điểm`; nút **In mẫu trắng** và liên kết sang `/admin/assignments`.
    - Tab **Phiếu đã chấm**: lọc theo từ khóa, sản phẩm, nhóm, người chấm, trạng thái; hiển thị người chấm, đơn vị tại thời điểm nộp, phạm vi phân công (`Toàn bộ` hoặc `X/Y tiêu chí`), trạng thái, ngày nộp, tổng điểm trong phạm vi (không gắn sao cuối cho phiếu một phần); nút **In phiếu chấm**.
  - 4 mẫu in A4 dùng chung CSS `@media print` (ẩn `.application-sidebar`, `.application-topbar`, `.no-print`; khổ `@page { size: A4 portrait; margin: 12mm; }`; bảng lặp `thead { display: table-header-group; }`; hàng tiêu chí `break-inside: avoid;`).

- [ ] **Step 1: Viết unit test `apps/web/test/scoring-print.test.ts` (Red)**
  - Kiểm tra `formatExactScore(89.99)` trả `"89.99"` và `formatStarRatingLabel(5)` trả `"Mức điểm 5 sao / Đề nghị xem xét 5 sao"`.
  - Kiểm tra `scoringPrintApi` gọi đúng các đường dẫn `/admin/criteria-sets`, `/admin/evaluations`, `*/print-data` qua `baseRequest` mà không gắn token lên query string.
- [ ] **Step 2: Implement `print-format.ts`, `scoring-print.ts`, `queries/scoring-print.ts`, `OcopPrintSheets.tsx`, `AdminScoringFormsPage.tsx`, `PrintPreviewPages.tsx` và các route**
- [ ] **Step 3: Gắn liên kết menu vào `AppLayout.tsx` (`Nhóm sản phẩm`, `Phiếu chấm OCOP`) và nút In vào `AdminProductDetailPage`, `AdminProductResultsPage`, `JudgeEvaluationPage`, `MyProductDetailPage`; bổ sung `@media print` vào `styles.css`**
- [ ] **Step 4: Chạy toàn bộ test, typecheck, build và commit**
  - Run:
    ```powershell
    pnpm --filter @ocop/api exec node --import tsx --test ../web/test/scoring-print.test.ts ../web/test/admin-catalogs.test.ts ../web/test/product-draft-save.test.ts ../web/test/session-contract.test.ts ../web/test/product-editor-categories.test.ts
    pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
    pnpm --filter @ocop/web exec node test/api-integration.check.mjs
    pnpm --filter @ocop/web exec node test/proxy.check.mjs
    pnpm --filter @ocop/web typecheck
    pnpm --filter @ocop/api typecheck
    pnpm --filter @ocop/web run build --configLoader native
    pnpm --filter @ocop/api build
    git diff --check
    ```
