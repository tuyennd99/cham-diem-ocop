# Kế hoạch thực thi 66 kịch bản kiểm thử hệ thống OCOP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn bị công cụ tạo fixture/tệp mẫu, bổ sung kiểm thử tự động cho các ca biên/hàm/DB và thực thi trọn vẹn 66 kịch bản kiểm thử (`6 E2E` + `60 ca chi tiết`) với bằng chứng ghi vào nhật ký nghiệm thu.

**Architecture:** Tách việc thực thi thành 6 Task độc lập theo phạm vi dữ liệu để tránh xung đột phân công (`JudgeAssignment` áp dụng cho toàn bộ phân loại) và trạng thái tài khoản (`tokenVersion`). Các ca kiểm thử hàm/biên (`SCORE-02`, `SCORE-03`, `FILE-02`, `FILE-06`, `FILE-07`) được ghim vào Jest/Node test hiện có trước, sau đó dùng script tạo fixture trong schema/DB kiểm thử riêng để chạy các ca API/DB và trình duyệt, cuối cùng tổng hợp kết quả vào `docs/verification/2026-10-25-test-scenarios-execution.md`.

**Tech Stack:** Node.js `>=24.7 <25`, pnpm `11.17.0`, React 19, Vite, NestJS 11, Prisma 7, PostgreSQL, Jest (`@ocop/api`), `node:test` (`@ocop/web`).

**Spec:**
- [docs/testing/kich-ban-kiem-thu-ocop.md](../../testing/kich-ban-kiem-thu-ocop.md)
- [docs/testing/huong-dan-su-dung-ocop.md](../../testing/huong-dan-su-dung-ocop.md)

## Global Constraints

- Runtime bắt buộc: Node.js `>=24.7 <25`, pnpm theo `packageManager` trong `package.json`.
- Không chạy migrate, seed hoặc tạo fixture kiểm thử trên database vận hành chính thức; chỉ dùng database kiểm thử riêng hoặc isolated schema (`withTestApp` trong `apps/be/test/support/db-app.ts`).
- Không ghi đè `apps/be/.env` hoặc `apps/web/.env`; không tiết lộ giá trị secret (`DATABASE_URL`, `JWT_SECRET`, `SMTP_PASSWORD`) vào log hay báo cáo.
- Tài khoản seed (`SEED_TEST_ACCOUNTS=true`) dùng mật khẩu mặc định `OcopTest@2026!` (nếu không đặt `SEED_TEST_PASSWORD`). Không chạy lại seed giữa các ca phân quyền (`RBAC`/`USR`).
- Kích thước biên tệp đính kèm: `10 MiB = 10485760 byte`, tối đa `20 tệp/hồ sơ`, định dạng cho phép `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.pdf` (kiểm tra cả đuôi, MIME và chữ ký magic bytes).
- Bộ tiêu chí chuẩn của phân loại `honey-and-other-agri-food` có đúng **12 tiêu chí, 32 tiểu tiêu chí**, tổng tối đa **100 điểm** (`apps/be/prisma/seed-data/criteria-sets-02-13.json`). Không sửa dữ liệu của 26 bộ tiêu chí chuẩn để tạo ca lỗi.
- Quy tắc xếp sao: `< 30` = 1 sao, `[30, 50)` = 2 sao, `[50, 70)` = 3 sao, `[70, 90)` = 4 sao, `[90, 100]` = 5 sao (*"Mức điểm 5 sao / Đề nghị xem xét 5 sao"*). Không làm tròn điểm trước khi xếp sao (`89.999` vẫn là 4 sao, `formatExactScore` cắt tối đa 2 chữ số thập phân thành `'89.99'`).
- Mọi ca kiểm thử trong báo cáo chỉ được ghi `PASS`, `FAIL` hoặc `BLOCKED` dựa trên kết quả chạy thực tế; không gán `PASS` từ việc chỉ đọc mã nguồn.

## Review Focus

- Chuỗi mật khẩu tiếng Việt có dấu ở biên 72 byte UTF-8: `'Đ'.repeat(36)` (36 ký tự, đúng 72 byte) phải hợp lệ, còn `'Đ'.repeat(37)` (37 ký tự, 74 byte) phải bị chặn ở cả client (`validatePasswordBytes`) và server (`MaxByteLength`).
- Điểm trung bình sát ngưỡng 5 sao như `89.999` (ví dụ chia trung bình 3 giám khảo): `calculateStars(89.999)` phải trả `4` và `formatExactScore(89.999)` phải trả `'89.99'`, không được làm tròn thành `'90'` hay `'90.00'`.
- Khi đổi phạm vi phân công của một giám khảo đang có phiếu nháp (`IN_PROGRESS`): nếu tập `criterionIds` thực sự thay đổi (`ASG-03`) thì toàn bộ điểm/ghi chú nháp của phiếu đó bị xóa; nhưng nếu chỉ đổi từ `[]` (toàn bộ) sang danh sách chứa đủ 12 mã tiêu chí hoặc đổi thứ tự mảng (`ASG-07`) thì điểm và ghi chú nháp phải được giữ nguyên.
- Hồ sơ lịch sử thiếu địa bàn (`REP-02`): chỉ khi cả `localityId`, `localityCodeAtSubmit`, `localityNameAtSubmit` và `registrationSnapshot` đều không có thông tin địa bàn thì báo cáo mới xếp vào nhóm **Chưa xác định địa bàn**.
- Giới hạn 20 tệp đính kèm (`FILE-05`) đi qua endpoint có throttle 20 request/phút: bài test kiểm tra tệp thứ 21 phải tạo sẵn 20 bản ghi `Attachment` trong DB trước khi gọi `POST /api/my/products/:id/attachments` đúng 1 lần để nhận `409 Conflict` thay vì bị lẫn với `429 Too Many Requests`.

---

## Bản đồ file theo Task

| Task | File tạo mới / chỉnh sửa | Trách nhiệm |
|---|---|---|
| **Task 1** | Modify: `apps/be/src/utils/scoring.spec.ts`<br>Modify: `apps/web/test/scoring-print.test.ts`<br>Modify: `apps/web/test/api-integration.check.mjs`<br>Modify: `apps/web/test/product-draft-save.test.ts` | Khóa tự động các ca hàm/client biên: `AUTH-04` (72/74 byte UTF-8), `SCORE-01..03` (`89.999`, overlap X/Y), `FILE-02`, `FILE-03`, `FILE-06`, `FILE-07`. |
| **Task 2** | Create: `apps/be/test/support/scenario-files.ts` | Helper sinh bộ tệp nhị phân chuẩn byte (`valid.jpg`, `valid.pdf`, `exact-10mib.pdf`, `over-10mib.pdf` = `10485761` byte, `empty.pdf`, `fake-signature.pdf`) phục vụ cả DB spec và kiểm thử trình duyệt. |
| **Task 3** | Create: `apps/be/test/e2e-honey-flow.db-spec.ts` | Thực thi và kiểm chứng tự động luồng chuẩn `E2E-01..06` (bảng 32 tiểu tiêu chí GK1=82, GK2=76 → `finalScore=79`, `starRating=4`) cùng `SCORE-01`, `SCORE-04`, `JDG-01..06`, `PUB-01..02`. |
| **Task 4** | Modify: `apps/be/test/auth.db-spec.ts`<br>Modify: `apps/be/test/admin-users.db-spec.ts`<br>Modify: `apps/be/test/staff-access.db-spec.ts` | Kiểm chứng nhóm `AUTH-01..07`, `RBAC-01..05` (`VIEW + SCORE` ngoài phân công) và `USR-01..04` (bảo vệ admin cuối cùng, chặn khóa GK đang có hồ sơ mở `409`, thu hồi token `401`). |
| **Task 5** | Modify: `apps/be/test/admin-catalogs.db-spec.ts`<br>Modify: `apps/be/test/admin-products.db-spec.ts`<br>Modify: `apps/be/test/admin-product-files.db-spec.ts`<br>Modify: `apps/be/test/assignment.db-spec.ts` | Kiểm chứng nhóm `CAT-01..02`, `LOC-01`, `SNAP-01`, `REG-01..06`, `FILE-01..05`, `ASG-01..07` (bao gồm `ASG-03` reset nháp và `ASG-07` giữ nháp khi phạm vi tương đương). |
| **Task 6** | Modify: `apps/be/test/admin-scoring-print.db-spec.ts`<br>Modify: `apps/be/test/admin-reports-dashboard.db-spec.ts`<br>Create: `docs/verification/2026-10-25-test-scenarios-execution.md` | Kiểm chứng `PRINT-01..04`, `REP-01..03` (biên múi giờ `+07:00`), `DASH-01` và xuất báo cáo nghiệm thu 66 ca theo mẫu Phần IV của `kich-ban-kiem-thu-ocop.md`. |

---

### Task 1: Kiểm thử đơn vị cho các ca biên mật khẩu, tính điểm, định dạng sao và lưu/upload phía Web

**Files:**
- Modify: `apps/be/src/utils/scoring.spec.ts`
- Modify: `apps/web/test/scoring-print.test.ts`
- Modify: `apps/web/test/api-integration.check.mjs`
- Modify: `apps/web/test/product-draft-save.test.ts`

**Interfaces:**
- Consumes:
  - `calculateFinalScore(evaluations, requiredCriterionIds)` và `calculateStars(score)` từ `apps/be/src/utils/scoring.ts`
  - `formatExactScore(score)` và `formatStarRatingLabel(starRating)` từ `apps/web/src/lib/print-format.ts`
  - `validatePasswordBytes(password)` từ `apps/web/src/lib/auth.ts`
  - `saveProductDraft(options)` và `canStartProductDraftSave(state)` từ `apps/web/src/lib/save-product-draft.ts`
- Produces: Các bài test pin chặt `AUTH-04`, `SCORE-01`, `SCORE-02`, `SCORE-03`, `FILE-02`, `FILE-03`, `FILE-06`, `FILE-07`.

- [ ] **Step 1: Bổ sung test `SCORE-01`, `SCORE-02` (overlap X/Y) và `SCORE-03` (biên `49.99`, `69.99`, `89.999`) vào `apps/be/src/utils/scoring.spec.ts`**

```typescript
describe('OCOP scenario boundaries (SCORE-01..03)', () => {
  it('maps all SCORE-03 boundary scores without pre-rounding', () => {
    expect(calculateStars(0)).toBe(1);
    expect(calculateStars(29.99)).toBe(1);
    expect(calculateStars(30)).toBe(2);
    expect(calculateStars(49.99)).toBe(2);
    expect(calculateStars(50)).toBe(3);
    expect(calculateStars(69.99)).toBe(3);
    expect(calculateStars(70)).toBe(4);
    expect(calculateStars(89.99)).toBe(4);
    expect(calculateStars(89.999)).toBe(4);
    expect(calculateStars(90)).toBe(5);
    expect(calculateStars(100)).toBe(5);
  });

  it('computes SCORE-01 full assignment average (85 and 78 -> 81.5)', () => {
    expect(
      calculateFinalScore(
        [
          { total: 85, criterionTotals: { c1: 85 } },
          { total: 78, criterionTotals: { c1: 78 } },
        ],
        ['c1'],
      ),
    ).toBe(81.5);
  });

  it('computes SCORE-02 overlapping partial assignments (X=50 vs X=40,Y=35 -> 80)', () => {
    expect(
      calculateFinalScore(
        [
          { total: 50, criterionTotals: { X: 50 } },
          { total: 75, criterionTotals: { X: 40, Y: 35 } },
        ],
        ['X', 'Y'],
      ),
    ).toBe(80);
  });
});
```

- [ ] **Step 2: Chạy Jest unit test của `@ocop/api` để xác nhận `scoring.spec.ts` PASS**

Run: `pnpm --filter @ocop/api test --runInBand src/utils/scoring.spec.ts`
Expected: PASS

- [ ] **Step 3: Bổ sung kiểm tra `AUTH-04` (`'Đ'.repeat(36)` = 72 byte hợp lệ, `'Đ'.repeat(37)` = 74 byte bị chặn) và `FILE-02`/`FILE-03`/`FILE-06`/`FILE-07` vào `apps/web/test/api-integration.check.mjs` và `apps/web/test/product-draft-save.test.ts`**

Trong `apps/web/test/product-draft-save.test.ts`, đảm bảo có đủ 3 kịch bản:
- Lỗi `415` ở tệp thứ 2 (`FILE-03`): giữ `product.id`, `requiresReview = false`, `remainingFiles` chỉ còn tệp thứ 2.
- Lỗi `500` hoặc mất mạng ở tệp thứ 2 (`FILE-06`): `requiresReview = true`, `remainingFiles = []` (bỏ danh sách chờ để buộc kiểm tra trước khi chọn lại), `canStartProductDraftSave({ reviewRequired: true, createOutcomeUnknown: false }) === false`.
- Lỗi mạng không rõ kết quả khi `create` (`FILE-07`): `canStartProductDraftSave({ reviewRequired: false, createOutcomeUnknown: true }) === false`.

- [ ] **Step 4: Chạy toàn bộ Node test và contract check của `@ocop/web`**

Run: `pnpm --filter @ocop/api exec node --import tsx --test ../web/test/*.test.ts && pnpm --filter @ocop/web exec node test/api-integration.check.mjs`
Expected: PASS (0 failures)

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/be/src/utils/scoring.spec.ts apps/web/test/scoring-print.test.ts apps/web/test/api-integration.check.mjs apps/web/test/product-draft-save.test.ts
git commit -m "test: cover scenario boundaries for scoring, password utf8 bytes, and draft uploads"
```

---

### Task 2: Tạo helper sinh tệp mẫu chuẩn byte và dữ liệu chấm điểm E2E (`honey-and-other-agri-food`)

**Files:**
- Create: `apps/be/test/support/scenario-files.ts`

**Interfaces:**
- Consumes: `PrismaService` từ `apps/be/src/prisma/prisma.service.ts`
- Produces:
  - `HONEY_E2E_POINTS: Record<string, { gk1: number; gk2: number }>` (khớp chính xác 32 mã tiểu tiêu chí ở mục `1.5` của `kich-ban-kiem-thu-ocop.md`, tổng `gk1 = 82`, `gk2 = 76`).
  - `buildHoneyScores(criteria, judge: 'gk1' | 'gk2', overrides?: Record<string, number>): Array<{ subCriterionId: string; optionId: string; note?: string }>`
  - `scenarioBuffers`:
    - `validJpg(): Buffer` (magic bytes `FF D8 FF E0`, `< 2 MiB`)
    - `validPdf(byteLength?: number): Buffer` (bắt đầu bằng `%PDF-1.4\n`, mặc định `1024` byte, truyền `10 * 1024 * 1024` để tạo tệp đúng `10485760` byte)
    - `overLimitPdf(): Buffer` (`10485761` byte)
    - `emptyBuffer(): Buffer` (`0` byte)
    - `fakeSignaturePdf(): Buffer` (nội dung `MZ-fake-executable`, dùng với tên `gia-mao.pdf` và `contentType: 'application/pdf'`)

- [ ] **Step 1: Viết `apps/be/test/support/scenario-files.ts` với bảng điểm 32 tiểu tiêu chí và các hàm tạo Buffer**

```typescript
export const HONEY_E2E_POINTS: Record<string, { gk1: number; gk2: number }> = {
  '1.1': { gk1: 3, gk2: 3 },
  '1.2': { gk1: 2, gk2: 2 },
  '1.3': { gk1: 3, gk2: 3 },
  '1.4': { gk1: 3, gk2: 3 },
  '1.5': { gk1: 3, gk2: 3 },
  '1.6': { gk1: 3, gk2: 3 },
  '1.7': { gk1: 1, gk2: 1 },
  '2.1': { gk1: 3, gk2: 3 },
  '2.2': { gk1: 3, gk2: 3 },
  '2.3': { gk1: 3, gk2: 3 },
  '2.4': { gk1: 1, gk2: 1 },
  '3.1': { gk1: 3, gk2: 3 },
  '3.2': { gk1: 1, gk2: 1 },
  '3.3': { gk1: 3, gk2: 3 },
  '3.4': { gk1: 2, gk2: 2 },
  '3.5': { gk1: 3, gk2: 3 },
  '4.1': { gk1: 5, gk2: 5 },
  '4.2': { gk1: 3, gk2: 3 },
  '4.3': { gk1: 5, gk2: 5 },
  '5.1': { gk1: 5, gk2: 5 },
  '5.2': { gk1: 2, gk2: 2 },
  '5.3': { gk1: 5, gk2: 5 },
  '6.1': { gk1: 2, gk2: 2 },
  '6.2': { gk1: 2, gk2: 2 },
  '6.3': { gk1: 4, gk2: 2 },
  '6.4': { gk1: 4, gk2: 0 },
  '7': { gk1: 0, gk2: 0 },
  '8': { gk1: 0, gk2: 0 },
  '9': { gk1: 2, gk2: 2 },
  '10': { gk1: 1, gk2: 1 },
  '11': { gk1: 1, gk2: 1 },
  '12': { gk1: 1, gk2: 1 },
};
```

- [ ] **Step 2: Chạy `pnpm --filter @ocop/api typecheck` để xác nhận helper biên dịch sạch**

Run: `pnpm --filter @ocop/api typecheck`
Expected: PASS

- [ ] **Step 3: Commit Task 2**

```bash
git add apps/be/test/support/scenario-files.ts
git commit -m "test(api): add honey E2E score map and binary attachment fixtures"
```

---

### Task 3: Kiểm chứng luồng E2E chuẩn (`E2E-01..06`), chấm điểm (`JDG-01..06`), tổng hợp điểm (`SCORE-01`, `SCORE-04`) và tra cứu công khai (`PUB-01..02`)

**Files:**
- Create: `apps/be/test/e2e-honey-flow.db-spec.ts`

**Interfaces:**
- Consumes: `withTestApp`, `apiRequest` từ `apps/be/test/support/db-app.ts`; `HONEY_E2E_POINTS`, `buildHoneyScores`, `scenarioBuffers` từ Task 2.
- Produces: Bằng chứng thực thi tự động cho `E2E-01..06`, `JDG-01..06`, `SCORE-01`, `SCORE-04`, `PUB-01`, `PUB-02`.

- [ ] **Step 1: Viết bài test `apps/be/test/e2e-honey-flow.db-spec.ts` mô phỏng đúng trình tự 6 bước E2E và các ca `JDG`/`SCORE`/`PUB`**

Các kiểm tra bắt buộc trong spec:
1. **`E2E-01`**: `POST /api/auth/register` với `htx.uminh@ocop.test`, lấy mã OTP từ mock mail/DB trong test app, `POST /api/auth/verify-otp`, `POST /api/auth/login` → `GET /api/my/products` trả mảng rỗng `[]`.
2. **`E2E-02`**: Admin tạo 2 đơn vị `SNNMT`, `SCT`; tạo địa bàn `XP-UMINH-01` (`Xã Khánh An`, `Tỉnh Cà Mau`); tạo `judge1@ocop.test` (`SNNMT`, `['SCORE']`) và `judge2@ocop.test` (`SCT`, `['SCORE']`).
3. **`E2E-03`**: Admin gọi `PUT /api/admin/assignments` giao cả `judge1` và `judge2` chấm toàn bộ (`criterionIds: []`) phân loại `honey-and-other-agri-food`.
4. **`E2E-04` & `PUB-02`**: Chủ thể 1 tạo hồ sơ `Mật ong rừng tràm U Minh nguyên chất 500ml` (`DRAFT`), tải lên `anh-chai-mat-ong.jpg` và `giay-chung-nhan-attp.pdf`. Khi còn `DRAFT`, gọi `GET /api/products/:id` trả `404`. Sau khi `POST /api/my/products/:id/submit`, trạng thái là `SUBMITTED`; `GET /api/products/:id` trả `200`, có ảnh nhưng **không có** `formData` và **không có** tệp `EVIDENCE`.
5. **`E2E-05`, `JDG-01..05`**:
   - `GET /api/judge/products` của `judge1` chứa hồ sơ vừa nộp.
   - `judge1` lưu nháp 31/32 tiểu tiêu chí → sản phẩm chuyển sang `SCORING`.
   - `POST /api/judge/products/:id/evaluation/submit` khi mới có 31/32 tiểu tiêu chí → trả `409` với `'Score every assigned subcriterion before submitting'` (`JDG-05`).
   - `judge1` lưu đủ 32 tiểu tiêu chí theo cột `gk1` (`82` điểm) và `submit` → phiếu `SUBMITTED`, `total = 82`, sản phẩm vẫn `SCORING`. Gọi `submit` hoặc `PUT` lần nữa trên phiếu `judge1` → trả `409` (`JDG-04`).
6. **`E2E-06`**: `judge2` lưu đủ 32 tiểu tiêu chí theo cột `gk2` (`76` điểm) và `submit` → sản phẩm chuyển sang `COMPLETED`, `finalScore = 79`, `starRating = 4` trên cả `/api/my/products/:id`, `/api/admin/products/:id/results` và `/api/products/:id`.
7. **`JDG-06` & `SCORE-01` & `SCORE-04`**: Tạo hồ sơ thứ 2 cùng phân loại, `judge1` lưu nháp `85` điểm (đổi tiểu tiêu chí `7` lên 3 điểm), `judge2` lưu nháp `78` điểm (đổi tiểu tiêu chí `6.3` lên 4 điểm), rồi gọi `Promise.all([submit(judge1), submit(judge2)])` đồng thời → cả hai thành công, chỉ sinh 1 sự kiện `COMPLETED`, `finalScore = 81.5`, `starRating = 4`. Sau đó Admin đổi phân công → hồ sơ đã `COMPLETED` vẫn giữ nguyên `81.5` điểm và `4` sao (`SCORE-04`).

- [ ] **Step 2: Chạy DB spec vừa tạo**

Run: `pnpm --filter @ocop/api test:db --runTestsByPath test/e2e-honey-flow.db-spec.ts`
Expected: PASS (hoặc ghi nhận trạng thái kết nối PostgreSQL nếu DB local chưa bật).

- [ ] **Step 3: Commit Task 3**

```bash
git add apps/be/test/e2e-honey-flow.db-spec.ts
git commit -m "test(api): add E2E honey flow, concurrent judge submit, and public privacy db-spec"
```

---

### Task 4: Kiểm chứng nhóm Xác thực (`AUTH-01..07`) và Phân quyền & Người dùng (`RBAC-01..05`, `USR-01..04`)

**Files:**
- Modify: `apps/be/test/auth.db-spec.ts`
- Modify: `apps/be/test/admin-users.db-spec.ts`
- Modify: `apps/be/test/staff-access.db-spec.ts`

**Interfaces:**
- Consumes: `withTestApp`, `adminFixture` từ `apps/be/test/support/`
- Produces: Bằng chứng tự động cho `AUTH-01..07`, `RBAC-01..05`, `USR-01..04`.

- [ ] **Step 1: Bổ sung các kiểm tra còn thiếu trong `apps/be/test/auth.db-spec.ts` cho `AUTH-01..07`**

Đảm bảo có đủ các assertion:
- `AUTH-01`: Đăng nhập trước khi verify OTP trả `401`/`403`.
- `AUTH-02`: `POST /api/auth/verify-otp` với `code: '12345a'` trả `400`; mã 6 số sai trả `401`; mã hết hạn (>5 phút) trả `401`.
- `AUTH-03`: Gửi `POST /api/auth/resend-otp` quá 3 lần trong cửa sổ 15 phút cùng IP trả `429`.
- `AUTH-04`: `POST /api/auth/register` với `password: 'Đ'.repeat(36)` (72 byte) trả `200`; với `password: 'Đ'.repeat(37)` (74 byte) trả `400`.
- `AUTH-05` & `AUTH-06`: `POST /api/auth/change-password` với `currentPassword` sai trả `401` kèm `'Current password is incorrect'` và token hiện tại gọi `GET /api/auth/me` vẫn trả `200`; khi đổi mật khẩu đúng trả `201` và token cũ gọi `GET /api/auth/me` trả `401`.
- `AUTH-07`: `forgot-password` → `reset-password` thu hồi token cũ và cho đăng nhập bằng mật khẩu mới.

- [ ] **Step 2: Bổ sung kiểm tra `RBAC-05` (`VIEW + SCORE` ngoài phân công) và `USR-01..04` vào `apps/be/test/staff-access.db-spec.ts` và `apps/be/test/admin-users.db-spec.ts`**

Đảm bảo có đủ các assertion:
- `RBAC-05`: Tài khoản có `['VIEW', 'SCORE']` nhưng không được phân công phân loại của hồ sơ đã nộp:
  - Gọi `GET /api/admin/products/:id`, `GET /api/admin/products/:id/attachments/:pdfId` và `GET /api/admin/evaluations/:submittedEvalId/print-data` → trả `200`.
  - Gọi `GET /api/judge/products/:id/evaluation` hoặc `GET /api/judge/products/:id/attachments/:pdfId` → trả `403`.
  - Gọi `GET /api/admin/evaluations/:draftEvalId/print-data` (phiếu nháp của người khác) → trả `403`/`404`.
- `USR-02`: Khi chỉ còn 1 tài khoản `MANAGE` đang active & verified, gọi API khóa hoặc gỡ `MANAGE` của chính tài khoản đó → trả `400`/`409`.
- `USR-03`: Khi `judge1` đang được phân công phân loại có hồ sơ `SUBMITTED`/`SCORING`, gọi API khóa `judge1` hoặc đổi quyền sang `['VIEW']` → trả `409` với `'Reassign open products before removing scoring access'`, và token của `judge1` vẫn gọi được `GET /api/auth/me` (`200`).
- `USR-04`: Khi phân loại của `judge` không còn hồ sơ mở, đổi quyền sang `['VIEW']` hoặc khóa tài khoản → trả `200`, tự động gỡ phân công `SCORE` và token cũ gọi `GET /api/auth/me` trả `401`.

- [ ] **Step 3: Chạy các DB spec của Nhóm 1 và Nhóm 2**

Run: `pnpm --filter @ocop/api test:db --runTestsByPath test/auth.db-spec.ts test/admin-users.db-spec.ts test/staff-access.db-spec.ts`
Expected: PASS

- [ ] **Step 4: Commit Task 4**

```bash
git add apps/be/test/auth.db-spec.ts apps/be/test/admin-users.db-spec.ts apps/be/test/staff-access.db-spec.ts
git commit -m "test(api): verify AUTH, RBAC-05 view+score scope, and USR-01..04 account guards"
```

---

### Task 5: Kiểm chứng nhóm Danh mục (`CAT`, `LOC`, `SNAP`), Hồ sơ (`REG-01..06`), Tệp (`FILE-01..05`) và Phân công (`ASG-01..07`)

**Files:**
- Modify: `apps/be/test/admin-catalogs.db-spec.ts`
- Modify: `apps/be/test/admin-products.db-spec.ts`
- Modify: `apps/be/test/admin-product-files.db-spec.ts`
- Modify: `apps/be/test/assignment.db-spec.ts`

**Interfaces:**
- Consumes: `scenarioBuffers` từ Task 2; `adminFixture` từ `apps/be/test/support/admin-fixture.ts`.
- Produces: Bằng chứng tự động cho `CAT-01..02`, `LOC-01`, `SNAP-01`, `REG-01..06`, `FILE-01..05`, `ASG-01..07`.

- [ ] **Step 1: Kiểm tra và bổ sung `CAT-01..02`, `LOC-01`, `SNAP-01`, `REG-01..06` trong `admin-catalogs.db-spec.ts` và `admin-products.db-spec.ts`**

Đảm bảo có mặt đầy đủ:
- `CAT-01`: Tạo phân loại mới chưa có `CriteriaSet` hoặc có tổng `maxScore = 99` → kích hoạt `isActive: true` bị từ chối.
- `CAT-02`: Ngừng hoạt động phân loại đang có 1 bản `DRAFT` và 1 bản `SUBMITTED` → tạo mới bị chặn (`409`), nộp bản `DRAFT` cũ bị chặn (`409`), chấm bản `SUBMITTED` vẫn thành công.
- `LOC-01`: Địa bàn có `effectiveTo` trong quá khứ không xuất hiện trong `GET /api/localities` và chặn nộp bản nháp đang gắn địa bàn đó.
- `SNAP-01`: Sau khi nộp hồ sơ và nộp phiếu chấm, Admin đổi tên địa bàn và đổi đơn vị của giám khảo → `registrationSnapshot` và `submissionSnapshot` vẫn giữ nguyên tên địa bàn và tên đơn vị tại thời điểm nộp.
- `REG-03`: Kiểm tra từng nhánh thiếu điều kiện bắt buộc khi gọi `POST /api/my/products/:id/submit` đều trả `400` và giữ trạng thái `DRAFT`.
- `REG-06`: Tạo 2 hồ sơ mới cùng tên với `registrationType: 'UPGRADE'` và `'REASSESSMENT'` không làm thay đổi hồ sơ `COMPLETED` cũ.

- [ ] **Step 2: Bổ sung `FILE-04` và `FILE-05` (biên đúng `10485760` byte, quá 1 byte `413`, rỗng/sai chữ ký `415`, tệp thứ 21 `409`) vào `apps/be/test/admin-product-files.db-spec.ts`**

Lưu ý cho nhánh tệp thứ 21 (`FILE-05`): dùng `prisma.attachment.createMany` tạo sẵn 20 bản ghi cho bản nháp trước khi gọi upload tệp thứ 21 qua HTTP để không chạm ngưỡng throttle 20 request/phút.

- [ ] **Step 3: Bổ sung `ASG-01..07` (đặc biệt là `ASG-03` xóa nháp khi đổi phạm vi thực sự và `ASG-07` giữ nháp khi đổi giữa `[]` và danh sách đủ tiêu chí hoặc đổi thứ tự) vào `apps/be/test/assignment.db-spec.ts`**

```typescript
it('preserves draft scores and notes when replacing with an equivalent criterion set or reordered list (ASG-07)', async () => {
  // 1. GK1 assigned criterionIds: [] (all), saves draft scores + note on criterion A
  // 2. replaceAssignments with criterionIds: [criterionA.id, criterionB.id] -> scores & note preserved
  // 3. replaceAssignments with criterionIds: [criterionB.id, criterionA.id] -> scores & note preserved
  // 4. replaceAssignments with criterionIds: [] -> scores & note preserved
});
```

- [ ] **Step 4: Chạy các DB spec của Nhóm 3, 4, 5, 6**

Run: `pnpm --filter @ocop/api test:db --runTestsByPath test/admin-catalogs.db-spec.ts test/admin-products.db-spec.ts test/admin-product-files.db-spec.ts test/assignment.db-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 5**

```bash
git add apps/be/test/admin-catalogs.db-spec.ts apps/be/test/admin-products.db-spec.ts apps/be/test/admin-product-files.db-spec.ts apps/be/test/assignment.db-spec.ts
git commit -m "test(api): cover catalog, registration, attachment boundaries, and ASG-01..07"
```

---

### Task 6: Kiểm chứng In ấn (`PRINT-01..04`), Báo cáo & Dashboard (`REP-01..03`, `DASH-01`) và Lập báo cáo nghiệm thu 66 ca

**Files:**
- Modify: `apps/be/test/admin-scoring-print.db-spec.ts`
- Modify: `apps/be/test/admin-reports-dashboard.db-spec.ts`
- Create: `docs/verification/2026-10-25-test-scenarios-execution.md`

**Interfaces:**
- Consumes: Kết quả chạy thực tế từ Task 1 → Task 6.
- Produces: File báo cáo nghiệm thu `docs/verification/2026-10-25-test-scenarios-execution.md` điền đầy đủ bảng 66 mã TC (`E2E-01` đến `DASH-01`).

- [ ] **Step 1: Bổ sung kiểm tra `REP-03` (biên tháng múi giờ `+07:00`: `2026-09-30T23:59:59+07:00` thuộc tháng 9, `2026-10-01T00:00:00+07:00` thuộc tháng 10) và `REP-02` (biên điểm 49 vs 50) vào `apps/be/test/admin-reports-dashboard.db-spec.ts`**

```typescript
// Biên múi giờ Việt Nam (REP-03): cả hai thời điểm đều có ngày UTC là 2026-09-30 (16:59:59Z và 17:00:00Z)
// nhưng theo Asia/Ho_Chi_Minh (+07:00) phải tách đúng vào kỳ 2026-09 và 2026-10.
```

- [ ] **Step 2: Kiểm tra `PRINT-01..04` trong `apps/be/test/admin-scoring-print.db-spec.ts`**

Đảm bảo kiểm tra đủ 4 loại print-data:
- `PRINT-01`: `/api/admin/criteria-sets/:id/print-data` cho `MANAGE`, `VIEW` và `SCORE` trong phạm vi.
- `PRINT-02`: Phiếu nháp trả trạng thái `IN_PROGRESS` (để UI hiện `BẢN NHÁP — CHƯA NỘP`), tiêu chí ngoài phạm vi tách riêng khỏi danh sách chấm, và tài khoản chỉ có `VIEW` bị chặn (`403`/`404`) khi đọc print-data phiếu nháp của người khác.
- `PRINT-03`: `/api/admin/products/:id/results/print-data` khi đang `SCORING` (`finalScore: null`, `starRating: null`) và khi đã `COMPLETED` đạt ≥ 90 điểm (`starRating: 5`).
- `PRINT-04`: `/api/admin/products/:id/registration-print-data` và `/api/my/products/:id/registration-print-data`.

- [ ] **Step 3: Chạy toàn bộ bộ kiểm thử (Typecheck, Build, Unit, Web Node tests, DB specs)**

```powershell
pnpm --filter @ocop/api typecheck
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/api test --runInBand
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/*.test.ts
pnpm --filter @ocop/web exec node test/proxy.check.mjs
pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/api test:db
```

- [ ] **Step 4: Ghi kết quả thực tế của từng ca trong 66 ca vào `docs/verification/2026-10-25-test-scenarios-execution.md`**

Báo cáo phải bao gồm:
1. Thông tin môi trường thực tế (commit hash, phiên bản Node/pnpm, trạng thái kết nối PostgreSQL và SMTP).
2. Bảng tổng hợp kết quả 66 ca theo đúng thứ tự Phần IV của `docs/testing/kich-ban-kiem-thu-ocop.md` (`E2E-01..06`, `AUTH-01..07`, `RBAC-01..05`, `USR-01..04`, `CAT-01..02`, `LOC-01`, `SNAP-01`, `REG-01..06`, `FILE-01..07`, `ASG-01..07`, `JDG-01..06`, `SCORE-01..04`, `PRINT-01..04`, `PUB-01..02`, `REP-01..03`, `DASH-01`).
3. Phân định rõ: ca nào `PASS` ở tầng Unit/DB/API, ca nào `PASS` trên trình duyệt, và ca nào `BLOCKED` (nếu thiếu hộp thư SMTP thật hoặc PostgreSQL bị chặn xác thực), kèm ghi chú điểm cần xác nhận nghiệp vụ `ASG-03`.

- [ ] **Step 5: Commit Task 6**

```bash
git add apps/be/test/admin-scoring-print.db-spec.ts apps/be/test/admin-reports-dashboard.db-spec.ts docs/verification/2026-10-25-test-scenarios-execution.md
git commit -m "docs(verification): record execution results for 66 OCOP test scenarios"
```
