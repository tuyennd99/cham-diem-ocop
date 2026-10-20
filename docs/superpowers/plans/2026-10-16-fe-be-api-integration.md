# OCOP FE–BE API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa các sai lệch tích hợp FE–BE đã xác định, giữ nguyên API hiện có và nghiệm thu hành trình OCOP bằng dữ liệu thử biệt lập.

**Architecture:** Giữ React/Vite/TanStack Router và client `src/lib/api.ts`; BE giữ controller → service → repository hiện tại. Sửa cấu hình proxy, types theo response thực tế, các luồng hồ sơ/upload và trạng thái UI tại nơi đang sở hữu chúng. Dùng Node assert, Vite và Jest đã cài để kiểm chứng; không thêm tầng API hoặc framework test.

**Tech Stack:** Node.js `>=24.7 <25`, pnpm `11.17.0`, React 19, Vite 8, TanStack Router, Tailwind 4, NestJS 11, Prisma 7, PostgreSQL, Jest.

**Implementation status (2026-10-17):** Code changes and automated checks are complete; DB, SMTP, browser, and deployment acceptance remain blocked as recorded in [verification report](../../verification/2026-10-16-fe-be-integration.md).

**Spec:** [2026-10-15-fe-be-api-integration.md](../specs/2026-10-15-fe-be-api-integration.md). Đọc cả spec và plan trước khi sửa; các đoạn code bên dưới là thay đổi dự kiến, chưa được áp dụng.

## Global Constraints

- API prefix `/api`; roles `REGISTRANT`, `JUDGE`, `ADMIN`.
- Luồng sản phẩm `DRAFT → SUBMITTED → SCORING → COMPLETED`; phiếu `SUBMITTED` bất biến.
- JWT bảy ngày, OTP sáu chữ số/hạn năm phút. Không đổi cơ chế Bearer/localStorage/tokenVersion.
- Giữ envelope `{statusCode,data,meta?,message?}`; lỗi `{statusCode,message,requestId?}`; binary không bọc JSON.
- Upload một field `file` mỗi request, PNG/JPEG/GIF/WebP/PDF, tối đa `10 * 1024 * 1024` byte/tệp.
- `PUT formData`, `PUT scores` thay toàn bộ dữ liệu tương ứng; `PUT assignments` thay toàn bộ danh sách phân công. Không biến thành patch ngầm.
- Dùng nguyên `finalScore`/`starRating` BE trả. Không thay bộ tiêu chí hoặc quy tắc tính điểm.
- Không thêm refresh token, endpoint logout, Redis, queue, SMS, S3, UI quản lý tiêu chí, thư viện HTTP, thư viện kiểm chứng schema hoặc thiết kế lại giao diện.
- Không ghi đè `.env`, in secret, đưa secret vào `VITE_*`, hoặc sửa `routeTree.gen.ts` bằng tay.
- Giữ thay đổi FE đang có; không phục hồi các utility đã chuyển sang `src/lib`, không `git add .` hoặc reset workspace.
- Không chạy migration/seed/reset trên `DATABASE_URL` chưa xác định phạm vi dữ liệu. Migration `0009_ocop_domain` có thể xóa domain cũ.
- DB suite chỉ dùng `TEST_DATABASE_URL` local có tên DB kết thúc `_test`; không suy ra từ DB người dùng và không nới guard của harness.
- Kế hoạch hiện được thực thi theo yêu cầu người dùng. Không chạy migration/seed/reset khi chưa xác nhận an toàn dữ liệu; các blocker môi trường được ghi trong report nghiệm thu.

## Hiện trạng đã đối chiếu

FE đã gọi đủ endpoint chính; không có công việc “thay mock bằng API” đại trà. Các điểm cần sửa xác định từ source:

1. `vite.config.ts` chỉ đọc `process.env.VITE_API_PROXY`, chưa nạp file env.
2. Types product category của registrant và product/attachment của evaluation yêu cầu field BE không trả.
3. Editor tải cả `/my/products` rồi `find(id)` thay vì dùng endpoint chi tiết.
4. File input chấp nhận rộng hơn BE; chưa kiểm tra dung lượng trước khi tạo/lưu hồ sơ. Editor cần hiển thị trạng thái đã lưu khi upload lỗi một phần.
5. My products hiện empty cùng lúc với lỗi tải; mutation ở list/detail chưa có trạng thái chặn gửi lặp.
6. Auth/client đã có phục hồi đăng ký và ngoại lệ 401 sai mật khẩu hiện tại; cần test trước khi quyết định sửa.
7. `auth.db-spec.ts` kỳ vọng 200 cho change-password và admin reset-password, trong khi controller hiện trả 201. OTP reset-password vẫn trả 200.
8. Web README mô tả sai tìm kiếm server và thời gian tồn tại localStorage.

Không có yêu cầu thay schema hoặc endpoint mới. Chỉ sửa production BE khi test tái hiện được sai lệch so với spec; các chỉnh sửa test đã xác định không phải lý do thay status code API.

## Bản đồ file và thứ tự

| Task | File sở hữu | Trách nhiệm |
|---|---|---|
| 1 | Không sửa ứng dụng | Chốt baseline, runtime, môi trường và giới hạn DB. |
| 2 | `apps/web/vite.config.ts`; tạo `apps/web/test/proxy.check.mjs` | Nạp env cho proxy, test default/file/process. |
| 3 | `apps/web/src/types/{product,registrant,judge}.ts`; tạo `apps/web/src/types/api-contract.check.ts` | Types phản ánh payload thực tế, fixture compile-time. |
| 4 | `apps/web/src/pages/RegistrantPages.tsx`, hàm `ProductEditorPage` | Tải detail, reset loading theo ID, giữ form/payload. |
| 5 | `apps/web/src/lib/attachments.ts`; `RegistrantPages.tsx`, editor; tạo `apps/web/test/api-integration.check.mjs` | Validate file, upload tuần tự, phục hồi lỗi một phần. |
| 6 | `RegistrantPages.tsx`, `MyProductsPage`/`MyProductDetailPage` | Loading/empty/error, retry và pending mutation. |
| 7 | `apps/api/test/auth.db-spec.ts`; `apps/api/src/services/auth.service.spec.ts`; `apps/api/src/utils/scoring.spec.ts`; `apps/web/test/api-integration.check.mjs` | Kiểm chứng auth/session và sửa hai expectation HTTP lệch contract. |
| 8 | `apps/web/README.md`; tạo `docs/verification/2026-10-16-fe-be-integration.md` | Chạy regression, nghiệm thu browser và ghi bằng chứng. |

Task 1 làm trước. Task 2 và 3 độc lập; task 4–6 làm nối tiếp vì cùng file. Task 7 tận dụng script task 5. Task 8 làm cuối; thiếu DB/SMTP không cản sửa FE hoặc chạy kiểm tra không phụ thuộc chúng.

## Review Focus

- Upload thành công trên server nhưng response mất: metadata không có hash/kích thước; không suy ra cùng file chỉ vì trùng tên.
- `formData` là replace: thay một field trên UI không được làm mất những field đã lưu khác.
- 401 sai mật khẩu hiện tại phải giữ session; 401 token bị thu hồi phải xóa session.
- Phân công là replace toàn bảng: sửa một nhóm không làm mất các nhóm ngoài màn hình đang xem.
- HTTP 201 là thành công; test/client không được yêu cầu mọi POST trả 200.

## Task 1: Xác định baseline và môi trường an toàn

**Files:** Read `package.json`, `apps/{web,api}/package.json`, `apps/api/.env.example`, `apps/api/test/support/db-app.ts`, `apps/api/docs/operations.md`. Không sửa `.env` hoặc ứng dụng.

**Interfaces:** Consumes cấu hình hiện có; produces danh sách kiểm tra đã chạy và điều kiện còn thiếu để task 8 nghiệm thu. Không truyền secret vào tài liệu.

- [ ] **Step 1 — Chụp trạng thái workspace và kiểm tra runtime.**

```powershell
git status --short
node --version
pnpm --version
```

Đạt khi Node thuộc `>=24.7 <25`, pnpm khớp `11.17.0`. Nếu sai, ghi rõ prerequisite; không tự nâng version package hoặc sửa lockfile để hợp máy hiện tại.

- [ ] **Step 2 — Chạy baseline không kết nối DB.**

```powershell
pnpm typecheck
pnpm build
pnpm --filter @ocop/api test --runInBand
```

Ghi exit code và lỗi đầu tiên từng lệnh. Không nhận kết quả lịch sử 14/10 là kết quả mới. Nếu thiếu dependency, dùng `pnpm install --frozen-lockfile`; không thêm dependency hoặc xóa lockfile. Nếu môi trường không cho cài, vẫn tiếp tục các chỉnh sửa có thể đối chiếu bằng source.

- [ ] **Step 3 — Kiểm tra cấu hình mà chỉ xuất trạng thái hợp lệ.**

```powershell
pnpm --filter @ocop/api exec node -r dotenv/config -e 'const e=process.env;for(const k of ["DATABASE_URL","JWT_SECRET","SMTP_HOST","SMTP_USER","SMTP_PASSWORD","SMTP_FROM"]){const valid=k==="JWT_SECRET"?Buffer.byteLength(e[k]??"","utf8")>=32:Boolean(e[k]?.trim());console.log(k+": "+(valid?"configured":"missing or invalid"));}'
```

Không dump `process.env` hoặc nội dung `.env`. Có key không chứng minh kết nối SMTP/DB. `TEST_DATABASE_URL` là cấu hình riêng cho DB test.

- [ ] **Step 4 — Chỉ đọc trạng thái migration khi đúng DB OCOP đã được xác định.**

```powershell
pnpm --filter @ocop/api prisma generate
pnpm --filter @ocop/api prisma migrate status
```

Lệnh status có thể trả khác 0 vì migration pending. Không chạy deploy/seed/reset trong task này. Nếu chưa rõ database có dữ liệu gì, ghi bước DB là `BLOCKED`, tiếp tục task FE.

## Task 2: Nạp env đúng cho Vite proxy

**Files:** Modify `apps/web/vite.config.ts`; Create `apps/web/test/proxy.check.mjs`.

**Interfaces:** Consumes `VITE_API_PROXY` từ process/file env. Produces proxy `/api` với thứ tự process → file → `http://localhost:3030`. `VITE_API_URL` vẫn là base của browser.

- [ ] **Step 1 — Tạo regression check cho config thực tế.** Lưu toàn bộ đoạn sau vào `proxy.check.mjs`:

```js
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';

const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url));
const fixture = mkdtempSync(join(tmpdir(), 'ocop-proxy-'));
const previousCwd = process.cwd();
const previousProxy = process.env.VITE_API_PROXY;
async function target() {
  const loaded = await loadConfigFromFile(
    { command: 'serve', mode: 'development' }, configFile, fixture, 'silent',
  );
  assert.ok(loaded);
  return loaded.config.server.proxy['/api'];
}
try {
  process.chdir(fixture);
  delete process.env.VITE_API_PROXY;
  assert.equal(await target(), 'http://localhost:3030');
  writeFileSync(join(fixture, '.env.local'), 'VITE_API_PROXY=http://127.0.0.1:3131\n');
  assert.equal(await target(), 'http://127.0.0.1:3131');
  process.env.VITE_API_PROXY = 'http://127.0.0.1:3232';
  assert.equal(await target(), 'http://127.0.0.1:3232');
  console.log('PASS proxy: default, file env, process override');
} finally {
  process.chdir(previousCwd);
  if (previousProxy === undefined) delete process.env.VITE_API_PROXY;
  else process.env.VITE_API_PROXY = previousProxy;
  rmSync(fixture, { recursive: true, force: true });
}
```

Fixture chỉ xóa đúng thư mục ngẫu nhiên vừa tạo; không ghi/xóa `.env` của người dùng. Nếu máy thiếu binary của Vite, ghi lỗi prerequisite; đó chưa phải bằng chứng regression.

- [ ] **Step 2 — Chạy red.**

```powershell
pnpm --filter @ocop/web exec node test/proxy.check.mjs
```

Trước sửa, check file env phải thất bại: target vẫn `http://localhost:3030`.

- [ ] **Step 3 — Giữ nguyên plugins/alias, đổi config sang callback.**

```ts
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const values = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { proxy: { "/api": process.env.VITE_API_PROXY || values.VITE_API_PROXY || "http://localhost:3030" } },
  };
});
```

`process.cwd()` là `apps/web` khi chạy workspace script. Không thêm `define: {"process.env": ...}`; không đẩy env backend vào bundle.

- [ ] **Step 4 — Chạy green và kiểm tra diff riêng task.**

```powershell
pnpm --filter @ocop/web exec node test/proxy.check.mjs
git diff --check -- apps/web/vite.config.ts
```

Đạt khi đủ ba case. Chỉ tạo checkpoint cho config và check mới; kiểm tra staged diff trước commit.

## Task 3: Types khớp đúng response của từng endpoint

**Files:** Modify `apps/web/src/types/product.ts`, `registrant.ts`, `judge.ts`; Create `apps/web/src/types/api-contract.check.ts`. Read callers trong `pages/{Registrant,Judge,Public,Admin}Pages.tsx` và selectors của repositories.

**Interfaces:** `RegistrantCategory` tiếp tục dùng cho `/categories`; `RegistrantProduct.category` dùng `Category` summary. `EvaluationData.product` mô tả riêng payload phiếu, không kế thừa field queue không được trả.

- [ ] **Step 1 — Tạo fixture compile-time trước sửa.**

```ts
// apps/web/src/types/api-contract.check.ts
import type { RegistrantProduct } from "./registrant";
import type { EvaluationData } from "./judge";

const summary = {
  id: "category-1", name: "Phân loại", groupCode: "A", groupName: "Nhóm",
} satisfies RegistrantProduct["category"];

const evaluation = {
  product: {
    id: "product-1", name: "Hồ sơ", description: null, formData: {},
    category: { id: "category-1", name: "Phân loại", groupName: "Nhóm" },
    attachments: [{ id: "file-1", type: "EVIDENCE", fileName: "proof.pdf" }],
  },
  criteria: [],
  evaluation: { id: null, status: "IN_PROGRESS", total: null, scores: [] },
} satisfies EvaluationData;

type Assert<T extends true> = T;
type NoQueueStatus = Assert<"status" extends keyof EvaluationData["product"] ? false : true>;
type NoAttachmentDate = Assert<"createdAt" extends keyof EvaluationData["product"]["attachments"][number] ? false : true>;
void summary;
void evaluation;
```

Fixture nằm trong `src` để `tsc` kiểm tra; không import fixture vào runtime và không export types chỉ để phục vụ test.

- [ ] **Step 2 — Chạy red.**

```powershell
pnpm --filter @ocop/web typecheck
```

Chờ lỗi thiếu classification ở summary, thiếu field queue/date ở evaluation và hai assertion type. Phân biệt với lỗi baseline không liên quan.

- [ ] **Step 3 — Chỉ sửa nơi types mô tả sai.**

```ts
// registrant.ts — giữ RegistrantCategory dành cho danh mục đầy đủ.
// Trong RegistrantProduct, thay category: RegistrantCategory bằng:
category: ProductCategoryView;
```

```ts
// judge.ts — thay import/product của EvaluationData; giữ QueueProduct hiện có.
import type { Criterion, Evaluation, Product, ProductAttachment } from "@ocop/shared";
import type { Attachment, Category } from "./product";

export interface EvaluationData {
  product: Pick<Product, "id" | "name" | "description"> & {
    formData: Record<string, unknown>;
    category: Pick<Category, "id" | "name" | "groupName">;
    attachments: Required<Pick<ProductAttachment, "id" | "fileName" | "type">>[];
  };
  criteria: Criterion[];
  evaluation: Evaluation;
}
```

Không cần đổi `product.ts` nếu alias hiện có đã dùng đúng; không thêm alias chỉ có một caller. Không thêm `expiresIn` vào session hoặc bắt BE trả classification/createdAt cho evaluation.

- [ ] **Step 4 — Chạy green và review mọi caller types.**

```powershell
pnpm --filter @ocop/web typecheck
rg -n 'RegistrantCategory|RegistrantProduct|EvaluationData|QueueProduct' apps/web/src
```

Không dùng `as unknown as`, `any`, hoặc làm tất cả field optional để tắt lỗi. Checkpoint chỉ types và fixture.

## Task 4: Editor dùng endpoint chi tiết và giữ đúng payload form

**Files:** Modify `apps/web/src/pages/RegistrantPages.tsx`, `ProductEditorPage` hiện khoảng dòng 33–133. Read `routes/_app.my.products.$id.edit.tsx`, `products.dto.ts`, `products.repository.ts`; không đổi endpoint BE.

**Interfaces:** Consumes `/categories` và `/my/products/:id`; produces POST/PUT `{name,description,categoryId,formData}` đầy đủ field form hiện tại.

- [ ] **Step 1 — Tái hiện request hiện tại trên browser.** Đăng nhập REGISTRANT ở môi trường nghiệm thu, mở `/my/products/<id>/edit`, bật Network. Hiện editor gọi `GET /my/products`; ghi bằng chứng trước sửa. Dùng hồ sơ của mình, hồ sơ đã nộp và ID không thuộc mình cho ba trường hợp riêng.

- [ ] **Step 2 — Đổi phần tải dữ liệu; giữ mapping field đã có.**

```tsx
useEffect(() => {
  let active = true;
  setLoaded(false); setError(""); setProduct(null);
  Promise.all([
    api<Category[]>("/categories"),
    productId
      ? api<Product>(`/my/products/${encodeURIComponent(productId)}`)
      : Promise.resolve({ data: null }),
  ]).then(([categoryResult, productResult]) => {
    if (!active) return;
    setCategories(categoryResult.data);
    const current = productResult.data;
    if (current) {
      const saved = current.formData ?? {};
      setProduct(current); setName(current.name);
      setDescription(current.description ?? ""); setCategoryId(current.category.id);
      setRegistration({
        entityName: String(saved.entityName ?? ""),
        representativeName: String(saved.representativeName ?? ""),
        representativeTitle: String(saved.representativeTitle ?? ""),
        contactAddress: String(saved.contactAddress ?? ""),
        provinceName: String(saved.provinceName ?? ""),
        phone: String(saved.phone ?? ""),
        email: String(saved.email ?? ""),
        registrationType: saved.registrationType === "FIRST" || saved.registrationType === "UPGRADE" || saved.registrationType === "REASSESSMENT" ? saved.registrationType : "",
        sampleQuantity: saved.sampleQuantity == null ? "" : String(saved.sampleQuantity),
        assessmentYear: saved.assessmentYear == null ? String(new Date().getFullYear()) : String(saved.assessmentYear),
        declarationAccepted: saved.declarationAccepted === true,
      });
    } else if (!productId) {
      setCategoryId(categoryResult.data[0]?.id ?? "");
    }
  }).catch((cause) => { if (active) setError(messageOf(cause)); })
    .finally(() => { if (active) setLoaded(true); });
  return () => { active = false; };
}, [productId]);
```

Đoạn này thay effect tải dữ liệu và giữ nguyên ý nghĩa mapping các field form hiện tại. Guard loading khi mở edit và màn hình không tìm thấy hiện có vẫn dùng `loaded`, `error`, `product`.

- [ ] **Step 3 — Giữ nháp chưa hoàn chỉnh hợp lệ và payload replace đầy đủ.** Trong `save`, sau khi đọc `sampleQuantity`, đặt `formData` như sau:

```ts
const assessmentYear = registration.assessmentYear === ""
  ? undefined : Number(registration.assessmentYear);
if (!Number.isInteger(sampleQuantity) || sampleQuantity < 0 || sampleQuantity > 100000) {
  throw new Error("Số lượng mẫu phải là số nguyên từ 0 đến 100000.");
}
if (assessmentYear !== undefined &&
  (!Number.isInteger(assessmentYear) || assessmentYear < 2020 || assessmentYear > 2100)) {
  throw new Error("Năm đánh giá phải là số nguyên từ 2020 đến 2100.");
}
const formData = {
  ...registration,
  registrationType: registration.registrationType || undefined,
  sampleQuantity,
  assessmentYear,
};
```

Thay guard số mẫu cũ, không để hai guard trùng nhau. `declarationAccepted` giữ boolean. Không gửi DTO đọc như `status`, `id`, `attachments` vào payload ghi. Submit vẫn do BE kiểm tra điều kiện đầy đủ; không chặn lưu draft chỉ vì chưa cam kết.

- [ ] **Step 4 — Kiểm chứng detail và replace bằng browser.**

Mở trực tiếp editor và reload: Network chỉ có `/categories` và detail tương ứng, không có GET list. Thay mô tả, lưu, reload: entityName/địa chỉ/contact/năm/loại đăng ký giữ nguyên. Hồ sơ đã nộp không có form sửa; ID ngoài quyền không hiện dữ liệu cũ. Thử lưu draft số mẫu trống/0, năm trống, loại chưa chọn; đều không bị FE yêu cầu hoàn thành để lưu.

```powershell
pnpm --filter @ocop/web typecheck
```

Nếu chưa có browser/DB, ghi các case runtime `BLOCKED`, không thay bằng assertion tìm chuỗi trong source. Checkpoint riêng task.

## Task 5: Upload đúng contract và phục hồi lỗi một phần

**Files:** Modify `apps/web/src/lib/attachments.ts`, editor trong `RegistrantPages.tsx`; Create `apps/web/test/api-integration.check.mjs`.

**Interfaces:** Thêm `PRODUCT_FILE_ACCEPT: string`, `validateProductFile(file: Pick<File,"name"|"type"|"size">): void` trong module attachment hiện có. Giữ `openAttachment(path,name,download?)` và client cũ.

- [ ] **Step 1 — Tạo check Node dùng Vite để nạp module FE đúng cách.** Không import trực tiếp module có `import.meta.env` bằng Node trần.

```js
// apps/web/test/api-integration.check.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root, configFile: false, envFile: false, appType: 'custom',
  server: { middlewareMode: true, watch: null, hmr: false },
});
try {
  const { validateProductFile, PRODUCT_FILE_ACCEPT } = await server.ssrLoadModule('/src/lib/attachments.ts');
  assert.equal(typeof validateProductFile, 'function');
  for (const [extension, type] of [
    ['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'],
    ['gif', 'image/gif'], ['webp', 'image/webp'], ['pdf', 'application/pdf'],
  ]) {
    assert.doesNotThrow(() => validateProductFile({ name: `a.${extension}`, type, size: 10 * 1024 * 1024 }));
  }
  assert.doesNotThrow(() => validateProductFile({ name: 'a.PDF', type: 'application/pdf', size: 1 }));
  for (const file of [
    { name: 'a.svg', type: 'image/svg+xml', size: 1 },
    { name: 'a.png', type: 'application/pdf', size: 1 },
    { name: 'a.pdf', type: 'application/pdf', size: 0 },
    { name: 'a.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 },
  ]) assert.throws(() => validateProductFile(file));
  assert.ok(!PRODUCT_FILE_ACCEPT.includes('image/*'));
  console.log('PASS file contract');
} finally {
  await server.close();
}
```

- [ ] **Step 2 — Chạy red.**

```powershell
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
```

Đợi lỗi thiếu export validator, không phải lỗi dependency/config. Script không gọi network API thật hoặc đọc env người dùng vì `envFile:false`.

- [ ] **Step 3 — Thêm validation tối thiểu trong module attachment hiện có.**

```ts
export const PRODUCT_FILE_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.pdf";
const fileTypes: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", pdf: "application/pdf",
};

export function validateProductFile(file: Pick<File, "name" | "type" | "size">): void {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!fileTypes[extension] || fileTypes[extension] !== file.type.toLowerCase() || file.size < 1) {
    throw new Error("Chỉ nhận PNG, JPEG, GIF, WebP hoặc PDF đúng định dạng.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("Mỗi tệp tối đa 10 MiB.");
}
```

BE vẫn kiểm chữ ký tệp và quyền. Không thêm đọc magic bytes phía FE hoặc import module Nest vào browser.

- [ ] **Step 4 — Kiểm tra toàn bộ file trước request ghi đầu tiên.** Trong `save` editor, sau guard busy và trước POST/PUT, dùng:

```ts
const selectedFiles = Array.from(files ?? []);
for (const file of selectedFiles) validateProductFile(file);
```

Đổi loop upload dùng `selectedFiles`; input dùng `accept={PRODUCT_FILE_ACCEPT}`. Đổi copy và số đo từ `MB` sang `MiB`. Giữ chuỗi create/update → lấy ID → upload từng file; không `Promise.all` uploads. Thêm `if (busy) return` sau `event?.preventDefault()`.

- [ ] **Step 5 — Giữ phần đã lưu và phân biệt lỗi xác định với kết quả chưa rõ.**

Giữ `existingId = productId ?? product?.id`, `setProduct(data)` ngay sau POST/PUT và chỉ thêm `fileKey` vào `uploadedFiles` khi response upload thành công. Hiện phần đã lưu trong editor:

```tsx
{product && <section aria-label="Tệp đã lưu">
  <p>Hồ sơ đã lưu: {product.id}</p>
  <ul>{product.attachments.map((file) => <li key={file.id}>
    <AttachmentLink path={attachmentUrl(product.id, file.id)} name={file.fileName} />
  </li>)}</ul>
</section>}
```

Với lỗi HTTP 4xx của một file: hiện lỗi, giữ ID/tệp đã thành công và danh sách còn chọn để người dùng sửa/thử lại. Với lỗi network hoặc 5xx, không biết chắc server đã ghi chưa: bỏ danh sách file chờ, đọc lại metadata, yêu cầu người dùng kiểm tra trước khi chọn lại. Trong catch riêng quanh request upload:

```ts
if (!(cause instanceof ApiError) || cause.status >= 500) {
  setFiles(null);
  try {
    const { data: latest } = await api<Product>(`/my/products/${encodeURIComponent(targetId)}`);
    setProduct(latest);
  } catch (refreshCause) {
    throw new Error(`Chưa xác nhận tải tệp ${file.name}; chưa tải lại được hồ sơ. ${messageOf(refreshCause)} Hãy mở hồ sơ kiểm tra trước khi chọn lại tệp.`);
  }
  throw new Error(`Chưa xác nhận tải tệp ${file.name}. Đã tải lại danh sách tệp đã lưu; hãy kiểm tra trước khi chọn lại tệp.`);
}
throw cause;
```

Import `ApiError` từ client hiện có. Không đánh dấu upload thành công chỉ vì server có tệp trùng tên. Dùng input file uncontrolled và thêm `useRef` vào import React:

```tsx
// Trong ProductEditorPage:
const fileInput = useRef<HTMLInputElement>(null);

// Input upload:
<Input ref={fileInput} type="file" accept={PRODUCT_FILE_ACCEPT} multiple
  disabled={busy} onChange={(event) => setFiles(event.target.files)} />

// Ngay sau setFiles(null) ở nhánh chưa rõ kết quả:
if (fileInput.current) fileInput.current.value = "";
```

Component `Input` hiện đã dùng `forwardRef<HTMLInputElement, InputProps>`; tái sử dụng, không thêm wrapper ref. Chỉ ghi comment giới hạn cho dedup nếu cần: `// shortcut: deduplicate confirmed uploads in this mounted editor; server content identity is unavailable.`

- [ ] **Step 6 — Chạy green và tái hiện lỗi một phần trên browser.**

```powershell
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/web typecheck
```

Case cụ thể: chọn ảnh hợp lệ và PDF giả có extension/MIME đúng nhưng nội dung không phải PDF. File đầu thành công, file sau bị BE trả 415; thử lại không tạo POST product mới và không upload lại ảnh đầu. Với Network Offline khi upload: không tự retry, giữ thông tin hồ sơ, tải lại metadata khi mạng trở lại và cho người dùng kiểm tra trước khi chọn lại. Sau reload không hứa dedup nội dung xuyên phiên.

- [ ] **Step 7 — Checkpoint đúng hunk.** `attachments.ts`, script mới và hunk editor của task này; không gom thay đổi FE của người dùng.

## Task 6: Trạng thái danh sách/chi tiết và chặn mutation lặp

**Files:** Modify `apps/web/src/pages/RegistrantPages.tsx`, các hàm `MyProductsPage`, `MyProductDetailPage`; không tạo hook pending hoặc state machine dùng chung.

**Interfaces:** Giữ GET/list/detail và POST submit/DELETE hiện có. Produces UI phân biệt loading/error/empty và tối đa một mutation đang xử lý trong mỗi màn hình.

- [ ] **Step 1 — Tái hiện lỗi empty bằng Request blocking.** Đăng nhập REGISTRANT, chặn đúng GET `/api/my/products`, reload list. Trước sửa, màn hình hiện cả lỗi và “Chưa có hồ sơ”. Chụp trạng thái và ghi request bị chặn.

- [ ] **Step 2 — Sửa refresh và điều kiện render tại list.**

```ts
const refresh = async () => {
  setLoading(true); setError("");
  try { const { data } = await api<Product[]>("/my/products"); setProducts(data); }
  catch (cause) { setError(messageOf(cause)); }
  finally { setLoading(false); }
};
```

```tsx
{error && <div role="alert"><p>{error}</p>
  <Button type="button" disabled={loading} onClick={() => void refresh()}>Thử lại</Button>
</div>}
{!loading && !error && !products.length && <div className="empty-state">
  <h2>Chưa có hồ sơ</h2>
  <p>Tạo bản nháp để bắt đầu đăng ký sản phẩm.</p>
  <Link className="button button-primary" to="/my/products/new">Tạo hồ sơ</Link>
</div>}
```

Record list chỉ render khi `!loading && !error` để dữ liệu từ request cũ không bị trình bày như kết quả mới sau lỗi.

- [ ] **Step 3 — Thêm busy tại list và detail, giữ xác nhận hiện tại.** Mỗi component có `const [busy,setBusy]=useState(false)`. Các handler submit/remove/removeAttachment theo mẫu:

```ts
async function submit() {
  if (busy) return;
  setBusy(true); setError("");
  try {
    const { data } = await api<Product>(`/my/products/${productId}/submit`, { method: "POST" });
    setProduct(data);
  } catch (cause) { setError(messageOf(cause)); }
  finally { setBusy(false); }
}
```

Tại list, giữ `id` argument và `setProducts(rows => rows.map(...))`; tại delete giữ filter sau response thành công. Mọi nút ghi liên quan có `disabled={busy}`. Không dùng optimistic success, timer hoặc auto retry. Detail hiện đã có `useApi`; lấy thêm `reload` và đặt nút “Tải lại hồ sơ” khi mutation lỗi, để người dùng xử lý 409/tab cũ mà không gửi lặp.

- [ ] **Step 4 — Kiểm tra green trên browser rồi typecheck.**

Khi request list lỗi, chạy trong DevTools Console:

```js
console.assert(document.querySelector('[role="alert"]'), 'Phải có lỗi');
console.assert(!document.body.innerText.includes('Chưa có hồ sơ'), 'Không được coi lỗi là empty');
```

Bỏ blocking và bấm “Thử lại”: GET thành công, state đúng. Với Network Slow 3G, click nhanh nút nộp/xóa hai lần: Network chỉ có một mutation, nút bị disable trong lúc chờ. Trả 409 từ tab cũ: không báo thành công; tải lại hiển thị trạng thái BE.

```powershell
pnpm --filter @ocop/web typecheck
```

Checkpoint riêng các hunk list/detail.

## Task 7: Khóa contract auth, session và status code bằng test hiện có

**Files:** Modify `apps/web/test/api-integration.check.mjs`, `apps/api/src/services/auth.service.spec.ts`, `apps/api/test/auth.db-spec.ts`, `apps/api/src/utils/scoring.spec.ts`. Read `lib/api.ts`, `lib/auth.ts`, `pages/AuthPages.tsx`, auth/admin controllers. Chỉ sửa production client/page nếu check dưới đây thất bại vì logic ứng dụng.

**Interfaces:** Giữ exact message `Current password is incorrect` và mọi đường dẫn hiện tại. Change-password/admin reset-password thành công là 201; OTP reset-password là 200. Script check FE giả lập fetch/storage, không gửi mail hoặc gọi API thật.

- [ ] **Step 1 — Bổ sung check client thật vào trong `try` của script task 5.** Đặt sau check file, giữ một Vite server và `finally` đóng server. Thêm khối sau:

```js
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const previousFetch = globalThis.fetch;
const storage = new Map();
const redirects = [];
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  location: { replace: (url) => redirects.push(url) },
} });
try {
  const { api, apiBlob } = await server.ssrLoadModule('/src/lib/api.ts');
  const { getSession, setSession } = await server.ssrLoadModule('/src/lib/auth.ts');
  const session = { accessToken: 'test-token', user: {
    id: 'user-1', email: 'a@example.invalid', fullName: 'A', phone: null,
    role: 'REGISTRANT', verified: true,
  } };
  setSession(session);
  const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
  globalThis.fetch = async (_url, init) => {
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer test-token');
    return Response.json({ statusCode: 200, data: [{ id: 'p1' }], meta });
  };
  assert.deepEqual(await api('/products'), { data: [{ id: 'p1' }], meta });
  globalThis.fetch = async () => Response.json({ statusCode: 201, data: { id: 'p1' } }, { status: 201 });
  assert.deepEqual(await api('/my/products', { method: 'POST', body: '{}' }), { data: { id: 'p1' } });
  globalThis.fetch = async (_url, init) => {
    assert.ok(init.body instanceof FormData);
    assert.equal(new Headers(init.headers).get('Content-Type'), null);
    return Response.json({ data: { id: 'file-1' } }, { status: 201 });
  };
  const form = new FormData(); form.append('file', new Blob(['x']), 'x.pdf');
  await api('/my/products/p1/attachments', { method: 'POST', body: form });
  globalThis.fetch = async () => new Response(new Blob(['binary']));
  assert.equal(await (await apiBlob('/my/products/p1/attachments/f1')).text(), 'binary');
  globalThis.fetch = async () => Response.json({ message: 'Current password is incorrect' }, { status: 401 });
  await assert.rejects(api('/auth/change-password', { method: 'POST' }), { status: 401 });
  assert.ok(getSession()); assert.equal(redirects.length, 0);
  globalThis.fetch = async () => Response.json({ message: 'Authentication required' }, { status: 401 });
  await assert.rejects(api('/auth/me'), { status: 401 });
  assert.equal(getSession(), null);
  assert.equal(storage.has('ocop-session'), false);
  assert.deepEqual(redirects, ['/login']);
  console.log('PASS client: envelope, 201, multipart, blob, 401 session rules');
} finally {
  globalThis.fetch = previousFetch;
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
  else delete globalThis.window;
}
```

Nếu module auth đã được load trước khi tạo window, `setSession(session)` vẫn khởi tạo session cho check; không cần reset/import wrapper mới. Không test bằng cách copy implementation của `request` vào script.

- [ ] **Step 2 — Chạy check auth không DB.**

```powershell
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/api test --runInBand --runTestsByPath src/services/auth.service.spec.ts src/utils/scoring.spec.ts
```

Nếu đã pass, giữ production auth/client. Trong test `rejects a password change when the current password is wrong`, pin thêm message dùng lại cùng promise:

```ts
const attempt = service.changePassword('user-1', 'wrong', 'NewPassword2!');
await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
await expect(attempt).rejects.toThrow('Current password is incorrect');
expect(repository.changePassword).not.toHaveBeenCalled();
```

Trong `scoring.spec.ts`, thêm `[89.99, 4]` vào bảng `it.each` đang có. Không sửa hàm tính điểm.

- [ ] **Step 3 — Chạy red DB test trước khi sửa expectation, chỉ với DB test đủ điều kiện.**

```powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/auth.db-spec.ts
```

Nếu đủ prerequisites, hai case change-password/admin reset hiện fail `Expected: 200, Received: 201`. Thiếu DB test thì ghi `BLOCKED`; không cố chạy trên `DATABASE_URL` hoặc claim red đã tái hiện.

- [ ] **Step 4 — Chỉ đổi hai assertion status bị sai, giữ kiểm tra tokenVersion.**

```ts
// Test current-password change, sau POST /auth/change-password:
expect(changed.status).toBe(201);

// Test admin reset judge, sau POST /admin/judges/:id/reset-password:
expect(reset.status).toBe(201);
```

Giữ `expect(reset.status).toBe(200)` ở case POST `/auth/reset-password`. Không thay hàng loạt mọi `toBe(200)`, không thêm `@HttpCode(200)` vào controller để chiều test.

- [ ] **Step 5 — Chạy green và kiểm tra auth UI.** Chạy lại hai lệnh không DB của step 2 và DB test step 3 khi có môi trường. Trên browser xác nhận: register SMTP lỗi vẫn có link verify/resend, email chờ còn trong sessionStorage; sai current password không logout; đổi thành công logout; token cũ từ tab khác bị BE từ chối. Không cố gây SMTP lỗi trên account thật; dùng test harness/môi trường nghiệm thu.

Checkpoint chỉ script/test và hunk production thực sự có lỗi nếu đã chứng minh.

## Task 8: Regression toàn luồng, tài liệu và bàn giao bằng chứng

**Files:** Modify `apps/web/README.md`; Create `docs/verification/2026-10-16-fe-be-integration.md`. Read ma trận spec mục 12 và các DB suites hiện có; không tạo một hệ thống E2E mới.

**Interfaces:** Consumes tasks 1–7; produces kết quả theo case `PASS/FAIL/BLOCKED`, lệnh/exit code/môi trường và giới hạn còn lại. Không coi SMTP mocked là mail thật.

- [ ] **Step 1 — Chạy tất cả gates phần mềm trên code cuối.**

```powershell
pnpm --filter @ocop/web exec node test/proxy.check.mjs
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm typecheck
pnpm build
pnpm --filter @ocop/api test --runInBand
```

API build phải chạy trước full DB suite: OpenAPI suite đọc output `dist/src`. Nếu generate router làm đổi file sinh, review vì sao trước khi giữ diff; không sửa tay route tree. Không lặp lại suite đã pass nếu không có thay đổi/failure mới.

- [ ] **Step 2 — Chạy DB suites hiện có trên DB riêng.**

```powershell
pnpm --filter @ocop/api test:db
```

`backend.db-spec.ts` đã bao phủ hành trình register → submit → hai judge → public, ownership và private files. `evaluation.db-spec.ts` đã bao phủ full/partial scopes và bất biến; `assignment.db-spec.ts` đã bao phủ coverage, nháp, completed và concurrency. `auth`, `seed`, `openapi` có suite riêng. Sửa failure đúng root cause theo spec; không xóa assertion, bỏ test hoặc nới safety guard để đạt xanh.

- [ ] **Step 3 — Chạy smoke qua FE proxy khi môi trường ứng dụng đã sẵn sàng.** Chạy `pnpm dev` trong terminal phục vụ riêng, rồi ở terminal thứ hai:

```powershell
Invoke-RestMethod http://localhost:3030/api/system/health/live
Invoke-RestMethod http://localhost:3030/api/system/health/ready
Invoke-RestMethod http://localhost:5173/api/categories
```

`ready` không xác nhận seed; categories phải có đủ dữ liệu. Nếu DB thiếu schema, dừng riêng smoke DB và ghi trạng thái; chỉ chạy migrate/seed khi database thử hoặc kế hoạch dữ liệu đã được xác định. Không tự deploy lên hệ thống thật.

- [ ] **Step 4 — Nghiệm thu browser theo nhóm, dùng case ID của spec.**

| Nhóm/case | Bước thực hiện bổ sung ngoài tasks trước | Bằng chứng cần có |
|---|---|---|
| ENV-01, PUB-01/02 | Danh mục qua proxy; tìm từ khóa có kết quả ngoài trang đầu; đổi lọc về trang 1; thử public draft/PDF. | Request/query/meta và response không có formData/evidence. |
| AUTH-01..04 | OTP thật đến hộp thư nghiệm thu, verify/login; mã sai/hết hạn; sai role/expired/revoked token; logout. | Vai trò, redirect và storage đã xóa khi cần; che token/OTP/password. |
| REG-01/02, FILE-01/02 | Draft còn thiếu, sửa một field/reload, nộp thiếu/đủ; upload partial/network; account khác/judge ngoài scope tải private file. | Không mất field, không tạo hồ sơ trùng, không lộ tệp. |
| ADM-01/02 | Tạo/sửa/reset/deactivate judge; giữ hai nhóm phân công, sửa một nhóm rồi save. | PUT assignments vẫn chứa nhóm còn lại; không mất lịch sử judge. |
| JDG-01/02 | Mở/lưu/reload; PUT thành công nhưng POST submit lỗi; nộp đủ rồi thử sửa/nộp lặp. | Nháp còn sau lỗi POST; đủ khóa; 409 không báo thành công. |
| SCORE-01/02 | Hai judge full scope, rồi sản phẩm khác chia tiêu chí; chờ đủ mới completed; đổi phân công sau completed. | Admin/my/public cùng kết quả BE; test unit có 89.99→4 và 90→5. |
| UI-01 | Slow network, 0 records, 5xx/offline rồi retry. | Loading/empty/error phân biệt, không tự retry mutation. |
| DEPLOY-01 | Trên môi trường preview có reverse proxy, mở trực tiếp URL con/reload; upload rồi restart API. | SPA fallback và private persistent storage hoạt động; thiếu môi trường ghi BLOCKED. |

Tại ADM-02, quan sát payload thực, không chỉ nhìn UI. Tại JDG-02, dùng Request blocking riêng endpoint submit sau khi PUT đã thành công; không ngắt toàn bộ API. Khi một case fail, ghi trigger/expected/actual và sửa hẹp ở component/controller hiện có; không thay đặc tả để hợp lỗi.

- [ ] **Step 5 — Cập nhật web README bằng thông tin đã kiểm chứng.** Thay hai đoạn mô tả sai bằng nội dung:

```markdown
Authenticated requests use Bearer tokens stored in localStorage under `ocop-session`. The session persists across browser restarts until cleared or rejected by the API. JSON responses use `{ statusCode, data, meta?, message? }`; errors use `{ statusCode, message, requestId? }`. File downloads return binary data.

Product search sends `q` to the API and searches across the matching database records, with server-side pagination. `VITE_API_URL` controls the browser base URL; the dev proxy reads `VITE_API_PROXY` from process variables or Vite env files and defaults to `http://localhost:3030`.
```

Giữ mô tả Mẫu 01/ảnh và evidence tùy chọn. Bổ sung link từ web README tới `../../docs/verification/2026-10-16-fe-be-integration.md`; bỏ câu “No build or runtime verification is recorded” sau khi report có kết quả thật. Không copy nguyên spec vào README.

- [ ] **Step 6 — Ghi report với kết quả thực tế và review diff cuối.** Report ghi ngày, commit/working tree, Node/pnpm, các lệnh và exit code, case ID, trạng thái, bằng chứng, blocker. Không ghi nội dung env. Các task viết code/test có thể hoàn thành trong khi một số case DB/SMTP/deploy vẫn `BLOCKED`; khi đó không tuyên bố nghiệm thu toàn hệ thống.

```powershell
git diff --check
git status --short
git diff -- apps/web/vite.config.ts apps/web/src/types apps/web/src/pages/RegistrantPages.tsx apps/web/src/lib/attachments.ts apps/api/test/auth.db-spec.ts apps/api/src/services/auth.service.spec.ts apps/api/src/utils/scoring.spec.ts apps/web/README.md
```

Review cả file mới chưa tracked bằng đọc trực tiếp. Nếu tạo checkpoint, stage từng hunk thuộc task; kiểm tra `git diff --cached` trước commit. Không commit thay đổi người dùng chỉ vì cùng file. Không push, merge hoặc deploy trong task này.

## Đối chiếu phạm vi spec

| Spec | Task chịu trách nhiệm |
|---|---|
| 1–2: hiện trạng, giữ stack/phạm vi | Global Constraints, task 1 và mọi checkpoint. |
| 3: môi trường, proxy, an toàn DB | Tasks 1–2, smoke/deploy checks task 8. |
| 4: envelope, multipart, lỗi, pagination | Client regression task 7; browser/API gates task 8. |
| 5: auth/session/OTP | Task 7 và AUTH-01..04 task 8. |
| 6: public/search/privacy | PUB-01/02 task 8, README task 8. |
| 7: draft/detail/payload/upload | Tasks 3–6; REG/FILE task 8. |
| 8: judge/submit/kết quả | Type task 3; JDG/SCORE và DB suites task 8. |
| 9: admin/replace assignments | ADM-01/02 và assignment suite task 8. |
| 10: danh sách sai lệch cần sửa | Tasks 2–7 và README task 8. |
| 11–12: thứ tự, gates và bằng chứng | Task order, task 8 và verification report. |

## Điều kiện bàn giao

1. Các bản sửa xác định trong plan có kiểm chứng tương ứng; không còn fixture type fail do contract sai.
2. Check proxy/client/file, typecheck/build/unit pass với kết quả mới; DB/browser/SMTP/deploy có trạng thái rõ từng case.
3. Không có thay đổi schema, secret hoặc dữ liệu ngoài môi trường nghiệm thu đã xác định.
4. Báo đúng phần hoàn thành và phần bị chặn; không ghi “đã ghép xong” nếu hành trình runtime chưa được nghiệm thu.

Ưu tiên thực thi trực tiếp trong chat theo từng task vì tasks 4–6 cùng sửa `RegistrantPages.tsx`. Nếu chọn subagent, ba task đó vẫn phải tuần tự và mỗi task có review trước task tiếp theo.
