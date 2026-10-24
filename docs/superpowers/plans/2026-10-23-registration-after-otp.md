# Registration After OTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chỉ tạo tài khoản chủ thể sau OTP hợp lệ; không cho mở biểu mẫu `/verify-otp` khi chưa có phiên đăng ký được backend xác nhận.

**Architecture:** Lưu snapshot đăng ký và OTP đã hash trong `pending_registrations`, không trong `users`. Dùng token phiên ngẫu nhiên, khóa dòng PostgreSQL và transaction để xác thực rồi tạo đúng một user; giữ `OtpCode` cho reset mật khẩu. Frontend dùng API client, sessionStorage và `beforeLoad` hiện có, không thêm thư viện.

**Tech Stack:** Node.js 24, TypeScript, NestJS 11, Prisma 7/PostgreSQL, bcryptjs, node:crypto, Nodemailer, React 19, TanStack Router/Form, Axios, Jest và các script kiểm tra Node/Vite hiện có.

**Spec:** [2026-10-23-registration-after-otp-spec.md](../specs/2026-10-23-registration-after-otp-spec.md). Đọc cả đặc tả và kế hoạch trước triển khai.

## Global Constraints

- “Trước bước 3, không tồn tại tài khoản mới trong `users`, kể cả bản ghi có `verified=false`.”
- “Thiếu thông tin đăng ký hoặc phiên không hợp lệ thì chuyển về `/register` bằng điều hướng thay thế lịch sử.”
- “Không lưu mật khẩu hoặc password hash vào sessionStorage/localStorage, URL, router state hay log.”
- OTP **5 phút**, tối đa **5 lần nhập sai**; phiên đăng ký **15 phút từ khi tạo**, không gia hạn khi đọc hoặc gửi lại.
- Khoảng chờ gửi lại **60 giây** ở cả backend/frontend. Giữ throttle register/resend **3 request/15 phút**, verify **5 request/phút**.
- Lần sai thứ 5 trả `410`; không rollback bộ đếm. OTP mới thay mã cũ ngay khi phát hành, kể cả khi SMTP sau đó lỗi.
- Token có ít nhất **32 byte** ngẫu nhiên; chọn `randomBytes(32).toString('hex')`, đúng 64 ký tự hex; backend chỉ lưu SHA-256 token.
- Giữ bcrypt **12 rounds**, mật khẩu **8..72 ký tự** và tối đa **72 byte UTF-8**. Không thay đổi API reset/đổi mật khẩu hay cách cấp/thu hồi JWT.
- Không thêm Redis, thư viện, service/repository mới hoặc sửa tay `routeTree.gen.ts`. Dùng `AuthRepository`, `AuthService`, `OtpService`, `databaseObject` và `requestJson` hiện có.
- Chỉ lên kế hoạch trong công việc này. Các lệnh migration, gửi thư thật, chuyển đổi dữ liệu và commit dưới đây dành cho lúc thực thi.
- Working tree đang có nhiều thay đổi khác. Không reset/stash hoặc `git add .`; chỉ stage từng file/hunk thuộc nhiệm vụ. Khi thực thi cần checkout cô lập thì dùng skill `superpowers:using-git-worktrees` và công cụ worktree của ứng dụng.

## File map và thứ tự triển khai

| Task | Create | Modify | Kết quả kiểm tra độc lập |
| --- | --- | --- | --- |
| 1 | `apps/be/prisma/migrations/20261023000100_registration_after_otp/migration.sql`; `apps/be/test/registration-repository.db-spec.ts` | Prisma schema; BE constants/auth, types/auth, auth.repository, otp.service; `test/support/db-app.ts` | Persistence, crypto, atomic create, attempts và resend reservation. |
| 2 | `apps/be/test/registration.db-spec.ts`; `apps/be/src/services/mail.service.spec.ts` | Auth controller/DTO/service; mail.service; auth.service.spec; exception-filter spec; OpenAPI spec | HTTP register/status/verify/resend, mail errors, reset contract. |
| 3 | `apps/web/src/pages/auth/pending-registration.ts`; `apps/web/test/registration-flow.check.mjs` | FE types/auth, api/auth, constants/api, constants/auth, constants/http-status; `_auth.verify-otp.tsx`; RegisterPage, VerifyOtpPage, LoginPage; api-integration check; bỏ pending-email.ts khi hết caller | API, storage, guard và form cùng dùng contract mới, frontend vẫn build được. |
| 4 | `apps/be/prisma/registration-maintenance.ts`; `apps/be/test/registration-maintenance.db-spec.ts` | Không thay seed | Kiểm kê, chuyển đổi chọn lọc và dọn dữ liệu tạm có kiểm tra. |
| 5 | `docs/verification/2026-10-23-registration-after-otp.md` | auth.db-spec, backend.db-spec, FE API contract check; README BE/FE/root; backend-architecture, operations; đặc tả tích hợp FE/BE | Hồi quy, bản ghi nghiệm thu và quy trình phát hành/rollback. |

Task 1 → 2 → 3. Task 4 cần schema Task 1 và được kiểm tra trước phát hành. Task 5 chạy sau tất cả. Đây là một thay đổi nghiệp vụ xuyên FE/BE; không phát hành từng API riêng vì verify/resend thay request.

Các đường dẫn rút gọn `src/...` trong task backend đều nằm dưới `apps/be/`; frontend dưới `apps/web/`. Lệnh luôn ghi rõ workspace cần chạy.

## Contract dùng chung giữa các task

Đặt type backend trong `apps/be/src/types/auth.ts`, type frontend tương ứng trong `apps/web/src/types/auth.ts`. Không thêm package chia sẻ chỉ cho luồng này.

```ts
export interface RegistrationStatus {
  email: string;
  expiresAt: string;
  otpExpiresAt: string;
  resendAvailableAt: string;
}
export interface RegistrationContext extends RegistrationStatus {
  registrationToken: string;
}
export interface RegistrationVerifyInput {
  registrationToken: string;
  code: string;
}
export interface RegistrationResendResult {
  message: string;
  otpExpiresAt: string;
  resendAvailableAt: string;
}
```

Backend repository dùng thêm:

```ts
export type RegistrationFailure =
  | 'invalid' | 'gone' | 'otp-invalid' | 'otp-expired'
  | 'otp-unavailable' | 'cooldown' | 'conflict';
export interface PendingRegistrationInput {
  tokenHash: string;
  email: string;
  fullName: string;
  phone: string | null;
  passwordHash: string;
  otpHash: string;
}
```

`invalid` → 401; `gone` → 410; `otp-invalid`, `otp-expired`, `otp-unavailable` → 400; `cooldown` → 429; `conflict`/Prisma P2002 → 409. Bỏ qua enum mới: các literal này đủ dùng. Lỗi hệ thống/mail → 500 với thông báo an toàn. Không trả row Prisma hoặc hash cho client.

### Task 1: Lưu đăng ký tạm và xác thực nguyên tử

**Files:** Những file của Task 1 trong file map; không thêm provider. Migration chỉ thêm bảng, không tự chuyển/xóa user cũ.

**Interfaces:**

- Consumes: `PrismaService`, `databaseObject`, `OTP_TTL_MS`, `OTP_MAX_ATTEMPTS`, `PendingRegistrationInput`, `RegistrationFailure`.
- Produces trong `AuthRepository`: `createPendingRegistration(input): Promise<PendingRegistration>`; `getPendingRegistration(tokenHash): Promise<PendingRegistration | RegistrationFailure>`; `reserveRegistrationOtp(tokenHash, otpHash): Promise<PendingRegistration | RegistrationFailure>`; `markRegistrationSent(tokenHash, otpHash): Promise<boolean>`; `deletePendingRegistration(tokenHash): Promise<void>`; `consumeRegistration(tokenHash, otpHash): Promise<'verified' | RegistrationFailure>`.
- Produces trong `OtpService`: `createRegistrationCode(tokenHash): { code: string; otpHash: string }`; `registrationHash(tokenHash, code): string`. Các hàm reset hiện tại giữ nguyên trong task này.

- [ ] **Step 1: Viết test đỏ cho repository.** Tạo `registration-repository.db-spec.ts` với các import `randomUUID`, `createHash` từ `node:crypto`, bcrypt, `AuthRepository`, `OtpService`, `withTestApp`. Dùng test dưới làm ca đầu tiên; `withTestApp` đã cô lập schema và chặn gửi email thật.

```ts
it('creates no user until a sent registration OTP is consumed once', async () => {
  await withTestApp(async ({ app, prisma }) => {
    const repo = app.get(AuthRepository);
    const otp = app.get(OtpService);
    const email = `pending-${randomUUID()}@example.invalid`;
    const tokenHash = createHash('sha256').update(randomUUID()).digest('hex');
    const { code, otpHash } = otp.createRegistrationCode(tokenHash);
    await repo.createPendingRegistration({
      tokenHash, email, fullName: 'Pending registrant', phone: null,
      passwordHash: await bcrypt.hash('Password1!', 4), otpHash,
    });
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect(await repo.consumeRegistration(tokenHash, otpHash)).toBe('otp-unavailable');
    expect(await repo.markRegistrationSent(tokenHash, otpHash)).toBe(true);
    expect(otp.registrationHash(tokenHash, code)).toBe(otpHash);
    const results = await Promise.all([
      repo.consumeRegistration(tokenHash, otpHash),
      repo.consumeRegistration(tokenHash, otpHash),
    ]);
    expect(results.sort()).toEqual(['invalid', 'verified']);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect(await prisma.user.findUnique({ where: { email } })).toMatchObject({
      role: 'REGISTRANT', verified: true, isActive: true,
    });
    expect(await prisma.pendingRegistration.count({ where: { tokenHash } })).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để thấy đỏ.**

```powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/registration-repository.db-spec.ts
```

Kỳ vọng: lỗi thiếu model/method. Nếu không kết nối DB local thì xử lý cấu hình test trước; lỗi DB không phải bằng chứng test nghiệp vụ đang đỏ. Không chạy `migrate reset` hoặc dùng production DB.

- [ ] **Step 3: Thêm schema, migration và constants.** Model không có quan hệ user và không unique theo email:

```prisma
model PendingRegistration {
  id                String   @id @default(cuid())
  tokenHash         String   @unique @db.VarChar(64)
  email             String   @db.VarChar(320)
  fullName          String   @db.VarChar(255)
  phone             String?  @db.VarChar(30)
  passwordHash      String   @db.VarChar(255)
  otpHash           String   @db.VarChar(64)
  attempts          Int      @default(0)
  otpReady          Boolean  @default(false)
  createdAt         DateTime @default(now()) @db.Timestamptz(3)
  expiresAt         DateTime @db.Timestamptz(3)
  otpExpiresAt      DateTime @db.Timestamptz(3)
  lastSendAttemptAt DateTime @db.Timestamptz(3)
  lastSentAt        DateTime? @db.Timestamptz(3)

  @@index([expiresAt])
  @@index([email])
  @@map("pending_registrations")
}
```

Migration SQL:

```sql
CREATE TABLE "pending_registrations" (
  "id" TEXT NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "fullName" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(30),
  "passwordHash" VARCHAR(255) NOT NULL,
  "otpHash" VARCHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "otpReady" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "otpExpiresAt" TIMESTAMPTZ(3) NOT NULL,
  "lastSendAttemptAt" TIMESTAMPTZ(3) NOT NULL,
  "lastSentAt" TIMESTAMPTZ(3),
  CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pending_registrations_attempts_check" CHECK ("attempts" >= 0)
);
CREATE UNIQUE INDEX "pending_registrations_tokenHash_key" ON "pending_registrations"("tokenHash");
CREATE INDEX "pending_registrations_expiresAt_idx" ON "pending_registrations"("expiresAt");
CREATE INDEX "pending_registrations_email_idx" ON "pending_registrations"("email");
```

Trong `constants/auth.ts`:

```ts
export const REGISTRATION_TTL_MS = 15 * 60_000;
export const REGISTRATION_RESEND_MS = 60_000;
```

Giữ migration 0001..0010. Nếu migration đích đã được tạo bởi công việc khác, đọc và tái sử dụng thay vì ghi đè. Trong `clearExistingData`, thêm `DELETE FROM "pending_registrations"` trước `users`; giữ search_path/schema isolation hiện có.

- [ ] **Step 4: Thêm crypto và repository tối thiểu.** Trong `OtpService`:

```ts
createRegistrationCode(tokenHash: string) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  return { code, otpHash: this.registrationHash(tokenHash, code) };
}

registrationHash(tokenHash: string, code: string) {
  return createHmac('sha256', env(process.env).jwtSecret)
    .update(`REGISTER:${tokenHash}:${code}`).digest('hex');
}
```

`createPendingRegistration` dùng cùng `now`, đặt `expiresAt=now+15 phút`, `otpExpiresAt=now+5 phút`, `lastSendAttemptAt=now`, `lastSentAt=null`, `otpReady=false`. Thêm private method khóa dòng dùng chung cho consume/reserve:

```ts
private async lockPending(tx: Prisma.TransactionClient, tokenHash: string) {
  const rows = await tx.$queryRaw<PendingRegistration[]>(Prisma.sql`
    SELECT * FROM ${databaseObject('pending_registrations')}
    WHERE "tokenHash" = ${tokenHash} FOR UPDATE
  `);
  return rows[0];
}

async consumeRegistration(tokenHash: string, otpHash: string) {
  return this.prisma.$transaction(async (tx) => {
    const pending = await this.lockPending(tx, tokenHash);
    const now = new Date();
    if (!pending || !pending.lastSentAt) return 'invalid' as const;
    if (pending.expiresAt <= now || pending.attempts >= OTP_MAX_ATTEMPTS)
      return 'gone' as const;
    if (!pending.otpReady) return 'otp-unavailable' as const;
    if (pending.otpExpiresAt <= now) return 'otp-expired' as const;
    if (!this.equal(pending.otpHash, otpHash)) {
      const attempts = pending.attempts + 1;
      await tx.pendingRegistration.update({ where: { id: pending.id }, data: { attempts } });
      return attempts >= OTP_MAX_ATTEMPTS ? 'gone' as const : 'otp-invalid' as const;
    }
    if (await tx.user.findUnique({ where: { email: pending.email } }))
      return 'conflict' as const;
    await tx.user.create({ data: {
      email: pending.email, password: pending.passwordHash, fullName: pending.fullName,
      phone: pending.phone, role: Role.REGISTRANT, verified: true, isActive: true,
    } });
    await tx.pendingRegistration.delete({ where: { id: pending.id } });
    return 'verified' as const;
  });
}
```

Import `PendingRegistration` từ Prisma và dùng `equal` hiện có để so sánh hash. `P2002` khi hai phiên khác nhau cùng email phải propagate để filter trả 409; transaction rollback bảo toàn phiên thua.

`reserveRegistrationOtp` thực hiện trong transaction cùng `lockPending`. Kiểm tra thiếu/chưa từng gửi → `invalid`; hết hạn/đủ 5 lần → `gone`; email đã thành user → `conflict`; chưa đủ 60 giây từ `lastSendAttemptAt` → `cooldown`. Khi hợp lệ trả row sau update:

```ts
return tx.pendingRegistration.update({
  where: { id: pending.id },
  data: {
    otpHash, otpReady: false, lastSendAttemptAt: now,
    otpExpiresAt: new Date(Math.min(now.getTime() + OTP_TTL_MS, pending.expiresAt.getTime())),
  },
});
```

Không reset attempts/expiry/password. `getPendingRegistration` kiểm tra thiếu/chưa từng gửi và hạn/attempts như trên nhưng không bắt `otpReady=true`: phiên vẫn tồn tại trong lúc SMTP resend đang chạy hoặc đã lỗi, để người dùng còn đường gửi lại.

`markRegistrationSent` dùng update có điều kiện chống callback SMTP cũ bật lại mã đã thay:

```ts
const result = await this.prisma.pendingRegistration.updateMany({
  where: {
    tokenHash, otpHash, otpReady: false,
    expiresAt: { gt: new Date() }, attempts: { lt: OTP_MAX_ATTEMPTS },
  },
  data: { otpReady: true, lastSentAt: new Date() },
});
return result.count === 1;
```

Không giữ DB transaction trong lúc chờ SMTP. `deletePendingRegistration` chỉ `deleteMany({where:{tokenHash}})`; không xóa các phiên cùng email.

- [ ] **Step 5: Bổ sung ca attempts/TTL/resend trong cùng test file.** Tạo fixture bằng các method trên; thay thời gian bằng update DB, không sleep. Thêm assertion thực tế:

```ts
const wrongHash = otpHash === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64);
for (let attempt = 1; attempt <= 5; attempt++) {
  expect(await repo.consumeRegistration(tokenHash, wrongHash))
    .toBe(attempt === 5 ? 'gone' : 'otp-invalid');
}
expect((await prisma.pendingRegistration.findUniqueOrThrow({ where: { tokenHash } })).attempts).toBe(5);
expect(await prisma.user.count({ where: { email } })).toBe(0);
```

Ca reserve: lần đầu trả `cooldown`; chỉnh `lastSendAttemptAt` về quá khứ 61 giây, reserve đổi hash; `otpReady=false`; `markRegistrationSent` bằng hash cũ trả false; hash mới trả true; `expiresAt` và attempts không đổi. Ca cuối phiên đặt `expiresAt=now+30 giây`, xác nhận `otpExpiresAt` không vượt hạn phiên.

- [ ] **Step 6: Generate client, kiểm tra schema và chạy test xanh.**

```powershell
pnpm --filter @ocop/api prisma validate
pnpm --filter @ocop/api prisma generate
pnpm --filter @ocop/api test:db --runTestsByPath test/registration-repository.db-spec.ts
pnpm --filter @ocop/api typecheck
```

Kỳ vọng pass trong schema test riêng, bảng public không bị thay. Dùng `withTestApp` để deploy migration vào schema test; chưa deploy schema ứng dụng đang chạy.

- [ ] **Step 7: Commit các hunk của Task 1.**

```powershell
git add apps/be/prisma/schema.prisma apps/be/prisma/migrations/20261023000100_registration_after_otp/migration.sql apps/be/test/registration-repository.db-spec.ts
git add -p -- apps/be/src/constants/auth.ts apps/be/src/types/auth.ts apps/be/src/repositories/auth.repository.ts apps/be/src/services/otp.service.ts apps/be/test/support/db-app.ts
git commit -m "feat(auth): persist pending registration before account creation"
```

### Task 2: Nối API đăng ký, trạng thái, OTP và gửi thư

**Files:** Những file Task 2 trong file map; sửa thêm nhánh `REGISTER` cũ trong auth.repository khi chuyển xong caller.

**Interfaces:**

- Consumes: các method Task 1, `MailService.sendOtp(email, code, 'REGISTER')`, `RegistrationContext/Status/ResendResult`.
- Produces: `AuthService.register(input): Promise<RegistrationContext>`; `registrationStatus(token): Promise<RegistrationStatus>`; `verifyOtp(token, code): Promise<{message:string}>`; `resendRegistrationOtp(token): Promise<RegistrationResendResult>`.
- HTTP đều `@Public`, `@HttpCode(200)`; status mới throttle **30 request/phút** để refresh không gửi mail hay gia hạn. DTO verify/resend đăng ký không nhận email.

- [ ] **Step 1: Viết ca HTTP đỏ trong `test/registration.db-spec.ts`.** Import `randomUUID`, bcrypt, `MailService`, `apiRequest`, `withTestApp`.

```ts
it('creates a user only after the token-bound OTP and returns no credentials', async () => {
  await withTestApp(async ({ app, prisma, baseUrl }) => {
    let code = '';
    app.get(MailService).sendOtp = jest.fn(async (_email, value) => { code = value; });
    const email = `http-${randomUUID()}@example.invalid`;
    const post = (url: string, body: unknown) => apiRequest<any>(baseUrl, url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const first = await post('/auth/register', { email, password: 'Password1!', fullName: 'Registrant' });
    expect(first.status).toBe(200);
    const context = first.body.data;
    expect(context.registrationToken).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(context).sort()).toEqual([
      'email', 'expiresAt', 'otpExpiresAt', 'registrationToken', 'resendAvailableAt',
    ]);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect((await post('/auth/registration-status', { registrationToken: context.registrationToken })).status).toBe(200);
    expect((await post('/auth/verify-otp', { registrationToken: context.registrationToken, code })).status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.verified).toBe(true);
    expect(await bcrypt.compare('Password1!', user.password)).toBe(true);
    expect((await post('/auth/verify-otp', { registrationToken: context.registrationToken, code })).status).toBe(401);
  });
});
```

- [ ] **Step 2: Chạy test đỏ.**

```powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/registration.db-spec.ts
```

Kỳ vọng hiện tại thiếu `registrationToken` hoặc endpoint status. Thêm ca mail `sendOtp.mockRejectedValue(new Error('smtp unavailable'))`: register trả 500, user count=0, pending count cho email=0; không trả token. Ca input sai phải bị validation chặn trước repository.

- [ ] **Step 3: DTO/controller và status mapping.** Trong `auth.dto.ts`, giữ `VerifyOtpDto` email+code cho `ResetPasswordDto`, thêm:

```ts
export class RegistrationTokenDto {
  @ApiProperty({ minLength: 64, maxLength: 64, writeOnly: true })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  registrationToken!: string;
}
export class RegistrationVerifyDto extends RegistrationTokenDto {
  @ApiProperty({ pattern: '^\\d{6}$', writeOnly: true })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
```

Controller status gọi `registrationStatus(body.registrationToken)`; verify/resend gọi các signature phía trên. Giữ `RegisterDto`, `ResetPasswordDto` và decorator throttle cũ. Không thêm endpoint nhận lại fullName/password tại bước verify.

Trong `AuthService`, thêm imports `createHash`, `randomBytes`; helper `tokenHash(token)` dùng SHA-256. Chuyển result repository thành HTTP **sau khi transaction đã resolve**:

```ts
private registrationError(reason: RegistrationFailure): never {
  const errors: Record<RegistrationFailure, [number, string]> = {
    invalid: [401, 'Registration session is invalid'],
    gone: [410, 'Registration session has expired or is locked'],
    'otp-invalid': [400, 'Invalid verification code'],
    'otp-expired': [400, 'Verification code has expired'],
    'otp-unavailable': [400, 'Request a new verification code'],
    cooldown: [429, 'Wait before requesting another verification code'],
    conflict: [409, 'Email is already registered'],
  };
  const [status, message] = errors[reason];
  throw new HttpException(message, status);
}

private registrationView(pending: PendingRegistration): RegistrationStatus {
  return {
    email: pending.email,
    expiresAt: pending.expiresAt.toISOString(),
    otpExpiresAt: pending.otpExpiresAt.toISOString(),
    resendAvailableAt: new Date(pending.lastSendAttemptAt.getTime() + REGISTRATION_RESEND_MS).toISOString(),
  };
}
```

- [ ] **Step 4: Chuyển service sang dữ liệu tạm.** Giữ normalize/assertPassword và `isUniqueConstraint` khi xử lý conflict. Code lõi `register`:

```ts
const email = this.normalizeEmail(input.email);
this.assertPassword(input.password);
if (await this.repository.findUserByEmail(email))
  throw new ConflictException('Email is already registered');
const registrationToken = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(registrationToken).digest('hex');
const { code, otpHash } = this.otpService.createRegistrationCode(tokenHash);
const pending = await this.repository.createPendingRegistration({
  tokenHash, email, fullName: input.fullName.trim(), phone: input.phone?.trim() || null,
  passwordHash: await bcrypt.hash(input.password, PASSWORD_ROUNDS), otpHash,
});
try {
  await this.mailService.sendOtp(email, code, 'REGISTER');
  if (!(await this.repository.markRegistrationSent(tokenHash, otpHash)))
    throw new Error('Registration expired while sending');
} catch {
  await this.repository.deletePendingRegistration(tokenHash);
  throw new InternalServerErrorException('Could not send verification email');
}
return { registrationToken, ...this.registrationView(pending) };
```

Status: hash token → `getPendingRegistration` → map failure hoặc trả `registrationView`. Verify: hash token, `registrationHash(tokenHash,code)` → `consumeRegistration` → map failure hoặc `{message:'Registration completed'}`. Resend: đọc phiên, tạo code/hash khác mã đang lưu, gọi reserve, gửi vào email row trả về, mark đúng hash; lỗi SMTP/mark trả 500, **không xóa phiên**. Return `{message:'Verification code sent', otpExpiresAt, resendAvailableAt}` từ `registrationView` của row reserve; không trả token lần nữa.

Không dựa vào xác suất để bảo đảm mã mới khác mã cũ. Sau khi đọc `current` bằng `getPendingRegistration` và map failure:

```ts
let next = this.otpService.createRegistrationCode(tokenHash);
while (next.otpHash === current.otpHash)
  next = this.otpService.createRegistrationCode(tokenHash);
const reserved = await this.repository.reserveRegistrationOtp(tokenHash, next.otpHash);
```

Trong lock của reserve, kiểm tra lại `otpHash===pending.otpHash` thì trả `otp-unavailable` trước update, tránh trường hợp phiên đã đổi mã giữa lần đọc và khóa. Không gửi mail nếu reserve không thành công.

Sau khi đổi caller, tìm toàn bộ `createRegistrant`, `OtpPurpose.REGISTER`, `sendOtp`, `verifyOtp`, `resendRegistrationOtp` dưới src/test. Xóa `createRegistrant` khi hết caller và nhánh update verified trong `consumeOtp`; `OtpService.issue/verify` chỉ dùng reset. Chặn purpose không phải `RESET_PASSWORD` trước khi consume/update OTP cũ, không để mã REGISTER cũ kích hoạt user. Các fixture cũ được chuyển ở Task 5.

- [ ] **Step 5: Loại bỏ thành công giả và bảo vệ log.** Trong `mail.service.ts`, bỏ nhánh `[DEV OTP]` log-return: SMTP mẫu phải trả lỗi, test dùng mock như hiện tại. Kiểm tra Nodemailer thực sự chấp nhận người nhận:

```ts
const info = await this.getTransporter().sendMail({
  from: config.smtpFrom, to: email, subject: 'Mã xác thực OCOP',
  text: `Mã OTP để ${action} OCOP của bạn là ${code}. Mã hết hạn sau ${OTP_TTL_MS / 60_000} phút.`,
});
if (!info.accepted?.some((recipient) =>
  (typeof recipient === 'string' ? recipient : recipient.address).toLowerCase() === email.toLowerCase(),
)) throw new Error('SMTP did not accept the recipient');
```

Trong mail.service.spec, mock `nodemailer.createTransport` trả `{sendMail:jest.fn()}`; dùng các assertion sau với `service=new MailService()` và `sendMail` là mock của transporter:

```ts
sendMail.mockResolvedValueOnce({ accepted: [] });
await expect(service.sendOtp('person@example.invalid', '012345', 'REGISTER')).rejects.toThrow();
sendMail.mockResolvedValueOnce({ accepted: ['person@example.invalid'] });
await expect(service.sendOtp('person@example.invalid', '012345', 'REGISTER')).resolves.toBeUndefined();
sendMail.mockRejectedValueOnce(new Error('smtp unavailable'));
await expect(service.sendOtp('person@example.invalid', '012345', 'REGISTER')).rejects.toThrow('smtp unavailable');
```

Thiết lập env giả đầy đủ như auth.service.spec, restore env sau test; không chạm credential thật, không gửi thư.

`requestMeta` hiện chỉ lấy request ID/IP/user-agent và filter không log body/query, nên không cần thêm sanitizer mới. Mở rộng filter spec: body `{registrationToken:'token-secret',code:'654321',password:'password-secret'}`; exception message cũng chứa token; assert cả log và response không có token/code/password. Giữ helper hiện có nếu test xanh, không sửa chỉ để có diff.

- [ ] **Step 6: Cập nhật unit/OpenAPI và kiểm tra xanh.** Đổi unit test đang mong user chờ xác thực thành mock repository pending methods. Trong OpenAPI test assert schema `RegistrationVerifyDto` có token/code, không có email; `ResetPasswordDto` vẫn có email/code/newPassword. Không đặt token thật trong Swagger example. Chạy:

```powershell
pnpm --filter @ocop/api test --runInBand src/services/auth.service.spec.ts src/services/mail.service.spec.ts src/filters/api-exception.filter.spec.ts
pnpm --filter @ocop/api test:db --runTestsByPath test/registration.db-spec.ts test/registration-repository.db-spec.ts
pnpm --filter @ocop/api build
pnpm --filter @ocop/api test:db --runTestsByPath test/openapi.db-spec.ts
```

OpenAPI test đọc `dist`, do đó phải build trước. Test DB cần thêm các ca HTTP 401/410/429, OTP sai lần 5, code hết hạn còn phiên, không nhận payload email cũ. Kỳ vọng không có user ở mọi ca chưa verify đúng. SMTP thật là kiểm tra riêng Task 5.

- [ ] **Step 7: Commit các hunk Task 2.**

```powershell
git add apps/be/test/registration.db-spec.ts apps/be/src/services/mail.service.spec.ts
git add -p -- apps/be/src/controllers/auth.controller.ts apps/be/src/dtos/auth.dto.ts apps/be/src/services/auth.service.ts apps/be/src/services/mail.service.ts apps/be/src/services/auth.service.spec.ts apps/be/src/repositories/auth.repository.ts apps/be/src/services/otp.service.ts apps/be/src/filters/api-exception.filter.spec.ts apps/be/test/openapi.db-spec.ts
git commit -m "feat(auth): create registrants only after valid session OTP"
```

### Task 3: Frontend dùng phiên đăng ký và chặn màn OTP

**Files:** Những file Task 3 trong file map; giữ component UI hiện có. Gộp API, guard và caller trong một task để không để frontend typecheck hỏng giữa hai contract.

**Interfaces:**

- Consumes: bốn endpoint Task 2, `ApiError.status`, `RegistrationContext`, `RegistrationStatus`, `RegistrationResendResult`.
- Produces: `readPendingRegistration(): RegistrationContext | null`; `writePendingRegistration(value): boolean`; `clearPendingRegistration(): void`; `requirePendingRegistration(): Promise<{registration:RegistrationContext}>`.
- Route trả `registration` qua route context vào prop `VerifyOtpPage({registration})`. Không dùng email nhập tay làm dữ liệu API.

- [ ] **Step 1: Viết test đỏ storage/guard bằng Node/Vite.** Tạo `test/registration-flow.check.mjs`. Dùng cùng kiểu `createServer`/mock window trong `api-integration.check.mjs`; không thêm test framework. Khung runnable:

```js
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const values = new Map();
const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  sessionStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  },
} });
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
  envDir: false, appType: 'custom',
  server: { middlewareMode: true, watch: null, hmr: false },
});
try {
  const pending = await server.ssrLoadModule('/src/pages/auth/pending-registration.ts');
  const { authApi } = await server.ssrLoadModule('/src/api/auth.ts');
  const { ApiError } = await server.ssrLoadModule('/src/lib/api-error.ts');
  const context = {
    registrationToken: 'a'.repeat(64), email: 'person@example.invalid',
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    otpExpiresAt: new Date(Date.now() + 300_000).toISOString(),
    resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const redirected = e => e.options?.to === '/register' && e.options?.replace === true;
  assert.equal(pending.readPendingRegistration(), null);
  await assert.rejects(pending.requirePendingRegistration(), redirected);
  assert.equal(pending.writePendingRegistration(context), true);
  let checks = 0;
  authApi.registrationStatus = async token => {
    checks++;
    assert.equal(token, context.registrationToken);
    return { data: { ...context, email: 'server@example.invalid' } };
  };
  const result = await pending.requirePendingRegistration();
  assert.equal(checks, 1);
  assert.equal(result.registration.email, 'server@example.invalid');
  authApi.registrationStatus = async () => { throw new ApiError('Expired', 410); };
  await assert.rejects(pending.requirePendingRegistration(), redirected);
  assert.equal(pending.readPendingRegistration(), null);
  pending.writePendingRegistration(context);
  authApi.registrationStatus = async () => { throw new TypeError('Network unavailable'); };
  await assert.rejects(pending.requirePendingRegistration(), /Network unavailable/);
  assert.ok(pending.readPendingRegistration());
  assert.ok(!JSON.stringify([...values.values()]).includes('password'));
  console.log('PASS registration storage and backend-confirmed route guard');
} finally {
  await server.close();
  if (previous) Object.defineProperty(globalThis, 'window', previous);
  else delete globalThis.window;
}
```

- [ ] **Step 2: Chạy test đỏ.**

```powershell
pnpm --filter @ocop/web exec node test/registration-flow.check.mjs
```

Kỳ vọng module chưa tồn tại. Đã đối chiếu Router đang cài: redirect có `options.to` và `options.replace`; kiểm tra cả hai, không chỉ kiểm tra có exception.

- [ ] **Step 3: Đổi type/API transport và hằng trạng thái.** Thêm các type contract ở đầu kế hoạch. Giữ `ResetPasswordInput` độc lập:

```ts
export interface ResetPasswordInput {
  email: string;
  code: string;
  newPassword: string;
}
```

Thêm `API.auth.registrationStatus='/auth/registration-status'`, `HTTP_STATUS.GONE=410`, `PENDING_REGISTRATION_STORAGE_KEY='ocop.pendingRegistration'`. Đổi các method trong `api/auth.ts`:

```ts
register: (data: RegisterInput) =>
  requestJson<RegistrationContext>({ url: API.auth.register, method: 'POST', data }),
registrationStatus: (registrationToken: string) =>
  requestJson<RegistrationStatus>({
    url: API.auth.registrationStatus, method: 'POST', data: { registrationToken },
  }),
verifyOtp: (data: RegistrationVerifyInput) =>
  requestJson<MessageResponse>({ url: API.auth.verifyOtp, method: 'POST', data }),
resendOtp: (registrationToken: string) =>
  requestJson<RegistrationResendResult>({
    url: API.auth.resendOtp, method: 'POST', data: { registrationToken },
  }),
```

Giữ `forgotPassword/resetPassword`. `base-request.ts` không cần sửa: interceptor 401 hiện chỉ đăng xuất khi có session và header của session; guard `_auth` đã dành cho khách. Kiểm tra lại điều kiện này bằng test hiện có.

- [ ] **Step 4: Viết storage và guard.** Trong `pending-registration.ts`, chỉ serialize whitelist, không `JSON.stringify` toàn bộ object đầu vào:

```ts
export function writePendingRegistration(value: RegistrationContext): boolean {
  try {
    const { registrationToken, email, expiresAt, otpExpiresAt, resendAvailableAt } = value;
    window.sessionStorage.setItem(PENDING_REGISTRATION_STORAGE_KEY, JSON.stringify({
      registrationToken, email, expiresAt, otpExpiresAt, resendAvailableAt,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingRegistration() {
  try {
    window.sessionStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY);
    window.sessionStorage.removeItem('ocop.pendingEmail');
  } catch { /* Guard treats unavailable storage as missing context. */ }
}

export async function requirePendingRegistration() {
  const saved = readPendingRegistration();
  if (!saved) {
    clearPendingRegistration();
    throw redirect({ to: '/register', replace: true });
  }
  let data: RegistrationStatus;
  try {
    ({ data } = await authApi.registrationStatus(saved.registrationToken));
  } catch (cause) {
    if (cause instanceof ApiError && [400, 401, 409, 410].includes(cause.status)) {
      clearPendingRegistration();
      throw redirect({ to: '/register', replace: true });
    }
    throw cause;
  }
  const registration = { ...data, registrationToken: saved.registrationToken };
  if (!writePendingRegistration(registration))
    throw redirect({ to: '/register', replace: true });
  return { registration };
}
```

`readPendingRegistration` kiểm tra dữ liệu không đáng tin và chỉ trả whitelist:

```ts
export function readPendingRegistration(): RegistrationContext | null {
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(PENDING_REGISTRATION_STORAGE_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') throw new Error('Missing context');
    const value = saved as Record<string, unknown>;
    const keys = ['registrationToken', 'email', 'expiresAt', 'otpExpiresAt', 'resendAvailableAt'] as const;
    if (!keys.every(key => typeof value[key] === 'string')) throw new Error('Invalid context');
    const { registrationToken, email, expiresAt, otpExpiresAt, resendAvailableAt } = value as Record<typeof keys[number], string>;
    if (!/^[a-f0-9]{64}$/.test(registrationToken) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        ![expiresAt, otpExpiresAt, resendAvailableAt].every(date => Number.isFinite(Date.parse(date))) ||
        Date.parse(expiresAt) <= Date.now()) throw new Error('Invalid context');
    return { registrationToken, email, expiresAt, otpExpiresAt, resendAvailableAt };
  } catch {
    clearPendingRegistration();
    return null;
  }
}
```

Không yêu cầu `otpExpiresAt>now` vì mã hết hạn vẫn được gửi lại trong phiên. Không dùng localStorage fallback. Không tin email storage khi backend trả email khác.

Route `_auth.verify-otp.tsx`:

```tsx
export const Route = createFileRoute('/_auth/verify-otp')({
  beforeLoad: requirePendingRegistration,
  pendingMs: 0,
  pendingComponent: () => <p role='status'>Đang kiểm tra phiên đăng ký…</p>,
  errorComponent: () => (
    <div role='alert'>
      <p>Không thể kiểm tra phiên đăng ký. Vui lòng thử lại.</p>
      <Button onClick={() => window.location.reload()}>Thử lại</Button>
      <Link to='/register' onClick={clearPendingRegistration}>Quay lại đăng ký</Link>
    </div>
  ),
  component: () => {
    const { registration } = Route.useRouteContext();
    return <VerifyOtpPage registration={registration} />;
  },
});
```

Import Button/Link và helpers theo pattern hiện có. Trang lỗi chỉ hiển thị thông báo an toàn; không render `error.message`, token hoặc form OTP. Kiểm tra lại phiên trong `beforeLoad` mỗi lần vào; test Back/refresh phải chứng minh không tái sử dụng phiên đã consume. Đặt `staleTime:0` khi cần ngăn tái sử dụng loader data, nhưng không coi loader cache là bằng chứng đã kiểm tra phiên.

- [ ] **Step 5: Nối form đăng ký với context thành công.** Trong `RegisterPage` thay onSubmit:

```ts
clearPendingRegistration();
setError('');
try {
  validatePasswordBytes(value.password);
  const { data } = await authApi.register({
    email: normalizeEmail(value.email), fullName: value.fullName,
    phone: optionalText(value.phone), password: value.password,
  });
  form.setFieldValue('password', '');
  if (!writePendingRegistration(data)) {
    setError('Không thể lưu phiên đăng ký. Hãy cho phép lưu trữ phiên rồi thử lại.');
    return;
  }
  await navigate({ to: '/verify-otp' });
} catch (cause) {
  setError(messageOf(cause));
}
```

Tên nút đổi **Gửi mã xác thực**; lỗi đăng ký không gợi ý tự nhập email tại OTP. Chỉ giữ link tiếp tục OTP khi `readPendingRegistration()` có giá trị; mọi link còn lại dùng `/register`. Bỏ câu “đã tạo tài khoản” trước xác thực. Không truyền password bằng props/context khi chuyển route.

- [ ] **Step 6: Nối màn OTP bằng token, email chỉ đọc.** `VerifyOtpPage` nhận prop `registration:RegistrationContext`; bỏ `email` khỏi defaultValues của form, chỉ còn `code`. Email hiển thị bằng text hoặc `<Input readOnly value={registration.email}>` có label. Không có handler đổi email. Verify dùng:

```ts
await authApi.verifyOtp({ registrationToken: registration.registrationToken, code: value.code });
clearPendingRegistration();
verifyForm.reset();
setSuccess(true);
```

Catch `ApiError` 401/410: clear, `navigate({to:'/register',replace:true})`; 400: báo lỗi OTP, giữ form; 409: thông báo email đã có tài khoản, cho tới `/login`, không đổi mật khẩu; 429: giữ phiên và báo chờ; mạng/500: giữ phiên và cho thử lại. Nếu mạng mất sau commit, cho nút đăng nhập, không tự gọi register/verify lặp vô hạn.

Gửi lại dùng token, cập nhật thời hạn do backend trả:

```ts
const { data } = await authApi.resendOtp(registration.registrationToken);
const updated = {
  ...registration,
  otpExpiresAt: data.otpExpiresAt,
  resendAvailableAt: data.resendAvailableAt,
};
if (!writePendingRegistration(updated)) {
  clearPendingRegistration();
  await navigate({ to: '/register', replace: true });
  return;
}
setResendAvailableAt(data.resendAvailableAt);
verifyForm.reset();
setNotice('Mã xác thực mới đã được gửi. Hãy dùng mã mới nhất.');
```

Khởi tạo state `resendAvailableAt` từ prop; tính giây chờ từ timestamp backend thay vì reset 60 giây mỗi refresh. Khi send lỗi, giữ context, xóa notice thành công, báo “Chưa gửi được mã mới. Mã cũ đã bị thay; hãy thử gửi lại.” Lấy lại status để cập nhật khoảng chờ nếu server đã reserve, dùng cùng xử lý lỗi phiên ở trên.

Thêm effect kiểm tra `expiresAt` khi đang chờ và khi tab focus trở lại. Hết hạn thì clear/replace `/register`; khi `success=true` thì ngừng kiểm tra để vẫn hiện màn thành công. Nút **Quay lại đăng ký** clear context trước navigate; nút thành công tới `/login`, không auto-login. Giữ OTP input numeric, one-time-code, aria-invalid/role alert và trạng thái disabled hiện có.

- [ ] **Step 7: Xóa caller/storage cũ và hoàn thiện test runnable.** Tìm `PENDING_EMAIL_STORAGE_KEY`, `readPendingEmail`, `writePendingEmail`, `clearPendingEmail`, `VerifyOtpInput`, mọi `resendOtp` caller. Chỉ sau khi hết caller mới xóa `pending-email.ts`, hằng/email verify type cũ; vẫn xóa key literal cũ khi clear. Trong `api-integration.check.mjs`, cập nhật exact exports hằng auth và assert request body verify/resend không có email/password.

Mở rộng script test Step 1 bằng các ca: storage JSON hỏng; chỉ email cũ; token sai; expiry sai/đã hết; OTP hết hạn nhưng phiên còn → vẫn gọi status; backend 401/410 clear; backend429/500 hoặc network giữ context nhưng không trả route context; storage.setItem throw thì không vào OTP. Thêm payload chứa password khi gọi writer và assert whitelist không lưu:

```js
pending.writePendingRegistration({ ...context, password: 'must-not-persist', passwordHash: 'must-not-persist' });
assert.ok(!JSON.stringify([...values.values()]).includes('must-not-persist'));
```

- [ ] **Step 8: Kiểm tra frontend xanh và hành vi hiển thị.**

```powershell
pnpm --filter @ocop/web exec node test/registration-flow.check.mjs
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web build
```

Browser với API local đã migrate và mail test hợp lệ: URL trực tiếp/Back/refresh; register lỗi; storage bị chặn; email read-only; cooldown refresh không reset; OTP hết hạn còn gửi lại được; lần sai thứ 5 về register; success không bị expiry effect đẩy đi; nút đăng nhập dùng được. Ghi lại kết quả ở Task 5. Không thêm trình duyệt tự động mới chỉ cho vài màn.

- [ ] **Step 9: Commit các hunk frontend.**

```powershell
git add apps/web/src/pages/auth/pending-registration.ts apps/web/test/registration-flow.check.mjs
git add -p -- apps/web/src/types/auth.ts apps/web/src/api/auth.ts apps/web/src/constants/api.ts apps/web/src/constants/auth.ts apps/web/src/constants/http-status.ts apps/web/src/routes/_auth.verify-otp.tsx apps/web/src/pages/auth/RegisterPage.tsx apps/web/src/pages/auth/VerifyOtpPage.tsx apps/web/src/pages/auth/LoginPage.tsx apps/web/src/pages/auth/pending-email.ts apps/web/test/api-integration.check.mjs
git commit -m "feat(web): require pending registration before OTP verification"
```

### Task 4: Chuyển đổi user chưa xác thực và dọn dữ liệu tạm

**Files:** `apps/be/prisma/registration-maintenance.ts`, `apps/be/test/registration-maintenance.db-spec.ts`; hướng dẫn chạy được hoàn tất trong operations ở Task 5.

**Interfaces:**

- Consumes: `PrismaClient`, `createPrismaAdapter`, `databaseObject`, schema Task 1.
- Produces export `auditPendingRegistrants(prisma): Promise<Array<{id:string;isActive:boolean;eligible:boolean;references:{products:number;assignments:number;evaluations:number;auditLogs:number}}>>`; `convertPendingRegistrants(prisma, ids:string[]): Promise<{convertedIds:string[];blockedIds:string[]}>`; `cleanupPendingRegistrations(prisma): Promise<number>`.
- CLI `--mode audit` mặc định chỉ đọc; `--mode convert --ids <JSON file>` chỉ chuyển ID đã chọn; `--mode cleanup` chỉ xóa `pending_registrations.expiresAt<=now`. Không thêm scheduler, không chạy từ seed hoặc startup.

- [ ] **Step 1: Viết test đỏ cho chuyển đổi có chọn lọc.** Import `randomUUID`, bcrypt, `Role`, `withTestApp` và ba hàm mới.

```ts
it('moves only explicitly selected unreferenced registrants and keeps blocked accounts', async () => {
  await withTestApp(async ({ prisma }) => {
    const passwordHash = await bcrypt.hash('LegacyPassword1!', 4);
    const safe = await prisma.user.create({ data: {
      email: `legacy-safe-${randomUUID()}@example.invalid`, password: passwordHash,
      fullName: 'Legacy safe', role: Role.REGISTRANT, verified: false,
    } });
    const blocked = await prisma.user.create({ data: {
      email: `legacy-blocked-${randomUUID()}@example.invalid`, password: passwordHash,
      fullName: 'Legacy referenced', role: Role.REGISTRANT, verified: false,
    } });
    await prisma.auditLog.create({ data: {
      actorId: blocked.id, action: 'TEST', entityType: 'User', entityId: blocked.id,
    } });
    const inventory = await auditPendingRegistrants(prisma);
    expect(inventory.find(item => item.id === safe.id)?.eligible).toBe(true);
    expect(inventory.find(item => item.id === blocked.id)?.eligible).toBe(false);
    const result = await convertPendingRegistrants(prisma, [safe.id, blocked.id]);
    expect(result).toEqual({ convertedIds: [safe.id], blockedIds: [blocked.id] });
    expect(await prisma.user.findUnique({ where: { id: safe.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: blocked.id } })).not.toBeNull();
    const pending = await prisma.pendingRegistration.findFirstOrThrow({ where: { email: safe.email } });
    expect(pending.passwordHash).toBe(passwordHash);
    expect(pending.lastSentAt).toBeNull();
    expect(pending.otpReady).toBe(false);
    await convertPendingRegistrants(prisma, [safe.id]);
    expect(await prisma.pendingRegistration.count({ where: { email: safe.email } })).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy đỏ.**

```powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/registration-maintenance.db-spec.ts
```

Kỳ vọng thiếu module/functions, không phải lỗi truy cập database.

- [ ] **Step 3: Thực hiện inventory và chuyển đổi từng user trong transaction.** Audit dùng Prisma `user.findMany` where `{role:REGISTRANT,verified:false}` select `id,isActive,_count:{select:{products,assignments,evaluations,auditLogs}}`; trả **ID và số lượng quan hệ**, không email/tên/password. `eligible` chỉ đúng khi active và bốn loại quan hệ đều 0.

Conversion mỗi ID khóa user trước khi kiểm tra lại. Dùng code lõi sau trong vòng lặp `for (const id of ids)`; kết quả false vào blockedIds, true vào convertedIds:

```ts
const converted = await prisma.$transaction(async tx => {
  const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE
  `);
  if (!locked.length) return false;
  const user = await tx.user.findUnique({ where: { id }, include: {
    _count: { select: { products: true, assignments: true, evaluations: true, auditLogs: true } },
  } });
  if (!user || user.role !== Role.REGISTRANT || user.verified || !user.isActive ||
      Object.values(user._count).some(count => count !== 0)) return false;
  const now = new Date();
  await tx.pendingRegistration.create({ data: {
    tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
    email: user.email, fullName: user.fullName, phone: user.phone,
    passwordHash: user.password, otpHash: randomBytes(32).toString('hex'),
    expiresAt: new Date(now.getTime() + REGISTRATION_TTL_MS),
    otpExpiresAt: now, lastSendAttemptAt: now, otpReady: false,
  } });
  await tx.otpCode.deleteMany({ where: { email: user.email, purpose: OtpPurpose.REGISTER } });
  await tx.user.delete({ where: { id } });
  return true;
});
```

Import crypto/Prisma/Role/OtpPurpose và constants chính xác. Các token/mã của bản ghi chuyển đổi không được phát hành; `lastSentAt=null` làm chúng không thể dùng verify/status. Người dùng phải nhập lại thông tin ở `/register`, nhận OTP mới rồi mới có user. Bản ghi chuyển đổi giữ snapshot/hash trong thời hạn 15 phút, sau đó cleanup; backup phục vụ rollback phải giữ độc lập. Không dùng script này để chuyển user có liên kết hoặc user bị khóa.

Giữ khóa user trong suốt transaction để insert FK đồng thời không chen giữa kiểm kê và xóa. Nếu schema sau này thêm quan hệ user, kiểm tra đủ quan hệ mới trước chạy conversion; không dựa vào cascade để xóa dữ liệu không có trong inventory.

Cleanup cụ thể:

```ts
export async function cleanupPendingRegistrations(prisma: PrismaClient) {
  const result = await prisma.pendingRegistration.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return result.count;
}
```

- [ ] **Step 4: Nối CLI bằng parseArgs và kiểm tra input.** Dùng `parseArgs` từ `node:util`, `readFileSync` từ fs. `--mode` chỉ nhận audit/convert/cleanup. `--ids` bắt buộc với convert, JSON phải là array không rỗng gồm string ID, không trùng; từ chối mode/input sai trước gọi Prisma. Không suy diễn danh sách từ `verified=false` để tự convert tất cả.

Nối CLI sau các export nghiệp vụ; import `parseArgs`, `readFileSync`, `PrismaClient`, `createPrismaAdapter` như mô tả:

```ts
async function main() {
  const { values } = parseArgs({ options: {
    mode: { type: 'string', default: 'audit' }, ids: { type: 'string' },
  } });
  if (!['audit', 'convert', 'cleanup'].includes(values.mode)) throw new Error('Invalid mode');
  let ids: string[] = [];
  if (values.mode === 'convert') {
    if (!values.ids) throw new Error('An IDs file is required');
    const parsed: unknown = JSON.parse(readFileSync(values.ids, 'utf8'));
    if (!Array.isArray(parsed) || !parsed.length ||
        !parsed.every(id => typeof id === 'string' && id.trim() === id && id.length > 0) ||
        new Set(parsed).size !== parsed.length) throw new Error('Invalid IDs file');
    ids = parsed;
  }
  const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
  try {
    if (values.mode === 'audit') console.log(JSON.stringify(await auditPendingRegistrants(prisma)));
    else if (values.mode === 'cleanup') console.log(JSON.stringify({ deleted: await cleanupPendingRegistrations(prisma) }));
    else {
      const result = await convertPendingRegistrants(prisma, ids);
      console.log(JSON.stringify(result));
      if (result.blockedIds.length) process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}
if (require.main === module) main().catch(() => {
  console.error('Registration maintenance failed; inspect the approved inventory and database access.');
  process.exitCode = 1;
});
```

Import `dotenv/config` ở đầu script. stdout chỉ in inventory hoặc convertedIds/blockedIds/count; catch không dump stack/DB URL/Prisma row. Import script trong test không tự chạy CLI.

- [ ] **Step 5: Thêm kiểm tra cleanup và rollback transaction.** Trong cùng test file, tạo một pending hết hạn và một pending còn hạn; `cleanupPendingRegistrations` trả 1, chỉ row hết hạn bị xóa. Với conversion, thêm user ADMIN/JUDGE, verified=true và inactive vào IDs: tất cả bị chặn, hash không đổi.

Ca rollback: tạo `safe` user không có FK bằng fixture Step 1, dùng trigger riêng schema test từ `databaseObject` và `Prisma.sql`:

```ts
await prisma.$executeRaw(Prisma.sql`
  CREATE FUNCTION ${databaseObject('reject_registration_test_delete')}()
  RETURNS trigger LANGUAGE plpgsql AS $body$
  BEGIN RAISE EXCEPTION 'test delete rejected'; END;
  $body$
`);
await prisma.$executeRaw(Prisma.sql`
  CREATE TRIGGER reject_registration_test_delete
  BEFORE DELETE ON ${databaseObject('users')}
  FOR EACH ROW EXECUTE FUNCTION ${databaseObject('reject_registration_test_delete')}()
`);
try {
  await expect(convertPendingRegistrants(prisma, [safe.id])).rejects.toThrow();
  expect(await prisma.user.findUnique({ where: { id: safe.id } })).not.toBeNull();
  expect(await prisma.pendingRegistration.count({ where: { email: safe.email } })).toBe(0);
} finally {
  await prisma.$executeRaw(Prisma.sql`
    DROP TRIGGER reject_registration_test_delete ON ${databaseObject('users')}
  `);
  await prisma.$executeRaw(Prisma.sql`
    DROP FUNCTION ${databaseObject('reject_registration_test_delete')}()
  `);
}
```

Không áp trigger lên schema public và luôn drop trong finally để helper test dọn user được.

- [ ] **Step 6: Chạy xanh và chỉ preview inventory khi có yêu cầu kiểm kê.**

```powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/registration-maintenance.db-spec.ts
pnpm --filter @ocop/api typecheck
```

Lệnh vận hành để ghi vào runbook, không chạy trong task viết kế hoạch:

```powershell
pnpm --filter @ocop/api exec tsx prisma/registration-maintenance.ts --mode audit
pnpm --filter @ocop/api exec tsx prisma/registration-maintenance.ts --mode convert --ids legacy-registration-ids.json
pnpm --filter @ocop/api exec tsx prisma/registration-maintenance.ts --mode cleanup
```

File JSON chỉ chứa IDs đã được kiểm kê, ví dụ `["legacy-user-id-1"]`; không commit manifest thật. Chạy conversion chỉ sau backup và rehearsal Task 5, khi đã xác nhận xử lý blocked rows. Dọn pending theo lượt vận hành hằng ngày và sau chuyển đổi; kiểm tra expiry trong API vẫn bắt buộc dù chưa chạy cleanup.

- [ ] **Step 7: Commit công cụ và tests.**

```powershell
git add apps/be/prisma/registration-maintenance.ts apps/be/test/registration-maintenance.db-spec.ts
git commit -m "feat(auth): add guarded pending registration maintenance"
```

### Task 5: Hồi quy, nghiệm thu và phát hành đồng bộ

**Files:** `apps/be/test/auth.db-spec.ts`, `apps/be/test/backend.db-spec.ts`, `apps/be/test/registration.db-spec.ts`, `apps/be/test/registration-repository.db-spec.ts`; `apps/web/src/types/api-contract.check.ts`; các tài liệu ở file map.

**Interfaces:**

- Consumes: bốn API mới, helper test DB, storage/guard, CLI maintenance của Task 4.
- Produces: các test cũ dùng đăng ký tạm; bằng chứng cho DK01..DK14; runbook cutover/cleanup/rollback. Không phát hành hoặc chuyển dữ liệu thật tự động vì chạy test thành công.

- [ ] **Step 1: Chạy nhóm auth cũ để thấy kỳ vọng cần chuyển.**

```powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/auth.db-spec.ts test/backend.db-spec.ts
```

Kỳ vọng đỏ ở test giữ pending user sau SMTP lỗi và fixture gọi `OtpService.issue(...REGISTER,userId)`. Không sửa bằng cách khôi phục tạo user sớm. Ghi danh sách test hỏng vào bản ghi verification, chỉ sửa các ca liên quan contract đăng ký.

- [ ] **Step 2: Đổi test SMTP failure/retry và fixture cũ.** Trong `auth.db-spec.ts`, thay test đầu bằng ca sau; giữ các test thu hồi JWT/reset hiện có:

```ts
it('allows a fresh registration after SMTP failure without reserving a users email', async () => {
  await withTestApp(async ({ app, prisma, baseUrl }) => {
    const email = `retry-${randomUUID()}@example.invalid`;
    let latestCode = '';
    app.get(MailService).sendOtp = jest.fn()
      .mockRejectedValueOnce(new Error('smtp unavailable'))
      .mockImplementation(async (_email, code) => { latestCode = code; });
    const post = (url: string, body: unknown) => apiRequest<any>(baseUrl, url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const input = { email, fullName: 'Retry registrant', password: 'FirstPassword1!' };
    expect((await post('/auth/register', input)).status).toBe(500);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    const second = await post('/auth/register', { ...input, password: 'SecondPassword2!' });
    expect(second.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect((await post('/auth/verify-otp', {
      registrationToken: second.body.data.registrationToken, code: latestCode,
    })).status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await bcrypt.compare('SecondPassword2!', user.password)).toBe(true);
  });
});
```

Trong `backend.db-spec.ts`, sửa ba vị trí: schema isolation, hành trình register→submit→score và concurrent REGISTER consumes. Mỗi vị trí gọi `/auth/register`, capture OTP qua mock MailService, assert zero users rồi verify bằng token. Ca concurrent assert statuses `[200,401]` khi dùng cùng token; trường hợp hai token cùng email có thể `[200,409]`. Không để fixture trực tiếp thêm `verified=false` cho đăng ký mới; fixture admin/judge/verified user khác giữ nguyên.

Schema isolation: dùng `databaseObject('pending_registrations')` ở truy vấn lock, assert row/user chỉ thuộc schema test và không có email fixture ở public. Cleanup test xóa pending theo email/token; giữ các cơ chế bảo vệ localhost/schema của helper.

- [ ] **Step 3: Thêm rollback và hai phiên dùng cùng email.** Trong repository DB spec, kiểm tra rollback bằng trigger **chỉ trong schema test**. Import `Prisma`, `databaseObject`; trong một ca `withTestApp`:

```ts
await prisma.$executeRaw(Prisma.sql`
  CREATE FUNCTION ${databaseObject('reject_registration_test_insert')}()
  RETURNS trigger LANGUAGE plpgsql AS $body$
  BEGIN
    IF NEW."fullName" = 'ROLLBACK_REGISTRATION_TEST' THEN
      RAISE EXCEPTION 'test insert rejected';
    END IF;
    RETURN NEW;
  END;
  $body$
`);
await prisma.$executeRaw(Prisma.sql`
  CREATE TRIGGER reject_registration_test_insert
  BEFORE INSERT ON ${databaseObject('users')}
  FOR EACH ROW EXECUTE FUNCTION ${databaseObject('reject_registration_test_insert')}()
`);
```

Tạo pending bằng `repo.createPendingRegistration` với `fullName:'ROLLBACK_REGISTRATION_TEST'`, mark sent rồi:

```ts
try {
  await expect(repo.consumeRegistration(tokenHash, otpHash)).rejects.toThrow();
  expect(await prisma.user.count({ where: { email } })).toBe(0);
  expect(await prisma.pendingRegistration.findUnique({ where: { tokenHash } }))
    .toMatchObject({ attempts: 0, otpReady: true });
} finally {
  await prisma.$executeRaw(Prisma.sql`
    DROP TRIGGER reject_registration_test_insert ON ${databaseObject('users')}
  `);
  await prisma.$executeRaw(Prisma.sql`
    DROP FUNCTION ${databaseObject('reject_registration_test_insert')}()
  `);
}
expect(await repo.consumeRegistration(tokenHash, otpHash)).toBe('verified');
```

Ca hai phiên cùng email tạo hai context với hash/password khác nhau, assert cross-session `registrationHash(tokenB,codeA)` không xác thực B. Dùng wrong code chắc chắn khác (`codeA==='000000' ? '000001' : '000000'`) cho ca sai mã, không dựa vào random tránh flaky. Tạo đúng một user từ snapshot của phiên thắng, snapshot phiên còn lại không bị overwrite; unique constraint chặn lần tạo thứ hai.

- [ ] **Step 4: Thêm HTTP resend/failure/expiry coverage cho DK06/DK10.** Trong `registration.db-spec.ts`, với mỗi ca dùng `withTestApp` mới để không dính throttle; hash token qua SHA-256 để tìm pending test. Trình tự assertion:

```ts
expect((await post('/auth/resend-otp', { registrationToken })).status).toBe(429);
await prisma.pendingRegistration.update({
  where: { tokenHash }, data: { lastSendAttemptAt: new Date(Date.now() - 61_000) },
});
const before = await prisma.pendingRegistration.findUniqueOrThrow({ where: { tokenHash } });
const resent = await post('/auth/resend-otp', { registrationToken });
expect(resent.status).toBe(200);
const after = await prisma.pendingRegistration.findUniqueOrThrow({ where: { tokenHash } });
expect(after.passwordHash).toBe(before.passwordHash);
expect(after.expiresAt).toEqual(before.expiresAt);
expect(after.attempts).toBe(before.attempts);
expect(await prisma.user.count({ where: { email } })).toBe(0);
```

Test không đoán OTP random có đổi giá trị: mock `createRegistrationCode` bằng hai mã khác nhau cố định và hash qua `registrationHash`, hoặc xác nhận trạng thái hash theo mã mock. Thử verify mã cũ trả 400, mã mới đúng trả200. SMTP resend lỗi: trả500; `otpReady=false`; token/status còn hợp lệ; mã cũ trả400; sau đủ khoảng chờ được gửi lại; không reset attempts. OTP hết hạn nhưng phiên còn: status200, verify400, resend được; phiên hết hạn: status/verify/resend410. Lần sai thứ5 commit attempts5 và trả410, không tạo user.

- [ ] **Step 5: Cập nhật FE type assertions và ghi bằng chứng.** Trong `types/api-contract.check.ts`, thêm type-only assertions không có password trong context/verify và reset vẫn có email:

```ts
type NoRegistrationPassword = Assert<'password' extends keyof RegistrationContext ? false : true>;
type NoVerifyEmail = Assert<'email' extends keyof RegistrationVerifyInput ? false : true>;
type ResetStillUsesEmail = Assert<'email' extends keyof ResetPasswordInput ? true : false>;
```

Tạo `docs/verification/2026-10-23-registration-after-otp.md` với ngày/commit kiểm tra, môi trường schema, mỗi lệnh và kết quả thực tế, bảng DK01..DK14 có pass/fail/chưa chạy và bằng chứng tương ứng. Không điền pass trước khi chạy. Screenshot không chứa OTP/token/password; không đưa DB URL hoặc email thật vào log tài liệu.

Map coverage bắt buộc:

| Spec | Bằng chứng |
| --- | --- |
| DK01/DK02/DK05/DK11 | Script storage/guard + browser URL trực tiếp, refresh, network failure, email read-only. |
| DK03/DK04/DK07 | HTTP registration test và kiểm tra DB count trước/sau OTP. |
| DK06/DK08/DK09/DK13 | Repository attempts, lock/concurrency, trigger rollback và hai phiên cùng email. |
| DK10 | HTTP resend mới/cũ, fail mail, cooldown, TTL không gia hạn. |
| DK12 | Replay test + browser Back/refresh; mô phỏng mất response sau commit rồi đăng nhập. |
| DK14 | Auth unit/DB reset-token revocation, filter/mail tests, frontend API integration, toàn bộ nhóm DB. |
| Dữ liệu cũ | Maintenance tests; inventory có kiểm kê FK; rehearsal conversion và restore backup trên DB sao chép. |

- [ ] **Step 6: Chạy checks cuối cùng sau khi cập nhật toàn bộ fixture.**

```powershell
pnpm --filter @ocop/api prisma validate
pnpm --filter @ocop/api prisma generate
pnpm --filter @ocop/api test --runInBand
pnpm --filter @ocop/api build
pnpm --filter @ocop/api test:db
pnpm --filter @ocop/web exec node test/registration-flow.check.mjs
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm typecheck
pnpm --filter @ocop/web build
```

Kỳ vọng tất cả pass; test DB chỉ schema test local. Không chạy lint `--fix` toàn repository hoặc format toàn app để tránh kéo thay đổi khác vào task. Nếu checks hỏng vì thay đổi ngoài scope, ghi lỗi cụ thể và không tuyên bố toàn hệ thống xanh; chỉ sửa phần do luồng đăng ký gây ra.

- [ ] **Step 7: Viết hướng dẫn vận hành và kiểm tra SMTP thật.** Cập nhật `apps/be/docs/operations.md` bằng trình tự dưới, liên kết từ README/backend-architecture/FE README và đặc tả tích hợp FE/BE. Bỏ mô tả “tạo user chưa xác thực rồi gửi lại bằng email”; bảng API chỉ rõ token cho register OTP, email+code cho reset.

1. Chụp backup dữ liệu và thử restore trên bản sao; không ghi credential vào báo cáo.
2. Rehearse schema migration, audit và conversion bằng danh sách ID trên DB sao chép; xác nhận user liên kết/locked/admin/judge/verified không bị xóa, mọi email giữ bởi bản ghi cũ có phương án xử lý. Trường hợp còn blockedIds chưa xử lý thì chưa đạt cutover hoàn chỉnh.
3. Chuẩn bị FE và BE cùng phiên bản, đặt cửa sổ bảo trì đăng ký/OTP để không chạy hai contract cùng lúc. Tạm dừng các thay đổi user liên quan trong lúc chuyển đổi.
4. Deploy migration thêm bảng bằng lệnh dưới vào DB đích đã xác nhận; generate client là bước build. Chạy audit, kiểm tra danh sách ID, rồi mới convert. Không tự gọi convert trong migration.
5. Deploy đồng bộ FE/BE. Xóa ngữ cảnh email cũ qua helper; user chưa hoàn tất phải đăng ký lại và nhận mã mới. Bật lại đăng ký sau smoke check.
6. Kiểm tra SMTP thật bằng hộp thư kiểm thử được phép dùng: submit thông tin → email nhận OTP → DB vẫn chưa có user → nhập OTP → có đúng một user → đăng nhập. SMTP accept chỉ chứng minh nhận lệnh gửi; xác nhận hộp thư mới là bằng chứng nhận mail. Xóa dữ liệu test theo quy trình của môi trường.
7. Chạy `--mode cleanup` hằng ngày theo quy trình vận hành, theo dõi số row xóa; không dựng lịch mới trong feature này. API từ chối phiên hết hạn dù cleanup chưa chạy.

```powershell
pnpm --filter @ocop/api prisma:migrate:deploy
```

Cấu hình SMTP mẫu hiện không đủ để chạy smoke thật; sau khi bỏ `[DEV OTP]`, placeholder không còn trả thành công. Ghi **chưa kiểm tra giao thư thật** nếu chưa có cấu hình/hộp nhận; không lấy mock pass làm nghiệm thu email.

Rollback: dừng đăng ký và thay đổi tài khoản trước; khôi phục FE/BE cùng phiên bản và dữ liệu user/OTP theo backup đã rehearsal, đối soát user đã tạo sau cutover để không làm mất tài khoản mới. Không chạy script chèn lại user hàng loạt lên DB đang có email trùng, không tự bỏ migration bằng `DROP TABLE`. Nếu chưa chuyển dữ liệu và chỉ lỗi app, bảng thêm mới có thể giữ khi rollback code; đăng ký tạm phải bị vô hiệu trước khi mở lại luồng cũ.

Sau kiểm tra thực tế, cập nhật dòng trạng thái của đặc tả thành đã triển khai kèm liên kết verification; chỉ bỏ dòng “chưa áp dụng” trong README khi code đã chạy đúng. Không đánh dấu hoàn tất chỉ vì tạo đủ file/commit.

- [ ] **Step 8: Review diff và commit test/docs.**

```powershell
git diff --check
git add -p -- apps/be/test/auth.db-spec.ts apps/be/test/backend.db-spec.ts apps/be/test/registration.db-spec.ts apps/be/test/registration-repository.db-spec.ts apps/web/src/types/api-contract.check.ts README.md apps/be/README.md apps/web/README.md apps/be/docs/backend-architecture.md apps/be/docs/operations.md docs/superpowers/specs/2026-10-15-fe-be-api-integration.md docs/superpowers/specs/2026-10-23-registration-after-otp-spec.md
git add docs/verification/2026-10-23-registration-after-otp.md
git commit -m "test(auth): verify registration cutover and document operations"
```

## Điểm hoàn tất của kế hoạch

Triển khai và nghiệm thu hoàn tất khi DK01..DK14 đạt, checks cuối xanh, người dùng cũ có đường xử lý đã kiểm kê, và kiểm tra nhận mail SMTP thật đạt. Mọi mục chưa chạy giữ trạng thái chưa chạy; thiếu bằng chứng SMTP thật thì chưa nghiệm thu xong việc gửi thư. Việc phát hành/chuyển đổi DB là bước thực thi riêng, không được suy ra từ việc kế hoạch này đã lưu.

## Tự rà soát kế hoạch

- Yêu cầu “không user trước OTP”: Task 1/2; không còn caller tạo user sớm ở Task 5.
- Bắt buộc thông tin đăng ký trước màn OTP và xác nhận backend: Task 3.
- TTL, attempts, cooldown, hash theo phiên, resend race, unique email, atomic rollback: Task 1/2/5.
- Thông tin nhạy cảm và reset DTO/JWT: Task 2/3/5.
- Legacy users, FK inventory, cleanup, backup/rollback và đồng bộ FE/BE: Task 4/5.
- Các type/method trong task sau dùng đúng contract ở đầu kế hoạch. Chỉ kiểm tra văn bản và nguồn hiện có trong bước lập kế hoạch; chưa chạy checks ứng dụng, migration, conversion hay mail thật.
