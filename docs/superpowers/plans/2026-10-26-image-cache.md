# Product Image Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giảm tải lại ảnh công khai và ảnh hiển thị riêng tư theo thiết kế Q1–Q5, bảo toàn kiểm tra quyền và vòng đời dữ liệu.

**Architecture:** Ảnh công khai tiếp tục dùng URL hiện có và HTTP cache của trình duyệt. Ảnh riêng tư dùng TanStack Query lưu Blob trong bộ nhớ, với giới hạn dùng lại 5 phút, key phân biệt phạm vi phiên và object URL do từng component quản lý. Upload/xóa cập nhật dữ liệu sản phẩm và dữ liệu in; nút tải tệp giữ luồng API trực tiếp.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Axios, Zustand, NestJS 11/Express, Jest, `node:test`/`node:assert`. Node hiện tại `v24.18.0`, pnpm `11.17.0`; dùng dependency đã cài.

**Spec:** [2026-10-26-image-cache-design.md](../specs/2026-10-26-image-cache-design.md). Đọc cả spec và plan trước khi thực hiện.

## Global Constraints

- `Cache-Control: private, max-age=300, must-revalidate` cho response ảnh công khai thành công.
- `Cache-Control: no-store` cho tệp riêng tư; lỗi endpoint attachment không được giữ header cache thành công.
- `staleTime: 300_000`, `gcTime: 300_000` riêng cho query ảnh; không thay mặc định query khác.
- Ảnh riêng tư chỉ giữ trong bộ nhớ của ứng dụng; không lưu qua F5/đóng mở trình duyệt.
- Chỉ cache ảnh hiển thị; nút tải tệp vẫn gọi API trực tiếp.
- Khi mở ảnh hết hạn, chờ kiểm tra lại; nếu thất bại thì hiện lỗi và không hiện ảnh cũ.
- Không đưa access token trực tiếp vào query key; xóa cache và trạng thái ảnh khi phạm vi phiên thay đổi.
- Mỗi component tự thu hồi object URL; không cache object URL dùng chung.
- Không sửa schema, lưu trữ file, nội dung ảnh, API URL hoặc điều kiện cấp quyền hiện có.
- Không thêm dependency, persistence, service worker, polling, CDN, ETag/Last-Modified, nén ảnh hoặc prefetch hàng loạt.
- Không cam kết tải đúng một lần vĩnh viễn; ảnh đang hiển thị không tự biến mất khi hết `staleTime`; `gcTime` không giới hạn tổng RAM.

---

## Điểm xuất phát và cách thực hiện

Đây là một tính năng xuyên backend/frontend, không cần chia thành các dự án độc lập. Thực hiện Task 1 → 2 → 3 → 4; không triển khai ở bước lập kế hoạch này.

Working tree hiện có nhiều thay đổi UI và dữ liệu ngoài phạm vi. Trước khi thực hiện, đọc `git status --short` và diff từng file định sửa; không reset, stash, format toàn repo hoặc đưa thay đổi người khác vào commit. Nếu chọn worktree, tạo theo `superpowers:using-git-worktrees` lúc bắt đầu thực hiện và bảo đảm đọc được spec/plan cùng trạng thái code cần dùng. Các dòng chỉ định bên dưới là mốc tìm kiếm của phiên khảo sát; tên hàm là điểm neo chính xác khi số dòng thay đổi.

### Bản đồ file

| File | Trách nhiệm |
| --- | --- |
| Modify: `apps/be/src/controllers/products.controller.ts:21` | Header của ảnh công khai |
| Modify: `apps/be/src/controllers/my-products.controller.ts:109`, `apps/be/src/controllers/admin-products.controller.ts:112`, `apps/be/src/controllers/judge.controller.ts:37` | Header `no-store` của attachment riêng tư |
| Modify: `apps/be/src/filters/api-exception.filter.ts:20` | Ghi đè header cache khi attachment lỗi, gồm lỗi từ guard |
| Test: `apps/be/src/filters/api-exception.filter.spec.ts`, `apps/be/test/admin-product-files.db-spec.ts` | Lỗi không cache; HTTP header và ma trận quyền thực tế |
| Modify: `apps/web/src/api/base-request.ts:71`, `apps/web/src/api/my-products.ts`, `apps/web/src/api/admin-products.ts` | `AbortSignal` tùy chọn cho request Blob, không đổi caller tải tệp |
| Modify: `apps/web/src/constants/query-key.ts` | Prefix key theo sản phẩm/ảnh, mode và phạm vi phiên |
| Modify: `apps/web/src/lib/query-client.ts:18` | Số hiệu phạm vi cache không chứa token; giữ cơ chế clear hiện có |
| Create: `apps/web/src/queries/product-images.ts` | Query options, kiểm tra Blob được phép hiển thị, cập nhật cache sau mutation |
| Modify: `apps/web/src/pages/registrant/AttachmentLink.tsx:38` | Chỉ chuyển `PrivateAttachmentThumbnail` sang query; giữ `AttachmentLink` |
| Modify: `apps/web/src/queries/admin-products.ts:71`, `:98` | Upload, xóa attachment và xóa bản nháp admin |
| Modify: `apps/web/src/pages/registrant/MyProductDetailPage.tsx:35`, `apps/web/src/pages/registrant/MyProductsPage.tsx:21` | Xóa attachment/bản nháp của chủ hồ sơ |
| Test: `apps/web/test/product-images.test.ts` (mới), `apps/web/test/session-contract.test.ts`, `apps/web/test/api-integration.check.mjs` | Gộp request, thời hạn, hủy request, đổi phiên, dữ liệu in |
| Reuse: `apps/web/src/components/print/OcopPrintSheets.tsx:723`, các trang admin và public | Tự nhận hành vi từ component/header chung; không sửa layout |

### Lệnh nền

Chạy từ `D:/project/chamdiemocop`, trừ khi bước chỉ rõ working directory khác. Các lệnh PowerShell nằm trên dòng riêng.

```powershell
node --version
pnpm --version
git status --short
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/session-contract.test.ts
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
```

Ghi nhận lỗi đã có trước khi sửa. DB suite dùng cơ chế cô lập schema của `apps/be/test/support/db-app.ts`; không chạy migration hoặc seed vào DB đang chứa dữ liệu người dùng. Nếu DB chưa kết nối được, ghi rõ kiểm thử DB bị chặn, không đánh dấu đã đạt.

## Task 1: Header HTTP cache và bảo toàn quyền truy cập

**Files:**
- Modify: bốn controller attachment trong bảng trên.
- Modify: `apps/be/src/filters/api-exception.filter.ts`.
- Test: `apps/be/src/filters/api-exception.filter.spec.ts`.
- Test: `apps/be/test/admin-product-files.db-spec.ts`.

**Interfaces:**
- Consumes: `ProductsController.image`, ba phương thức `attachment`, `ApiExceptionFilter.catch(exception, host)` hiện có; giữ nguyên chữ ký endpoint và `StreamableFile`.
- Produces: header success/error đúng Global Constraints; không tạo helper trả file mới và không đổi `asDownload`.

- [ ] **Step 1: Viết kiểm thử lỗi attachment trước khi sửa filter.**

Thêm `HttpException` vào import hiện có trong `api-exception.filter.spec.ts`, dùng lại `hostFor`:

```ts
it.each([401, 403, 404, 500])('prevents caching attachment error %s', (status) => {
  const { host, response } = hostFor({
    method: 'GET',
    path: '/api/products/product-1/attachments/image-1',
    headers: {} as Request['headers'],
  });
  filter.catch(new HttpException('Image unavailable', status), host);
  expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(response.status).toHaveBeenCalledWith(status);
});
```

- [ ] **Step 2: Chạy red test.**

```powershell
pnpm --filter @ocop/api test --runInBand --runTestsByPath src/filters/api-exception.filter.spec.ts
```

Expected: FAIL ở assertion `Cache-Control`, không phải lỗi import hoặc khởi động.

- [ ] **Step 3: Bổ sung assertion HTTP vào DB test có sẵn.**

Trong test `allows MANAGE drafts and VIEW submitted evidence only, without changing public file behavior`, sau đoạn chuyển `draft` sang `SUBMITTED`, dùng các biến `baseUrl`, `f`, `draft`, `image`, `evidence` sẵn có:

```ts
const publicImage = await fetch(
  `${baseUrl}/api/products/${draft.id}/attachments/${image.id}`,
);
expect(publicImage.status).toBe(200);
expect(publicImage.headers.get('cache-control')).toBe(
  'private, max-age=300, must-revalidate',
);
expect(Buffer.from(await publicImage.arrayBuffer()).equals(png)).toBe(true);

for (const [path, authorization, status] of [
  [`/my/products/${draft.id}/attachments/${evidence.id}`, f.headers('owner').authorization, 200],
  [`/admin/products/${draft.id}/attachments/${evidence.id}`, f.headers('viewer').authorization, 200],
  [`/admin/products/${draft.id}/attachments/${image.id}`, f.headers('viewer').authorization, 404],
  [`/admin/products/${draft.id}/attachments/${evidence.id}`, f.headers('scorer').authorization, 403],
  [`/judge/products/${draft.id}/attachments/${evidence.id}`, f.headers('owner').authorization, 403],
] as const) {
  const response = await fetch(`${baseUrl}/api${path}`, { headers: { authorization } });
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await response.arrayBuffer();
}
const publicDenied = await fetch(
  `${baseUrl}/api/products/${draft.id}/attachments/${evidence.id}`,
);
expect(publicDenied.status).toBe(404);
expect(publicDenied.headers.get('cache-control')).toBe('no-store');
```

Giữ toàn bộ assertions quyền/file bytes hiện có, gồm trường hợp judge được phân công ở các DB test khác. Không đổi fixture để hợp thức hóa quyền truy cập.

- [ ] **Step 4: Thêm header bằng cơ chế Nest hiện có.**

Import `Header` từ `@nestjs/common`. Thêm lên `ProductsController.image`:

```ts
@Header('Cache-Control', 'private, max-age=300, must-revalidate')
```

Thêm lên từng phương thức `attachment` của `MyProductsController`, `AdminProductsController`, `JudgeController`:

```ts
@Header('Cache-Control', 'no-store')
```

Trong `ApiExceptionFilter.catch`, sau khi có `request` và `response`, thêm đoạn sau. Guard có thể chặn trước khi decorator header được áp dụng; filter cũng phải xử lý lỗi đó. Với public handler đã đặt header cache rồi ném lỗi, đoạn này ghi đè thành `no-store`.

```ts
if (request.method === 'GET' && /\/attachments\/[^/]+\/?$/.test(request.path)) {
  response.setHeader('Cache-Control', 'no-store');
}
```

- [ ] **Step 5: Kiểm tra green và quyền truy cập.**

```powershell
pnpm --filter @ocop/api test --runInBand --runTestsByPath src/filters/api-exception.filter.spec.ts
pnpm --filter @ocop/api test:db --runTestsByPath test/admin-product-files.db-spec.ts test/e2e-honey-flow.db-spec.ts
pnpm --filter @ocop/api typecheck
```

Expected: unit PASS; DB PASS khi test DB sẵn sàng; status, content type, disposition và bytes giữ nguyên. Public error/401/403/404 không nhận header cache 300 giây. Chưa có ETag thì không đòi `304`.

- [ ] **Step 6: Commit phần backend đã kiểm tra.**

```powershell
git add -p -- apps/be/src/controllers/products.controller.ts apps/be/src/controllers/my-products.controller.ts apps/be/src/controllers/admin-products.controller.ts apps/be/src/controllers/judge.controller.ts apps/be/src/filters/api-exception.filter.ts apps/be/src/filters/api-exception.filter.spec.ts apps/be/test/admin-product-files.db-spec.ts
git diff --cached --check
git commit -m "feat(api): set bounded product image cache headers"
```

Chỉ stage các hunk của task; nếu test DB bị chặn, ghi lại lý do và chưa coi kiểm chứng quyền hoàn tất.

## Task 2: Query Blob, phạm vi phiên và hủy request

**Files:**
- Modify: `apps/web/src/api/base-request.ts:71`, `apps/web/src/api/my-products.ts`, `apps/web/src/api/admin-products.ts`.
- Modify: `apps/web/src/constants/query-key.ts`, `apps/web/src/lib/query-client.ts`.
- Create/Test: `apps/web/src/queries/product-images.ts`, `apps/web/test/product-images.test.ts`.
- Test: `apps/web/test/session-contract.test.ts`, `apps/web/test/api-integration.check.mjs`.

**Interfaces:**
- Consumes: API attachment hiện có; `sessionStore`; `queryKeys`; query client và retry hiện có.
- Produces: `requestBlob(path: string, signal?: AbortSignal): Promise<Blob>` và hai API attachment nhận thêm tham số thứ ba `signal?: AbortSignal`.
- Produces: `getSessionCacheRevision(): number`; tăng khi phạm vi trong `sessionScope` hiện có thay đổi, không chứa bí mật và không tăng khi chỉ đổi tên.
- Produces: `privateProductImageOptions(mode: 'owner' | 'admin', productId: string, attachmentId: string, scope: string)` trả `queryOptions` cho Blob.
- Produces: `imageBlobForOpen(state: { data?: Blob; dataUpdatedAt: number; error: unknown }, openedAt: number): Blob | undefined`.

- [ ] **Step 1: Viết test cho gộp request, biên 5 phút và GC.**

Tạo `apps/web/test/product-images.test.ts`:

```ts
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../src/constants/query-key';
import {
  privateProductImageOptions,
  imageBlobForOpen,
} from '../src/queries/product-images';

it('deduplicates one image and keeps mode/session keys separate', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    let calls = 0;
    const blob = new Blob(['image']);
    const options = {
      ...privateProductImageOptions('owner', 'p1', 'a1', 'scope-1'),
      queryFn: async () => { calls++; return blob; },
    };
    const [first, second] = await Promise.all([
      client.fetchQuery(options), client.fetchQuery(options),
    ]);
    assert.equal(first, blob);
    assert.equal(second, blob);
    assert.equal(calls, 1);
    assert.equal(await client.fetchQuery(options), blob);
    assert.equal(calls, 1);
    assert.notDeepEqual(options.queryKey,
      privateProductImageOptions('admin', 'p1', 'a1', 'scope-1').queryKey);
    assert.notDeepEqual(options.queryKey,
      privateProductImageOptions('owner', 'p1', 'a1', 'scope-2').queryKey);
    assert.deepEqual(options.queryKey.slice(0, 3), queryKeys.productImages.attachment('p1', 'a1'));
  } finally { client.clear(); }
});

it('hides an expired or failed image on opening, without expiring a mounted image', () => {
  const blob = new Blob(['image']);
  const state = { data: blob, dataUpdatedAt: 1_000_000, error: null };
  assert.equal(imageBlobForOpen(state, 1_299_000), blob);
  assert.equal(imageBlobForOpen(state, 1_300_000), undefined);
  assert.equal(imageBlobForOpen({ ...state, error: new Error('offline') }, 1_299_000), undefined);
  assert.equal(imageBlobForOpen({ ...state, dataUpdatedAt: 1_300_010 }, 1_300_000), blob);
  assert.equal(imageBlobForOpen({ data: undefined, dataUpdatedAt: 0, error: null }, 1_000_000), undefined);
});

it('removes inactive image bytes after gcTime', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000_000 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  t.after(() => client.clear());
  const options = {
    ...privateProductImageOptions('owner', 'p1', 'a1', 'scope-1'),
    queryFn: async () => new Blob(['image']),
  };
  await client.fetchQuery(options);
  t.mock.timers.tick(299_999);
  assert.ok(client.getQueryData(options.queryKey));
  t.mock.timers.tick(1);
  assert.equal(client.getQueryData(options.queryKey), undefined);
});

it('aborts a removed image query and cannot restore it with a late response', async () => {
  const client = new QueryClient();
  let release!: (blob: Blob) => void;
  let receivedSignal!: AbortSignal;
  const options = {
    ...privateProductImageOptions('owner', 'p1', 'a1', 'scope-1'),
    queryFn: ({ signal }: { signal: AbortSignal }) => {
      receivedSignal = signal;
      return new Promise<Blob>((resolve) => { release = resolve; });
    },
  };
  try {
    const pending = client.fetchQuery(options);
    const rejected = assert.rejects(pending);
    client.removeQueries({ queryKey: queryKeys.productImages.attachment('p1', 'a1') });
    await rejected;
    assert.equal(receivedSignal.aborted, true);
    release(new Blob(['late image']));
    await Promise.resolve();
    assert.equal(client.getQueryData(options.queryKey), undefined);
  } finally { client.clear(); }
});
```

- [ ] **Step 2: Chạy red test cho module mới.**

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/product-images.test.ts
```

Expected: FAIL do module/query key mới chưa có. Không cài thêm test runner; `tsx` đã có ở workspace backend.

- [ ] **Step 3: Kiểm thử signal qua API client hiện có.**

Trong block cuối của `api-integration.check.mjs`, sau test `myProductsApi.attachment` sẵn có, dùng lại `reply`, `requestBlob` và `myProductsApi`:

```js
const { adminProductsApi } = await server.ssrLoadModule('/src/api/admin-products.ts');
const controller = new AbortController();
for (const download of [
  () => requestBlob('/my/products/p1/attachments/a1', controller.signal),
  () => myProductsApi.attachment('p1', 'a1', controller.signal),
  () => adminProductsApi.attachment('p1', 'a1', controller.signal),
]) {
  reply(200, new Blob(['image']), config => assert.equal(config.signal, controller.signal));
  assert.equal(await (await download()).text(), 'image');
}
controller.abort();
await assert.rejects(requestBlob('/my/products/p1/attachments/a1', controller.signal),
  error => error.code === 'ERR_CANCELED');
```

Giữ các test tải tệp không truyền signal và test late old-token 401. Chạy lệnh sau để thấy FAIL signal trước khi đổi chữ ký:

```powershell
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
```

- [ ] **Step 4: Truyền signal; bổ sung query key và options.**

Đổi đúng ba hàm, giữ tham số mới tùy chọn:

```ts
// api/base-request.ts
export async function requestBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  return (await baseRequest.get<Blob>(path, { responseType: 'blob', signal })).data;
}

// Thuộc myProductsApi trong api/my-products.ts
attachment: (id: string, attachmentId: string, signal?: AbortSignal) =>
  requestBlob(API.my.attachment(id, attachmentId), signal),

// Thuộc adminProductsApi trong api/admin-products.ts
attachment: (id: string, attachmentId: string, signal?: AbortSignal) =>
  requestBlob(API.admin.productAttachment(id, attachmentId), signal),
```

Thêm nhánh này vào object `queryKeys`, không sửa các key khác:

```ts
productImages: {
  all: ['product-images'] as const,
  product: (productId: string) => ['product-images', productId] as const,
  attachment: (productId: string, attachmentId: string) =>
    ['product-images', productId, attachmentId] as const,
  detail: (productId: string, attachmentId: string, mode: 'owner' | 'admin', scope: string) =>
    ['product-images', productId, attachmentId, mode, scope] as const,
},
```

Nội dung ban đầu của `queries/product-images.ts`:

```ts
import { queryOptions } from '@tanstack/react-query';
import { myProductsApi } from '../api/my-products';
import { adminProductsApi } from '../api/admin-products';
import { queryKeys } from '../constants/query-key';

const IMAGE_CACHE_MS = 300_000;

export function privateProductImageOptions(
  mode: 'owner' | 'admin', productId: string, attachmentId: string, scope: string,
) {
  return queryOptions({
    queryKey: queryKeys.productImages.detail(productId, attachmentId, mode, scope),
    queryFn: ({ signal }) => mode === 'admin'
      ? adminProductsApi.attachment(productId, attachmentId, signal)
      : myProductsApi.attachment(productId, attachmentId, signal),
    enabled: Boolean(scope && productId && attachmentId),
    staleTime: IMAGE_CACHE_MS,
    gcTime: IMAGE_CACHE_MS,
  });
}

export function imageBlobForOpen(
  state: { data?: Blob; dataUpdatedAt: number; error: unknown }, openedAt: number,
): Blob | undefined {
  return !state.error && state.dataUpdatedAt > openedAt - IMAGE_CACHE_MS
    ? state.data : undefined;
}
```

`imageBlobForOpen` dùng thời điểm mở cố định do component cung cấp. Không dùng `query.isStale` để ẩn ảnh đang xem sau 5 phút; cũng không dùng `keepPreviousData` để hiện ảnh của key cũ.

- [ ] **Step 5: Tạo số hiệu phạm vi cache cùng nơi đang clear phiên.**

Viết các assertion và test đổi phiên của Step 5 bên dưới trước khi thêm implementation. Chạy `pnpm --filter @ocop/api exec node --import tsx --test ../web/test/session-contract.test.ts`; expected FAIL vì chưa có export `getSessionCacheRevision`. Sau khi có red test, thêm code sau.

Trong `lib/query-client.ts`, sau khi khởi tạo `queryClient` và trước subscription hiện có:

```ts
let sessionCacheRevision = 0;

export function getSessionCacheRevision(): number {
  return sessionCacheRevision;
}
```

Giữ `sessionScope` hiện có; thay body subscription bằng:

```ts
sessionStore.subscribe((state, previous) => {
  if (sessionScope(state.session) !== sessionScope(previous.session)) {
    sessionCacheRevision++;
    queryClient.clear();
  }
});
```

Mở rộng test `clears private data when the same user loses MANAGE, but not on a name-only update` trong `session-contract.test.ts`. Import thêm `getSessionCacheRevision`. Sau khi set phiên manager, lưu revision và kiểm tra ở đúng các điểm đổi tên/mất quyền:

```ts
const managerRevision = getSessionCacheRevision();
// Sau lần setState đổi fullName của test hiện có:
assert.equal(getSessionCacheRevision(), managerRevision);
// Sau lần setState staffPermissions thành ['VIEW'] của test hiện có:
assert.equal(getSessionCacheRevision(), managerRevision + 1);
```

Thêm một test dùng lại fixture `viewer` sẵn có để kiểm tra đổi token và logout ngay khi query chưa xong:

```ts
it('changes image cache scope on token change and cancels the previous request', async () => {
  sessionStore.setState({ session: viewer });
  const revision = getSessionCacheRevision();
  const key = ['product-images', 'p1', 'a1', 'admin', String(revision)];
  let signal!: AbortSignal;
  let release!: (value: Blob) => void;
  const request = queryClient.fetchQuery({
    queryKey: key,
    queryFn: (context) => {
      signal = context.signal;
      return new Promise<Blob>(resolve => { release = resolve; });
    },
  });
  const rejected = assert.rejects(request);
  try {
    sessionStore.setState({ session: { ...viewer, accessToken: 'replacement-token' } });
    await rejected;
    assert.equal(signal.aborted, true);
    assert.equal(getSessionCacheRevision(), revision + 1);
    release(new Blob(['old identity']));
    await Promise.resolve();
    assert.equal(queryClient.getQueryData(key), undefined);
  } finally { sessionStore.setState({ session: null }); }
});
```

- [ ] **Step 6: Chạy các kiểm tra client rồi commit.**

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/product-images.test.ts ../web/test/session-contract.test.ts
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/web typecheck
git add -- apps/web/src/queries/product-images.ts apps/web/test/product-images.test.ts
git add -p -- apps/web/src/api/base-request.ts apps/web/src/api/my-products.ts apps/web/src/api/admin-products.ts apps/web/src/constants/query-key.ts apps/web/src/lib/query-client.ts apps/web/test/session-contract.test.ts apps/web/test/api-integration.check.mjs
git diff --cached --check
git commit -m "feat(web): cache scoped private product image queries"
```

Expected: kiểm thử mới PASS, API cũ vẫn nhận hai tham số; không có token trong image query key. Node MockTimers có thể in cảnh báo thử nghiệm; không bỏ qua assertion fail.

## Task 3: Thumbnail dùng cache và không lộ ảnh stale/phiên cũ

**Files:**
- Modify: `apps/web/src/pages/registrant/AttachmentLink.tsx:38`.
- Test/Reuse: `apps/web/test/product-images.test.ts`, `apps/web/test/print-layout.check.cjs` và trang in đăng ký thực tế.
- Không sửa layout hoặc chữ ký `PrivateAttachmentThumbnail` ở các trang admin/phiếu in.

**Interfaces:**
- Consumes: `privateProductImageOptions(mode, productId, attachmentId, scope)`, `imageBlobForOpen(state, openedAt)`, `getSessionCacheRevision()` từ Task 2; `sessionStore`, `useSession`, `ApiError` hiện có.
- Produces: `PrivateAttachmentThumbnail` giữ nguyên props `{ mode, productId, attachmentId, name }`; chỉ render Blob hợp lệ cho lần mở hiện tại. `AttachmentLink` giữ nguyên cách tải trực tiếp.

- [ ] **Step 1: Ghi lại red reproduction trên bản in.**

Chạy web/backend development trên dữ liệu kiểm thử được phép dùng. Mở bản in đăng ký của một hồ sơ có ảnh; chờ ảnh xong. Trong DevTools Console chạy:

```js
performance.clearResourceTimings();
```

Bỏ chọn rồi chọn lại cùng ảnh bằng checkbox của `.registration-image-picker`, chờ ảnh xuất hiện. Chạy:

```js
console.assert(
  performance.getEntriesByType('resource').filter(entry => entry.name.includes('/attachments/')).length === 0,
  'Fresh remount must not request the same private image again',
);
```

Expected trước sửa: assertion FAIL vì thumbnail hiện có gọi API mỗi lần mount. Không đo bằng nút Reload hoặc Disable cache; Reload làm mất query cache theo Q2. Ghi lại ảnh Network/Console của lần kiểm tra này.

- [ ] **Step 2: Thay riêng component thumbnail bằng luồng dưới đây.**

Import thêm `useSyncExternalStore` từ React; `useQuery`, `useQueryClient` từ TanStack; `ApiError` cùng `messageOf`; `getSessionCacheRevision`, `sessionStore`, `useSession` và hai hàm của Task 2. Giữ nguyên `AttachmentLink` và các import API mà nó vẫn dùng.

```ts
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, messageOf } from '../../lib/api-error';
import { getSessionCacheRevision } from '../../lib/query-client';
import { imageBlobForOpen, privateProductImageOptions } from '../../queries/product-images';
import { sessionStore, useSession } from '../../stores/session-store';
```

```tsx
export function PrivateAttachmentThumbnail(props: {
  mode: ProductAttachmentMode;
  productId: string;
  attachmentId: string;
  name: string;
}) {
  const session = useSession();
  const revision = useSyncExternalStore(
    sessionStore.subscribe, getSessionCacheRevision, getSessionCacheRevision,
  );
  if (!session) return <span role='status'>Không tải được ảnh riêng tư</span>;
  const scope = [
    revision, session.user.id, session.user.role,
    [...session.user.staffPermissions].sort().join(','),
  ].join(':');
  const imageKey = [scope, props.mode, props.productId, props.attachmentId].join(':');
  return <CachedPrivateThumbnail key={imageKey} {...props} scope={scope} />;
}

function CachedPrivateThumbnail({ mode, productId, attachmentId, name, scope }: {
  mode: ProductAttachmentMode;
  productId: string;
  attachmentId: string;
  name: string;
  scope: string;
}) {
  const client = useQueryClient();
  const [openedAt] = useState(Date.now);
  const [denied, setDenied] = useState<Error | null>(null);
  const options = privateProductImageOptions(mode, productId, attachmentId, scope);
  const query = useQuery({ ...options, enabled: options.enabled && !denied });
  const error = denied ?? query.error;
  const blob = imageBlobForOpen({ ...query, error }, openedAt);
  const [image, setImage] = useState<{ blob: Blob; src: string } | null>(null);

  useEffect(() => {
    if (query.error instanceof ApiError && [403, 404].includes(query.error.status)) {
      setDenied(query.error);
      client.removeQueries({ queryKey: options.queryKey, exact: true });
    }
  }, [client, query.error, scope, mode, productId, attachmentId]);

  useEffect(() => {
    if (!blob) {
      setImage(null);
      return;
    }
    const src = URL.createObjectURL(blob);
    setImage({ blob, src });
    return () => URL.revokeObjectURL(src);
  }, [blob]);

  if (error) return (
    <span role='status'>
      Không tải được ảnh riêng tư.{' '}
      <button type='button' className='text-link' onClick={() => {
        if (denied) setDenied(null);
        else void query.refetch();
      }}>Thử lại</button>
    </span>
  );
  const src = image?.blob === blob ? image?.src : '';
  if (!src) return <span aria-busy='true'>Đang tải ảnh…</span>;
  return <img src={src} alt={name} loading='lazy' />;
}
```

Hai component trong cùng file là ranh giới vòng đời: key đổi khi phiên/ảnh/mode đổi, nên trạng thái ảnh cũ bị unmount ngay. Không dựa riêng vào một effect chạy sau paint để che ảnh của tài khoản trước. So sánh `image.blob` ngăn một frame dùng URL cũ khi Blob bị ẩn hoặc thay thế. `openedAt` cố định cho phép ảnh đang xem tiếp tục hiển thị sau 5 phút; chỉ lần mở mới phải vượt qua kiểm tra freshness.

Với 403/404, lưu lỗi cục bộ, bỏ query chứa Blob cũ và tắt tự tải lại cho đến khi người dùng bấm thử lại. Không gọi `removeQueries` bên trong `queryFn`, vì có thể tự hủy chính request đang trả lỗi. 401 tiếp tục theo interceptor phiên hiện có. Không thêm polling hoặc tự động tạo lại request lỗi vô hạn.

- [ ] **Step 3: Chạy test và kiểm tra cache bằng trình duyệt.**

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/product-images.test.ts ../web/test/session-contract.test.ts
pnpm --filter @ocop/web typecheck
```

Lặp lại Step 1: assertion PASS, thumbnail xuất hiện lại, không tải thêm bytes. Mở danh sách admin, chi tiết và trang in trong cùng SPA để kiểm tra cùng ảnh/mode/scope được dùng lại. Tab mới có bộ nhớ riêng, không đòi gộp request giữa hai tab.

Kiểm tra mốc hết hạn mà không chờ 5 phút thật: bỏ chọn ảnh, lưu hàm gốc và dịch `Date.now` trong đúng tab kiểm thử:

```js
window.restoreImageCheckClock = Date.now;
Date.now = () => window.restoreImageCheckClock() + 300_001;
performance.clearResourceTimings();
```

Trong DevTools Network đặt Slow 3G rồi chọn lại ảnh. Trong lúc request chạy, vị trí ảnh phải hiện loading và không có `<img>` dùng Blob cũ; response thành công mới hiện ảnh. Trước ca lỗi tiếp theo, bỏ chọn ảnh và dịch đồng hồ thêm một khoảng mới để Blob vừa tải không còn fresh:

```js
Date.now = () => window.restoreImageCheckClock() + 600_002;
```

Dùng Request blocking chặn URL attachment rồi chọn lại để kiểm tra lỗi sau retry và nút Thử lại. Khôi phục mạng trước khi thử lại. Cuối cùng khôi phục đồng hồ; Reload tab kiểm thử để bỏ cache có timestamp giả:

```js
Date.now = window.restoreImageCheckClock;
delete window.restoreImageCheckClock;
```

Theo dõi object URL bằng snippet dưới đây trước khi bỏ chọn ảnh. Sau unmount, URL đã dùng phải có mặt trong `revokedImageUrls`; khôi phục hàm khi xong.

```js
window.revokedImageUrls = [];
window.restoreImageRevoke = URL.revokeObjectURL;
URL.revokeObjectURL = function(url) {
  window.revokedImageUrls.push(url);
  return window.restoreImageRevoke.call(URL, url);
};
```

```js
console.assert(window.revokedImageUrls.length > 0, 'Unmount must revoke object URLs');
URL.revokeObjectURL = window.restoreImageRevoke;
delete window.restoreImageRevoke;
delete window.revokedImageUrls;
```

Không đưa các snippet kiểm thử này vào code ứng dụng.

- [ ] **Step 4: Kiểm tra đổi phiên, tải tệp và trang in.**

Với ảnh đã hiện, đăng xuất/đổi tài khoản: ảnh cũ biến mất ngay. Lặp lại khi đang Slow 3G: request cũ bị abort, late response không đưa ảnh vào tài khoản mới. Đổi tên tài khoản đơn thuần không xóa query cache. Bấm liên kết tải tệp hai lần: vẫn có hai lần gọi API, khác với remount thumbnail.

Nếu môi trường đã có Playwright theo hướng dẫn đầu `apps/web/test/print-layout.check.cjs`, chạy nguyên script hiện có; không thêm dependency vào package.json chỉ để chạy nó:

```powershell
node apps/web/test/print-layout.check.cjs
```

Expected: chọn/bỏ chọn ảnh, alt, phiếu in, khổ A4 và filename vẫn đạt kiểm tra cũ. Nếu Playwright không có trong runtime hiện tại, dùng trình duyệt kiểm tra các mục vừa nêu và ghi rõ phần script chưa chạy; không đánh dấu script PASS.

- [ ] **Step 5: Commit thumbnail đã kiểm tra.**

```powershell
git add -p -- apps/web/src/pages/registrant/AttachmentLink.tsx
git diff --cached --check
git commit -m "feat(web): reuse image blobs in private thumbnails"
```

## Task 4: Đồng bộ cache khi upload, xóa attachment và xóa bản nháp

**Files:**
- Modify: `apps/web/src/queries/product-images.ts` của Task 2.
- Modify: `apps/web/src/queries/admin-products.ts:71`, `:98`.
- Modify: `apps/web/src/pages/registrant/MyProductDetailPage.tsx:35`, `apps/web/src/pages/registrant/MyProductsPage.tsx:21`.
- Test: `apps/web/test/product-images.test.ts`.
- Reuse: `queryKeys.scoringPrint.registrationPrintData`, `resultsPrintData`; không sửa shape API/phiếu in.

**Interfaces:**
- Consumes: prefix `queryKeys.productImages.product/attachment` từ Task 2; query print-data có dạng `['print-data', kind, mode, productId]` hiện có.
- Produces: `invalidateProductPrintData(client: QueryClient, productId: string): void` chỉ đánh dấu dữ liệu in cần tải lại.
- Produces: `evictProductImages(client: QueryClient, productId: string, attachmentId?: string): Promise<void>` dùng khi xóa thành công; có ID thì bỏ ảnh đó ở mọi mode/scope, thiếu ID thì bỏ mọi ảnh của sản phẩm. Hàm cũng bỏ metadata in cũ và chặn response metadata đang chạy khôi phục ảnh vừa xóa.

- [ ] **Step 1: Thêm red tests cho xóa ảnh, xóa bản nháp và upload.**

Trong `product-images.test.ts`, import thêm hai hàm mới; import type `ApiResult` từ `../src/types/api` và `RegistrationPrintData` từ `@ocop/shared`. Fixture sau chỉ mô phỏng trường cần dùng trong query cache, không thay fixture API hoặc bỏ qua validation backend.

```ts
it('evicts a deleted image in both modes and cancels stale print metadata', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const blob = new Blob(['image']);
  const ownerKey = queryKeys.productImages.detail('p1', 'a1', 'owner', 'scope-1');
  const adminKey = queryKeys.productImages.detail('p1', 'a1', 'admin', 'scope-1');
  const retainedKey = queryKeys.productImages.detail('p1', 'a2', 'admin', 'scope-1');
  const otherKey = queryKeys.productImages.detail('p2', 'a1', 'owner', 'scope-1');
  const printKey = queryKeys.scoringPrint.registrationPrintData('admin', 'p1');
  const metadata = {
    data: { attachments: [{ id: 'a1' }, { id: 'a2' }] },
  } as unknown as ApiResult<RegistrationPrintData>;
  let release!: (value: ApiResult<RegistrationPrintData>) => void;
  try {
    for (const key of [ownerKey, adminKey, retainedKey, otherKey]) client.setQueryData(key, blob);
    client.setQueryData(printKey, metadata);
    const pending = client.fetchQuery({
      queryKey: printKey, staleTime: 0,
      queryFn: () => new Promise<ApiResult<RegistrationPrintData>>(resolve => { release = resolve; }),
    });
    const cancelled = assert.rejects(pending);
    await evictProductImages(client, 'p1', 'a1');
    await cancelled;
    release(metadata);
    await Promise.resolve();
    assert.equal(client.getQueryData(ownerKey), undefined);
    assert.equal(client.getQueryData(adminKey), undefined);
    assert.equal(client.getQueryData(retainedKey), blob);
    assert.equal(client.getQueryData(otherKey), blob);
    const print = client.getQueryData<ApiResult<RegistrationPrintData>>(printKey);
    assert.deepEqual(print?.data.attachments.map(file => file.id), ['a2']);
  } finally { client.clear(); }
});

it('evicts all product images and resets print data after deleting a draft', async () => {
  const client = new QueryClient();
  const blob = new Blob(['image']);
  const deletedKey = queryKeys.productImages.detail('p1', 'a1', 'owner', 'scope-1');
  const otherKey = queryKeys.productImages.detail('p2', 'a1', 'owner', 'scope-1');
  const printKey = queryKeys.scoringPrint.registrationPrintData('owner', 'p1');
  try {
    client.setQueryData(deletedKey, blob);
    client.setQueryData(otherKey, blob);
    client.setQueryData(printKey, { data: { attachments: [{ id: 'a1' }] } });
    await evictProductImages(client, 'p1');
    assert.equal(client.getQueryData(deletedKey), undefined);
    assert.equal(client.getQueryData(otherKey), blob);
    assert.equal(client.getQueryData(printKey), undefined);
  } finally { client.clear(); }
});

it('invalidates print metadata after upload without discarding existing image bytes', () => {
  const client = new QueryClient();
  const blob = new Blob(['image']);
  const key = queryKeys.productImages.detail('p1', 'a1', 'owner', 'scope-1');
  const printKey = queryKeys.scoringPrint.registrationPrintData('owner', 'p1');
  try {
    client.setQueryData(key, blob);
    client.setQueryData(printKey, { data: { attachments: [{ id: 'a1' }] } });
    invalidateProductPrintData(client, 'p1');
    assert.equal(client.getQueryData(key), blob);
    assert.equal(client.getQueryState(printKey)?.isInvalidated, true);
  } finally { client.clear(); }
});
```

Chạy red:

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/product-images.test.ts
```

Expected: FAIL vì hai export mới chưa có, không phải do lỗi cú pháp fixture.

- [ ] **Step 2: Thêm hai hàm nhỏ vào module query ảnh.**

Import type `QueryClient` từ TanStack, `RegistrationPrintData` từ `@ocop/shared`, `ApiResult` từ `../types/api`:

```ts
export function invalidateProductPrintData(client: QueryClient, productId: string): void {
  for (const mode of ['owner', 'admin'] as const) {
    void client.invalidateQueries({
      queryKey: queryKeys.scoringPrint.registrationPrintData(mode, productId), exact: true,
    });
    void client.invalidateQueries({
      queryKey: queryKeys.scoringPrint.resultsPrintData(mode, productId), exact: true,
    });
  }
}

export async function evictProductImages(
  client: QueryClient, productId: string, attachmentId?: string,
): Promise<void> {
  await client.cancelQueries({
    queryKey: ['print-data'], predicate: query => query.queryKey[3] === productId,
  });
  for (const mode of ['owner', 'admin'] as const) {
    const registrationKey = queryKeys.scoringPrint.registrationPrintData(mode, productId);
    if (attachmentId) {
      client.setQueryData<ApiResult<RegistrationPrintData>>(registrationKey, current =>
        current ? {
          ...current,
          data: {
            ...current.data,
            attachments: current.data.attachments.filter(file => file.id !== attachmentId),
          },
        } : current,
      );
    } else {
      void client.resetQueries({ queryKey: registrationKey, exact: true });
      void client.resetQueries({
        queryKey: queryKeys.scoringPrint.resultsPrintData(mode, productId), exact: true,
      });
    }
  }
  client.removeQueries({
    queryKey: attachmentId
      ? queryKeys.productImages.attachment(productId, attachmentId)
      : queryKeys.productImages.product(productId),
  });
  if (attachmentId) invalidateProductPrintData(client, productId);
  else client.removeQueries({ queryKey: queryKeys.myProducts.detail(productId), exact: true });
}
```

Không chỉ `invalidateQueries` cho dữ liệu in: phải bỏ attachment khỏi dữ liệu sẵn có trước, nếu không cache còn fresh có thể dựng lại thumbnail cũ. Hủy query metadata trước khi chỉnh dữ liệu để response bắt đầu trước lần xóa không khôi phục danh sách attachment cũ. `removeQueries` hủy query ảnh; không thêm một lần `cancelQueries` toàn bộ ứng dụng.

- [ ] **Step 3: Nối đúng ba mutation dùng chung trong `queries/admin-products.ts`.**

Import `evictProductImages`, `invalidateProductPrintData` từ `./product-images`.

Trong mutation `upload` của `useProductDraftCommands`, đổi riêng `onSuccess`:

```ts
onSuccess: (_result, { id }) => {
  invalidateDraftViews(queryClient, mode);
  invalidateProductPrintData(queryClient, id);
},
```

Trong mutation `remove` của `useAdminProductMutations`:

```ts
onSuccess: async () => {
  await evictProductImages(queryClient, id);
  invalidate();
},
```

Trong mutation `removeAttachment`, đồng bộ chi tiết admin hiện có trước khi evict/invalidate:

```ts
onSuccess: async (_result, { attachmentId }) => {
  queryClient.setQueriesData<import('../types/api').ApiResult<AdminProductDetail>>({
    queryKey: queryKeys.adminProducts.all,
    predicate: query => query.queryKey[3] === 'detail' && query.queryKey[4] === id,
  }, current => current ? {
    ...current,
    data: {
      ...current.data,
      attachments: current.data.attachments.filter(file => file.id !== attachmentId),
    },
  } : current);
  await evictProductImages(queryClient, id, attachmentId);
  invalidate();
},
```

`AdminProductDetail` và `ApiResult` đã được import trong file; dùng `ApiResult<AdminProductDetail>` ở code sau khi format, không thêm type mới. Không đổi mutation submit/create/update để phục vụ cache ảnh.

- [ ] **Step 4: Nối luồng xóa của chủ hồ sơ.**

Import `evictProductImages` ở hai page. Trong `MyProductDetailPage.removeAttachment`, giữ nguyên API call và `setQueryData<Product>` lọc attachment; ngay sau cập nhật chi tiết và trước invalidation danh sách, thêm:

```ts
await evictProductImages(queryClient, productId, attachmentId);
```

Trong `MyProductsPage.remove`, sau API xóa và thao tác lọc danh sách hiện có, thêm:

```ts
await evictProductImages(queryClient, id);
```

Giữ nguyên `try/catch/finally`, busy guard và thông báo lỗi. Chỉ evict sau API thành công; lỗi xóa phải giữ nguyên ảnh và dữ liệu sản phẩm. Xóa PDF không có Blob query tương ứng nhưng vẫn cập nhật metadata phiếu in đúng cách.

- [ ] **Step 5: Chạy kiểm thử mới và kiểm tra mutation bằng UI.**

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/product-images.test.ts ../web/test/session-contract.test.ts
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm typecheck
```

Expected: PASS gộp request, thời hạn, GC, hủy query, late response, upload không mất Blob còn đúng và xóa đúng sản phẩm/ảnh. Trong UI kiểm tra ba tình huống riêng: admin xóa ảnh khỏi draft; chủ hồ sơ xóa ảnh; chủ hồ sơ/admin xóa cả draft. Sau đó mở trang in trong cùng SPA: ảnh đã xóa không xuất hiện trở lại. Upload ảnh mới phải tạo ID mới, danh sách chọn ảnh in cập nhật, ảnh cũ không bị tải lại hàng loạt. Thử xóa khi server trả lỗi: ảnh cũ còn vì thao tác chưa thành công.

- [ ] **Step 6: Chạy cổng kiểm chứng chung của tính năng.**

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/*.test.ts
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
pnpm --filter @ocop/api test --runInBand
pnpm --filter @ocop/api test:db --runTestsByPath test/admin-product-files.db-spec.ts test/e2e-honey-flow.db-spec.ts
pnpm typecheck
pnpm build
git diff --check
```

Kiểm chứng HTTP cache công khai trên browser thật: mở cùng ảnh từ trang chủ/danh sách/chi tiết, tắt Disable cache, quan sát transferred bytes và header. Không dùng `context.route` để chứng minh HTTP cache trình duyệt vì interception có thể vô hiệu hóa cache; fixture route chỉ kiểm tra hành vi query/hiển thị. Hết 300 giây hoặc thử clock phù hợp phải hỏi server lại; lỗi không hiện bản stale. Reload ảnh riêng tư phải phát sinh tải lại, đúng Q2. Không gọi một request `fetch` phía Node là bằng chứng browser cache hoạt động.

Đối chiếu các lỗi với baseline: không sửa lỗi UI/DB ngoài phạm vi. Nếu có phần bị chặn, nêu tên lệnh, nguyên nhân và tiêu chí nào chưa được chứng minh. Chỉ kết luận tính năng hoàn tất khi các yêu cầu tương ứng có bằng chứng.

- [ ] **Step 7: Commit thay đổi đồng bộ cache.**

```powershell
git add -p -- apps/web/src/queries/product-images.ts apps/web/test/product-images.test.ts apps/web/src/queries/admin-products.ts apps/web/src/pages/registrant/MyProductDetailPage.tsx apps/web/src/pages/registrant/MyProductsPage.tsx
git diff --cached --check
git commit -m "fix(web): evict deleted product images and refresh print metadata"
```

## Tự rà soát kế hoạch

Đã đối chiếu trực tiếp với spec; đây là kết quả rà kế hoạch, không phải kết quả chạy kiểm thử ứng dụng:

| Yêu cầu | Task/kiểm chứng |
| --- | --- |
| Q1: công khai + riêng tư, admin/chủ hồ sơ/trang in | Task 1 và 3; tái sử dụng component hiện có |
| Q2: bộ nhớ, không persistence riêng tư | Task 1 `no-store`, Task 2 query, Task 3 Reload và kiểm tra tab |
| Q3: 300 giây, không polling | Task 1 header, Task 2 biên thời gian, Task 3 `openedAt` |
| Q4: nút tải tệp vẫn trực tiếp | Task 2 tham số signal tùy chọn; Task 3 giữ `AttachmentLink` và kiểm tra hai lần bấm |
| Q5: stale phải chờ; lỗi không hiện ảnh cũ | Task 2 `imageBlobForOpen`; Task 3 loading, denied, retry |
| Cùng ảnh gộp request; mode/phiên khác không dùng nhầm | Task 2 query tests, Task 3 đổi phiên và remount |
| Logout/đổi token/quyền, late response | Task 2 revision/cancellation; Task 3 keyed component |
| Object URL cleanup, không chia sẻ URL có thể bị revoke | Task 3 local state/effect, kiểm tra unmount |
| Upload/xóa attachment/xóa draft, metadata in và request đang chạy | Task 4 helper và test late print response |
| Giữ quyền backend, không cache nhầm PDF hoặc lỗi | Task 1 DB matrix và filter; Task 4 lỗi xóa |
| GC hữu hạn và giới hạn RAM được giải thích | Task 2 GC test; Global Constraints |
| Không thay schema, URL, layout, thêm dependency | Bản đồ file và review diff trước từng commit |

Tên/chữ ký được dùng xuyên task: `queryKeys.productImages`, `getSessionCacheRevision`, `privateProductImageOptions`, `imageBlobForOpen`, `invalidateProductPrintData`, `evictProductImages`. Không có đổi tên ngầm giữa các task. Dữ liệu print được giữ dưới `ApiResult<RegistrationPrintData>`, khác với query chi tiết chủ hồ sơ chứa trực tiếp `RegistrantProduct`.

Kiểm tra trong giai đoạn lập kế hoạch: 30 code block hợp lệ về cú pháp trong ngữ cảnh được hướng dẫn; kiểm tra kiểu trong bộ nhớ cho query ảnh, thumbnail, key, transport và revision không ghi nhận lỗi. Việc này không ghi app code ra file và không thay thế việc chạy test/browser/DB khi triển khai. Đã rà tất cả caller upload/xóa attachment/xóa draft hiện có bằng tìm kiếm source; không thấy luồng mutation thứ hai ngoài các điểm đã liệt kê.

## Tài liệu đối chiếu cho người thực hiện

- [Spec đã chốt Q1–Q5](../specs/2026-10-26-image-cache-design.md).
- [Nghiên cứu cache ảnh của dự án](../../research/2026-10-26-image-caching.md).
- [Node 24 MockTimers](https://nodejs.org/docs/latest-v24.x/api/test.html#class-mocktimers): dùng đồng hồ giả cho kiểm thử GC, không chờ 5 phút thật.
- Source đang cài của Nest `router-execution-context.js`: guard chạy trước header decorator; vì vậy cần kiểm tra lỗi ở filter.
- Source đang cài của TanStack Query: `clear/removeQueries` hủy query; truyền signal vào Axios để hủy cả tải mạng.

Kế hoạch này chưa thực thi. Không có app code, test code hoặc commit ứng dụng được tạo trong giai đoạn lập kế hoạch.
