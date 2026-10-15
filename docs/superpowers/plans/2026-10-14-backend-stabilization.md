# OCOP Backend Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa các lỗi đã xác minh trong backend OCOP, bảo vệ kết quả chấm và phiên đăng nhập, rồi kiểm chứng các luồng chính trên PostgreSQL thử nghiệm.

**Architecture:** Giữ NestJS controller → service → repository và Prisma hiện tại. Dùng khóa DB trong transaction cho chấm/phân công, dùng chung hàm tổng hợp điểm ở hai nơi thực sự cần, và tăng phiên bản token khi đổi mật khẩu. Chỉ đổi frontend ở các luồng bị ảnh hưởng: đăng ký lỗi email và đăng xuất sau đổi mật khẩu.

**Tech Stack:** pnpm, Node.js >=24.7 <25, NestJS 11, Prisma 7, PostgreSQL, Jest/ts-jest, class-validator, bcryptjs, React/Vite/TanStack Router.

**Spec:** `2026-10-12-ocop-scoring-system-design.md`; `docs/superpowers/plans/2026-10-13-ocop-monorepo.md`; phạm vi sửa lỗi và các quyết định nghiệp vụ bên dưới dựa trên báo cáo review trong chat.

## Global Constraints

- API prefix: `/api`.
- Roles: `REGISTRANT`, `JUDGE`, `ADMIN`.
- Access JWT lifetime: 7 days; registration and password reset use 6-digit email OTP with 5-minute expiry.
- Product status flow: `DRAFT` → `SUBMITTED` → `SCORING` → `COMPLETED`.
- Five-star thresholds: 90, 70, 50, 30 points.
- Upload limit: 10 MB per file; accept image and PDF evidence only. Implementation hiện tại dùng 10 MiB; giữ `MAX_IMAGE_BYTES = 10 * 1024 * 1024`, cập nhật tài liệu cho nhất quán.
- Criteria and form fields must come from Quyết định 26/2026/QĐ-TTg and its appendices; do not invent legal scoring content.
- Không chạy migration, seed hoặc reset trên DATABASE_URL hiện có. Chỉ chạy kiểm thử DB trên PostgreSQL thử nghiệm được tạo riêng cho tác vụ.
- Không thêm refresh token, Redis, queue, S3, giao diện sửa bộ tiêu chí hoặc hệ thống workflow mới.
- Không revert/stage toàn bộ thay đổi đang có của người dùng. Chỉ sửa đúng file/hunk của từng task; tạo checkpoint commit khi có thể tách được thay đổi.
- Đây là plan, chưa phải xác nhận các lỗi đã được sửa. Các câu lệnh, snippets và test dưới đây chạy ở giai đoạn thực hiện.

## Phạm vi và thứ tự

| Giai đoạn | Tasks | Kết quả |
|---|---|---|
| 1 — Chạy được, chuẩn bị kiểm chứng | 1–3 | Startup đúng, test DB biệt lập, raw SQL đúng schema |
| 2 — Sửa tính đúng và bảo mật | 4–8 | Chấm/phân công nhất quán, thu hồi token, validation và phục hồi đăng ký |
| 3 — Vận hành và hoàn thiện | 9–12 | Swagger, seed an toàn, constants/docs/health/log, kiểm thử cuối |

Tasks 4 và 5 phải thực hiện nối tiếp vì chia sẻ quy tắc khóa và tổng hợp. Task 6 chứa cả schema/API/frontend để không tạo phiên bản chạy được nhưng frontend vẫn giữ token đã bị thu hồi. Các task khác có thể review độc lập sau khi hoàn thành dependencies.

## Quyết định nghiệp vụ dùng để triển khai

1. Phiếu `SUBMITTED` không được sửa điểm hoặc tự quay về nháp.
2. Khi hồ sơ đang mở đã có phiếu nộp, không cho đổi tập tiêu chí của giám khảo đã nộp. So sánh tập tiêu chí thực tế: `criterionIds=[]` nghĩa là toàn bộ, không so sánh JSON theo thứ tự.
3. Vẫn cho gỡ giám khảo chưa nộp nếu phân công còn lại phủ đủ tiêu chí. Khi đó tổng hợp lại hồ sơ trong chính transaction thay phân công.
4. Đổi phạm vi giám khảo đang chấm nháp: xóa điểm nháp của người đó trên hồ sơ đang mở, đặt total về null, giữ phiếu `IN_PROGRESS`; UI phải tải lại phạm vi mới. Không giữ lựa chọn ngoài phạm vi mới.
5. Hồ sơ `COMPLETED` giữ nguyên kết quả khi admin đổi phân công cho công việc tiếp theo. Không tự mở lại hoặc tính lại lịch sử.
6. Đổi/reset mật khẩu thành công làm vô hiệu hóa tất cả JWT đã cấp trước đó, kể cả phiên đang dùng. Người dùng đăng nhập lại; không cấp refresh token.
7. SMTP lỗi không xóa tài khoản đã tạo. UI cung cấp đường sang xác thực/gửi lại mã, không ghi password/OTP vào storage hoặc log.
8. Seed lại dữ liệu không đổi là hợp lệ. Bộ tiêu chí đã có phiếu chấm không được thay đổi nội dung/cấu trúc/điểm qua seed.

## Bản đồ file

| Files | Trách nhiệm thay đổi |
|---|---|
| `apps/api/package.json` | Startup và scripts test DB |
| `apps/api/test/jest-db.json`, `apps/api/test/support/db-app.ts`, `apps/api/test/*.db-spec.ts` | Test PostgreSQL/API biệt lập bằng Jest và fetch sẵn có |
| `apps/api/src/prisma/sql.ts` | Định danh schema/table/type an toàn cho raw SQL |
| `apps/api/src/repositories/{auth,products,admin,evaluations}.repository.ts` | SQL, khóa, điều kiện ghi và phân công |
| `apps/api/src/utils/evaluation-result.ts`, `apps/api/src/utils/scoring.ts` | Khóa chung/tổng hợp dùng ở submit và thay phân công; tính điểm thuần |
| `apps/api/prisma/schema.prisma`, migration mới | `User.tokenVersion`; migration bổ sung không sửa lịch sử đã áp dụng |
| `apps/api/src/{services/auth.service.ts,guards/account.guard.ts,guards/jwt-auth.guard.ts,types/auth.ts}` | Cấp/kiểm tra JWT và thu hồi phiên |
| `apps/api/src/dtos/{products,admin}.dto.ts` | Phân biệt optional với nullable |
| `apps/api/src/config/app.ts`, `apps/api/src/controllers/*.ts`, `apps/api/nest-cli.json` | OpenAPI schema/security |
| `apps/api/prisma/seed/seed.ts` | Chặn sửa bộ tiêu chí đã dùng trước mọi ghi dữ liệu |
| `apps/api/src/constants/{auth,products}.ts` | Giá trị chính sách dùng lại trong API/seed |
| `apps/api/src/{services/health.service.ts,filters/api-exception.filter.ts}` | Readiness và log lỗi được che thông tin nhạy cảm |
| `apps/web/src/pages/AuthPages.tsx` | Phục hồi đăng ký và đăng xuất sau đổi mật khẩu |
| `README.md`, `apps/api/README.md`, `apps/api/docs/{operations,backend-architecture}.md` | Hướng dẫn đúng backend OCOP hiện tại |

Giữ nguyên các controller/service không cần đổi. Không tách repository chỉ để làm đẹp. `packages/shared` hiện chỉ export types, nên không import runtime constants từ package đó nếu chưa có runtime entrypoint.

## Task 1: Sửa đường dẫn chạy production

**Files:** Modify `apps/api/package.json:18`; kiểm tra `apps/api/tsconfig.build.json` và output build.

**Interfaces:** Giữ tên scripts; `pnpm --filter @ocop/api start:prod` phải chạy output của `build`.

- [ ] **Step 1 — Xác nhận lỗi trước sửa.**

```powershell
pnpm --filter @ocop/api build
pnpm --filter @ocop/api exec node -e "require('node:assert/strict').ok(require('node:fs').existsSync('dist/main.js'))"
```

Expected hiện tại: assert thất bại; output thật là `dist/src/main.js`.

- [ ] **Step 2 — Sửa nhỏ nhất, giữ layout build.**

```json
"start:prod": "node dist/src/main.js"
```

- [ ] **Step 3 — Kiểm tra entrypoint.**

```powershell
pnpm --filter @ocop/api build
pnpm --filter @ocop/api exec node -e "const a=require('node:assert/strict'),f=require('node:fs'),p=require('./package.json');a.equal(p.scripts['start:prod'],'node dist/src/main.js');a.ok(f.existsSync('dist/src/main.js'))"
```

Expected PASS. Startup/health smoke thực tế chạy trong Task 12 bằng env thử nghiệm.

- [ ] **Step 4 — Review diff/checkpoint riêng.** Không commit toàn bộ package.json nếu còn hunk của người dùng không thuộc task.

## Task 2: Khôi phục bộ kiểm thử DB/API có môi trường riêng

**Files:** Create `apps/api/test/jest-db.json`, `apps/api/test/support/db-app.ts`, `apps/api/test/backend.db-spec.ts`; Modify `apps/api/package.json`.

**Interfaces:** `withTestApp(run: (context: { app: INestApplication; prisma: PrismaService; baseUrl: string }) => Promise<void>): Promise<void>`. `apiRequest<T>(baseUrl: string, path: string, init?: RequestInit): Promise<{ status: number; body: T }>` dùng fetch của Node. Không thêm supertest hoặc Nest testing dependency.

- [ ] **Step 1 — Thêm config/script cho bộ test riêng.**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testRegex": "test/.*\\.db-spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "transformIgnorePatterns": ["node_modules/(?!.*uuid)"],
  "moduleNameMapper": { "^(\\.{1,2}/.*)\\.js$": "$1" },
  "testEnvironment": "node",
  "testTimeout": 60000
}
```

```json
"test:db": "jest --config test/jest-db.json --runInBand"
```

- [ ] **Step 2 — Implement harness với DB riêng cho từng lần gọi.** Dùng `TEST_DATABASE_URL` trỏ vào PostgreSQL local chỉ dành cho test; kiểm tra hostname loopback và database name kết thúc `_test`. Tạo schema `ocop_test_` + `randomUUID().replaceAll('-', '')`; mọi migration/seed/API của lần test phải dùng URL gắn schema này. Harness giữ nguyên env ngoài test và phục hồi trong `finally`.

```ts
const testUrl = new URL(process.env.TEST_DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(testUrl.hostname) ||
    !testUrl.pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a local *_test database');
}
const schema = `ocop_test_${randomUUID().replaceAll('-', '')}`;
testUrl.searchParams.set('schema', schema);
```

Trong `db-app.ts`: dùng `pg.Client` kết nối DB test, `CREATE SCHEMA` với tên đã sinh; dùng `spawnSync('node', [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { cwd: apiRoot, env: testEnv, encoding: 'utf8' })`. Chạy seed qua `spawnSync('node', ['--import', 'tsx', 'prisma/seed/seed.ts'], options)` sau migrate. Kiểm tra `status===0`, không in toàn bộ env/URL.

Tạo Nest app bằng `NestFactory.create(AppModule, { logger: false })`, thay `MailService.sendOtp` trên instance bằng mock trong từng test trước request đầu tiên, `configureApp(app)`, `app.listen(0, '127.0.0.1')`. `testEnv` ghi đè JWT secret giả 32+ bytes, SMTP credentials giả, `STORAGE_PATH` là thư mục tạm mới và xóa `BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD` kế thừa; không gửi mail thật hoặc dùng mật khẩu bootstrap hiện có. Dọn app/client và chỉ DROP schema đúng tên đã tạo; nếu setup lỗi vẫn dọn schema đã tạo. Phục hồi các env keys sau từng lần gọi harness, không để test ghi đè env cho task tiếp theo.

Hàm request cụ thể:

```ts
export async function apiRequest<T>(baseUrl: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, init);
  return { status: response.status, body: await response.json() as T };
}
```

- [ ] **Step 3 — Viết test hạ tầng chạy thật.**

```ts
it('migrates, seeds and serves the isolated database', async () => {
  await withTestApp(async ({ prisma, baseUrl }) => {
    expect(await prisma.productCategory.count()).toBe(26);
    const result = await apiRequest(baseUrl, '/categories');
    expect(result.status).toBe(200);
  });
});
```

Expected ban đầu có thể FAIL do raw SQL custom schema; bộ test không được đổi sang public để né Task 3. Migration/seed thuần vẫn phải hoàn tất; test Task 3 bổ sung đường raw SQL.

- [ ] **Step 4 — Kiểm tra dọn schema và ghi checkpoint.** `pnpm --filter @ocop/api test:db` phải fail rõ ràng nếu chưa cấu hình DB test, không tự fallback sang DATABASE_URL.

## Task 3: Sửa raw SQL cho custom schema

**Files:** Create `apps/api/src/prisma/sql.ts`, `sql.spec.ts`; Modify raw queries trong auth/products/admin repositories; Test `apps/api/test/backend.db-spec.ts`.

**Interfaces:** `databaseObject(name: string, databaseUrl?: string): Prisma.Sql` trả identifier schema-qualified. Helper dùng cho table và enum type, không dùng cho dữ liệu request.

- [ ] **Step 1 — Test identifier và đường raw SQL.**

```ts
expect(databaseObject('products', 'postgresql://u:p@localhost/ocop_test?schema=ocop').text)
  .toBe('"ocop"."products"');
expect(databaseObject('OtpPurpose', 'postgresql://u:p@localhost/ocop_test').text)
  .toBe('"public"."OtpPurpose"');
expect(databaseObject('users', 'postgresql://u:p@localhost/ocop_test?schema=a%22b').text)
  .toBe('"a""b"."users"');
```

DB tests: tạo OTP rồi consume; tạo/sửa draft; gọi `/admin/dashboard` với token ADMIN trong schema của harness. Expected trước sửa: raw queries truy cập sai schema.

- [ ] **Step 2 — Implement helper và thay mọi raw identifier.**

```ts
import { Prisma } from '@prisma/client';

export function databaseObject(name: string, databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const schema = new URL(databaseUrl).searchParams.get('schema') ?? 'public';
  const quote = (value: string) => {
    if (!value || value.includes('\0')) throw new Error('Invalid database identifier');
    return `"${value.replaceAll('"', '""')}"`;
  };
  return Prisma.raw(`${quote(schema)}.${quote(name)}`);
}
```

```ts
await tx.$queryRaw(Prisma.sql`
  SELECT "id" FROM ${databaseObject('products')}
  WHERE "id" = ${productId} FOR UPDATE
`);
```

Áp dụng cả `FROM/JOIN` và cast `::${databaseObject('OtpPurpose')}`, `ProductStatus`, `EvaluationStatus`, `Role` trong dashboard. Mọi email/id/purpose vẫn truyền bằng bind parameter. Không dùng `$queryRawUnsafe`.

- [ ] **Step 3 — Run unit + DB test.**

```powershell
pnpm --filter @ocop/api test -- --runInBand prisma/sql.spec.ts
pnpm --filter @ocop/api test:db
```

- [ ] **Step 4 — Review tất cả `$queryRaw` bằng rg, checkpoint.** Adapter được giữ nguyên; helper làm schema rõ ràng mà không thay pool/session configuration.

## Task 4: Bảo vệ lưu nháp/nộp phiếu và dùng chung tính điểm

**Files:** Modify `apps/api/src/repositories/evaluations.repository.ts`, `apps/api/src/repositories/products.repository.ts` (submitDraft); Create `apps/api/src/utils/evaluation-result.ts`; giữ `scoring.ts`; Test `apps/api/test/evaluation.db-spec.ts`.

**Interfaces:** `lockEvaluationCategory(tx: Prisma.TransactionClient, categoryId: string): Promise<void>`; `recomputeProductResult(tx: Prisma.TransactionClient, productId: string): Promise<void>`. Submit và Task 5 cùng gọi recompute trong transaction của mình.

- [ ] **Step 1 — Test không thay đổi phiếu đã nộp.** Fixture tạo qua Prisma trong test: category/criteria/options; user registrant; hai judge active/verified; sản phẩm SUBMITTED; assignments. Đặt tổng max fixture =100; không sửa seed chính thức.

```ts
await repository.saveDraft(judgeId, productId, scores);
await repository.submit(judgeId, productId);
await expect(repository.saveDraft(judgeId, productId, changedScores))
  .rejects.toThrow('Submitted evaluations are immutable');
expect((await prisma.evaluation.findUniqueOrThrow({
  where: { judgeId_productId: { judgeId, productId } },
})).status).toBe('SUBMITTED');
```

Trong test đồng thời, dùng connection riêng giữ khóa sản phẩm, cho request save và submit cùng bắt đầu, rồi thả khóa. Kiểm tra mọi thứ tự hợp lệ: submit trước thì save bị từ chối; save trước thì submit dùng bộ điểm mới. Luôn không có trạng thái SUBMITTED bị đổi về IN_PROGRESS hoặc COMPLETED quay lại SCORING. Không dùng sleep để giả định thứ tự commit.

- [ ] **Step 2 — Đặt thứ tự khóa rõ ràng.** Trong `saveDraft/submit`: đọc categoryId → khóa category → khóa product → tải lại assigned-product/trạng thái → ghi dữ liệu. So sánh categoryId sau khóa; nếu category vừa đổi thì trả 409 và không ghi. Task 5 lấy khóa category cùng thứ tự trước khi thay phân công.

```ts
export async function lockEvaluationCategory(tx: Prisma.TransactionClient, categoryId: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM ${databaseObject('product_categories')}
    WHERE "id" = ${categoryId} FOR UPDATE
  `);
}
```

Giữ khóa đến commit. `ProductsRepository.submitDraft` cũng lấy category → product lock rồi đọc lại category trước chuyển DRAFT sang SUBMITTED, để thay phân công không bỏ sót hồ sơ vừa mở. Giữ các kiểm tra ownership/formData hiện tại. Dùng READ COMMITTED cộng khóa chung cho các invariant đã xác định; không giữ Serializable hiện tại nếu không có retry và chỉ gây lỗi P2034 cho luồng bình thường. Comment giới hạn thực tế: `shortcut: serialize scoring writes per category; use finer locks if measured contention warrants`.

- [ ] **Step 3 — Dùng hàm tổng hợp chung, không coi thiếu điểm là 0.** `recomputeProductResult` tải product + criteria/subcriteria, assignments và evaluations đã nộp của các judge còn được giao. Với mỗi judge, giải `[]` thành toàn bộ criteria; kiểm tra scores phủ chính xác subcriteria của scope đó, option thuộc subcriterion và tổng điểm lấy từ option.

Nếu thiếu phiếu/tiêu chí/điểm: giữ SUBMITTED nếu chưa có evaluation, ngược lại SCORING; xóa `finalScore/starRating` về null trên hồ sơ đang mở. Nếu dữ liệu submitted không khớp scope: throw ConflictException để không âm thầm cho 0. Nếu đủ: dùng utility hiện tại:

```ts
const finalScore = calculateFinalScore(evaluationTotals, criterionIds);
await tx.product.update({
  where: { id: productId },
  data: finalScore === null
    ? { status: 'SCORING', finalScore: null, starRating: null }
    : { status: 'COMPLETED', finalScore, starRating: calculateStars(finalScore) },
});
```

`evaluationTotals` là `EvaluationCriterionTotals[]`: mỗi phần tử có `total` từ các option thực tế và `criterionTotals` chỉ chứa tiêu chí thật sự đã chấm đủ. Không thay thuật toán điểm trung bình theo tiêu chí đã có. Product COMPLETED được trả về sớm khi recompute từ thay phân công; submit chỉ gọi khi product đang mở.

- [ ] **Step 4 — Run kiểm tra.** Test thêm full scope trung bình 80, partial scope tổng 75 theo `scoring.spec.ts`, các ngưỡng 30/50/70/90, thiếu điểm và hai judge nộp đồng thời. Run `pnpm --filter @ocop/api test:db` và unit scoring; checkpoint.

## Task 5: Làm thay phân công nhất quán với phiếu chấm

**Files:** Modify `apps/api/src/repositories/admin.repository.ts`, `apps/api/src/services/admin.service.ts`; dùng helper Task 4; Test `apps/api/test/assignment.db-spec.ts`.

**Interfaces:** Giữ `replaceAssignments(assignments, actorId, reason, meta)` và response hiện tại. 409 khi đổi phạm vi phiếu đã nộp; thay đổi hợp lệ và recompute cùng transaction/audit.

- [ ] **Step 1 — Tái hiện hai lỗi bằng DB test.**

```ts
await expect(admin.replaceAssignments(widenSubmittedJudge, adminId, undefined, {}))
  .rejects.toThrow(ConflictException);
expect(await prisma.judgeAssignment.findUnique({
  where: { judgeId_categoryId: { judgeId, categoryId } },
})).toEqual(beforeAssignment);
```

```ts
await admin.replaceAssignments(onlyAlreadySubmittedJudge, adminId, undefined, {});
const result = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
expect(result.status).toBe('COMPLETED');
expect(result.finalScore).toBe(90);
expect(result.starRating).toBe(5);
```

Fixtures cụ thể: test đầu j1 chấm A=50, j2 được giao B, mở scope j1 thành A+B; test sau j1 được giao toàn bộ và đã nộp 90, j2 chưa nộp.

- [ ] **Step 2 — Khóa và kiểm tra lại references trong transaction.** `replaceAssignments` hiện thay toàn bộ bảng, nên khóa tất cả category theo `ORDER BY id FOR UPDATE`; sau đó kiểm tra judge còn active/JUDGE, category và criterion membership trong transaction. `deactivateJudge` lấy cùng tập khóa trước đọc assignments/open-products và đổi active/delete assignment, để không thể thêm phân công cho judge vừa bị vô hiệu hóa. Không dựa duy nhất vào kiểm tra ngoài transaction của service. Giữ guard coverage cho hồ sơ mở.

```ts
await tx.$queryRaw(Prisma.sql`
  SELECT "id" FROM ${databaseObject('product_categories')}
  ORDER BY "id" FOR UPDATE
`);
```

- [ ] **Step 3 — Chặn đổi scope submitted; reset draft khi scope thay đổi; recompute hồ sơ mở.** So sánh tập scope đã giải thành ID; dùng cùng phép so sánh cho mọi category.

```ts
const sameScope = oldIds.length === newIds.length &&
  oldIds.every((id) => newIds.includes(id));
if (!sameScope && hasSubmittedEvaluationOnOpenProduct) {
  throw new ConflictException('Cannot change criteria for a submitted evaluation');
}
```

Giữ submitted evaluation lịch sử khi xóa assignment; không delete evaluation/score đó. Khi đổi scope IN_PROGRESS, delete scores + set total null trong cùng transaction. Sau ghi assignments, gọi `recomputeProductResult(tx, product.id)` cho các hồ sơ SUBMITTED/SCORING trong các category bị thay đổi; audit cuối transaction. Không chạm kết quả COMPLETED.

- [ ] **Step 4 — Run tests/checkpoint.** Bổ sung case giữ nguyên assignments không reset draft, chỉ đảo thứ tự criterionIds không bị 409, [] tương đương all, missing coverage rollback, và thay assignment đồng thời submit cho kết quả theo thứ tự commit hợp lệ.

## Task 6: Thu hồi JWT sau mọi đường đổi mật khẩu

**Files:** Modify schema, auth/admin repositories, AuthService, JWT/Account guards, `types/auth.ts`, `AuthPages.tsx`; Create migration mới và `apps/api/test/auth.db-spec.ts`; Update auth unit fixtures.

**Interfaces:** `AccessTokenPayload.tokenVersion: number`; `User.tokenVersion Int @default(0)`; `findUserById(id: string): Promise<(PublicUser & { isActive: boolean; tokenVersion: number }) | null>` và Prisma select trả thêm tokenVersion nhưng PublicUser API không lộ trường nội bộ này.

- [ ] **Step 1 — Test token cũ hết hiệu lực cho đủ ba đường.** Với verified user, login lấy token A; đổi mật khẩu bằng A → `/auth/me` bằng A trả 401; login mới lấy B → `/auth/me` bằng B trả 200. Lặp lại cho reset OTP và admin reset judge. Test sai current password không tăng tokenVersion.

```ts
expect(beforeVersion).toBe(0);
await authRepository.changePassword(userId, currentHash, nextHash);
expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).tokenVersion).toBe(1);
```

- [ ] **Step 2 — Thêm schema/migration, giữ nguyên lịch sử đã commit.**

```prisma
tokenVersion Int @default(0)
```

```sql
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
```

Migration mới `0010_backend_stabilization` phải khai báo mọi field/index/table mà schema hiện tại cần nhưng bản `0009` đã commit chưa có, cộng `tokenVersion`. Không sửa, resolve checksum, hay thay nội dung bất kỳ migration đã commit. So sánh bằng `git show HEAD:apps/api/prisma/migrations/0009_ocop_domain/migration.sql` và schema đích. Viết migration 0010 sao cho database đã chạy 0009 cũ được nâng cấp, và database mới chạy 0009 rồi 0010 cũng áp dụng được; dùng `IF NOT EXISTS`/catalog guards cho đối tượng có thể đã được tạo trong bản working tree của 0009. Backfill bắt buộc lấy giá trị chính thức từ seed hiện tại; không ghi điểm/nhãn giả và không xóa dữ liệu OCOP. Kiểm tra migration trên database tạm dựng từ cả hai trạng thái 0009, không đụng DATABASE_URL cấu hình. Không dùng `migrate resolve`, sửa checksum, hoặc reset để né drift.

- [ ] **Step 3 — Tăng version cùng password write và kiểm tra guard.**

```ts
data: { password: newPasswordHash, tokenVersion: { increment: 1 } }
```

Áp dụng cho `AuthRepository.changePassword`, `consumeOtp` RESET_PASSWORD và `AdminRepository.resetJudgePassword`; vẫn giữ điều kiện current hash/active/verified. Login thêm `tokenVersion: user.tokenVersion` vào payload. JWT shape yêu cầu integer >=0; token thiếu claim bị 401. AccountGuard so sánh version trước khi cho qua.

```ts
if (request.user.tokenVersion !== user.tokenVersion) {
  throw new UnauthorizedException('Authentication required');
}
```

- [ ] **Step 4 — Đồng bộ frontend và release note.** Sau đổi thành công:

```ts
setSession(null);
window.location.replace('/login');
```

Xóa thông báo hiện tại rằng phiên thiết bị khác chưa thu hồi. Ghi rõ release này buộc các token cũ thiếu claim đăng nhập lại; deploy schema trước code. Run Prisma generate/validate, unit auth/guard và DB tests; checkpoint.

## Task 7: Chặn null không hợp lệ tại DTO

**Files:** Modify products/admin DTOs; Create `apps/api/src/dtos/update-validation.spec.ts`; DB/API test các PUT hiện tại.

**Interfaces:** Optional `name/categoryId/fullName/reason` chỉ bỏ qua undefined; `description/phone/note` vẫn nhận null đúng ý nghĩa hiện tại.

- [ ] **Step 1 — Test bằng ValidationPipe thật.**

```ts
const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
await expect(pipe.transform({ name: null }, { type: 'body', metatype: ProductUpdateDto }))
  .rejects.toBeInstanceOf(BadRequestException);
await expect(pipe.transform({ fullName: null }, { type: 'body', metatype: UpdateJudgeDto }))
  .rejects.toBeInstanceOf(BadRequestException);
await expect(pipe.transform({ reason: null }, { type: 'body', metatype: UpdateJudgeDto }))
  .rejects.toBeInstanceOf(BadRequestException);
```

- [ ] **Step 2 — Thay decorator trên trường không nullable.**

```ts
@ValidateIf((_object, value) => value !== undefined)
@IsString()
@MinLength(1)
@MaxLength(255)
name?: string;
```

CategoryId giữ giới hạn 100; reason cho empty string nếu service đang coi là không có lý do, nhưng null bị từ chối. Rà mọi `.trim()` trong service để kiểm tra DTO tương ứng; không thêm null guard rải rác thay cho validation boundary.

- [ ] **Step 3 — Kiểm tra không mất khả năng xóa giá trị nullable.** `description:null`, `phone:null` được chấp nhận; `formData:null` bị 400; body thiếu trường optional vẫn hợp lệ. Request lỗi không ghi DB và không trả 500.

- [ ] **Step 4 — Run focused unit + API PUT tests/checkpoint.**

## Task 8: Đường phục hồi đăng ký khi gửi OTP thất bại

**Files:** Modify `apps/web/src/pages/AuthPages.tsx`; mở rộng `apps/api/src/services/auth.service.spec.ts`, `apps/api/test/auth.db-spec.ts`. Giữ API register/resend hiện tại.

**Interfaces:** Không đổi thành công giả hoặc tự thay password của tài khoản pending. UI có đường đến `/verify-otp` kể cả khi đăng ký trước đó lỗi SMTP hoặc đăng ký lại 409.

- [ ] **Step 1 — Test backend trạng thái tài khoản và resend.** Mock MailService.sendOtp reject lần register, resolve lần resend; assert user tồn tại verified=false, password không bị đổi khi retry 409, resend gửi mã mới và verify được.

```ts
mail.sendOtp.mockRejectedValueOnce(new Error('smtp unavailable'));
await expect(service.register(input)).rejects.toThrow('Could not send verification email');
expect((await prisma.user.findUniqueOrThrow({ where: { email: input.email } })).verified).toBe(false);
mail.sendOtp.mockResolvedValueOnce(undefined);
await service.resendRegistrationOtp(input.email);
expect(mail.sendOtp).toHaveBeenCalledTimes(2);
```

- [ ] **Step 2 — Ghi pendingEmail trước request, hiện link phục hồi khi có lỗi.** Chỉ lưu email người dùng tự nhập, không lưu password/OTP; không suy đoán tài khoản tồn tại từ 500.

```tsx
sessionStorage.setItem('ocop.pendingEmail', emailValue);
```

```tsx
{error && <p><Link className="text-link" to="/verify-otp">
  Xác thực email hoặc gửi lại mã
</Link></p>}
```

Giữ lỗi 400/409/500 và thông báo hiện có; không tự resend trong vòng lặp. Login thêm link tự nguyện đến xác thực; trang verify đang có chức năng đổi email nên dùng lại.

- [ ] **Step 3 — Kiểm tra giao diện.** SMTP fail → thấy lỗi + link → email được điền → gửi lại → verify → login. Register 409 không đổi mật khẩu/chủ thể đã có. Kiểm tra keyboard và busy state.

- [ ] **Step 4 — Run API test, web typecheck/build và ghi kết quả kiểm tra UI/checkpoint.**

## Task 9: Hoàn thiện OpenAPI để kiểm thử bằng Swagger

**Files:** Modify `apps/api/src/config/app.ts`, `apps/api/nest-cli.json`; Test `apps/api/test/openapi.db-spec.ts`.

**Interfaces:** Giữ HTTP API; security scheme thống nhất `bearer`. DTO properties được sinh bằng Swagger plugin và class-validator shim.

- [ ] **Step 1 — Test document thật sau build.**

```ts
const document = SwaggerModule.createDocument(app,
  new DocumentBuilder().addBearerAuth().build());
expect(document.components?.securitySchemes).toHaveProperty('bearer');
expect(document.paths['/api/auth/me'].get?.security).toEqual([{ bearer: [] }]);
expect(document.components?.schemas?.RegisterDto).toHaveProperty('properties.email');
```

- [ ] **Step 2 — Đồng bộ scheme và bật plugin.** Đổi `.addBearerAuth(options, 'access-token')` sang tên `bearer` hoặc bỏ name để dùng default; không sửa từng controller nếu tất cả đã dùng default.

```json
"plugins": [{
  "name": "@nestjs/swagger",
  "options": { "classValidatorShim": true, "dtoFileNameSuffix": [".dto.ts"] }
}]
```

Plugin đặt trong compilerOptions. Kiểm tra `nest build --tsc` có áp transformer; test document phải dùng classes từ output build vì ts-jest không tự chạy Swagger transformer. Nếu build driver không chạy plugin, khai báo `@ApiProperty/@ApiPropertyOptional` trực tiếp cho DTO, không giữ hai cơ chế cùng làm một việc.

- [ ] **Step 3 — Kiểm tra upload và security references.** Multipart upload cần schema `file: { type: 'string', format: 'binary' }`; dùng `@ApiBody` trên upload hiện có. Mọi security requirement phải tham chiếu một scheme đã khai báo, DTO nested formData/scores/assignments có properties đúng.

- [ ] **Step 4 — Build, OpenAPI assertion, thử Authorize/Try it out với token test; checkpoint.**

## Task 10: Ngăn seed sửa lịch sử chấm

**Files:** Modify `apps/api/prisma/seed/seed.ts`; Test `apps/api/test/seed.db-spec.ts`. Không thay nội dung official JSON.

**Interfaces:** Seed unchanged idempotent. Nếu category có evaluation và cấu trúc/nội dung scoring khác bản DB, seed phải thất bại trước mọi ghi dữ liệu.

- [ ] **Step 1 — DB test hai lần seed và thay points.** Chạy seed hai lần trên schema test, assert category/criterion/option IDs không đổi. Tạo evaluation liên quan; sửa bản sao seed JSON trong thư mục tạm của test, tăng points hoặc đảo options; chạy seed subprocess từ sandbox copy với paths tương ứng. Assert exitCode khác 0 và giá trị DB/tổng điểm không đổi. Không sửa JSON workspace để chạy test.

- [ ] **Step 2 — Preflight toàn bộ bundles trước upsert đầu tiên.** Tải categories có evaluation + criteria/subcriteria/options theo stable code/order; chuẩn hóa projection để so sánh không chứa ID/timestamp, có code/name/maxScore/section/order/content/options label/points/order. So sánh toàn bộ danh sách, không chỉ item upsert để phát hiện option/criterion bị xóa.

```ts
if (hasEvaluations && JSON.stringify(existingScoring) !== JSON.stringify(incomingScoring)) {
  throw new Error(`Cannot alter used scoring criteria for category ${categoryId}`);
}
```

Định nghĩa projection bằng type `CriteriaSeed` đang có và sort criterion/subcriteria theo order, options theo order. Preflight và seed trong transaction; khóa category theo thứ tự giống Task 4/5, để không xuất hiện evaluation giữa kiểm tra và ghi. Transaction seed dùng `{ timeout: 60000, maxWait: 5000 }`, tránh mặc định 5 giây cho hàng nghìn option. Bootstrap admin chạy sau transaction scoring. Dữ liệu không đổi được seed lại bình thường.

- [ ] **Step 3 — Kiểm tra rollback.** Với một bundle bị chặn ở cuối danh sách, các bundle trước không được thay đổi một phần. Không dùng deleteMany hoặc cascade để vượt hạn chế.

- [ ] **Step 4 — Run seed DB tests và ghi hướng dẫn: edition mới cần thay đổi thiết kế version trong tác vụ riêng; checkpoint.**

## Task 11: Gom constants, readiness, log và tài liệu

**Files:** Create `apps/api/src/constants/auth.ts`, `products.ts`; Modify callers được nêu bên dưới, health service/test, exception filter/test và docs. Không tạo config framework.

**Interfaces:** API paths/response success giữ nguyên; `/system/health/ready` trả 503 khi DB không sẵn sàng, `/live` vẫn 200. Constants không đổi policy.

- [ ] **Step 1 — Gom đúng giá trị đang dùng chung.**

```ts
export const PASSWORD_ROUNDS = 12;
export const PASSWORD_MAX_BYTES = 72;
export const JWT_ISSUER = 'ocop-api';
export const JWT_AUDIENCE = 'ocop-web';
export const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
```

AuthService/AdminService/seed dùng rounds/bytes; JWT service/guard dùng issuer/audience; repo dùng OTP TTL/max attempts; MailService diễn đạt phút từ TTL. Giữ regex 6 số ở DTO và dịch vụ hiện tại nếu không thực sự cần runtime regex generator. Giữ rate limit của endpoint tại decorator, không tạo cấu hình throttle mới.

Backend `constants/products.ts` export `productRegistrationTypes` với `satisfies readonly ProductRegistrationType[]` (type import từ shared), dùng trong DTO và submit repository. `packages/shared` chưa có runtime export; không biến type-only package thành library build chỉ để tái sử dụng ba literal. Ghi rõ sự trùng tên với type contract; khi shared có runtime chính thức mới hợp nhất xuyên package. Giữ MAX_IMAGE_BYTES tại helper storage hiện có.

- [ ] **Step 2 — Test readiness thật, implement query có timeout.**

```ts
await expect(service.ready()).resolves.toEqual({ status: 'ok' });
database.$transaction.mockRejectedValueOnce(new Error('database unavailable'));
await expect(service.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
expect(service.live()).toEqual({ status: 'ok' });
```

Inject PrismaService vào HealthService; `ready` mở transaction timeout 3000/maxWait 1000, đặt local statement_timeout=2000, chạy `SELECT 1`; lỗi chuyển thành ServiceUnavailableException('Database is unavailable'). `/live` không query DB. Giá trị timeout single-use giữ local, không tạo env knob chưa cần.

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
  await tx.$queryRaw`SELECT 1`;
}, { timeout: 3000, maxWait: 1000 });
```

- [ ] **Step 3 — Log lỗi 500 có requestId, không log bí mật.** Dùng `requestMeta` helper hiện có, bổ sung requestId vào ApiError/types shared như optional (không làm hỏng FE). Log structured fields: requestId, method, pathname không query, loại exception và `code` nếu có. Không log body/token/password/OTP/DATABASE_URL hoặc message/stack DB có thể chứa params; không đổi response chung thành lỗi chi tiết.

```ts
this.logger.error({
  requestId,
  method: request.method,
  path: request.path,
  errorType: exception instanceof Error ? exception.name : 'UnknownError',
  errorCode: typeof exception === 'object' && exception !== null && 'code' in exception
    ? String(exception.code) : undefined,
});
```

Test filter: lỗi nội bộ chứa password mẫu không xuất hiện trong log/response; requestId hợp lệ đi xuyên, header sai sinh ID mới. Giữ 400/401/403/409 phản ánh đúng HttpException.

- [ ] **Step 4 — Cập nhật docs và kiểm chứng.** Thay task/report/refresh cookie/CSRF/websocket/scheduler cũ bằng luồng OCOP thực có; ghi đúng health `/api/system/health/live|ready`, bootstrap env, start:prod, DB test, storage 10 MiB, migration/token rollout. Không đưa default admin password vào docs. Run focused health/filter tests, full unit/typecheck; checkpoint.

## Task 12: Kiểm thử cuối và bàn giao

**Files:** Hoàn thiện `apps/api/test/backend.db-spec.ts`; cập nhật kết quả thực hiện ngay dưới mục này và docs vận hành. Không tạo feature mới trong task kiểm chứng.

**Interfaces:** Dùng HTTP thật qua fetch, guards thật, repository thật, PostgreSQL test; SMTP được mock, lưu file vào thư mục tạm do harness tạo và chỉ dọn thư mục đó.

- [x] **Step 1 — Một hành trình đầy đủ (đã thêm test; chưa chạy trên PostgreSQL).** Register registrant; capture OTP từ mock MailService (không log); verify; login; tạo product với formData hợp lệ; upload ảnh fixture và PDF fixture; submit; admin tạo hai judge/phân công; judge save/submit; admin results và public detail kiểm tra điểm/sao/trạng thái đúng.

```ts
expect(completed.status).toBe('COMPLETED');
expect(completed.finalScore).toBe(expectedScore);
expect(completed.starRating).toBe(calculateStars(expectedScore));
expect(publicBody.data).not.toHaveProperty('formData');
expect(publicBody.data).not.toHaveProperty('registrant');
expect(publicBody.data.attachments.every((file) => file.type !== 'EVIDENCE')).toBe(true);
```

Fixture HTTP dùng category seeded có criterion/options thật; tạo danh sách scores từ options trả ở judge evaluation, chọn option max hoặc min để tính expectedScore từ dữ liệu thật. Không gán synthetic points vào official seed. Khi API không trả attachment type, kiểm tra tập IDs public là tập IMAGE và không chứa ID PDF thay vì chỉ kiểm tra thuộc tính thiếu.

- [x] **Step 2 — Kiểm tra quyền và OTP (đã thêm test; assertion DB-backed chưa chạy).** Registrant khác không đọc/sửa/xóa/download private hồ sơ; judge chưa giao không chấm hoặc đọc private evidence; non-admin không quản lý judge/assignment; public không lấy PDF. OTP expired/sai 5 lần/reuse/concurrent consume đều bị chặn; không đổi password/account khi OTP invalid. Token thu hồi nhận 401; inactive nhận 401; wrong role nhận 403.

- [ ] **Step 3 — Chạy gate cuối.**

```powershell
pnpm --filter @ocop/api test -- --runInBand
pnpm --filter @ocop/api test:db
pnpm typecheck
pnpm build
pnpm --filter @ocop/api exec prisma validate
```

Start API production với env DB schema test + SMTP giả trên port trống, fetch `/api/system/health/live` và `/ready`, sau đó stop process. DB/schema test phải còn tồn tại trong smoke. Ghi exit code và số test thật vào báo cáo; không ghi PASS cho test bị skip vì DB thiếu.

- [x] **Step 4 — Bàn giao diff và giới hạn.** Phân biệt test mock với DB thật, SMTP chưa test thật, pháp lý nội dung scoring chưa đối chiếu lại. Nếu có DB thật được phép đọc metadata, ghi trạng thái migration; không triển khai hoặc migrate production chỉ vì test đã pass.

### Task 12 execution results — 2026-10-14

- Đã bổ sung hành trình HTTP trong `apps/api/test/backend.db-spec.ts`: đăng ký/OTP/login, dùng category/criteria/options từ seed và response thật, tạo hồ sơ với các trường bắt buộc, upload fixture PNG/PDF trong bộ nhớ qua HTTP, nộp hồ sơ, tạo và phân công hai giám khảo, chấm/nộp theo options API trả về, rồi kiểm tra admin result và public detail. Assertion public evidence so sánh ID IMAGE/PDF vì API không trả attachment type.
- Cùng spec kiểm tra OTP hết hạn qua HTTP trong app context riêng; năm lần sai qua HTTP rồi xác nhận code đúng bị khóa ở `OtpService` trực tiếp (lần gọi HTTP thứ sáu bị limiter thật giới hạn); consume đồng thời qua HTTP; cùng quyền registrant khác đối với hồ sơ COMPLETED và đối với DRAFT (update/delete trên DRAFT), judge chưa phân công, quyền admin, wrong role, inactive token, private/public download. Các kiểm tra thu hồi JWT đã có trong `apps/api/test/auth.db-spec.ts`: password change, OTP reset và admin reset mật khẩu judge.
- **Không chạy được kiểm thử DB thật:** `TEST_DATABASE_URL` chưa được cấu hình. Toàn bộ DB suite chạy fail-closed trước kết nối: 6 suites, 36 tests; 11 passed safety checks, 25 failed vì harness yêu cầu `TEST_DATABASE_URL`. Không dùng `DATABASE_URL`, không migrate/seed/reset và không kết nối DB.
- Offline gates: API unit **10 suites / 48 tests passed**; API typecheck passed; test-inclusive TypeScript check passed; Nest production build (`nest build --tsc`) passed; Prisma validate passed khi chỉ truyền URL thử local làm giá trị config (validate không kết nối).
- Web gates chưa xác minh được vì workspace dependency thiếu `@typescript/typescript-win32-x64` cho typecheck và thiếu `rolldown` cho Vite build; không cài package trong môi trường offline. OpenAPI DB test và production live/ready smoke chưa chạy vì cần DB thử nghiệm an toàn.
- SMTP production chưa được kiểm tra; hành trình mock MailService. Nội dung pháp lý/scoring JSON chưa được đối chiếu độc lập; test chỉ dùng dữ liệu seed hiện có. Trạng thái migration trên DB triển khai chưa được kiểm tra. Vì chưa có PostgreSQL thử nghiệm, các bước tích hợp và tiêu chí hoàn thành cuối vẫn **chưa được xác nhận**.

## Tiêu chí hoàn thành

- [ ] `start:prod` chạy được output build.
- [ ] Không lưu nháp sau khi phiếu đã nộp; chạy đồng thời không làm hỏng trạng thái/điểm.
- [ ] Đổi assignment không tạo điểm 0 giả, không làm hồ sơ kẹt, không sửa kết quả COMPLETED.
- [ ] Mọi đường đổi/reset mật khẩu vô hiệu hóa JWT cũ; FE đăng nhập lại rõ ràng.
- [ ] Null không hợp lệ trả 400; giá trị nullable vẫn xóa được.
- [ ] OTP/raw product locks/dashboard chạy đúng schema tùy chỉnh.
- [ ] Người dùng phục hồi được đăng ký sau lỗi SMTP.
- [ ] Swagger security/DTO/upload schema dùng được.
- [ ] Seed không thay đổi bộ tiêu chí đã dùng; migrate fresh và nâng cấp có lộ trình không phá dữ liệu.
- [ ] Constants/log/readiness/docs đúng hành vi hiện tại.
- [ ] Unit + DB/API tests + typecheck + build + production smoke đều có kết quả được ghi lại.

**Trạng thái bàn giao:** Task 1–12 đã triển khai trong clone cô lập và đều được reviewer đánh giá PASS. Unit test API 48/48, typecheck API và typecheck gồm test, Nest production build cùng Prisma validate đều đạt. Hành trình DB đầy đủ, migration/custom-schema, OpenAPI DB check và production smoke `/live`/`/ready` chưa được xác minh vì thiếu `TEST_DATABASE_URL`; typecheck/build web bị chặn do thiếu dependency platform/rolldown trong workspace offline. Không truy cập `DATABASE_URL`. Các tiêu chí cần PostgreSQL thật vẫn chờ DB thử nghiệm an toàn.

## Self-review của kế hoạch

- Coverage: startup (1); DB test (2,12); custom schema (3); save/submit race và scoring helper (4); scope/assignment stuck (5); thu hồi JWT và migration (6); null DTO (7); SMTP recovery (8); Swagger (9); seed history (10); constants/health/log/docs (11).
- Dependencies: Task 3 → 4 → 5; Task 2 phục vụ các DB checks; Task 6 phải generate Prisma trước typecheck; Task 12 chỉ chạy sau các task chức năng.
- Interfaces: `databaseObject` thống nhất Task 3/4/5; `recomputeProductResult` chỉ ghi trong transaction của caller; `tokenVersion` đồng bộ DB/query/JWT/guard, không lộ trong PublicUser.
- Rủi ro còn lại: migration 0009 đã áp dụng hay chưa chưa biết; category lock có giới hạn throughput; mock mail không xác nhận SMTP production; tổng 100 của seed không chứng minh tính pháp lý nội dung.
- Phần chủ động không làm: refresh token, automatic reopen submitted/completed, criteria versioning UI, queue/retry mail tự động, runtime packaging shared và refactor toàn backend.

## Execution handoff

Plan được lưu để review trước. Sau khi chọn cách thực hiện:

1. **Subagent-driven:** một task mỗi lượt, review correctness và scope sau task; các task có dependency không chạy chồng nhau.
2. **Inline:** thực hiện trong chat hiện tại bằng executing-plans; kiểm tra kết quả sau mỗi giai đoạn.

Trong cả hai cách, giữ các thay đổi hiện có và không chạy lệnh ghi dữ liệu trên database cấu hình của người dùng.
