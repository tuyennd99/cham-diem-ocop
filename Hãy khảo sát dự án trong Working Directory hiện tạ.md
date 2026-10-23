# Hãy khảo sát dự án trong Working Directory hiện tạ

## 🧑‍💻 User

Hãy khảo sát dự án trong Working Directory hiện tại để hiểu tôi đang xây dựng gì, đã có gì, còn thiếu gì và chất lượng code hiện tại.

Trong lượt khảo sát này, đọc code và chạy các kiểm tra phù hợp; chưa sửa code, cài dependency, chạy migration hay thay đổi dữ liệu. Trả lời bằng tiếng Việt.

Quy tắc chung:
- Áp dụng ponytail: hiểu luồng thực tế, ưu tiên giải pháp nhỏ nhất giải quyết đầy đủ vấn đề, không đề xuất tính năng hoặc abstraction chưa có nhu cầu.
- Kiểm tra các skill và công cụ thực sự khả dụng. Đọc hướng dẫn skill trước khi áp dụng; thông báo ngắn bước nào dùng skill nào.
- Nếu thiếu skill, công cụ hoặc quyền truy cập, nói rõ và tiếp tục phần có thể làm. Không tuyên bố đã dùng skill hoặc chạy kiểm tra khi chưa thực hiện.
- Không đọc hoặc đưa giá trị bí mật từ .env, API key, token vào báo cáo. Có thể xem tên biến trong file cấu hình mẫu.
- Phân biệt điều đã xác minh, suy luận và thông tin cần tôi bổ sung.

Bước 1 — Hiểu dự án
Đọc hướng dẫn dự án, README, tài liệu yêu cầu, cấu hình dependency, cấu trúc thư mục, các điểm khởi chạy, lịch sử Git và thay đổi chưa commit nếu có.

Lần theo các luồng chức năng chính từ giao diện hoặc API tới xử lý nghiệp vụ và lưu trữ dữ liệu. Không kết luận chỉ từ tên thư mục hoặc README.

Cho biết:
- Dự án giải quyết việc gì, dành cho ai.
- Công nghệ và cách các phần kết nối.
- Cách chạy, build và test theo cấu hình thực tế.
- Chức năng đã hoạt động, mới có một phần, hoặc chưa xác minh.

Skill: ponytail xuyên suốt. Chỉ dùng brainstorming khi mục tiêu hoặc hành vi sản phẩm chưa rõ; trước hết hãy tìm câu trả lời trong dự án.

Bước 2 — Xác định còn thiếu gì
Đối chiếu yêu cầu, tài liệu và test với code thực tế.

Phân biệt:
- Yêu cầu đã ghi nhận nhưng chưa được triển khai.
- Chức năng đang làm dở hoặc có lỗi.
- Khoảng trống kiểm thử, cấu hình và vận hành.
- Ý tưởng cải tiến tùy chọn.

Không coi một tính năng là “còn thiếu” chỉ vì các sản phẩm khác thường có nó. Với mỗi mục, ghi bằng chứng và tác động.

Bước 3 — Review code
Dùng code-review theo đúng phạm vi skill hỗ trợ. Nếu skill chỉ review diff, hãy nêu rõ phần diff được review và khảo sát riêng các luồng quan trọng của toàn dự án.

Ưu tiên lỗi logic, phân quyền, xác thực, kiểm tra đầu vào, nguy cơ mất hoặc lộ dữ liệu, xử lý lỗi và các vấn đề hiệu năng có bằng chứng.

Chỉ áp dụng skill công nghệ khi dự án thực sự sử dụng công nghệ đó:
- nestjs-best-practices: backend NestJS.
- vercel-react-best-practices: React hoặc Next.js.
- shadcn: thành phần shadcn.
- tailwind-4-docs và tailwind-v4-shadcn: Tailwind v4 hoặc tích hợp Tailwind v4 với shadcn.
- webapp-testing: kiểm tra hành vi trên trình duyệt nếu có môi trường chạy phù hợp và không làm thay đổi dữ liệu thật.

Với mỗi phát hiện, ghi:
- Mức độ nghiêm trọng và ảnh hưởng.
- File, dòng code liên quan.
- Điều kiện gây lỗi hoặc cách tái hiện.
- Hướng sửa nhỏ nhất.
- Đã xác minh bằng cách nào, hoặc còn cần kiểm tra gì.

Không bịa lỗi để đủ số lượng. Nêu rõ phần chưa khảo sát hoặc chưa kiểm thử.

Bước 4 — Đề xuất thứ tự làm
Lập backlog theo thứ tự ưu tiên, mỗi việc gồm mục tiêu, lý do, phần code liên quan, phụ thuộc và tiêu chí hoàn thành.

Dùng writing-plans khi đã đủ yêu cầu để lập kế hoạch cụ thể. Nếu còn quyết định nghiệp vụ quan trọng, hỏi tôi những câu cần thiết trước.

Ghi skill dự kiến cho các bước triển khai sau:
- brainstorming: làm rõ yêu cầu hoặc thiết kế còn mở.
- writing-plans: lập kế hoạch đã có tiêu chí hoàn thành.
- executing-plans: thực hiện kế hoạch đã được thống nhất.
- test-driven-development: thêm hoặc sửa hành vi bằng chu trình test thất bại → sửa code → test đạt.
- requesting-code-review và code-review: tổ chức review và kiểm tra thay đổi sau triển khai.
- webapp-testing: kiểm tra luồng giao diện nếu phù hợp.
- ponytail: giữ phạm vi và cách triển khai đơn giản xuyên suốt.

Chưa triển khai trong lượt này.

Kết quả cuối cùng gồm:
1. Tôi đang làm dự án gì.
2. Hiện trạng: đã có, đang dở, chưa xác minh.
3. Các phát hiện review, xếp theo mức độ.
4. Việc còn thiếu và backlog ưu tiên.
5. Việc nên làm đầu tiên cùng skill sẽ dùng.
6. Những điều cần hỏi tôi và giới hạn của lần khảo sát.

Nếu dự án lớn, khảo sát tổng quan trước rồi đi sâu vào các luồng quan trọng nhất; báo rõ phạm vi, không tuyên bố đã review toàn bộ.

---
## 🤖 Bruh

API Error: 402 Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay.

ClaudeCodeResultError
API Error: 402 Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay.

---
## 🧑‍💻 User

Tiếp tục

---
## 🤖 Bruh

API Error: 402 Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay.

ClaudeCodeResultError
API Error: 402 Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay.

---
## 🧑‍💻 User

Tiếp tục

---
## 🤖 Bruh

Dưới đây là kết quả khảo sát toàn diện dự án **Hệ thống chấm điểm OCOP** (`D:\project\chamdiemocop`).

### Thông báo các Skill & Công cụ đã áp dụng
- **`ponytail` (full mode)**: Áp dụng xuyên suốt để đi thẳng vào luồng thực tế, đề xuất giải pháp nhỏ nhất và không đẻ thêm abstraction chưa có nhu cầu.
- **`code-review`**: Đối chiếu 2 trục **Standards** (quy ước codebase & code smells) và **Spec** (`docs/superpowers/specs/2026-10-15-fe-be-api-integration.md` + `docs/superpowers/specs/2026-10-17-admin-modules-spec.md`) trên working tree diff so với `HEAD` (`99a7d8a`) và toàn bộ luồng chính.
- **`nestjs-best-practices`**: Rà soát kiến trúc, guard, DTO validation, transaction, N+1 và xử lý lỗi tại `apps/be`.
- **`react-best-practices`**: Rà soát data fetching, re-render, state衍生 và bundle tại `apps/web`.
- **`writing-plans`**: Dùng để cấu trúc hóa backlog ưu tiên với file, phụ thuộc và tiêu chí hoàn thành rõ ràng.
- **Trạng thái các skill khác**:
  - `shadcn`: Đã gọi nhưng CLI báo thiếu `components.json` ở root và thiếu `bunx` trên máy; kiểm tra trực tiếp cho thấy `apps/web/src/components/ui/{button,input}.tsx` là 2 component viết tay mỏng dùng `cva` + `tailwind-merge`.
  - `tailwind-4-docs` & `tailwind-v4-shadcn`: Không có trong danh sách skill được cài đặt của phiên này.
  - `webapp-testing`: Chưa chạy trình duyệt vì chưa khởi chạy DB/SMTP runtime trong lượt khảo sát chỉ đọc này.

---

## 1. Bạn đang làm dự án gì?

### Mục tiêu & Đối tượng sử dụng
Hệ thống quản lý đăng ký, đánh giá và xếp hạng sản phẩm **OCOP** theo **Quyết định 26/2026/QĐ-TTg** (thang 100 điểm, 6 nhóm ngành lớn, 26 phân loại sản phẩm/bộ tiêu chí):
- **Công khai (Public)**: Người dân/đối tác tra cứu danh mục sản phẩm OCOP đã nộp (`SUBMITTED`, `SCORING`, `COMPLETED`), lọc theo phân loại, tìm kiếm từ khóa, xem ảnh sản phẩm và kết quả điểm/sao (ẩn thông tin liên hệ, `formData` và PDF minh chứng).
- **Chủ thể (`REGISTRANT`)**: Tự đăng ký tài khoản (xác thực Email OTP 6 số), lập hồ sơ đăng ký sản phẩm theo Mẫu 01 (3 bước), tải ảnh/PDF minh chứng (tối đa 10 MiB/tệp), lưu nháp và nộp hồ sơ.
- **Giám khảo (`JUDGE`)**: Xem hàng chờ các hồ sơ thuộc phân loại được phân công, đối chiếu minh chứng, chấm điểm từng tiểu tiêu chí (chọn `ScoreOption` cố định + ghi chú) trong phạm vi tiêu chí được giao, lưu nháp và nộp phiếu chấm.
- **Quản trị viên (`ADMIN`)**: Xem tổng quan tiến độ, tạo/quản lý/reset mật khẩu/ngừng hoạt động giám khảo, phân công giám khảo theo phân loại & phạm vi tiêu chí (kiểm tra độ phủ 100% tiêu chí), theo dõi danh sách hồ sơ và bảng tổng hợp kết quả.

### Kiến trúc & Kết nối công nghệ
Monorepo `pnpm@11.17.0` trên Node.js `v24.18.0`:
- **`packages/shared` (`@ocop/shared`)**: Hợp đồng TypeScript dùng chung (`Role`, `ProductStatus`, `Product`, `Criterion`, `Evaluation`, `ApiResult`).
- **`apps/be` (`@ocop/api`)**: NestJS 11 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL.
  - Kiến trúc: `Controller → Service → Repository → Prisma`.
  - Bảo mật: Global guards chạy theo thứ tự `JwtAuthGuard` (HS256, 7 ngày) → `UserThrottlerGuard` → `AccountGuard` (kiểm tra DB `verified`, `isActive`, `tokenVersion` mỗi request) → `RoleGuard`.
  - Chuẩn hóa HTTP: `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), `ApiResponseInterceptor` bọc `{ statusCode, data, meta?, message? }`, `ApiExceptionFilter` trả `{ statusCode, message, requestId }` và ẩn chi tiết lỗi 5xx khỏi log/client.
  - Lưu trữ file: Multer custom `PrivateStorage` lưu tên file UUIDv7 vào `STORAGE_PATH`, kiểm tra magic bytes (`PNG`, `JPEG`, `GIF`, `WebP`, `PDF`) trong `inspectProductUpload`.
- **`apps/web` (`@ocop/web`)**: React 19 + Vite 8 + TanStack Router + Tailwind CSS v4.
  - Gọi API qua `apps/web/src/lib/api.ts` (`fetch` wrapper gửi Bearer token từ `localStorage['ocop-session']`, tự xóa session khi gặp `401` trừ ngoại lệ sai mật khẩu hiện tại).
  - Dev server proxy `/api` về `http://localhost:3030` (có đọc `VITE_API_PROXY` qua `loadEnv`).

### Cách chạy, build và test thực tế (Đã xác minh trong phiên này)
- **Typecheck**:
  - `pnpm --filter @ocop/web typecheck` → **PASS**
  - `pnpm --filter @ocop/api typecheck` → **PASS**
- **Build**:
  - `pnpm --filter @ocop/web run build --configLoader native` → **PASS** (1.85s; cần `--configLoader native` trên môi trường hạn chế spawn esbuild).
  - `pnpm --filter @ocop/api build` → **PASS**
- **Unit & Contract Tests (không cần DB)**:
  - `pnpm --filter @ocop/web exec node test/proxy.check.mjs` → **PASS**
  - `pnpm --filter @ocop/web exec node test/api-integration.check.mjs` → **PASS**
  - `pnpm --filter @ocop/api test --runInBand` → **PASS** (10 suites, 49 tests)
  - `pnpm --filter @ocop/api test:db --runTestsByPath test/openapi.db-spec.ts` → **PASS** (1 suite, 1 test kiểm tra OpenAPI schema từ bản build `dist/`)
- **DB Integration Tests**:
  - `pnpm --filter @ocop/api test:db` yêu cầu biến `TEST_DATABASE_URL` trỏ tới PostgreSQL local có tên DB kết thúc bằng `_test` (tự tạo schema ngẫu nhiên, chạy migrate + seed 26 bộ tiêu chí, mock mail và dọn dẹp).

---

## 2. Hiện trạng: Đã có, Đang dở, Còn thiếu & Chưa xác minh

### A. Đã hoàn thành và có kiểm thử code/unit (Đã xác minh)
1. **Luồng cốt lõi Giai đoạn 1 (FE + BE)**:
   - Xác thực Email OTP (HMAC-SHA256, giới hạn 5 lần thử, `FOR UPDATE` chống race condition), đăng nhập JWT, quên/đổi mật khẩu kèm thu hồi token qua `tokenVersion`.
   - Seed dữ liệu chuẩn (`apps/be/prisma/seed/seed.ts`): nạp 6 nhóm ngành, 26 phân loại sản phẩm và 26 bộ tiêu chí (tổng mỗi bộ đúng 100 điểm), có khóa bảo vệ không cho sửa tiêu chí của phân loại đã có phiếu chấm.
   - Quản lý hồ sơ chủ thể (`DRAFT` → `SUBMITTED`), upload/xóa minh chứng với kiểm tra chữ ký file thật.
   - Chấm điểm giám khảo (lưu nháp chuyển sang `SCORING`, nộp phiếu khóa `SUBMITTED`, tự động tính `finalScore` trung bình toàn phần hoặc trung bình từng tiêu chí rồi xếp sao `calculateStars` khi đủ giám khảo và phủ kín tiêu chí).
2. **Đợt đồng bộ tích hợp FE–BE (`docs/superpowers/plans/2026-10-16-fe-be-api-integration.md`)**:
   - Đã thực hiện xong trong working tree nhưng **chưa commit** (36 file sửa/xóa, 10 file/thư mục mới): chuyển tiện ích FE vào `apps/web/src/lib/`, tách types vào `apps/web/src/types/`, sửa Vite proxy `loadEnv`, sửa `ProductEditorPage` gọi `GET /my/products/:id`, validate file 10 MiB phía FE, phục hồi khi upload lỗi một phần, tách trạng thái loading/error/empty và viết các bài test kiểm chứng.

### B. Đang làm dở hoặc có lỗi nhỏ trong code hiện tại (Đã xác minh)
1. **Working tree đang dirty trên nhánh `main`**: Toàn bộ thay đổi tích hợp FE–BE ngày 16–17/10 chưa được commit.
2. **Hiển thị thông tin hồ sơ ở màn chi tiết chủ thể (`MyProductDetailPage`) còn thô**: Tại `apps/web/src/pages/RegistrantPages.tsx:212`, thông tin Mẫu 01 đang in thẳng bằng `<pre>{JSON.stringify(product.formData, null, 2)}</pre>` thay vì hiển thị danh sách nhãn tiếng Việt như bên màn giám khảo (`JudgePages.tsx:63-67`).
3. **Một số điểm lệch validation/quyền nhỏ giữa FE và BE** (chi tiết tại Mục 3 — Review Code).

### C. Yêu cầu đã ghi nhận trong Spec mở rộng nhưng CHƯA triển khai (Đã xác minh đối chiếu code)
Toàn bộ đặc tả **`docs/superpowers/specs/2026-10-17-admin-modules-spec.md` (Mở rộng 7 phân hệ quản trị)** hiện mới ở mức tài liệu thiết kế, **chưa có trong `schema.prisma`, backend hay frontend**:
1. **Mô hình quyền kết hợp & Đơn vị công tác**: Chưa có `staffPermissions` (`MANAGE`, `VIEW`, `SCORE`), vai trò `VIEWER`, bảng `OrganizationUnit`, hay hỗ trợ tài khoản `ADMIN` có quyền `SCORE` vào chấm điểm.
2. **Chuẩn hóa danh mục & Địa bàn**: Chưa có bảng `ProductGroup`, `Locality` (Xã/Phường), trạng thái ngừng sử dụng danh mục, hay trường `localityId` trên `Product`.
3. **Lịch sử trạng thái & Snapshot pháp lý**: Chưa có `completedAt`, `createdById` (nhập hộ), bảng `ProductStatusEvent`, hay snapshot thông tin người chấm/đơn vị/tiêu chí tại thời điểm nộp phiếu.
4. **7 phân hệ Admin mới/mở rộng**:
   - `/admin/users` (quản lý người dùng + tab Đơn vị) — hiện mới chỉ có `/admin/judges`.
   - `/admin/product-groups` (quản lý 6 nhóm, 26 phân loại, địa bàn, in mẫu trắng).
   - `/admin/products` mở rộng (bộ lọc tìm kiếm server, chi tiết 5 tab, admin tải tệp private).
   - `/admin/scoring-forms` (danh mục 26 bộ phiếu, danh sách phiếu đã chấm, 4 mẫu in A4).
   - `/admin/registrations` (quản lý phiếu đăng ký, admin nhập hộ bản nháp cho chủ thể, in Mẫu 01).
   - `/admin/reports` (báo cáo thống kê theo kỳ đăng ký / kỳ hoàn tất, múi giờ `Asia/Ho_Chi_Minh`, `dataQuality`).
   - `/admin` Dashboard mới (8 KPI, 4 vùng biểu đồ, bảng đối chiếu kỳ trước).

### D. Khoảng trống kiểm thử, cấu hình & vận hành (Chưa xác minh runtime)
Theo `docs/verification/2026-10-16-fe-be-integration.md`:
- Chưa có cấu hình `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` thật và `TEST_DATABASE_URL` để chạy `pnpm --filter @ocop/api test:db` (5 bộ test DB: `auth`, `backend`, `evaluation`, `assignment`, `seed`).
- Chưa chạy nghiệm thu E2E trên trình duyệt với DB thật cho các ca `ENV-01`, `PUB-01..02`, `AUTH-01..04`, `REG-01..02`, `FILE-01..02`, `ADM-01..02`, `JDG-01..02`, `SCORE-01..02`.

---

## 3. Kết quả Review Code

### Phần A — Review theo 2 trục của skill `code-review` (trên working tree diff so với `HEAD` `99a7d8a`)

#### ## Standards
- **Điểm đạt**:
  - Việc tách `apps/web/src/{api,auth,attachments,route-guards,use-api}.ts` vào `apps/web/src/lib/` và tách `apps/web/src/types.ts` thành `apps/web/src/types/*.ts` giúp cấu trúc rõ ràng, xóa bỏ file моноlithic type cũ.
  - Giữ đúng nguyên tắc `ponytail`: dùng `node:assert/strict` cho test FE (`test/proxy.check.mjs`, `test/api-integration.check.mjs`) mà không cài thêm Vitest/Playwright dư thừa.
- **Vi phạm / Code Smells phát hiện**:
  1. **Mật độ format một dòng khó đọc (Formatting / Readability)**: Trong `apps/web/src/pages/RegistrantPages.tsx` (dòng 44–48, 177, 207–213), `apps/web/src/pages/JudgePages.tsx` (dòng 13, 73–88), và `apps/web/src/pages/AdminPages.tsx` (dòng 26, 29, 46, 127, 139, 147), rất nhiều khối JSX phức tạp bị nén thành các dòng đơn dài 400–1.200 ký tự. Khi có diff hoặc lỗi runtime sẽ rất khó đọc và dễ gây conflict.
  2. **Duplicated Code (Fowler smell)**: Logic quy đổi đuôi file sang MIME type và kiểm tra đường dẫn UUID trong `STORAGE_PATH` đang viết lặp lại gần như y hệt tại `apps/be/src/services/products.service.ts:185-207` và `apps/be/src/services/evaluations.service.ts:32-49`.

#### ## Spec (Đối chiếu với `2026-10-15-fe-be-api-integration.md`)
- **Điểm đạt**: Tất cả 7 hạng mục P1/P2 trong Mục 10 của spec tích hợp FE–BE đều đã được triển khai khớp yêu cầu (proxy `loadEnv`, tách type `RegistrantProduct` & `EvaluationData`, editor gọi `GET /my/products/:id`, validate file 10 MiB & giữ trạng thái khi lỗi upload 5xx/network, tách empty state khỏi error state, pin status `201` cho `change-password` và `admin/judges/:id/reset-password`).
- **Sai lệch nhỏ so với Spec**:
  1. **Số lượng sản phẩm nổi bật trang chủ**: Spec mục 6 (dòng 184) quy định `/` gọi `GET /products?page=1&limit=8&categoryId=...`, nhưng `apps/web/src/App.tsx:16` đang gọi `limit: "6"`.

> **Tóm tắt 2 trục `code-review`**: Trục **Standards** có 2 phát hiện (nặng nhất: nén JSX dài trên 1 dòng và lặp logic đọc file private); trục **Spec** có 1 sai lệch nhỏ (`limit=6` so với `limit=8` ở trang chủ).

---

### Phần B — Các phát hiện chi tiết trên toàn dự án (Xếp theo mức độ nghiêm trọng)

#### [Mức Trung bình - Medium] 1. Chênh lệch kiểm tra độ dài mật khẩu tiếng Việt/UTF-8 giữa FE và BE
- **Ảnh hưởng**: Người dùng nhập mật khẩu từ 8–72 ký tự nhưng có dấu tiếng Việt hoặc ký tự đặc biệt nhiều byte (tổng > 72 UTF-8 bytes) sẽ vượt qua validation của form HTML (`maxLength={72}` tính theo UTF-16 code units), gửi lên BE và bị trả lỗi `400 Bad Request` (`Password must be at most 72 UTF-8 bytes`). Spec tích hợp mục 5.2 (dòng 168) đã cảnh báo rõ điểm này.
- **File & dòng code**:
  - `apps/web/src/pages/AuthPages.tsx:231, 362, 405-407`
  - `apps/web/src/pages/AdminPages.tsx:46`
  - `apps/be/src/dtos/auth.dto.ts:26, 48, 63, 71, 77` và `apps/be/src/services/auth.service.ts:194-198`
- **Cách tái hiện**: Tại `/register` hoặc `/account/password`, nhập mật khẩu 40 ký tự tiếng Việt có dấu (ví dụ 40 chữ `ă` hoặc `ệ` = 80–120 bytes UTF-8) rồi bấm gửi.
- **Hướng sửa nhỏ nhất**: Thêm kiểm tra `new TextEncoder().encode(password).length <= 72` tại hàm submit của `AuthPages.tsx` và `AdminPages.tsx` để báo lỗi tiếng Việt thân thiện ngay tại form trước khi gọi API.
- **Xác minh**: Đã xác minh qua đối chiếu mã nguồn `AuthPages.tsx` và `auth.service.ts`.

#### [Mức Trung bình - Medium] 2. Giám khảo bị vô hiệu hóa (`isActive = false`) vẫn còn trong `JudgeAssignment` làm kẹt việc hoàn tất điểm sản phẩm
- **Ảnh hưởng**: Trong `AdminRepository.deactivateJudge` (`apps/be/src/repositories/admin.repository.ts:107-120`), nếu giám khảo đang không có sản phẩm mở (`SUBMITTED`/`SCORING`) tại thời điểm bị khóa thì hệ thống xóa phân công của họ. Tuy nhiên, `recomputeProductResult` (`apps/be/src/utils/evaluation-result.ts:46-49`) và `EvaluationsRepository.listQueue` lấy toàn bộ `judgeAssignment` mà không lọc `judge: { isActive: true }`. Nếu có dữ liệu phân công trỏ tới judge không active (hoặc trong tương lai khi giữ phân công để tra cứu lịch sử), sản phẩm sẽ không bao giờ chuyển sang `COMPLETED` vì chờ phiếu của judge đã ngừng hoạt động.
- **File & dòng code**: `apps/be/src/utils/evaluation-result.ts:46-49` (so sánh với `apps/be/src/repositories/admin.repository.ts:50` nơi dashboard có lọc `judge: { is: { role: Role.JUDGE, isActive: true } }`).
- **Cách tái hiện**: Khi một bản ghi `JudgeAssignment` tồn tại cho user có `isActive: false`, `recomputeProductResult` vẫn đưa `assignment` đó vào vòng lặp kiểm tra `evaluationsByJudge.get(assignment.judgeId)` và đặt `complete = false`.
- **Hướng sửa nhỏ nhất**: Đồng bộ điều kiện lọc `judge: { is: { isActive: true } }` (hoặc đảm bảo invariant mọi assignment của judge bị khóa đều phải được gỡ/thay thế) giữa `dashboardData` và `recomputeProductResult`.
- **Xác minh**: Đã xác minh qua đọc code `evaluation-result.ts` và `admin.repository.ts`.

#### [Mức Thấp - Low] 3. Trang chi tiết hồ sơ của Chủ thể hiển thị JSON thô cho `formData`
- **Ảnh hưởng**: Trải nghiệm người dùng kém — chủ thể mở `/my/products/:id` sau khi lưu/nộp hồ sơ thấy khối code JSON (`entityName`, `representativeName`, `declarationAccepted`...) thay vì bảng thông tin Tiếng Việt.
- **File & dòng code**: `apps/web/src/pages/RegistrantPages.tsx:212` (`<h2>Thông tin hồ sơ</h2><pre>{JSON.stringify(product.formData, null, 2)}</pre>`).
- **Cách tái hiện**: Mở bất kỳ hồ sơ nào tại `/my/products/:id`.
- **Hướng sửa nhỏ nhất**: Tái sử dụng map nhãn tiếng Việt `formLabels` và `<dl className="detail-facts">` đã có sẵn ở `apps/web/src/pages/JudgePages.tsx:63-67`.
- **Xác minh**: Đã xác minh trực tiếp trong mã nguồn `RegistrantPages.tsx`.

#### [Mức Thấp - Low] 4. `AdminJudgesPage` thiếu trạng thái chặn bấm lặp (`busy`) cho các nút Sửa, Reset mật khẩu và Ngừng hoạt động từng dòng
- **Ảnh hưởng**: Form tạo giám khảo có `busy`, nhưng các thao tác `update`, `resetPassword`, `deactivate` trên từng giám khảo trong danh sách không đặt `busy`, cho phép admin bấm liên tiếp gây gửi nhiều request `PUT/POST/DELETE` trùng lặp.
- **File & dòng code**: `apps/web/src/pages/AdminPages.tsx:43-46`.
- **Cách tái hiện**: Mạng chậm, bấm đúp vào nút "Lưu thay đổi" hoặc "Đặt lại mật khẩu" của một giám khảo tại `/admin/judges`.
- **Hướng sửa nhỏ nhất**: Dùng chung state `busy` (hoặc `busyId`) có sẵn trong `AdminJudgesPage` để `disabled={busy}` trên các nút trong danh sách.
- **Xác minh**: Đã xác minh trong mã nguồn `AdminPages.tsx`.

#### [Mức Thấp - Low] 5. `MailService` khởi tạo transporter ngay trong property initializer của class
- **Ảnh hưởng**: Trong `apps/be/src/services/mail.service.ts:8-16`, `env(process.env)` chạy ngay lúc NestJS khởi tạo instance `MailService`. Dù hiện tại `withTestApp` ghi đè `process.env` trước khi `require('../../src/app.module')`, theo `nestjs-best-practices` (`di-` / `devops-use-config-module`), việc đọc `process.env` trực tiếp trong constructor/property làm giảm tính cô lập khi viết unit test tạo module.
- **File & dòng code**: `apps/be/src/services/mail.service.ts:8-16`.
- **Hướng sửa nhỏ nhất**: Chuyển việc tạo transporter thành lazy getter hoặc khởi tạo khi gọi `sendOtp` (chỉ tạo 1 lần và cache lại).
- **Xác minh**: Đã xác minh qua đọc code `mail.service.ts`.

---

## 4. Việc còn thiếu & Backlog ưu tiên

Backlog dưới đây được sắp xếp theo thứ tự phụ thuộc thực tế: **ổn định & đóng gói phần đang làm dở trước → nghiệm thu runtime Giai đoạn 1 → triển khai mở rộng 7 phân hệ Admin theo `2026-10-17-admin-modules-spec.md`**.

### Hạng mục 1: Chốt và làm sạch đợt tích hợp FE–BE hiện tại (Ngắn hạn - Làm ngay)
- **Mục tiêu**: Hoàn thiện các chi tiết nhỏ còn sót của Giai đoạn 1 và tạo commit sạch cho những thay đổi đang nằm trên working tree.
- **Lý do**: Working tree đang có 46 mục thay đổi chưa commit; nếu làm tiếp tính năng mới ngay sẽ rất dễ lẫn lộn diff và khó rollback.
- **Phần code liên quan**:
  - `apps/web/src/pages/RegistrantPages.tsx` (thay `<pre>{JSON.stringify(product.formData)}</pre>` bằng `<dl>` tiếng Việt).
  - `apps/web/src/pages/AdminPages.tsx` (thêm `busy` cho `update`/`resetPassword`/`deactivate` giám khảo).
  - `apps/web/src/pages/AuthPages.tsx` & `AdminPages.tsx` (kiểm tra 72 UTF-8 bytes cho mật khẩu).
  - `apps/web/src/App.tsx` (đồng bộ `limit=8` theo spec hoặc giữ `6` nếu bạn muốn lưới 3×2).
- **Phụ thuộc**: Không phụ thuộc DB/SMTP.
- **Tiêu chí hoàn thành**: `pnpm --filter @ocop/web typecheck`, `pnpm --filter @ocop/api typecheck`, `pnpm --filter @ocop/api test --runInBand` và 2 script `test/*.check.mjs` đều PASS; git status được commit gọn theo đúng mục đích.
- **Skill dự kiến**: `ponytail`, `test-driven-development`, `code-review`.

### Hạng mục 2: Nghiệm thu Runtime & Database Integration cho Giai đoạn 1
- **Mục tiêu**: Chạy toàn bộ 5 bộ test DB (`auth`, `backend`, `evaluation`, `assignment`, `seed`) và smoke test trình duyệt cho luồng hiện có.
- **Lý do**: Hiện tại các bài test DB và luồng OTP/browser đang ở trạng thái `BLOCKED` do thiếu `TEST_DATABASE_URL` và SMTP thật (theo `docs/verification/2026-10-16-fe-be-integration.md`).
- **Phần code liên quan**: `apps/be/.env`, `apps/be/test/*.db-spec.ts`, `docs/verification/2026-10-16-fe-be-integration.md`.
- **Phụ thuộc**: Cần bạn cung cấp/kích hoạt PostgreSQL local có DB `*_test` và thông tin SMTP (hoặc xác nhận dùng môi trường test).
- **Tiêu chí hoàn thành**: `pnpm --filter @ocop/api test:db` PASS 6/6 suites; cập nhật các ca `BLOCKED` trong báo cáo verification sang `PASS`.
- **Skill dự kiến**: `webapp-testing`, `ponytail`.

### Hạng mục 3: Nền tảng Dữ liệu & Phân quyền kết hợp (Mở đầu Spec 7 phân hệ Admin)
- **Mục tiêu**: Bổ sung migration tiến (`0011_...`) cho `staffPermissions` (`MANAGE`, `VIEW`, `SCORE`), `OrganizationUnit`, `ProductGroup`, `Locality`, `ProductStatusEvent`, `completedAt`, `createdById` và cập nhật Guard/Auth.
- **Lý do**: Tất cả 7 phân hệ quản trị mới trong `2026-10-17-admin-modules-spec.md` đều phụ thuộc vào mô hình quyền kết hợp (ví dụ Admin vừa `MANAGE` vừa `SCORE`, hoặc lãnh đạo chỉ có quyền `VIEW`) và danh mục Đơn vị/Địa bàn.
- **Phần code liên quan**: `apps/be/prisma/schema.prisma`, `apps/be/src/guards/*`, `apps/be/src/services/auth.service.ts`, `packages/shared/src/index.ts`, `apps/web/src/lib/route-guards.ts`.
- **Phụ thuộc**: Hạng mục 1 & 2, và chốt các câu hỏi nghiệp vụ ở Mục 6 bên dưới.
- **Tiêu chí hoàn thành**: Migration chạy an toàn trên dữ liệu cũ (`MIG-01`), giữ nguyên ID/phiếu đã nộp; test `USR-01..04`, `ORG-01`, `CAT-01..02` PASS.
- **Skill dự kiến**: `writing-plans`, `executing-plans`, `test-driven-development`, `nestjs-best-practices`, `ponytail`.

### Hạng mục 4: Các phân hệ Danh mục Người dùng, Nhóm sản phẩm, Sản phẩm & Phiếu đăng ký (Phân hệ 1, 2, 3, 5)
- **Mục tiêu**: Xây dựng API và màn hình `/admin/users` (kèm tab Đơn vị), `/admin/product-groups` (kèm tab Địa bàn), mở rộng `/admin/products` (bộ lọc server, xem/tải tệp private) và `/admin/registrations` (nhập hộ bản nháp cho chủ thể).
- **Phần code liên quan**: `apps/be/src/controllers/admin.controller.ts`, `apps/be/src/services/admin.service.ts`, `apps/be/src/repositories/admin.repository.ts`, `apps/web/src/pages/AdminPages.tsx`, `apps/web/src/routes/_app.admin.*.tsx`.
- **Phụ thuộc**: Hạng mục 3.
- **Tiêu chí hoàn thành**: Thỏa mãn các tiêu chí nghiệm thu `PROD-01`, `REG-01..02`, `FILE-01` trong spec admin.
- **Skill dự kiến**: `writing-plans`, `executing-plans`, `test-driven-development`, `nestjs-best-practices`, `react-best-practices`, `ponytail`.

### Hạng mục 5: Phân hệ Phiếu chấm OCOP & 4 Biểu mẫu In A4 (Phân hệ 4)
- **Mục tiêu**: Xây dựng `/admin/scoring-forms` (tra cứu 26 bộ phiếu, danh sách phiếu chấm) và 4 trang in A4 chuẩn (Mẫu phiếu trắng, Phiếu chấm sản phẩm, Bảng tổng hợp kết quả, Phiếu đăng ký Mẫu 01) lấy dữ liệu snapshot từ BE.
- **Phần code liên quan**: Endpoint `*/print-data` tại `apps/be`, layout in `@media print` tại `apps/web`.
- **Phụ thuộc**: Hạng mục 3 & 4.
- **Tiêu chí hoàn thành**: Thỏa mãn `FORM-01..02`, `PRINT-01..03` (ghi rõ "mức điểm 5 sao/đề nghị xem xét 5 sao", không làm tròn 89.99 thành 5 sao).
- **Skill dự kiến**: `executing-plans`, `test-driven-development`, `react-best-practices`, `webapp-testing`, `ponytail`.

### Hạng mục 6: Báo cáo thống kê & Analytics Dashboard (Phân hệ 6 & 7)
- **Mục tiêu**: Triển khai `/admin/reports` (2 báo cáo theo kỳ đăng ký và kỳ hoàn tất, múi giờ `Asia/Ho_Chi_Minh`, `dataQuality`) và nâng cấp `/admin` Dashboard (8 KPI, 4 biểu đồ, bảng đối chiếu và drill-down).
- **Phần code liên quan**: `apps/be/src/repositories/admin.repository.ts`, `apps/web/src/pages/AdminPages.tsx`.
- **Phụ thuộc**: Hạng mục 3, 4, 5.
- **Tiêu chí hoàn thành**: Thỏa mãn `REP-01..05` và `DASH-01..02`.
- **Skill dự kiến**: `writing-plans`, `executing-plans`, `test-driven-development`, `react-best-practices`, `requesting-code-review`, `code-review`, `ponytail`.

---

## 5. Việc nên làm đầu tiên & Skill sẽ dùng

**Đề xuất làm ngay**: **Hạng mục 1 (Hoàn thiện các điểm nhỏ còn sót của đợt tích hợp FE–BE hiện tại và chốt trạng thái working tree)** kết hợp với **Hạng mục 2 (Chạy test DB nếu máy bạn đã bật PostgreSQL local)**.
- Cụ thể:
  1. Sửa hiển thị `formData` từ `<pre>JSON</pre>` sang bảng thông tin tiếng Việt tại `MyProductDetailPage` (`apps/web/src/pages/RegistrantPages.tsx:212`).
  2. Thêm khóa `busy` cho các thao tác từng dòng trên `AdminJudgesPage` (`apps/web/src/pages/AdminPages.tsx:43-46`) và kiểm tra 72 byte UTF-8 cho mật khẩu.
  3. Chạy lại toàn bộ typecheck, unit test, build để bạn commit gọn phần tích hợp FE–BE hiện tại trước khi bắt đầu làm 7 phân hệ quản trị mới.
- **Skill sẽ dùng**: `ponytail` + `test-driven-development` + `code-review`.

---

## 6. Những câu hỏi cần bạn xác nhận & Giới hạn của lần khảo sát

### Câu hỏi cần bạn xác nhận trước khi bước sang kế hoạch tiếp theo:
1. **Mục tiêu ngắn hạn của bạn ngay lúc này là gì?**
   - **(A)** Hoàn tất nghiệm thu runtime (DB/SMTP/Browser) và commit dứt điểm đợt tích hợp FE–BE hiện tại (`2026-10-15-fe-be-api-integration.md`), hay
   - **(B)** Lập kế hoạch chi tiết (`writing-plans`) và bắt đầu triển khai luôn bản mở rộng **7 phân hệ quản trị** (`2026-10-17-admin-modules-spec.md`)?
2. **Về môi trường PostgreSQL local**: Bạn đã có sẵn PostgreSQL đang chạy trên máy (để tạo DB `ocop_test` chạy `pnpm --filter @ocop/api test:db`) chưa, và DB trong `DATABASE_URL` hiện tại là DB mới dành riêng cho OCOP hay có dữ liệu cũ cần giữ?
3. **Nếu triển khai 7 phân hệ quản trị (`2026-10-17-admin-modules-spec.md`), xin chốt 4 điểm còn mở ở Mục 16 của Spec**:
   - Quyền `VIEW` được xem toàn bộ hồ sơ của tỉnh/thành phố triển khai (như giả định trong spec), hay phải giới hạn theo Đơn vị/Địa bàn?
   - Bạn đã có danh mục thực tế của **Tỉnh/Thành phố, Xã/Phường và tên các Đơn vị/Sở** để nạp seed chưa, hay tạm thời nạp dữ liệu mẫu cấu hình được?
   - Báo cáo chỉ thống kê **mức sao tính theo điểm hệ thống**, hay cần thêm quản lý **Quyết định công nhận chính thức**?
   - Báo cáo chỉ cần **In / Lưu PDF A4 ngang** như spec, hay cần xuất thêm file **XLSX/CSV** ngay trong đợt này?

### Giới hạn của lần khảo sát này (theo quy tắc Ponytail):
- **Đã bỏ qua / Không thực hiện**: Không đọc giá trị trong `.env`; không chạy `prisma migrate`, `seed`, không khởi chạy server dev hay kết nối tới PostgreSQL/SMTP thật; chưa đọc chi tiết từng dòng trong 3 file JSON dữ liệu tiêu chí lớn (`criteria-sets*.json`) vì đã có `seed.ts` và unit/DB test kiểm chứng tổng điểm 100.
- **Rủi ro cần lưu ý**: Working tree trên nhánh `main` đang có nhiều file đã sửa và xóa (`apps/web/src/*` chuyển vào `src/lib/` và `src/types/`) chưa được commit — tuyệt đối không chạy `git checkout .` hay `git reset --hard` để tránh mất phần việc tích hợp FE–BE vừa hoàn thành.

---
## 🧑‍💻 User

Hạng mục 1: Chốt và làm sạch đợt tích hợp FE–BE hiện tại

---
## 🤖 Bruh

Đã hoàn tất **Hạng mục 1: Chốt và làm sạch đợt tích hợp FE–BE hiện tại** theo đúng chu trình TDD (`test-driven-development`: viết test đỏ → sửa tối thiểu sang xanh) và nguyên tắc `ponytail`.

### 1. Những gì đã thay đổi

- **Kiểm tra giới hạn 72 byte UTF-8 cho mật khẩu tại Frontend**:
  - `apps/web/src/lib/auth.ts`: Thêm `validatePasswordBytes(password)` dùng `TextEncoder` để chặn mật khẩu tiếng Việt có dấu vượt quá 72 byte UTF-8 trước khi gọi API.
  - `apps/web/src/pages/AuthPages.tsx`: Áp dụng kiểm tra tại form Đăng ký (`RegisterPage`), Đặt lại mật khẩu (`ForgotPasswordPage`) và Đổi mật khẩu (`ChangePasswordPage`), đảm bảo không ghi `ocop.pendingEmail` nếu mật khẩu vượt giới hạn byte.
  - `apps/web/src/pages/AdminPages.tsx`: Áp dụng kiểm tra khi Tạo giám khảo và Đặt lại mật khẩu giám khảo; bổ sung guard `busy` và `disabled={busy}` cho các thao tác Sửa, Đặt lại mật khẩu và Ngừng hoạt động trên từng dòng giám khảo (`AdminJudgesPage`).
- **Hiển thị thông tin hồ sơ tiếng Việt (thay cho `<pre>JSON</pre>` thô)**:
  - `apps/web/src/lib/utils.ts`: Tách helper dùng chung `formatFormEntries` và `formatFormValue` (ánh xạ nhãn tiếng Việt Mẫu 01 và dịch `FIRST`/`UPGRADE`/`REASSESSMENT` sang `Lần đầu`/`Nâng hạng`/`Đánh giá lại`).
  - `apps/web/src/pages/RegistrantPages.tsx`: Thay `<pre>{JSON.stringify(product.formData, null, 2)}</pre>` ở `MyProductDetailPage` bằng `<dl className="detail-facts">` hiển thị nhãn tiếng Việt rõ ràng.
  - `apps/web/src/pages/JudgePages.tsx`: Tái sử dụng `formatFormEntries` để bỏ code lặp tại `JudgeEvaluationPage`.
- **Làm sạch Backend & Đồng bộ điều kiện hoàn tất điểm**:
  - `apps/be/src/utils/evaluation-result.ts`: Lọc `judge: { is: { isActive: true } }` khi truy vấn `judgeAssignment` trong `recomputeProductResult`, đồng bộ với `AdminRepository.dashboardData` để giám khảo bị khóa không làm kẹt việc tổng hợp điểm.
  - `apps/be/src/utils/private-storage.ts`, `apps/be/src/services/products.service.ts`, `apps/be/src/services/evaluations.service.ts`: Gom logic kiểm tra UUID key và mở stream tệp đính kèm về `resolveStoredPath` / `openStoredFile` dùng chung.
  - `apps/be/src/services/mail.service.ts`: Chuyển khởi tạo `nodemailer` transporter sang lazy getter `getTransporter()` để `MailService` có thể khởi tạo trong unit test mà không bắt buộc biến môi trường SMTP cho đến khi thực sự gọi `sendOtp`.
- **Cập nhật Kiểm thử & Báo cáo nghiệm thu**:
  - `apps/web/test/api-integration.check.mjs`: Thêm test cho `validatePasswordBytes` (72 ký tự ASCII, 24 ký tự `ệ` = 72 bytes đạt, 25 ký tự `ệ` = 75 bytes báo lỗi) và `formatFormEntries`.
  - `apps/be/src/repositories/evaluations.repository.spec.ts`: Thêm unit test cho `recomputeProductResult` (lọc judge active) và `openStoredFile`.
  - `apps/be/src/services/auth.service.spec.ts`: Thêm unit test cho khởi tạo lazy của `MailService`.
  - `docs/verification/2026-10-16-fe-be-integration.md`: Cập nhật số lượng test mới (10 suites, 52 unit tests + OpenAPI check).

### 2. Kết quả kiểm tra thực tế

| Kiểm tra | Lệnh | Kết quả |
|---|---|---|
| Web Typecheck | `pnpm --filter @ocop/web typecheck` | **PASS** |
| API Typecheck | `pnpm --filter @ocop/api typecheck` | **PASS** |
| Vite Proxy Check | `pnpm --filter @ocop/web exec node test/proxy.check.mjs` | **PASS** |
| Web Client & Contract Check | `pnpm --filter @ocop/web exec node test/api-integration.check.mjs` | **PASS** |
| API Unit Tests | `pnpm --filter @ocop/api test --runInBand` | **PASS** (10 suites, 52 tests) |
| Web Production Build | `pnpm --filter @ocop/web run build --configLoader native` | **PASS** (990ms) |
| API Production Build | `pnpm --filter @ocop/api build` | **PASS** |
| OpenAPI Contract Suite | `pnpm --filter @ocop/api test:db --runTestsByPath test/openapi.db-spec.ts` | **PASS** (1 suite, 1 test) |
| Git Whitespace Check | `git diff --check` | **PASS** (0 lỗi) |

### 3. Phần còn hạn chế / Bước tiếp theo

- **Chưa thực hiện**: Tôi chưa chạy `git commit` (theo quy tắc chỉ commit khi bạn yêu cầu) và chưa chạy các bài test DB (`test:db` ngoài `openapi.db-spec.ts`) do chưa có `TEST_DATABASE_URL`.
- Bạn có muốn tôi **tạo git commit** để đóng gói toàn bộ đợt tích hợp FE–BE này trước khi chuyển sang bước tiếp theo không? Nếu tiếp tục sang **Hạng mục 2 (test DB)** hoặc **Hạng mục 3 (lập kế hoạch triển khai 7 phân hệ quản trị theo `2026-10-17-admin-modules-spec.md`)**, hãy cho tôi biết lựa chọn của bạn.

---
## 🧑‍💻 User

 tạo git commit để đóng gói toàn bộ đợt tích hợp FE–BE này trước khi chuyển sang bước tiếp theo, sau khi làm xong thì tiếp tục sang hạng mục 2

---
## 🤖 Bruh

### 1. Đã tạo Git Commit cho Hạng mục 1

Đã đóng gói toàn bộ đợt tích hợp FE–BE và các bài kiểm tra hợp đồng vào commit sạch trên nhánh `main`:
- **Commit**: `18c2b56` — `feat(web,api): finalize FE-BE API integration and contract checks` (64 files changed, working tree hiện tại hoàn toàn sạch).

---

### 2. Kết quả kiểm tra Hạng mục 2 (Nghiệm thu Runtime & Database Integration)

Tôi đã chạy kiểm tra trạng thái cấu hình và kết nối thực tế (không đọc hay lộ giá trị bí mật trong `apps/be/.env`):

1. **Biến môi trường (`apps/be/.env`)**:
   - `DATABASE_URL`: **Đã cấu hình** (trỏ tới `localhost` cổng `15432`, có `sslmode`).
   - `JWT_SECRET`: **Đã cấu hình** (đạt `>= 32` bytes).
   - `TEST_DATABASE_URL`: **Chưa cấu hình** (`missing`).
   - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: **Chưa cấu hình** (`missing` — khiến `env(process.env)` sẽ dừng khi khởi động API thực tế).
2. **Trạng thái kết nối PostgreSQL**:
   - Thử kết nối tới PostgreSQL tại cổng `15432` trả về **`ECONNREFUSED`**.
   - Kiểm tra các cổng đang lắng nghe trên máy (`5432`, `15432`, `5433`, `3030`, `5173`) hiện **không có tiến trình PostgreSQL hoặc Docker/SSH tunnel nào đang mở**.
3. **Các bài kiểm tra trong `test:db` chạy được không cần PostgreSQL**:
   - `pnpm --filter @ocop/api test:db --runTestsByPath test/openapi.db-spec.ts` → **PASS** (1 suite, 1 test).
   - Phần `describe('test database safety')` trong `apps/be/test/backend.db-spec.ts` (kiểm tra chặn URL không an toàn và dọn dẹp khi lỗi kết nối) đã được khóa chặt.
   - 5 bộ test cần kết nối PostgreSQL thật (`auth.db-spec.ts`, `backend.db-spec.ts`, `evaluation.db-spec.ts`, `assignment.db-spec.ts`, `seed.db-spec.ts`) đang ở trạng thái **`BLOCKED`** cho đến khi bật PostgreSQL tại cổng `15432` (hoặc cổng local bạn dùng) và có database kết thúc bằng `_test`.

---

### Cách mở khóa Hạng mục 2 (khi bạn bật DB) hoặc chuyển sang Hạng mục 3

- **Nếu bạn muốn chạy ngay Hạng mục 2 bây giờ**:
  1. Hãy khởi động PostgreSQL (hoặc Docker container / SSH tunnel ở cổng `15432`) và tạo một database trống tên là `ocop_test` (cùng user/password local).
  2. Thêm dòng `TEST_DATABASE_URL=postgresql://.../ocop_test` vào `apps/be/.env` (nhớ dùng `sslmode=disable` hoặc cấu hình khớp với server local ở cổng `15432`), sau đó nhắn tôi chạy lại `pnpm --filter @ocop/api test:db`.
- **Nếu bạn chưa bật DB/SMTP ngay và muốn chuyển sang Hạng mục 3 (Triển khai mở rộng 7 phân hệ quản trị theo `docs/superpowers/specs/2026-10-17-admin-modules-spec.md`)**:
  - Chúng ta có thể lập kế hoạch (`writing-plans`) và triển khai code + unit test cho **Hạng mục 3 (Nền tảng dữ liệu & phân quyền kết hợp `MANAGE` / `VIEW` / `SCORE`, `OrganizationUnit`, `ProductGroup`, `Locality`)** ngay mà không bị chặn bởi SMTP hay DB runtime.

Bạn muốn **bật PostgreSQL ở cổng `15432` để tôi chạy tiếp `test:db`**, hay **chuyển sang Hạng mục 3**?

---
## 🧑‍💻 User

Tôi đang bật PostgreSQL ở cổng 15432, chạy tiếp test:db

---
## 🤖 Bruh

Tôi đã kết nối tới PostgreSQL ở cổng `15432` và chạy thử `pnpm --filter @ocop/api test:db`. Hiện tại 5/6 bộ test DB dừng lại ngay ở bước kiểm tra an toàn đầu vào vì **3 nguyên nhân cụ thể**:

### 1. Chưa có biến `TEST_DATABASE_URL` và chưa có database tên `*_test`
- Trên PostgreSQL cổng `15432` hiện chỉ có 3 database: `chamdiemocop_dev`, `chamdiemocop_prod`, `postgres`.
- Tài khoản trong `.env` (`app_dev_user`) có quyền `CREATE SCHEMA` trên `chamdiemocop_dev`, nhưng **không có quyền `CREATEDB`** (`rolcreatedb: false`).
- Trong khi đó, hàm `withTestApp` (`apps/be/test/support/db-app.ts:20-35`) và quy tắc của dự án bắt buộc `TEST_DATABASE_URL` phải trỏ tới một database có tên kết thúc bằng **`_test`** (ví dụ: `chamdiemocop_test` hoặc `ocop_test`), không được phép tự trỏ `TEST_DATABASE_URL` vào `chamdiemocop_dev`.

### 2. Chứng chỉ SSL tự ký (`DEPTH_ZERO_SELF_SIGNED_CERT`) với `pg`
- Server PostgreSQL ở cổng `15432` đang dùng chứng chỉ SSL tự ký (self-signed).
- Với phiên bản `pg` hiện tại, chuỗi kết nối chỉ có `?sslmode=require` sẽ bị coi là `verify-full` và từ chối kết nối với lỗi `DEPTH_ZERO_SELF_SIGNED_CERT`.
- **Đã xác minh**: Khi thêm `uselibpqcompat=true&sslmode=require` (hoặc `sslmode=no-verify`), kết nối tới cổng `15432` thành công ngay lập tức.

### 3. Trạng thái hiện tại của `chamdiemocop_dev`
- Database `chamdiemocop_dev` đã có 13 bảng của schema OCOP (`users`, `products`, `product_categories`, `criteria_sets`, `evaluations`...) nhưng **đang trống hoàn toàn** (`0` danh mục, `0` bộ tiêu chí, `0` user, `0` sản phẩm) và chưa có bảng `_prisma_migrations`.

---

### Bạn cần làm 1 bước nhỏ để tôi chạy tiếp `test:db` ngay:

Bằng quyền quản trị PostgreSQL (`postgres` / superuser) trên server cổng `15432`, bạn hãy tạo database test và cấp quyền cho `app_dev_user`:

```sql
CREATE DATABASE chamdiemocop_test OWNER app_dev_user;
GRANT ALL PRIVILEGES ON DATABASE chamdiemocop_test TO app_dev_user;
```

Sau đó trong `apps/be/.env`:
1. Cập nhật tham số cuối của `DATABASE_URL` thành `?uselibpqcompat=true&sslmode=require` (để không bị lỗi chứng chỉ tự ký).
2. Thêm dòng `TEST_DATABASE_URL` (dùng chung thông tin đăng nhập với `DATABASE_URL` nhưng đổi tên DB ở cuối thành `/chamdiemocop_test?uselibpqcompat=true&sslmode=require`).

*(Hoặc nếu bạn đã tạo xong DB `chamdiemocop_test` trên PostgreSQL và muốn tôi tự thêm dòng `TEST_DATABASE_URL` + `uselibpqcompat=true` vào `apps/be/.env` giúp bạn thì hãy nhắn tôi xác nhận).*

---
## 🧑‍💻 User

Làm luôn trên table có sẵn, không cần phải tạo table test
