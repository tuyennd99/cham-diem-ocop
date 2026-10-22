# Kế hoạch tách nhỏ các file `*Pages.tsx` thành từng file riêng

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách 5 file gom nhóm trong `apps/web/src/pages/` (`AuthPages.tsx`, `RegistrantPages.tsx`, `JudgePages.tsx`, `AdminPages.tsx`, `PublicPages.tsx`, `RoutePages.tsx`) thành cấu trúc mỗi màn hình một file theo phân hệ nghiệp vụ, sẵn sàng mở rộng 7 phân hệ quản trị trong [2026-10-17-admin-modules-spec.md](../specs/2026-10-17-admin-modules-spec.md) mà không đổi URL hay hành vi hiện có.

**Architecture:** Giữ nguyên cấu trúc file-based routing trong `apps/web/src/routes/` (không đổi đường dẫn URL, không sửa tay `routeTree.gen.ts`). Tổ chức `apps/web/src/pages/` theo thư mục nghiệp vụ (`public/`, `auth/`, `account/`, `registrant/`, `judge/`, `admin/`, `errors/`), mỗi page một file và chỉ giữ các helper/component dùng chung giữa nhiều page ở file riêng cùng thư mục hoặc `src/components/`.

## 1. Nguyên tắc tách file

1. **Một màn hình (page component) = một file `.tsx`** đặt tên PascalCase khớp tên component export (`LoginPage.tsx` export `function LoginPage()`).
2. **Không đổi route tree:** các file trong `apps/web/src/routes/*.tsx` chỉ cập nhật đường dẫn `import`, giữ nguyên `createFileRoute(...)`, `beforeLoad`, `useParams`.
3. **Helper/component dùng chung giữa >= 2 page trong cùng phân hệ** tách ra file riêng trong phân hệ đó (hoặc `src/lib/` / `src/components/` nếu dùng xuyên phân hệ); helper chỉ phục vụ 1 page giữ nguyên trong file page đó.
4. **Tuân thủ quy ước FE trong [apps/web/README.md](../../../apps/web/README.md#frontend-api-and-constants-convention):**
   - Endpoint & URL builder lấy từ `src/constants/api.ts`.
   - Query key lấy từ `src/constants/query-key.ts`.
   - Đọc dữ liệu server qua hooks trong `src/queries/`.
   - Session đọc qua `useSession()` / `getSession()` từ `src/lib/auth.ts` (`src/stores/session-store.ts`).
5. **Tương thích mở rộng Admin (7 phân hệ):** thư mục `src/pages/admin/` chia sẵn tên file rõ ràng để khi bổ sung `Users`, `ProductGroups`, `ScoringForms`, `Registrations`, `Reports` không phải di chuyển lại các page hiện có.

---

## 2. Sơ đồ ánh xạ file cũ → file mới

```text
apps/web/src/pages/
├── errors/
│   ├── ForbiddenPage.tsx              (từ RoutePages.tsx)
│   └── NotFoundPage.tsx               (từ RoutePages.tsx)
├── public/
│   ├── HomePage.tsx                   (tách từ src/App.tsx; App.tsx re-export hoặc chuyển hẳn)
│   ├── PublicCatalogPage.tsx          (từ PublicPages.tsx)
│   └── PublicProductDetailPage.tsx    (từ PublicPages.tsx)
├── auth/
│   ├── AuthFrame.tsx                  (component khung dùng chung của 4 màn auth)
│   ├── pending-email.ts               (readPendingEmail, writePendingEmail, clearPendingEmail)
│   ├── LoginPage.tsx                  (từ AuthPages.tsx)
│   ├── RegisterPage.tsx               (từ AuthPages.tsx)
│   ├── VerifyOtpPage.tsx              (từ AuthPages.tsx)
│   └── ForgotPasswordPage.tsx         (từ AuthPages.tsx)
├── account/
│   ├── AccountPage.tsx                (từ AuthPages.tsx)
│   └── ChangePasswordPage.tsx         (từ AuthPages.tsx)
├── registrant/
│   ├── AttachmentLink.tsx             (dùng chung giữa ProductEditorPage và MyProductDetailPage)
│   ├── MyProductsPage.tsx             (từ RegistrantPages.tsx)
│   ├── ProductEditorPage.tsx          (từ RegistrantPages.tsx)
│   └── MyProductDetailPage.tsx        (từ RegistrantPages.tsx)
├── judge/
│   ├── JudgeQueuePage.tsx             (từ JudgePages.tsx)
│   └── JudgeEvaluationPage.tsx        (từ JudgePages.tsx, kèm openJudgeAttachment nội bộ)
└── admin/
    ├── AdminDashboardPage.tsx         (từ AdminPages.tsx)
    ├── AdminJudgesPage.tsx            (từ AdminPages.tsx)
    ├── AdminAssignmentsPage.tsx       (từ AdminPages.tsx)
    ├── AdminProductsPage.tsx          (từ AdminPages.tsx)
    └── AdminProductResultsPage.tsx    (từ AdminPages.tsx)
```

### Dự phòng vị trí cho các màn Admin mới (theo `2026-10-17-admin-modules-spec.md`)

Khi triển khai đặc tả 7 phân hệ quản trị, thêm trực tiếp vào `src/pages/admin/` mà không chạm các file đã tách:

- `src/pages/admin/AdminUsersPage.tsx` (`/admin/users`)
- `src/pages/admin/AdminProductGroupsPage.tsx` (`/admin/product-groups`)
- `src/pages/admin/AdminScoringFormsPage.tsx` (`/admin/scoring-forms`)
- `src/pages/admin/AdminRegistrationsPage.tsx` (`/admin/registrations`)
- `src/pages/admin/AdminReportsPage.tsx` (`/admin/reports`)

---

## 3. Bảng đối chiếu chi tiết từng file và nơi import

| File nguồn hiện tại | Thành phần bên trong | File đích sau khi tách | File `routes/` / `layouts/` cần đổi import |
|---|---|---|---|
| `src/pages/RoutePages.tsx` | `ForbiddenPage` | `src/pages/errors/ForbiddenPage.tsx` | `src/routes/403.tsx` |
| `src/pages/RoutePages.tsx` | `NotFoundPage` | `src/pages/errors/NotFoundPage.tsx` | `src/routes/404.tsx`, `src/routes/__root.tsx` |
| `src/App.tsx` | `default function App` | `src/pages/public/HomePage.tsx` | `src/routes/_public.index.tsx` (`src/App.tsx` re-export `HomePage` nếu còn test/script tham chiếu) |
| `src/pages/PublicPages.tsx` | `PublicCatalogPage`, `statusLabel` | `src/pages/public/PublicCatalogPage.tsx` | `src/routes/_public.products.index.tsx` |
| `src/pages/PublicPages.tsx` | `PublicProductDetailPage`, `statusLabel` | `src/pages/public/PublicProductDetailPage.tsx` | `src/routes/_public.products.$id.tsx` |
| `src/pages/AuthPages.tsx` | `readPendingEmail`, `writePendingEmail`, `clearPendingEmail` | `src/pages/auth/pending-email.ts` | `RegisterPage.tsx`, `VerifyOtpPage.tsx` |
| `src/pages/AuthPages.tsx` | `AuthFrame` | `src/pages/auth/AuthFrame.tsx` | `LoginPage.tsx`, `RegisterPage.tsx`, `VerifyOtpPage.tsx`, `ForgotPasswordPage.tsx` |
| `src/pages/AuthPages.tsx` | `LoginPage` | `src/pages/auth/LoginPage.tsx` | `src/routes/_auth.login.tsx` |
| `src/pages/AuthPages.tsx` | `RegisterPage` | `src/pages/auth/RegisterPage.tsx` | `src/routes/_auth.register.tsx` |
| `src/pages/AuthPages.tsx` | `VerifyOtpPage` | `src/pages/auth/VerifyOtpPage.tsx` | `src/routes/_auth.verify-otp.tsx` |
| `src/pages/AuthPages.tsx` | `ForgotPasswordPage` | `src/pages/auth/ForgotPasswordPage.tsx` | `src/routes/_auth.forgot-password.tsx` |
| `src/pages/AuthPages.tsx` | `AccountPage` | `src/pages/account/AccountPage.tsx` | `src/routes/_app.account.tsx` |
| `src/pages/AuthPages.tsx` | `ChangePasswordPage` | `src/pages/account/ChangePasswordPage.tsx` | `src/routes/_app.account.password.tsx` |
| `src/pages/RegistrantPages.tsx` | `AttachmentLink` | `src/pages/registrant/AttachmentLink.tsx` | `ProductEditorPage.tsx`, `MyProductDetailPage.tsx` |
| `src/pages/RegistrantPages.tsx` | `MyProductsPage` | `src/pages/registrant/MyProductsPage.tsx` | `src/routes/_app.my.products.index.tsx` |
| `src/pages/RegistrantPages.tsx` | `ProductEditorPage`, `emptyRegistrationForm`, `applicationSteps` | `src/pages/registrant/ProductEditorPage.tsx` | `src/routes/_app.my.products.new.tsx`, `src/routes/_app.my.products.$id.edit.tsx` |
| `src/pages/RegistrantPages.tsx` | `MyProductDetailPage` | `src/pages/registrant/MyProductDetailPage.tsx` | `src/routes/_app.my.products.$id.tsx` |
| `src/pages/JudgePages.tsx` | `JudgeQueuePage` | `src/pages/judge/JudgeQueuePage.tsx` | `src/routes/_app.judge.index.tsx` |
| `src/pages/JudgePages.tsx` | `JudgeEvaluationPage`, `openJudgeAttachment` | `src/pages/judge/JudgeEvaluationPage.tsx` | `src/routes/_app.judge.products.$id.tsx` |
| `src/pages/AdminPages.tsx` | `AdminDashboardPage`, `dashboardStatusLabel` | `src/pages/admin/AdminDashboardPage.tsx` | `src/routes/_app.admin.index.tsx` |
| `src/pages/AdminPages.tsx` | `AdminJudgesPage` | `src/pages/admin/AdminJudgesPage.tsx` | `src/routes/_app.admin.judges.tsx` |
| `src/pages/AdminPages.tsx` | `AdminAssignmentsPage` | `src/pages/admin/AdminAssignmentsPage.tsx` | `src/routes/_app.admin.assignments.tsx` |
| `src/pages/AdminPages.tsx` | `AdminProductsPage` | `src/pages/admin/AdminProductsPage.tsx` | `src/routes/_app.admin.products.index.tsx` |
| `src/pages/AdminPages.tsx` | `AdminProductResultsPage` | `src/pages/admin/AdminProductResultsPage.tsx` | `src/routes/_app.admin.products.$id.tsx` |

> **Lưu ý về hằng số nhãn trạng thái:** `statusLabel` (trong `App.tsx` và `PublicPages.tsx`), `dashboardStatusLabel` (trong `AdminDashboardPage`) và `statusLabel` (trong `MyProductDetailPage`) nên được gom vào `src/constants/product-status.ts` để các file sau khi tách không phải khai báo lặp.

---

## 4. Các bước thực thi (Task-by-task)

### Task 1: Tạo hằng số trạng thái dùng chung `src/constants/product-status.ts`

- [x] Tạo `apps/web/src/constants/product-status.ts` chứa nhãn hiển thị theo ngữ cảnh:
  - `PUBLIC_PRODUCT_STATUS_LABEL`: `{ SUBMITTED: "Đã tiếp nhận", SCORING: "Đang đánh giá", COMPLETED: "Đã xếp hạng" }`
  - `PUBLIC_PRODUCT_STATUS_TONE`: `{ SUBMITTED: "status-received", SCORING: "status-evaluating", COMPLETED: "status-ranked" }`
  - `REGISTRANT_PRODUCT_STATUS_LABEL`: `{ DRAFT: "Bản nháp", SUBMITTED: "Đã nộp", SCORING: "Đang đánh giá", COMPLETED: "Đã hoàn tất" }`
  - `ADMIN_DASHBOARD_STATUS_LABEL`: `{ DRAFT: "Bản nháp", SUBMITTED: "Đã nộp", SCORING: "Đang chấm", COMPLETED: "Hoàn tất" }`

### Task 2: Tách `RoutePages.tsx` và `PublicPages.tsx` (+ `App.tsx`)

- [x] Tạo `src/pages/errors/ForbiddenPage.tsx` và `src/pages/errors/NotFoundPage.tsx`.
- [x] Cập nhật import trong `src/routes/403.tsx`, `src/routes/404.tsx`, `src/routes/__root.tsx`.
- [x] Xóa `src/pages/RoutePages.tsx`.
- [x] Tạo `src/pages/public/HomePage.tsx` (chuyển nội dung từ `src/App.tsx`), để `src/App.tsx` re-export `export { HomePage as default } from "./pages/public/HomePage";`.
- [x] Tạo `src/pages/public/PublicCatalogPage.tsx` và `src/pages/public/PublicProductDetailPage.tsx` dùng `PUBLIC_PRODUCT_STATUS_LABEL`.
- [x] Cập nhật import trong `src/routes/_public.index.tsx`, `src/routes/_public.products.index.tsx`, `src/routes/_public.products.$id.tsx`.
- [x] Xóa `src/pages/PublicPages.tsx`.

### Task 3: Tách `AuthPages.tsx` thành `pages/auth/*` và `pages/account/*`

- [x] Tạo `src/pages/auth/pending-email.ts` (`readPendingEmail`, `writePendingEmail`, `clearPendingEmail`).
- [x] Tạo `src/pages/auth/AuthFrame.tsx`.
- [x] Tạo `src/pages/auth/LoginPage.tsx`, `src/pages/auth/RegisterPage.tsx`, `src/pages/auth/VerifyOtpPage.tsx`, `src/pages/auth/ForgotPasswordPage.tsx`.
- [x] Tạo `src/pages/account/AccountPage.tsx` và `src/pages/account/ChangePasswordPage.tsx`.
- [x] Cập nhật import trong `src/routes/_auth.login.tsx`, `src/routes/_auth.register.tsx`, `src/routes/_auth.verify-otp.tsx`, `src/routes/_auth.forgot-password.tsx`, `src/routes/_app.account.tsx`, `src/routes/_app.account.password.tsx`.
- [x] Xóa `src/pages/AuthPages.tsx`.

### Task 4: Tách `RegistrantPages.tsx` thành `pages/registrant/*`

- [x] Tạo `src/pages/registrant/AttachmentLink.tsx`.
- [x] Tạo `src/pages/registrant/MyProductsPage.tsx`.
- [x] Tạo `src/pages/registrant/ProductEditorPage.tsx`.
- [x] Tạo `src/pages/registrant/MyProductDetailPage.tsx` dùng `REGISTRANT_PRODUCT_STATUS_LABEL`.
- [x] Cập nhật import trong `src/routes/_app.my.products.index.tsx`, `src/routes/_app.my.products.new.tsx`, `src/routes/_app.my.products.$id.edit.tsx`, `src/routes/_app.my.products.$id.tsx`.
- [x] Xóa `src/pages/RegistrantPages.tsx`.

### Task 5: Tách `JudgePages.tsx` thành `pages/judge/*`

- [x] Tạo `src/pages/judge/JudgeQueuePage.tsx`.
- [x] Tạo `src/pages/judge/JudgeEvaluationPage.tsx` (giữ `openJudgeAttachment` trong cùng file).
- [x] Cập nhật import trong `src/routes/_app.judge.index.tsx`, `src/routes/_app.judge.products.$id.tsx`.
- [x] Xóa `src/pages/JudgePages.tsx`.

### Task 6: Tách `AdminPages.tsx` thành `pages/admin/*`

- [x] Tạo `src/pages/admin/AdminDashboardPage.tsx` dùng `ADMIN_DASHBOARD_STATUS_LABEL`.
- [x] Tạo `src/pages/admin/AdminJudgesPage.tsx`.
- [x] Tạo `src/pages/admin/AdminAssignmentsPage.tsx`.
- [x] Tạo `src/pages/admin/AdminProductsPage.tsx`.
- [x] Tạo `src/pages/admin/AdminProductResultsPage.tsx`.
- [x] Cập nhật import trong `src/routes/_app.admin.index.tsx`, `src/routes/_app.admin.judges.tsx`, `src/routes/_app.admin.assignments.tsx`, `src/routes/_app.admin.products.index.tsx`, `src/routes/_app.admin.products.$id.tsx`.
- [x] Xóa `src/pages/AdminPages.tsx`.

### Task 7: Kiểm chứng sau khi tách

- [x] Chạy `Get-ChildItem apps/web/src/pages -File` để đảm bảo không còn file `*Pages.tsx` nào ở cấp gốc `src/pages/`.
- [x] Chạy `pnpm --filter @ocop/web build` để Vite + TanStack Router plugin kiểm tra toàn bộ route imports và bundle chunks.
- [x] Chạy `node apps/web/test/api-integration.check.mjs` và `node apps/web/test/proxy.check.mjs`.
- [x] Kiểm tra không có thay đổi ngoài ý muốn trên `apps/web/src/routeTree.gen.ts` (vì đường dẫn file trong `src/routes/` giữ nguyên).
