# OCOP Web API and Constants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay các mẫu API/constants của dự án khác bằng Axios client và hàm nghiệp vụ OCOP dùng chung, chuyển toàn bộ caller hiện tại sang cấu trúc đó mà giữ hành vi ứng dụng.

**Architecture:** Một Axios instance tại `src/api/base-request.ts` xử lý transport, Bearer và lỗi; các module nghiệp vụ trả `Promise<ApiResult<T>>` hoặc `Promise<Blob>`. Hooks và page gọi hàm nghiệp vụ, không biết endpoint/HTTP options. Giữ Zustand session store và TanStack Query hiện có; constants chỉ chứa giá trị dùng chung thực sự.

**Tech Stack:** Node.js `>=24.7 <25`, pnpm `11.17.0`, React 19, Vite 8, TypeScript, TanStack Router/Query, Zustand; thêm Axios làm dependency runtime duy nhất của đợt sửa này. Dùng Node assert và Vite SSR harness hiện có, không thêm test framework.

**Spec:** [Quy ước frontend](../../../apps/web/README.md#frontend-api-and-constants-convention), [contract tích hợp FE–BE](../specs/2026-10-15-fe-be-api-integration.md), và yêu cầu ngày 22/10/2026: sửa `api/`, `constants/` cho phù hợp OCOP, dùng chung thay vì gọi HTTP trong component.

## Global Constraints

- API prefix `/api`; roles `REGISTRANT`, `JUDGE`, `ADMIN`.
- Giữ `VITE_API_URL` mặc định `/api`, `VITE_API_PROXY` mặc định `http://localhost:3030`; không dùng `VITE_API_BASE_URL` hoặc `/api/v1` từ mẫu.
- Session hiện tại là JSON `{ accessToken, user }` trong `localStorage['ocop-session']`; giữ nguyên để người dùng không bị đăng xuất sau nâng cấp. `sessionStorage['ocop.pendingEmail']` tiếp tục phục vụ OTP.
- Không thêm refresh token, CSRF-token storage, cookie auth, logout endpoint hoặc gọi `/auth/refresh`. Không import router vào transport.
- Giữ envelope `{statusCode,data,meta?,message?}`; lỗi `{statusCode,message,requestId?}`; binary không bọc JSON.
- `ApiResult<T>` của FE tiếp tục là `{ data: T, meta? }`. Không đổi sang union `ApiResult` của shared; không unwrap hai lần hoặc tự bịa pagination metadata.
- Lỗi HTTP tiếp tục là cùng một constructor `ApiError` có `status: number`; lỗi mạng không được biến thành HTTP success hay `ApiError` có status 4xx.
- `401` với session đang dùng: xóa session, clear query cache qua subscription đang có, chuyển `/login`. Ngoại lệ duy nhất: endpoint `/auth/change-password` trả message chính xác `Current password is incorrect` thì giữ session.
- `403`, `409`, `413`, `415`, `429`, `5xx` không tự xóa session. Không tự retry mutation hoặc upload; query giữ chính sách không retry 4xx, retry network/5xx tối đa một lần.
- Upload một field `file` mỗi request, PNG/JPEG/GIF/WebP/PDF, tối đa `10 * 1024 * 1024` byte/tệp. Giữ `validateProductFile`, xử lý upload lỗi không rõ đã ghi hay chưa, và giải phóng object URL.
- `PUT formData`, `PUT scores`, `PUT assignments` thay toàn bộ dữ liệu tương ứng. Giữ xác nhận trước nộp/xóa/thay phân công và trạng thái chỉ đọc sau nộp.
- Không sửa BE, schema, database, seed, routes, JSX giao diện hoặc triển khai 7 phân hệ admin mới. Chỉ thay nơi sở hữu request/constants và các import/caller liên quan.
- Working tree đã có nhiều thay đổi và đổi `apps/api` sang `apps/be`; giữ nguyên chúng. Không reset, checkout khôi phục hoặc stage toàn bộ workspace.
- Các đoạn code dưới đây là nội dung dự kiến để triển khai, chưa được ghi vào source. Tác vụ hiện tại chỉ lập kế hoạch.

---

## 1. Hiện trạng đã đối chiếu

| Nơi | Thực trạng và quyết định |
|---|---|
| `src/api/base-request.ts` | Mẫu dùng `/api/v1`, refresh/CSRF/storage/types chưa có; thay bằng transport OCOP. |
| `src/api/system.ts`, `src/api/index.ts` | Mẫu task/organization/program/user của domain khác, nhiều export không tồn tại; bỏ các API này, không tạo module giả cho hết lỗi. |
| `src/lib/api.ts` | Fetch client thật; chứa cả `ApiError`, `messageOf`, `errorText`. Tách helper lỗi rồi xóa transport cũ khi hết caller. |
| `src/constants/api.ts` | Đã là endpoint OCOP và có encode path segment; tái sử dụng, giữ public image URL builder. |
| `src/constants/auth.ts` | Các key `auth_user`, `auth_access_token`, `auth_token`, `auth_refresh_token` không phải session OCOP; thay bằng hai key đang dùng. |
| `src/constants/query-key.ts` | Giữ cây key OCOP; bỏ `USERS_KEY`, task/department/program keys và `queryKeys.admin.users` chưa có caller. Chuyển type params sang `src/types/public.ts`. |
| `src/constants/consts.ts` | Mẫu default 10, page sizes, sizes, date formats và `ALL` chưa được dùng. Chỉ giữ `DEFAULT_PAGE_SIZE = 20` dùng bởi catalog/admin; homepage vẫn limit 6. |
| `src/constants/http-status.ts` | Đã có `HTTP_STATUS`, `isClientError`; dùng lại cho interceptor/retry, không tạo enum thứ hai. |
| `src/queries/*.ts` | Đã có query hook nhưng vẫn gọi generic client; chuyển queryFn sang hàm nghiệp vụ và giữ query keys/staleTime/gcTime. |
| Các page auth/admin/judge/registrant | Mutation, một số initial fetch và download vẫn tự ghép endpoint/HTTP options; phải chuyển hết, không chỉ đổi query hook. |
| `src/lib/attachments.ts` | Đang nhận path rồi tự tải blob; đổi sang nhận blob đã được domain API tải, giữ chức năng mở/tải file. |

Baseline kiểm tra ngày 22/10/2026:

- `pnpm --filter @ocop/web typecheck`: **FAIL**, thiếu `axios`, `./storage`, `./types`, `@/types/error`, domain types và barrel exports của mẫu.
- `pnpm --filter @ocop/web exec node test/api-integration.check.mjs`: **FAIL trước assertions**, Vite SSR đánh giá CommonJS React và báo `ReferenceError: module is not defined`. Sửa externalization của harness trong Task 1; không ghi PASS khi chưa chạy lại.
- Chưa chạy build, browser, DB hoặc SMTP trong tác vụ lập kế hoạch.

## 2. Bản đồ file và trách nhiệm

Đường dẫn tính từ repository root. Không tạo `api/storage.ts`, `api/types.ts`, generic CRUD factory hoặc service registry.

| File | Thao tác / trách nhiệm |
|---|---|
| `apps/web/src/constants/{api,auth,query-key,consts,http-status}.ts` | Sửa constants OCOP; `http-status.ts` tái sử dụng nguyên nếu không cần đổi. |
| `apps/web/src/lib/api-error.ts` | Tạo, sở hữu `ApiError`, `messageOf`, `errorText`; không import transport/store. |
| `apps/web/src/api/base-request.ts` | Thay mẫu; Axios instance, normalized HTTP errors, `requestJson`, `requestBlob`. |
| `apps/web/src/api/{auth,products,my-products,judge,admin}.ts` | Tạo 5 module đúng các route BE đã có; endpoint constants và serialization chỉ ở đây/transport. |
| `apps/web/src/api/index.ts` | Thay barrel mẫu bằng named exports 5 domain API, không export storage/refresh/generic client. |
| `apps/web/src/api/system.ts` | Xóa domain task/system mẫu, không đụng health controller BE. |
| `apps/web/src/types/{api,auth,public,product,registrant,judge,admin}.ts` | Tái sử dụng response types; thêm các input types và params được nêu ở Task 3. |
| `apps/web/src/stores/session-store.ts` | Import session key từ constants; giữ read/validate/write, storage listener và public exports hiện tại. |
| `apps/web/src/queries/{common,admin,judge,registrant}.ts` | Chỉ gọi domain API, import query keys trực tiếp. |
| `apps/web/src/pages/{AuthPages,AdminPages,JudgePages,RegistrantPages,PublicPages}.tsx`, `apps/web/src/App.tsx` | Chuyển caller/import, giữ form state, bảo vệ thao tác, cache updates và render. |
| `apps/web/src/lib/{attachments,query-client}.ts` | Blob-only helper, error import mới; giữ retry và session cache clearing. |
| `apps/web/src/lib/api.ts` | Xóa sau khi hết caller ở Task 5; không giữ compatibility wrapper lâu dài. |
| `apps/web/test/api-integration.check.mjs` | Giữ file/password/form tests; chuyển fetch mock thành Axios adapter assertions. |
| `apps/web/test/api-boundary.check.mjs` | Tạo một check nhỏ khóa ranh giới UI/query/helper với transport. |
| `apps/web/package.json`, `pnpm-lock.yaml` | Chỉ thêm Axios; không sửa version dependency khác. |
| `apps/web/README.md`, `README.md`, `docs/verification/2026-10-22-web-api-constants.md` | Cập nhật trạng thái thật và kết quả kiểm tra sau triển khai. |

Thứ tự bắt buộc: **1 → 2 → 3 → 4 → 5 → 6**. Fetch cũ chỉ tồn tại trong các checkpoint chuyển tiếp 1–4; không thêm wrapper chuyển `RequestInit` sang Axios và không đổi đồng thời toàn bộ UI state.

### Task 1: Chuẩn hóa constants, tách lỗi và sửa harness hiện có

**Files:** Modify `constants/{auth,consts,query-key}.ts`, `types/public.ts`, `stores/session-store.ts`, `pages/AuthPages.tsx`, `pages/PublicPages.tsx`, `queries/{common,admin}.ts`, `lib/api.ts`, `test/api-integration.check.mjs`; Create `lib/api-error.ts`.

**Interfaces:**
- Consumes: session store và HTTP client hiện tại.
- Produces: `SESSION_STORAGE_KEY`, `PENDING_EMAIL_STORAGE_KEY`, `DEFAULT_PAGE_SIZE`; `PublicProductParams`; một `ApiError(message: string, status: number)`, `messageOf(error: unknown): string`, `errorText(error: unknown): string`.

- [x] **Step 1 — Khôi phục chạy harness trước khi thêm regression assertions.** Trong `createServer` của `api-integration.check.mjs`, externalize dependency CommonJS bằng cấu hình sau; chạy lại để phân biệt lỗi runner với lỗi contract. Mọi mock window/storage phải có trước lần đầu load session store.

```js
ssr: { external: [
  'react', 'react-dom', 'zustand', 'zustand/vanilla', '@tanstack/react-query',
] },
```

Đưa phần tạo mock `window`/storage hiện có lên trước lần đầu `ssrLoadModule('/src/lib/attachments.ts')`; restore trong `finally` ngoài cùng, sau khi mọi assertion hoàn tất. Nếu store đã được load trước mock, không tạo store mới để che lỗi thứ tự import.

Run: `pnpm --filter @ocop/web exec node test/api-integration.check.mjs`.
Expected: runner vượt qua import React; các assertions hiện có chạy được. Nếu vẫn lỗi dependency resolution, sửa đúng externalization của module được stack chỉ ra; không tắt assertions hay đổi React/version lockfile.

- [x] **Step 2 — Thêm assertions fail cho constants mới vào cùng harness.**

```js
const authConstants = await server.ssrLoadModule('/src/constants/auth.ts');
const { DEFAULT_PAGE_SIZE } = await server.ssrLoadModule('/src/constants/consts.ts');
assert.equal(authConstants.SESSION_STORAGE_KEY, 'ocop-session');
assert.equal(authConstants.PENDING_EMAIL_STORAGE_KEY, 'ocop.pendingEmail');
assert.equal(DEFAULT_PAGE_SIZE, 20);
assert.deepEqual(Object.keys(authConstants).sort(), [
  'PENDING_EMAIL_STORAGE_KEY', 'SESSION_STORAGE_KEY',
]);
```

Run cùng command. Expected: FAIL vì exports chưa tồn tại hoặc giá trị chưa đúng.

- [x] **Step 3 — Ghi constants, chuyển caller, giữ đúng dữ liệu cũ.**

```ts
// constants/auth.ts
export const SESSION_STORAGE_KEY = "ocop-session";
export const PENDING_EMAIL_STORAGE_KEY = "ocop.pendingEmail";

// constants/consts.ts
export const DEFAULT_PAGE_SIZE = 20;

// types/public.ts: thêm, giữ nguyên PublicProduct/FeaturedProduct
export interface PublicProductParams {
  page: number;
  limit: number;
  categoryId?: string;
  q?: string;
}
```

Trong session store, thay declaration key bằng import và re-export key cũ nếu còn caller; không đổi logic JSON/storage. Ba helper `readPendingEmail`, `writePendingEmail`, `clearPendingEmail` ở `AuthPages.tsx` dùng `PENDING_EMAIL_STORAGE_KEY`, giữ `try/catch`. Catalog dùng `DEFAULT_PAGE_SIZE` cả request và fallback meta; admin query thay `ADMIN_PRODUCTS_PAGE_SIZE` bằng constant này. Không đổi homepage limit 6. Bỏ constants mẫu không có caller sau tìm kiếm toàn `apps/web/src`.

Trong `query-key.ts`, chỉ giữ `queryKeys` OCOP (bỏ `admin.users`) và import `PublicProductParams`; thay kiểu tham số của `publicProducts.list` bằng type đó. `queries/common.ts` import/re-export `PublicProductParams` từ `types/public.ts` để không làm hỏng consumer giữa các checkpoint.

- [x] **Step 4 — Di chuyển helper lỗi nguyên nội dung hiện tại, giữ cùng constructor.**

```ts
// lib/api-error.ts
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Có lỗi xảy ra. Vui lòng thử lại.";
}
export function errorText(error: unknown): string {
  return error ? messageOf(error) : "";
}
```

`lib/api.ts` tạm import `ApiError` để dùng nội bộ và re-export ba helper từ file mới, xóa các declaration cũ. Như vậy caller chưa chuyển vẫn dùng đúng `instanceof`. Đây là chuyển nơi sở hữu helper, không tạo error class thứ hai.

- [x] **Step 5 — Chạy harness lại, review diff theo đúng file.** Expected: PASS file/password/form/constants và client fetch hiện tại. Typecheck vẫn có thể fail do API mẫu; Task 2 phải xóa nguyên nhân đó. Checkpoint commit chỉ stage file Task 1 sau khi kiểm tra không lẫn thay đổi có trước; không commit cả file đang có thay đổi người dùng mà chưa tách được hunk.

### Task 2: Thay Axios transport mẫu bằng contract OCOP

**Files:** Modify `api/base-request.ts`, `package.json`, `pnpm-lock.yaml`, `test/api-integration.check.mjs`; Delete `api/system.ts`, barrel mẫu `api/index.ts` (Task 3 tạo lại với domain thật).

**Interfaces:**
- Consumes: `API_BASE`, `API.auth.changePassword`, `HTTP_STATUS`, `getSession/setSession`, `ApiError`, FE `ApiResult<T>`.
- Produces: default `baseRequest: AxiosInstance`; `requestJson<T>(config: AxiosRequestConfig): Promise<ApiResult<T>>`; `requestBlob(path: string): Promise<Blob>`.

- [x] **Step 1 — Thêm Axios vào riêng web và dùng nó trong harness.**

```powershell
pnpm --filter @ocop/web add axios
```

Giữ version được pnpm resolve trong manifest/lockfile; không chạy update toàn workspace. Thêm `'axios'` vào `ssr.external` của harness. Dùng `AxiosError` từ dependency này để mô phỏng HTTP failure, không giả định custom adapter tự áp dụng `validateStatus`.

- [x] **Step 2 — Thêm test cho transport mới trước khi thay mẫu.** Trong block đang mock window, load transport mới, lấy `AxiosError` bằng `await import('axios')` và dùng adapter sau. Giữ mock cho đến hết assertions, khôi phục adapter/window trong `finally`.

```js
const { default: baseRequest, requestJson, requestBlob } =
  await server.ssrLoadModule('/src/api/base-request.ts');
const { AxiosError } = await import('axios');
const originalAdapter = baseRequest.defaults.adapter;
function reply(status, data, inspect = () => {}) {
  baseRequest.defaults.adapter = async (config) => {
    inspect(config);
    const response = { status, statusText: String(status), data, headers: {}, config };
    if (status >= 400) throw new AxiosError('HTTP failure', undefined, config, null, response);
    return response;
  };
}
reply(201, { statusCode: 201, data: { id: 'p1' } }, (config) => {
  assert.equal(config.baseURL, '/api');
  assert.equal(config.headers.get('Authorization'), 'Bearer test-token');
});
assert.deepEqual(await requestJson({ url: '/my/products', method: 'POST', data: {} }),
  { data: { id: 'p1' } });
reply(200, { data: [{ id: 'p1' }], meta });
assert.deepEqual(await requestJson({ url: '/products' }), { data: [{ id: 'p1' }], meta });
reply(200, new Blob(['binary']), (config) => assert.equal(config.responseType, 'blob'));
assert.equal(await (await requestBlob('/my/products/p1/attachments/f1')).text(), 'binary');
reply(401, new Blob([JSON.stringify({ message: 'Authentication required' })]));
await assert.rejects(requestBlob('/my/products/p1/attachments/f1'), { status: 401 });
assert.equal(getSession(), null);
assert.equal(queryClient.getQueryData(queryKeys.myProducts.list), undefined);
```

Run: `pnpm --filter @ocop/web exec node test/api-integration.check.mjs`.
Expected: FAIL do mẫu không cung cấp interfaces hoặc import thiếu module. Tách nhóm fetch cũ và Axios mới: seed session/cache, reset `redirects.length = 0` trước mỗi nhóm, không để ca 401 trước làm ca sau chạy ẩn danh.

- [x] **Step 3 — Thay toàn bộ `base-request.ts` bằng implementation sau.** Bỏ module augmentation, refresh promise, CSRF và dynamic router import của mẫu.

```ts
import axios, { type AxiosRequestConfig } from "axios";
import { API, API_BASE } from "../constants/api";
import { HTTP_STATUS } from "../constants/http-status";
import { getSession, setSession } from "../stores/session-store";
import { ApiError } from "../lib/api-error";
import type { ApiResult } from "../types/api";

const baseRequest = axios.create({ baseURL: API_BASE });

baseRequest.interceptors.request.use((config) => {
  const token = getSession()?.accessToken;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  if (config.data instanceof FormData) config.headers.setContentType(false);
  return config;
});

baseRequest.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.response) return Promise.reject(error);
    const status = error.response.status;
    let body: unknown = error.response.data;
    if (body instanceof Blob) {
      body = await body.text().then((text) => {
        try { return JSON.parse(text) as unknown; } catch { return null; }
      }).catch(() => null);
    }
    const message = typeof body === "object" && body !== null &&
      "message" in body && typeof body.message === "string"
      ? body.message : `Request failed (${status})`;
    const session = getSession();
    const sentAuthorization = error.config?.headers.get("Authorization");
    const wrongPassword = error.config?.url === API.auth.changePassword &&
      message === "Current password is incorrect";
    if (status === HTTP_STATUS.UNAUTHORIZED && session &&
        sentAuthorization === `Bearer ${session.accessToken}` && !wrongPassword) {
      setSession(null);
      window.location.replace("/login");
    }
    return Promise.reject(new ApiError(message, status));
  },
);

export async function requestJson<T>(config: AxiosRequestConfig): Promise<ApiResult<T>> {
  const response = await baseRequest.request<unknown>(config);
  const body = response.data === "" ? null : response.data;
  if (typeof body === "object" && body !== null && "data" in body) {
    return { data: body.data as T,
      ...("meta" in body ? { meta: body.meta as ApiResult<T>["meta"] } : {}) };
  }
  return { data: body as T };
}
export async function requestBlob(path: string): Promise<Blob> {
  return (await baseRequest.get<Blob>(path, { responseType: "blob" })).data;
}
export default baseRequest;
```

Không đặt global JSON Content-Type hoặc `withCredentials: true`. Axios serialize object JSON; FormData giữ boundary do trình duyệt tạo. So sánh Bearer gửi đi với session hiện tại để một response cũ không xóa session vừa đăng nhập mới.

- [x] **Step 4 — Hoàn thiện ca biên trong cùng harness, không thêm test framework.** Thêm code sau trong nhóm Axios đã seed session; `form`, `session`, `meta`, `redirects` dùng các fixture nhỏ hiện có.

```js
reply(201, { data: { id: 'file-1' } }, (config) => {
  assert.ok(config.data instanceof FormData);
  assert.ok(!config.headers.getContentType());
});
await requestJson({ url: '/my/products/p1/attachments', method: 'POST', data: form });
for (const status of [403, 409, 413, 415, 429, 500]) {
  setSession(session);
  reply(status, { message: `failure-${status}` });
  await assert.rejects(requestJson({ url: '/my/products/p1' }),
    { status, message: `failure-${status}` });
  assert.ok(getSession());
}
setSession(session);
redirects.length = 0;
reply(401, { message: 'Current password is incorrect' });
await assert.rejects(requestJson({ url: '/auth/change-password', method: 'POST' }),
  { status: 401 });
assert.ok(getSession());
assert.equal(redirects.length, 0);
setSession(null);
reply(401, { message: 'Invalid credentials' });
await assert.rejects(requestJson({ url: '/auth/login', method: 'POST' }), { status: 401 });
assert.equal(redirects.length, 0);
baseRequest.defaults.adapter = async () => { throw new Error('Network Error'); };
await assert.rejects(requestJson({ url: '/my/products' }), (error) =>
  !(error instanceof ApiError) && error.message === 'Network Error');
```

Thêm các ca sau, import `ApiError` trong harness từ `lib/api-error.ts`:

```js
reply(204, '');
assert.deepEqual(await requestJson({ url: '/my/products/p1', method: 'DELETE' }), { data: null });
reply(500, '<html>proxy error</html>');
await assert.rejects(requestJson({ url: '/products' }),
  { status: 500, message: 'Request failed (500)' });
setSession(session);
queryClient.setQueryData(queryKeys.myProducts.list, [{ id: 'cached' }]);
redirects.length = 0;
reply(401, { message: 'Authentication required' });
await assert.rejects(requestJson({ url: '/auth/me' }), { status: 401 });
assert.equal(getSession(), null);
assert.equal(storage.has('ocop-session'), false);
assert.equal(queryClient.getQueryData(queryKeys.myProducts.list), undefined);
assert.deepEqual(redirects, ['/login']);
setSession(session);
redirects.length = 0;
reply(401, { message: 'Old token expired' }, () => {
  setSession({ ...session, accessToken: 'new-token' });
});
await assert.rejects(requestJson({ url: '/auth/me' }), { status: 401 });
assert.equal(getSession().accessToken, 'new-token');
assert.equal(redirects.length, 0);
const retry = queryClient.getDefaultOptions().queries.retry;
assert.equal(typeof retry, 'function');
assert.equal(retry(0, new ApiError('conflict', 409)), false);
assert.equal(retry(0, new ApiError('server', 500)), true);
assert.equal(retry(0, new Error('network')), true);
assert.equal(retry(1, new Error('network')), false);
```

- [x] **Step 5 — Xóa `api/system.ts`, barrel mẫu, chạy kiểm tra.**

```powershell
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
```

Expected: cả hai PASS; không còn module/import thiếu từ API mẫu. Nếu Axios đã resolve API/type khác đoạn dự kiến, chỉnh theo type của version đã khóa, không thêm `any` hoặc tắt strict. Checkpoint commit chỉ gồm transport, dependency và test changes của task.

### Task 3: Tạo hàm API cho đúng năm nhóm nghiệp vụ OCOP

**Files:** Create `api/{auth,products,my-products,judge,admin,index}.ts`; Modify `types/{auth,product,public,registrant,judge,admin}.ts`, `test/api-integration.check.mjs`.

**Interfaces:** Consumes `requestJson`, `requestBlob`, endpoint `API`; produces năm object API dưới đây. Mọi JSON function trả envelope FE để giảm thay đổi caller. Types input phải là payload gửi BE, không chứa `FormDataEntryValue`, UI-only fields hoặc relation response.

- [x] **Step 1 — Thêm request input types vào các file đang sở hữu domain.**

```ts
// types/auth.ts
export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { fullName: string; phone?: string }
export interface VerifyOtpInput { email: string; code: string }
export interface ResetPasswordInput extends VerifyOtpInput { newPassword: string }
export interface ChangePasswordInput { currentPassword: string; newPassword: string }
export interface MessageResponse { message: string }

// types/product.ts — thêm type import Criterion từ @ocop/shared
export type CategoryRecord = Category & {
  groupCode: string;
  classificationGroup: string;
  classificationSubgroup: string | null;
  criteriaSet?: { criteria: Criterion[] } | null;
};

// types/registrant.ts — ProductApplicationForm đã được import trong file
export interface ProductWriteInput {
  name: string;
  categoryId: string;
  description?: string | null;
  formData: Partial<ProductApplicationForm>;
}

// types/judge.ts — thêm type import EvaluationScore từ @ocop/shared
export interface SaveEvaluationInput { scores: EvaluationScore[] }
export interface SavedEvaluation {
  id: string;
  status: string;
  scores: EvaluationScore[];
}
export interface SubmittedEvaluation { id: string; status: string; total: number }

// types/admin.ts
export interface CreateJudgeInput {
  email: string; fullName: string; password: string; phone?: string;
}
export interface UpdateJudgeInput { fullName?: string; phone?: string | null }
export interface ResetJudgePasswordInput { password: string }
export type DeactivatedJudge = Pick<AdminJudge, "id" | "email" | "fullName" | "isActive">;
export interface AssignmentInput {
  judgeId: string; categoryId: string; criterionIds: string[];
}
```

- [x] **Step 2 — Thêm domain contract assertions fail trước khi tạo module.** Dùng adapter `reply` Task 2; bật lại session nếu test cần Bearer. Một test phải kiểm cả path/method/payload và data/meta trả về, không chỉ kiểm function tồn tại.

```js
const { authApi, productsApi, myProductsApi, judgeApi, adminApi } =
  await server.ssrLoadModule('/src/api/index.ts');
reply(201, { data: { id: 'p1' } }, (config) => {
  assert.equal(config.url, '/my/products');
  assert.equal(config.method, 'post');
  assert.deepEqual(JSON.parse(config.data), {
    name: 'Chè', categoryId: 'c1', formData: {},
  });
});
assert.deepEqual(await myProductsApi.create({ name: 'Chè', categoryId: 'c1', formData: {} }),
  { data: { id: 'p1' } });
reply(200, { data: [], meta }, (config) => {
  assert.equal(config.url, '/products');
  assert.deepEqual(config.params, { page: 2, limit: 20, q: 'chè & trà' });
});
assert.deepEqual(await productsApi.list({ page: 2, limit: 20, q: 'chè & trà' }),
  { data: [], meta });
```

Run harness. Expected: FAIL do chưa có domain modules/barrel.

- [x] **Step 3 — Ghi đủ các API nghiệp vụ sau, mỗi module import type từ file domain tương ứng và `API` từ constants.** `requestJson/requestBlob` chỉ import từ `./base-request`; không nhân bản Axios instance.

```ts
// api/auth.ts imports: LoginInput, LoginResponse, RegisterInput, VerifyOtpInput,
// ResetPasswordInput, ChangePasswordInput, MessageResponse, SessionUser từ ../types/auth
export const authApi = {
  login: (data: LoginInput) => requestJson<LoginResponse>({ url: API.auth.login, method: "POST", data }),
  register: (data: RegisterInput) => requestJson<MessageResponse>({ url: API.auth.register, method: "POST", data }),
  verifyOtp: (data: VerifyOtpInput) => requestJson<MessageResponse>({ url: API.auth.verifyOtp, method: "POST", data }),
  resendOtp: (email: string) => requestJson<MessageResponse>({ url: API.auth.resendOtp, method: "POST", data: { email } }),
  forgotPassword: (email: string) => requestJson<MessageResponse>({ url: API.auth.forgotPassword, method: "POST", data: { email } }),
  resetPassword: (data: ResetPasswordInput) => requestJson<MessageResponse>({ url: API.auth.resetPassword, method: "POST", data }),
  changePassword: (data: ChangePasswordInput) => requestJson<MessageResponse>({ url: API.auth.changePassword, method: "POST", data }),
  me: () => requestJson<SessionUser>({ url: API.auth.me }),
};

// api/products.ts imports: CategoryRecord từ ../types/product;
// PublicProduct, PublicProductParams từ ../types/public
export const productsApi = {
  categories: () => requestJson<CategoryRecord[]>({ url: API.categories }),
  list: <T = PublicProduct>(params: PublicProductParams) =>
    requestJson<T[]>({ url: API.products.list, params }),
  detail: <T = PublicProduct>(id: string) => requestJson<T>({ url: API.products.detail(id) }),
};

// api/my-products.ts imports: RegistrantProduct, ProductWriteInput từ ../types/registrant;
// ProductAttachmentRecord từ ../types/product
export const myProductsApi = {
  list: () => requestJson<RegistrantProduct[]>({ url: API.my.products }),
  detail: (id: string) => requestJson<RegistrantProduct>({ url: API.my.product(id) }),
  create: (data: ProductWriteInput) => requestJson<RegistrantProduct>({ url: API.my.products, method: "POST", data }),
  update: (id: string, data: ProductWriteInput) => requestJson<RegistrantProduct>({ url: API.my.product(id), method: "PUT", data }),
  remove: (id: string) => requestJson<{ id: string }>({ url: API.my.product(id), method: "DELETE" }),
  submit: (id: string) => requestJson<RegistrantProduct>({ url: API.my.submit(id), method: "POST" }),
  upload: (id: string, file: File) => {
    validateProductFile(file);
    const data = new FormData();
    data.append("file", file);
    return requestJson<ProductAttachmentRecord>({ url: API.my.attachments(id), method: "POST", data });
  },
  attachment: (id: string, attachmentId: string) => requestBlob(API.my.attachment(id, attachmentId)),
  removeAttachment: (id: string, attachmentId: string) =>
    requestJson<{ id: string }>({ url: API.my.attachment(id, attachmentId), method: "DELETE" }),
};

// api/judge.ts imports: QueueProduct, EvaluationData, SaveEvaluationInput,
// SavedEvaluation, SubmittedEvaluation từ ../types/judge
export const judgeApi = {
  queue: () => requestJson<QueueProduct[]>({ url: API.judge.products }),
  evaluation: (id: string) => requestJson<EvaluationData>({ url: API.judge.evaluation(id) }),
  save: (id: string, data: SaveEvaluationInput) => requestJson<SavedEvaluation>({ url: API.judge.evaluation(id), method: "PUT", data }),
  submit: (id: string) => requestJson<SubmittedEvaluation>({ url: API.judge.submitEvaluation(id), method: "POST" }),
  attachment: (id: string, attachmentId: string) => requestBlob(API.judge.attachment(id, attachmentId)),
};

// api/admin.ts imports: AdminDashboard, AdminJudge, AdminProduct, Assignment,
// ProductResults, CreateJudgeInput, UpdateJudgeInput, ResetJudgePasswordInput,
// AssignmentInput, DeactivatedJudge từ ../types/admin; DEFAULT_PAGE_SIZE từ ../constants/consts
export const adminApi = {
  dashboard: () => requestJson<AdminDashboard>({ url: API.admin.dashboard }),
  judges: () => requestJson<AdminJudge[]>({ url: API.admin.judges }),
  createJudge: (data: CreateJudgeInput) => requestJson<AdminJudge>({ url: API.admin.judges, method: "POST", data }),
  updateJudge: (id: string, data: UpdateJudgeInput) => requestJson<AdminJudge>({ url: API.admin.judge(id), method: "PUT", data }),
  resetJudgePassword: (id: string, data: ResetJudgePasswordInput) => requestJson<{ id: string }>({ url: API.admin.judgeResetPassword(id), method: "POST", data }),
  deactivateJudge: (id: string) => requestJson<DeactivatedJudge>({ url: API.admin.judge(id), method: "DELETE" }),
  assignments: () => requestJson<Assignment[]>({ url: API.admin.assignments }),
  replaceAssignments: (assignments: AssignmentInput[]) => requestJson<Assignment[]>({ url: API.admin.assignments, method: "PUT", data: { assignments } }),
  products: (page: number) => requestJson<AdminProduct[]>({ url: API.admin.products, params: { page, limit: DEFAULT_PAGE_SIZE } }),
  productResults: (id: string) => requestJson<ProductResults>({ url: API.admin.productResults(id) }),
};

// api/index.ts
export { authApi } from "./auth";
export { productsApi } from "./products";
export { myProductsApi } from "./my-products";
export { judgeApi } from "./judge";
export { adminApi } from "./admin";
```

`my-products.ts` import `validateProductFile` từ `../lib/attachments`; Task 4 sẽ gỡ transport khỏi helper này để graph cuối không có vòng. Đã đối chiếu `AdminService.resetJudgePassword` trả `{id}`; deactivate trả projection `{id,email,fullName,isActive}` của repository, không phải toàn bộ `AdminJudge`.

- [x] **Step 4 — Khóa mapping nguy hiểm bằng test cụ thể.** Với `reply` adapter, kiểm `myProductsApi.update` dùng PUT và formData nguyên object; `adminApi.replaceAssignments` gửi `{assignments:[{judgeId,categoryId,criterionIds}]}`; `judgeApi.save` PUT trước `judgeApi.submit` POST, `notes` không mất; upload chỉ một field `file`; ID `a/b` thành `a%2Fb`; private attachment có Bearer, responseType blob. Không test từng getter chỉ để đếm coverage.

```js
const assignmentInput = [{ judgeId: 'j1', categoryId: 'c1', criterionIds: [] }];
reply(200, { data: [] }, (config) => {
  assert.equal(config.url, '/admin/assignments');
  assert.equal(config.method, 'put');
  assert.deepEqual(JSON.parse(config.data), { assignments: assignmentInput });
});
await adminApi.replaceAssignments(assignmentInput);
const proof = new File(['proof'], 'proof.pdf', { type: 'application/pdf' });
reply(201, { data: { id: 'f1' } }, (config) => {
  assert.equal(config.url, '/my/products/a%2Fb/attachments');
  assert.deepEqual([...config.data.keys()], ['file']);
  assert.equal(config.data.get('file').name, 'proof.pdf');
});
await myProductsApi.upload('a/b', proof);
```

- [x] **Step 5 — Chạy web typecheck và harness.** Expected: PASS, barrel chỉ export domain có thật, không còn dependency task/system. Checkpoint commit theo file/hunk Task 3.

### Task 4: Chuyển hooks, initial loads, mutations và private attachments

**Files:** Modify toàn bộ file caller trong bản đồ mục 2; test tiếp tục tại `api-integration.check.mjs`.

**Interfaces:** Consumes năm API object Task 3; produces UI/hooks không biết generic transport. `openAttachment(blob: Blob, name: string, download?: boolean): Promise<void>` chỉ hiển thị blob, không tự tải HTTP.

- [x] **Step 1 — Thay `queryFn`, giữ nguyên các options và cache shape.**

```ts
// queries/common.ts
queryFn: async () => (await authApi.me()).data
queryFn: async () => (await productsApi.categories()).data
queryFn: () => productsApi.list<T>(params)
queryFn: async () => (await productsApi.detail<T>(id)).data

// queries/admin.ts
queryFn: async () => (await adminApi.dashboard()).data
queryFn: async () => (await adminApi.judges()).data
queryFn: async () => (await adminApi.assignments()).data
queryFn: () => adminApi.products(page)
queryFn: async () => (await adminApi.productResults(id)).data

// queries/judge.ts
queryFn: async () => (await judgeApi.queue()).data
queryFn: async () => (await judgeApi.evaluation(productId)).data

// queries/registrant.ts
queryFn: async () => (await myProductsApi.list()).data
queryFn: async () => (await myProductsApi.detail(id ?? "")).data
```

Những dòng trên là thay thế giá trị `queryFn` trong từng hook hiện có, không ghép thành một object. Giữ `enabled: Boolean(id)`, `gcTime: 0` cho evaluation/assignments, `staleTime` categories và toàn bộ query keys. Bỏ URLSearchParams ở common vì Axios params do domain sở hữu; `CategoryRecord` import từ types/product. Query keys import từ constants ở tất cả query/page/test; bỏ re-export `queryKeys` từ common khi hết caller.

- [x] **Step 2 — Thay toàn bộ request auth bằng payload typed, giữ xử lý form hiện có.**

```ts
const { data } = await authApi.login({
  email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""),
});
await authApi.register({
  email: emailValue, fullName: String(form.get("fullName") ?? ""),
  phone: String(form.get("phone") ?? "") || undefined, password: passwordValue,
});
await authApi.verifyOtp({ email: normalizedEmail, code });
await authApi.resendOtp(email.trim().toLowerCase());
await authApi.resendOtp(nextEmail);
const { data } = await authApi.forgotPassword(value);
await authApi.resetPassword({ email, code: String(form.get("code") ?? ""), newPassword });
await authApi.changePassword({ currentPassword, newPassword });
```

Mỗi dòng nằm tại handler tương ứng, không gom thành một flow. Giữ validation 72 byte, lưu/xóa pending email, `setSession`, navigation, busy/error/notice và logout sau đổi mật khẩu thành công. Imports lỗi chuyển sang `lib/api-error`.

- [x] **Step 3 — Chuyển admin và judge, giữ initial form load và thứ tự thao tác.**

```ts
await adminApi.createJudge({
  email: String(form.get("email") ?? ""), fullName: String(form.get("fullName") ?? ""),
  phone: String(form.get("phone") ?? "") || undefined, password,
});
await adminApi.updateJudge(judge.id, {
  fullName: String(data.get("fullName") ?? ""), phone: String(data.get("phone") ?? "") || null,
});
await adminApi.resetJudgePassword(judge.id, { password });
await adminApi.deactivateJudge(judge.id);
Promise.all([adminApi.judges(), productsApi.categories(), adminApi.assignments()]);
const { data } = await adminApi.replaceAssignments(assignments.map((item) => ({
  judgeId: item.judgeId, categoryId: item.categoryId, criterionIds: item.criterionIds,
})));

judgeApi.evaluation(productId).then(({ data: result }) => {
  if (!active) return;
  setData(result);
  const selectedOptions: Record<string, string> = {};
  const savedNotes: Record<string, string> = {};
  for (const score of result.evaluation.scores) {
    selectedOptions[score.subCriterionId] = score.optionId;
    savedNotes[score.subCriterionId] = score.note ?? "";
  }
  setSelected(selectedOptions);
  setNotes(savedNotes);
  setActiveCriterionId(result.criteria[0]?.id ?? "");
});
await judgeApi.save(productId, { scores: buildScores() });
const { data: result } = await judgeApi.submit(productId);
```

Giữ `.catch`, cleanup `active` trong effect và UI state ở vị trí cũ. Không bắt buộc chuyển initial form loads thành useQuery: named domain calls đã đáp ứng ranh giới, tránh refetch ghi đè lựa chọn chưa lưu. Save và submit vẫn là hai request tuần tự; lỗi save chặn submit. Giữ confirm thay toàn bộ phân công, diff preview, cache invalidation admin/judge, `setSavedAssignments`.

- [x] **Step 4 — Chuyển toàn bộ registrant requests, giữ chống mất/lặp dữ liệu khi upload lỗi.**

```ts
await myProductsApi.remove(id);
const { data } = await myProductsApi.submit(id);
Promise.all([productsApi.categories(), productId
  ? myProductsApi.detail(productId) : Promise.resolve({ data: null })]);
const { data } = existingId
  ? await myProductsApi.update(existingId, payload)
  : await myProductsApi.create(payload);
const { data: attachment } = await myProductsApi.upload(targetId, file);
const { data: latest } = await myProductsApi.detail(targetId);
await myProductsApi.removeAttachment(productId, attachmentId);
```

Các dòng thay cho từng call cũ, gồm cả `submit(productId)` tại detail page. Gỡ tạo FormData khỏi page vì `upload` sở hữu nó; vẫn kiểm tất cả selectedFiles trước khi lưu draft. Giữ `existingId`, `uploadedFiles` dedup, cập nhật `setProduct`, xử lý network/5xx với refetch và thông báo kiểm tra tệp, xóa file input khi chưa xác nhận; không tự retry upload. Giữ payload formData đang chuẩn hóa number/undefined và cache shape `Product[]`/`Product`.

- [x] **Step 5 — Đưa private HTTP ra khỏi helper và component link.**

```ts
// lib/attachments.ts: bỏ import apiBlob; giữ validation, accept và phần DOM hiện có
export async function openAttachment(blob: Blob, name: string, download = false) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.setAttribute("aria-label", `Mở ${name}`);
  if (download) link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// RegistrantPages.tsx: cả hai nơi render AttachmentLink truyền productId/attachmentId
function AttachmentLink({ productId, attachmentId, name }: {
  productId: string; attachmentId: string; name: string;
}) {
  async function open() {
    try { await openAttachment(await myProductsApi.attachment(productId, attachmentId), name, true); }
    catch (error) { window.alert(messageOf(error)); }
  }
  return <button type="button" className="text-link" onClick={() => void open()}>{name}</button>;
}

// JudgePages.tsx
async function openJudgeAttachment(productId: string, attachmentId: string, fileName: string) {
  try { await openAttachment(await judgeApi.attachment(productId, attachmentId), fileName); }
  catch (cause) { window.alert(messageOf(cause)); }
}
```

`App.tsx` và `PublicPages.tsx` giữ `publicAttachmentUrl` cho `<img src>`; đó là public browser image, không phải private download cần Bearer. Chỉ đổi error helper imports ở hai file này. `lib/query-client.ts` import `ApiError` từ file mới, giữ retry/subscription.

- [x] **Step 6 — Chạy typecheck và harness, rà đủ caller.**

```powershell
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
rg -n --no-ignore 'api<|apiBlob|from .*lib/api|API\.' apps/web/src/pages apps/web/src/queries apps/web/src/App.tsx
```

Expected: typecheck/tests PASS; search không còn generic HTTP/client hoặc endpoint `API` trong UI/query. `lib/api-error` là error helper hợp lệ; regex có thể in dòng đó, phải đọc kết quả thay vì coi tất cả là vi phạm. Checkpoint commit theo hunk của Task 4.

### Task 5: Gỡ fetch cũ và thêm check ranh giới

**Files:** Delete `lib/api.ts`; Modify `test/api-integration.check.mjs`; Create `test/api-boundary.check.mjs`.

**Interfaces:** Consumes source migration Task 4; produces check độc lập không cần DB/SMTP và không import app.

- [x] **Step 1 — Tạo check nguồn để một request trực tiếp trong page/query làm test fail.**

```js
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
const root = fileURLToPath(new URL('../src/', import.meta.url));
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}
for (const path of walk(root)) {
  const name = relative(root, path).replaceAll('\\', '/');
  if (name.startsWith('api/')) continue;
  const code = readFileSync(path, 'utf8');
  for (const match of code.matchAll(/^\s*import\s+(?:type\s+)?([^;]+?)\s+from\s*["']([^"']+)["']/gm)) {
    const [, bindings, source] = match;
    assert.ok(source !== 'axios' && !/(?:^|\/)api\/base-request$/.test(source), name);
    assert.ok(!/(?:^|\/)lib\/api$/.test(source) && !(name.startsWith('lib/') && source === './api'), name);
    assert.ok(!(/(?:^|\/)constants\/api$/.test(source) && /\bAPI\b/.test(bindings)), name);
  }
  assert.ok(!/\b(?:fetch|axios|baseRequest|api|apiBlob|requestJson|requestBlob)\s*(?:<[^;\n]*>)?\s*\(/.test(code), name);
}
assert.equal(existsSync(join(root, 'lib/api.ts')), false);
assert.equal(existsSync(join(root, 'api/system.ts')), false);
console.log('PASS API boundaries');
```

Đây là check quy ước import/call của source hiện tại, không phải parser TypeScript hoàn chỉnh. Nếu source chuyển sang dynamic imports hoặc re-export transport, nâng check theo cú pháp thực tế; không thêm AST dependency chỉ cho quy ước này.

- [x] **Step 2 — Chạy để thấy FAIL vì `lib/api.ts` vẫn tồn tại.**

Run: `pnpm --filter @ocop/web exec node test/api-boundary.check.mjs`.
Expected: FAIL tại tồn tại legacy client; không đổi expectation thành true.

- [x] **Step 3 — Chuyển nốt test khỏi legacy client rồi xóa file.** Giữ nguyên assertions file/password/form của harness; xóa block fetch mocking và thay bằng nhóm Axios/domain đã có ở Tasks 2–3. Import `queryKeys` trực tiếp từ constants, `ApiError` từ `lib/api-error`; khôi phục `baseRequest.defaults.adapter` trong `finally`. Không xóa ca JSON 201, pagination, FormData, binary, 401 exception, session/cache clearing vì đổi HTTP library.

```powershell
rg -n --no-ignore 'lib/api|apiBlob|refreshAccessToken|AUTH_REFRESH_TOKEN_STORAGE_KEY|LIST_TASKS_KEY|TASK_DETAIL_KEY|DEPARTMENTS_KEY|TASK_CATEGORIES_KEY|USERS_KEY|VITE_API_BASE_URL|/api/v1' apps/web/src apps/web/test
```

Expected: không còn legacy transport/refresh/task imports/keys; `lib/api-error` là hợp lệ. Đọc toàn bộ hits trước khi xóa `apps/web/src/lib/api.ts`.

- [x] **Step 4 — Chạy checks của cả feature.**

```powershell
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/web exec node test/proxy.check.mjs
pnpm --filter @ocop/web exec vite build --configLoader native
```

Expected: tất cả PASS; không bỏ file `api/` khỏi tsconfig để che lỗi. Checkpoint commit chỉ theo file/hunk đã review.

### Task 6: Cập nhật tài liệu trạng thái thật và nghiệm thu trình duyệt

**Files:** Modify `apps/web/README.md`, `README.md`; Create `docs/verification/2026-10-22-web-api-constants.md`.

**Interfaces:** Consumes PASS/FAIL thực tế Tasks 1–5; produces báo cáo với command/kết quả/blocker và quy ước đã áp dụng.

- [x] **Step 1 — Cập nhật README khi migration đã hoàn tất.** Thay đoạn mẫu chưa tích hợp bằng nội dung sau; giữ nguyên phần hướng dẫn chạy và contract.

```text
The OCOP frontend uses the shared Axios transport in src/api/base-request.ts.
Domain functions in src/api/ own endpoints and request serialization; pages and
query hooks consume those functions. Shared endpoints, session keys, query keys,
HTTP statuses and pagination defaults live in src/constants/. The previous fetch
client in src/lib/api.ts and unrelated task/system API samples have been removed.
```

Xóa đoạn cảnh báo thiếu Axios/import của mẫu trong README web và cập nhật câu target-only ở README root. Các plan/spec cũ giữ mốc lịch sử; không viết lại lịch sử verification cũ thành kết quả mới.

- [x] **Step 2 — Ghi báo cáo automated checks.** Mỗi hàng có command từ Task 5, kết quả thực tế, thời điểm và lỗi nếu có. Đặc biệt ghi riêng baseline SSR runner failure đã sửa hay chưa; không coi lỗi runner là contract PASS. Thêm browser checklist dưới đây với trạng thái riêng, không suy luận từ build.

| Luồng trình duyệt | Kết quả bắt buộc |
|---|---|
| Catalog/search/pagination + ảnh public | Query params được encode; meta và limit 20 giữ nguyên; homepage vẫn 6. |
| Login/OTP/forgot/reset password | Payload đúng endpoint, hiển thị message; không gọi refresh. Không gửi OTP thật nếu chưa có tài khoản/môi trường test được phép. |
| Session đã tồn tại | Reload nhận `ocop-session`, không tạo các key auth_* mẫu. |
| Sai mật khẩu hiện tại / token hết hạn | Lần đầu giữ session và form; lần sau clear session/cache rồi về login. |
| Tạo/sửa draft + upload hai file | FormData có boundary thật; mỗi request một `file`, attachment không lặp khi partial failure. |
| Download private | Bearer gửi đúng; mở/download được blob; lỗi 401/403 binary hiển thị message, không mở tệp lỗi như thành công. |
| Judge save/submit | PUT trước POST; lỗi save chặn submit; note và chỉ đọc sau nộp giữ nguyên. |
| Admin judges/assignments | CRUD đúng method; confirm thay toàn bộ phân công, giữ cache invalidation. |

- [x] **Step 3 — Chỉ smoke browser bằng dữ liệu test được phép.** Nếu chưa có BE/DB/SMTP/tài khoản hoặc chưa được phép gửi email/nộp hồ sơ, ghi `BLOCKED` với đúng điều kiện thiếu; không chạy migration/seed hay thử trên dữ liệu thật để làm checklist xanh.

- [x] **Step 4 — Review phạm vi và kết thúc.**

```powershell
git diff --check
git status --short
```

Expected: không có lỗi whitespace của phần sửa; không có thay đổi BE, env, schema, routeTree hoặc dependency khác ngoài Axios. Đối chiếu diff với snapshot trước triển khai để tách thay đổi đã có. Chỉ tạo commit khi việc commit được cho phép và đã tách đúng file/hunk; kế hoạch này không tự cấp quyền gom/commit thay đổi người dùng.

## 3. Tiêu chí hoàn tất

- Web typecheck, production build, hai contract/boundary checks và proxy check đều PASS.
- `api/` chỉ còn transport chung và 5 domain OCOP với barrel hợp lệ; không còn import module vắng mặt từ mẫu.
- Không còn `lib/api.ts`, gọi HTTP trực tiếp hoặc ghép endpoint/options trong component/page/query/helper hiển thị tệp.
- Constants không có task/program/department/session keys của dự án khác; query key OCOP và localStorage hiện có tương thích.
- Regression assertions giữ được JSON/meta, HTTP 201/204, upload, blob/error blob, password bytes, lỗi HTTP/network, retry policy và 401/cache behavior.
- README phản ánh implementation thật; browser/runtime chưa chạy được ghi rõ, không chặn việc review diff nhưng không được tuyên bố nghiệm thu runtime toàn phần.

## 4. Nguồn kỹ thuật đối chiếu

Chọn Axios theo yêu cầu đã nêu trong quy ước dự án. API cấu hình, errors và FormData đối chiếu tài liệu chính thức: [request configuration](https://axios-http.com/docs/req_config), [handling errors](https://axios-http.com/docs/handling_errors), [multipart](https://axios-http.com/docs/multipart). Khi triển khai dùng version được khóa trong lockfile, xác nhận types thực tế trước khi chép code.

## 5. Tự rà soát kế hoạch

- Phạm vi đã phủ: transport (Task 2), domain/types (Task 3), constants/session keys (Task 1), mọi caller/query/private attachment (Task 4), loại bỏ legacy và regression check (Task 5), docs/runtime status (Task 6).
- Giữ một `ApiError` và một contract trả về; types/helper được định nghĩa trước task tiêu thụ.
- Không thêm framework, CRUD factory, refresh/cookie auth, runtime schema hoặc module BE mới.
- Các checkpoint không yêu cầu stage thay đổi đã có; execution lựa chọn chạy tuần tự trong chat hoặc subagent theo từng task sau khi người dùng chọn cách thực hiện.
