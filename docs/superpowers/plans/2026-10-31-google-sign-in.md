# Đăng nhập Google và đăng ký sau OTP Implementation Plan

> Đây là kế hoạch gốc; các checkbox giữ nguyên trạng thái khi lập kế hoạch. Xem [trạng thái thực hiện và việc còn thiếu](../status/2026-10-31-google-sign-in-status.md) để biết kết quả hiện tại.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép đăng nhập bằng mật khẩu hoặc Google, chỉ tạo tài khoản mới sau khi xác thực email bằng OTP, và bảo vệ liên kết Google với tài khoản hiện có.

**Architecture:** Dùng Google Identity Services ở web và xác minh ID token ở backend. PostgreSQL lưu yêu cầu đăng ký/liên kết tạm có hạn và lưu `sub` Google duy nhất trên tài khoản; OTP được kiểm tra và tạo hoặc liên kết tài khoản trong transaction. Giữ JWT, phân quyền, SMTP và luồng quên mật khẩu hiện tại.

**Tech Stack:** NestJS 11, Prisma 7/PostgreSQL, React 19, TanStack Router/Form, Google Identity Services, `google-auth-library`, Nodemailer, Jest, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-31-google-sign-in-spec.md`; đối chiếu `docs/superpowers/specs/2026-10-23-registration-after-otp-spec.md` cho đăng ký email và chuyển tiếp dữ liệu cũ.

## Global Constraints

- Node `>=24.7 <25` cho backend; không thêm dependency trừ `google-auth-library` để kiểm tra chữ ký ID token.
- Mật khẩu có 8–72 ký tự và tối đa 72 byte UTF-8; OTP gồm 6 chữ số, hiệu lực 5 phút, tối đa 5 lần sai.
- Phiên đăng ký tạm sống 15 phút; token ngẫu nhiên 32 byte, chỉ lưu hash ở backend; không đưa token, OTP, mật khẩu, Google credential vào URL hoặc log.
- Tài khoản mới chỉ tạo sau OTP đúng; vai trò `REGISTRANT`, tên bắt buộc 1–255 ký tự, số điện thoại tùy chọn tối đa 30 ký tự.
- Không đổi vai trò, quyền, hồ sơ, mật khẩu hoặc trạng thái khóa của tài khoản cũ khi liên kết Google. Dùng `sub` Google duy nhất; không lấy số điện thoại/ảnh từ Google.
- Không xóa, tự kích hoạt hoặc chuyển đổi hàng loạt người dùng cũ; kiểm kê bản ghi chưa xác thực và quan hệ trước triển khai. Giữ cơ chế xác thực cũ có giới hạn trong giai đoạn chuyển tiếp; ngừng chỉ sau khi đã xử lý dữ liệu.
- Giữ response envelope, kiểm tra `verified`, `isActive`, `tokenVersion`, OTP đặt lại mật khẩu và chính sách thu hồi phiên hiện tại.
- Bảo toàn thay đổi chưa commit của người dùng trong `LoginPage.tsx`, `RegisterPage.tsx`, `AuthFrame.tsx`, `styles.css`, `vite.config.ts`; không dùng `git add` toàn bộ repo.
- Cấu hình SMTP thật và Google Cloud cần do người vận hành cung cấp; không in hoặc commit credential. Không yêu cầu SMTP thật trong kiểm thử tự động.

## Bản đồ tệp và hợp đồng

| Thành phần | Tệp | Trách nhiệm |
| --- | --- | --- |
| Lưu trữ | `apps/be/prisma/schema.prisma`, migrations mới `0015_pending_auth`, `0016_google_identity` | Phiên tạm, tài khoản Google, ràng buộc và chỉ mục; migrations cộng thêm, không xóa user. |
| Xác thực | `apps/be/src/services/auth.service.ts`, `otp.service.ts`, `mail.service.ts`, `apps/be/src/repositories/auth.repository.ts` | Đăng ký, OTP, liên kết và cấp JWT; giữ reset mật khẩu. |
| Google | `apps/be/src/services/google-identity.service.ts`, `apps/be/src/app.module.ts`, `apps/be/src/config/env.ts`, `apps/be/package.json`, `pnpm-lock.yaml` | Xác minh credential và cấu hình client ID. |
| API | `apps/be/src/controllers/auth.controller.ts`, `apps/be/src/dtos/auth.dto.ts`, `apps/be/src/types/auth.ts` | Hợp đồng request/response, validation và throttle. |
| Web | `apps/web/src/api/auth.ts`, `apps/web/src/constants/api.ts`, `apps/web/src/types/auth.ts`, `apps/web/src/pages/auth/`, `apps/web/src/routes/_auth.verify-otp.tsx`, `apps/web/src/vite-env.d.ts` | Nút Google, biểu mẫu, phiên tạm, OTP và chuyển hướng. |
| Kiểm thử | `apps/be/test/auth.db-spec.ts`, `apps/be/test/support/db-app.ts`, `apps/be/src/services/auth.service.spec.ts`, `apps/web/test/api-integration.check.mjs` | Kiểm thử hành vi qua HTTP/DB, bảo vệ dữ liệu cũ và hợp đồng web. |
| Vận hành | `apps/be/.env.example`, `apps/web/.env.example`, `README.md`, `apps/be/README.md` | Cấu hình OAuth/SMTP, migration và kiểm tra thật. |

Các API bên dưới trả envelope `{ statusCode, data, message }` hiện có; các object trong bảng là `data`. Không được dựa vào nhãn UI để bảo vệ API.

| API | Body | `data` thành công |
| --- | --- | --- |
| `POST /auth/register` | `{ email, password, fullName, phone? }` | `{ registrationToken, email, expiresAt, otpExpiresAt, resendAvailableAt }` |
| `POST /auth/registration-status` | `{ registrationToken }` | `{ mode: 'register' \| 'google-link', email, expiresAt, otpExpiresAt, resendAvailableAt }` |
| `POST /auth/verify-otp` | `{ registrationToken, code }` | `{ message: 'Registration completed' }` |
| `POST /auth/resend-otp` | `{ registrationToken }` | `{ message, otpExpiresAt, resendAvailableAt }` |
| `POST /auth/google/challenge` | `{}` | `{ challengeToken, nonce }` |
| `POST /auth/google` | `{ challengeToken, credential, intent: 'login' \| 'register' }` | Một trong `{ kind: 'session', accessToken, user, expiresIn }`, `{ kind: 'profile', registrationToken, email, suggestedName }`, `{ kind: 'link_otp', registrationToken, email, expiresAt, otpExpiresAt, resendAvailableAt }`. |
| `POST /auth/google/register` | `{ registrationToken, fullName, phone? }` | `{ registrationToken, email, expiresAt, otpExpiresAt, resendAvailableAt }` sau khi SMTP chấp nhận. |
| `POST /auth/google/link/verify` | `{ registrationToken, code }` | `{ kind: 'session', accessToken, user, expiresIn }` |
| `POST /auth/google/link/resend` | `{ registrationToken }` | `{ message, otpExpiresAt, resendAvailableAt }` |

Google credential phải gắn nonce với challenge do backend phát hành, hạn 5 phút, dùng một lần. Chỉ chấp nhận request Google có `Origin` trong `CORS_ORIGINS`, dùng JSON; không coi việc CORS không trả header là chặn xử lý request. Test HTTP phải gửi `Origin` hợp lệ. `registrationToken` là token phiên riêng được trả một lần; lưu trong `sessionStorage`, không lưu mật khẩu hoặc credential Google. Với `intent: register` và `sub` đã gắn user, trả `409` với thông báo “Tài khoản Google này đã được dùng”; nếu email trùng tài khoản chưa liên kết, cũng không tạo user và hướng dẫn sang đăng nhập.

---

### Task 1: Đăng ký email chỉ tạo user sau OTP

**Files:** Modify `apps/be/prisma/schema.prisma`, `apps/be/src/controllers/auth.controller.ts`, `apps/be/src/dtos/auth.dto.ts`, `apps/be/src/services/auth.service.ts`, `apps/be/src/repositories/auth.repository.ts`, `apps/be/src/services/otp.service.ts`, `apps/be/test/support/db-app.ts`, `apps/be/test/auth.db-spec.ts`, `apps/be/src/services/auth.service.spec.ts`; create `apps/be/prisma/migrations/0015_pending_auth/migration.sql`.

**Interfaces:** `POST /auth/register`, `registration-status`, `verify-otp`, `resend-otp` theo bảng trên. `ResetPasswordDto` tiếp tục nhận `{ email, code, newPassword }`, không kế thừa DTO registration mới. Thêm `PendingAuth` với `id`, `kind` (`EMAIL_REGISTER`, `GOOGLE_PROFILE`, `GOOGLE_REGISTER`, `GOOGLE_LINK`, `GOOGLE_CHALLENGE`), `tokenHash` unique, `email`, `fullName`, `phone`, `passwordHash`, `googleSub`, `nonceHash`, `otpHash`, `attempts`, `expiresAt`, `otpExpiresAt`, `resendAvailableAt`, `createdAt`; các trường tùy chọn khi kind không dùng. Không có FK đến user đối với đăng ký mới; với liên kết lưu `userId` và kiểm tra lại user trong transaction.

- [ ] **Viết kiểm thử HTTP thất bại trước.** Trong `auth.db-spec.ts`, dùng `withTestApp`, thay `MailService.sendOtp` bằng hàm lưu mã trong biến test, POST `/auth/register`, xác nhận HTTP 200 và `prisma.user.findUnique({ where: { email } })` là `null`. POST `/auth/verify-otp` với `{ registrationToken: data.registrationToken, code }`, xác nhận chỉ sau đó có một user `verified: true`; dùng lại cùng request phải thất bại. Thêm ca SMTP throw, mã sai/hết hạn, 5 lần sai, gửi lại quá sớm, hai phiên cùng email và `Promise.all` hai lần verify. Các ca thất bại đều kiểm tra không tạo user.

```ts
const result = await apiRequest<{ data: { registrationToken: string } }>(baseUrl, '/auth/register', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'ValidPassword1!', fullName: 'HTX A' }),
});
expect(result.status).toBe(200);
expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
```

- [ ] **Chạy kiểm thử để thấy lỗi hiện tại.** `pnpm --filter @ocop/api test:db -- auth.db-spec.ts`; PostgreSQL phải là localhost như helper yêu cầu. Kỳ vọng thất bại vì user hiện được tạo trước OTP.
- [ ] **Viết migration và xử lý giao dịch.** Tạo migration cộng thêm bảng pending, chỉ mục `expiresAt` và unique `tokenHash`; giữ toàn bộ bảng/user hiện có. Hash token bằng SHA-256, hash OTP bằng HMAC-SHA256 với `JWT_SECRET` và tiền tố `pendingId:purpose:`. Mỗi phiên giữ snapshot và OTP riêng; lock dòng `FOR UPDATE`, commit lần sai trước khi trả lỗi; OTP đúng tạo user và xóa pending trong cùng transaction. Khi unique email conflict hoặc DB lỗi, rollback toàn transaction. `resend` vô hiệu mã cũ trước khi gửi và backend enforce 60 giây; chỉ báo gửi thành công sau khi SMTP nhận thư. Hết hạn là `min(now + 5 phút, expiresAt)`.
- [ ] **Giữ quyền truy cập user cũ.** Tách DTO và endpoint chuyển tiếp `POST /auth/legacy-registration/verify` nhận `{ email, code }` và `POST /auth/legacy-registration/resend` nhận `{ email }`; chỉ tác động user `REGISTRANT`, `verified=false`, `isActive=true` đã tồn tại và OTP `REGISTER` cũ. Không tạo user mới ở nhánh này. Ghi hướng dẫn quản trị viên kiểm kê các user cũ và quan hệ trước khi ngừng endpoint; không tự xóa hoặc tự chuyển đổi. Bổ sung test user cũ xác thực được, user bị khóa không được kích hoạt, và reset OTP vẫn hoạt động.
- [ ] **Cập nhật helper và chạy lại.** `clearExistingData` xóa `pending_auth` trước `users`; sửa test cũ đang kỳ vọng user tồn tại khi SMTP lỗi. Chạy `pnpm --filter @ocop/api exec prisma generate`, sau đó `pnpm --filter @ocop/api test:db -- auth.db-spec.ts` và `pnpm --filter @ocop/api test -- --runInBand auth.service.spec.ts`. Kỳ vọng tất cả PASS.
- [ ] **Commit phần backend đăng ký.** Chỉ stage tệp của task: `git add apps/be/prisma apps/be/src/controllers/auth.controller.ts apps/be/src/dtos/auth.dto.ts apps/be/src/services/auth.service.ts apps/be/src/services/otp.service.ts apps/be/src/repositories/auth.repository.ts apps/be/test/auth.db-spec.ts apps/be/test/support/db-app.ts apps/be/src/services/auth.service.spec.ts`; `git commit -m "feat(auth): create registrations after OTP verification"`.

### Task 2: Xác minh Google và đăng nhập tài khoản cũ

**Files:** Create `apps/be/src/services/google-identity.service.ts`, `apps/be/prisma/migrations/0016_google_identity/migration.sql`; modify `apps/be/src/app.module.ts`, `apps/be/src/config/env.ts`, `apps/be/src/dtos/auth.dto.ts`, `apps/be/src/controllers/auth.controller.ts`, `apps/be/src/services/auth.service.ts`, `apps/be/src/repositories/auth.repository.ts`, `apps/be/prisma/schema.prisma`, `apps/be/test/auth.db-spec.ts`, `apps/be/test/support/db-app.ts`, `apps/be/package.json`, `pnpm-lock.yaml`.

**Interfaces:** `GoogleIdentityService.verify(credential: string, nonce: string): Promise<{ sub: string; email: string; suggestedName: string | null; authoritative: boolean }>`; API `google/challenge`, `google` theo bảng. Thêm `User.googleSub String? @unique`; `User.password String?` để tài khoản chỉ Google không cần mật khẩu giả. Google-only quên mật khẩu dùng OTP reset hiện có để thiết lập mật khẩu ứng dụng; đổi mật khẩu khi chưa có mật khẩu trả lỗi hướng dẫn dùng quên mật khẩu.

- [ ] **Viết kiểm thử thất bại.** Mock `GoogleIdentityService.verify` ở ranh giới ngoài trong `withTestApp`; tạo user đã xác thực với email `owner@gmail.com`, yêu cầu challenge rồi POST `/auth/google` intent `login`; xác nhận JWT và `user.id` cũ, một user duy nhất, quyền và mật khẩu không đổi. Gửi lại cùng challenge phải thất bại. Lặp với user bị khóa/chưa xác thực, `sub` gắn user khác, email thiếu, credential sai, nonce sai, origin không cho phép; xác nhận không có JWT hoặc thay đổi DB. Test riêng `intent: register` với `sub` đã dùng trả 409 và thông báo theo hợp đồng.
- [ ] **Chạy kiểm thử để thấy lỗi.** `pnpm --filter @ocop/api test:db -- auth.db-spec.ts`; kỳ vọng endpoint Google chưa tồn tại hoặc kiểm thử schema chưa compile.
- [ ] **Cài thư viện và migration.** `pnpm --filter @ocop/api add google-auth-library`; thêm `googleSub` nullable unique và `password` nullable vào schema/migration `0016_google_identity`, không sửa migration đã áp dụng hoặc hash hiện có. Thêm `GOOGLE_CLIENT_ID` backend và `VITE_GOOGLE_CLIENT_ID` web vào `.env.example`, cùng giá trị client ID công khai; cấu hình thiếu phải ẩn nút và endpoint trả lỗi cấu hình rõ ràng, không ngăn đăng nhập email/mật khẩu.
- [ ] **Xác minh credential.** Trong service dùng `OAuth2Client.verifyIdToken({ idToken: credential, audience: googleClientId })`; từ payload bắt buộc `sub`, `email`, `email_verified === true`, `nonce` trùng challenge. Thư viện phải kiểm tra chữ ký/issuer/audience/hạn; chuẩn hóa email như `EmailDto`. `authoritative` chỉ true khi email kết thúc `@gmail.com`, hoặc `email_verified === true` và `hd` không rỗng. Không tin `email_verified` riêng cho email bên thứ ba. Không in payload hoặc token.
- [ ] **Thực hiện đăng nhập.** Challenge tạo nonce và token ngẫu nhiên, chỉ lưu hash, sống 5 phút, tiêu thụ một lần. Tìm `googleSub` trước; nếu đã gắn, kiểm tra `verified/isActive`, cấp JWT từ `issueToken` hiện tại. Nếu chưa gắn, tìm email: user đã xác thực/active và Google authoritative thì cập nhật `googleSub` có điều kiện cùng unique constraint rồi cấp JWT; nếu Google không authoritative thì tạo phiên `GOOGLE_LINK`, gửi OTP và trả `link_otp` không có JWT; nếu không có user, trả `profile`. Với user nullable password, luôn so sánh dummy bcrypt khi đăng nhập bằng mật khẩu nhưng hash null; `changePassword` trả lỗi khi hash null; reset OTP vẫn cập nhật hash và tăng `tokenVersion`.
- [ ] **Chạy kiểm thử.** `pnpm --filter @ocop/api exec prisma generate`; `pnpm --filter @ocop/api test:db -- auth.db-spec.ts`; `pnpm --filter @ocop/api test -- --runInBand auth.service.spec.ts`; `pnpm --filter @ocop/api typecheck`. Kỳ vọng PASS; kiểm tra thêm Google-only reset OTP và đăng nhập bằng mật khẩu mới.
- [ ] **Commit.** Stage đúng các tệp nêu trong task và `git commit -m "feat(auth): verify Google identity for existing accounts"`.

### Task 3: Đăng ký Google và OTP liên kết

**Files:** Modify `apps/be/src/services/auth.service.ts`, `apps/be/src/services/mail.service.ts`, `apps/be/src/services/otp.service.ts`, `apps/be/src/repositories/auth.repository.ts`, `apps/be/src/controllers/auth.controller.ts`, `apps/be/src/dtos/auth.dto.ts`, `apps/be/test/auth.db-spec.ts`.

**Interfaces:** Các API `google/register`, `google/link/verify`, `google/link/resend` theo bảng; `MailService.sendOtp(email: string, code: string, purpose: 'REGISTER' | 'RESET_PASSWORD' | 'GOOGLE_LINK'): Promise<void>`. Google profile token chỉ cho phép nộp `fullName/phone`, không cho trình duyệt thay email hoặc `sub`.

- [ ] **Viết kiểm thử thất bại.** Với mock Google identity chưa có user, POST challenge và Google `intent: register`, sau đó gửi profile; assert chưa có user, mock mail nhận OTP. OTP đúng tạo một `REGISTRANT` với `googleSub`, `password: null`, `verified: true` và tên đã xác nhận. Kiểm tra tên rỗng/quá dài, OTP sai/hết hạn/replay, đăng ký đồng thời cùng email/sub, SMTP lỗi. Với email bên thứ ba đã có user, assert Google `login` trả `link_otp` không JWT; OTP sai không liên kết, OTP đúng trả JWT user cũ; login Google sau đó không gửi OTP mới.
- [ ] **Chạy kiểm thử.** `pnpm --filter @ocop/api test:db -- auth.db-spec.ts`; kỳ vọng lỗi vì chưa có endpoint/profile/link.
- [ ] **Triển khai.** Lưu `sub/email` từ credential đã xác minh vào `GOOGLE_PROFILE`, token riêng hết hạn 15 phút. Khi nhận tên hợp lệ, chuyển thành `GOOGLE_REGISTER`, gửi OTP bằng `REGISTER`, rồi để `verify-otp` lock phiên và tạo user + `googleSub` trong cùng transaction. Với `GOOGLE_LINK`, lưu `userId`, `sub`, email và OTP; tại verify lock phiên và user, kiểm tra email, `verified`, `isActive`, `googleSub` và unique lần nữa, sau đó liên kết và consume OTP cùng transaction, cuối cùng mới cấp JWT. Với user bị thay đổi hoặc OTP lỗi, trả lỗi không cấp JWT. Chặn đồng thời theo unique DB; không ghi đè `sub` của liên kết khác.
- [ ] **Chạy kiểm thử.** `pnpm --filter @ocop/api test:db -- auth.db-spec.ts`; `pnpm --filter @ocop/api typecheck`. Kỳ vọng PASS, gồm ca cùng email/sub verify song song và resend bị giới hạn.
- [ ] **Commit.** Stage đúng tệp task và `git commit -m "feat(auth): register and link Google accounts with OTP"`.

### Task 4: Giao diện đăng ký, đăng nhập và OTP

**Files:** Modify `apps/web/src/api/auth.ts`, `apps/web/src/constants/api.ts`, `apps/web/src/types/auth.ts`, `apps/web/src/constants/auth.ts`, `apps/web/src/pages/auth/LoginPage.tsx`, `RegisterPage.tsx`, `VerifyOtpPage.tsx`, `pending-email.ts`, `apps/web/src/routes/_auth.verify-otp.tsx`, `apps/web/src/vite-env.d.ts`, `apps/web/test/api-integration.check.mjs`; create `apps/web/src/components/google-sign-in.tsx` nếu cần chia phần GIS.

**Interfaces:** `authApi.googleChallenge()`, `authApi.google({ challengeToken, credential, intent })`, `authApi.googleRegister({ registrationToken, fullName, phone? })`, `authApi.googleLinkVerify({ registrationToken, code })`, `authApi.googleLinkResend({ registrationToken })`; union `GoogleResult` theo bảng. `pending-email.ts` lưu `{ registrationToken, email, expiresAt, otpExpiresAt, resendAvailableAt, mode: 'register' | 'google-link' }` trong `sessionStorage`; chỉ lưu sau API thành công.

- [ ] **Viết kiểm thử hợp đồng thất bại.** Bổ sung vào `apps/web/test/api-integration.check.mjs` sau setup Axios mock: gọi `authApi.googleChallenge()` và `authApi.googleLinkVerify({ registrationToken: 'test', code: '123456' })`; assert URL, POST, JSON body, không có Authorization và không redirect sai khi HTTP 401. Kiểm tra sessionStorage không chứa password/Google credential và xóa sau thành công.

```js
reply(200, { data: { challengeToken: 'challenge', nonce: 'nonce' } }, (config) => {
  assert.equal(config.url, '/auth/google/challenge');
  assert.equal(config.method, 'post');
});
assert.equal((await authApi.googleChallenge()).data.nonce, 'nonce');
```

- [ ] **Chạy kiểm thử.** `node apps/web/test/api-integration.check.mjs`; kỳ vọng lỗi thiếu method/hợp đồng.
- [ ] **Thực hiện giao diện.** Dùng nút Google do GIS render và tải `https://accounts.google.com/gsi/client` một lần; lấy challenge trước `google.accounts.id.initialize({ client_id, nonce, callback })`, callback POST credential cùng challenge và intent. Theo `kind`, cấp session qua `setSession`/`homeFor`, hiển thị biểu mẫu xác nhận tên với email chỉ đọc, hoặc chuyển sang OTP liên kết. Trang đăng ký email gửi thông tin rồi chuyển OTP chỉ sau response thành công. Guard `/verify-otp` gọi `registration-status`, từ chối token thiếu/hỏng/hết hạn và hiển thị lỗi mạng riêng; gửi/verify đúng API theo `mode`. Hiển thị trạng thái tải, lỗi Google bị hủy/mạng, 409 bằng thông báo đã dùng, nhãn và điều hướng bàn phím. Giữ `ForgotPasswordPage` dùng email + OTP + mật khẩu mới; nếu người dùng chỉ Google dùng chức năng này thì sau OTP có thể đặt mật khẩu ứng dụng.
- [ ] **Kiểm tra trình duyệt.** `pnpm --filter @ocop/web typecheck`; `node apps/web/test/api-integration.check.mjs`; `node apps/web/test/router.check.mjs`; `pnpm --filter @ocop/web build`. Chạy web local, xác nhận Google popup/đăng nhập, đăng ký trùng, OTP và resend bằng test account; kiểm tra CSP/COOP của nơi phục vụ web cho phép GIS theo tài liệu Google mà không nới rộng CSP toàn bộ.
- [ ] **Commit.** Stage theo từng hunk để không đưa thay đổi sẵn có của người dùng vào commit: `git add -p apps/web/src/pages/auth/LoginPage.tsx apps/web/src/pages/auth/RegisterPage.tsx` và stage các tệp khác thuộc task; kiểm tra `git diff --cached`; `git commit -m "feat(web): add Google sign-in and verified registration"`.

### Task 5: Kiểm thử hồi quy và hướng dẫn vận hành

**Files:** Modify `apps/be/.env.example`, `apps/web/.env.example`, `README.md`, `apps/be/README.md`, `apps/be/test/auth.db-spec.ts`, `apps/be/test/backend.db-spec.ts`, `apps/web/test/api-integration.check.mjs`, các kiểm thử OpenAPI bị ảnh hưởng.

**Interfaces:** Không thay đổi API ngoài bảng. Biến môi trường `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`; client ID frontend và backend phải trùng.

- [ ] **Viết kiểm thử hồi quy trước.** Mở rộng hành trình HTTP: đăng ký email → OTP → login → `/auth/me`; Google mới → profile → OTP → login → `/auth/me`; user cũ email bên thứ ba → Google → OTP liên kết → cùng user; reset mật khẩu → token cũ bị từ chối. Kiểm tra nội dung phản hồi không chứa password/hash/OTP/credential, và đăng ký không thành công không ghi user. Cập nhật kiểm thử OpenAPI để kiểm tra DTO đăng ký mới nhưng reset vẫn có email/code/newPassword.
- [ ] **Chạy kiểm thử.** `pnpm --filter @ocop/api test:db`; `pnpm --filter @ocop/api test -- --runInBand`; `pnpm typecheck`; `pnpm build`; `node apps/web/test/api-integration.check.mjs`; `node apps/web/test/router.check.mjs`. Sửa mọi lỗi do thay đổi này; không kết luận hoàn tất nếu DB hoặc Google/SMTP thật chưa sẵn sàng.
- [ ] **Ghi hướng dẫn triển khai.** Trong README ghi: tạo Google OAuth Web client, cấu hình authorized JavaScript origins chính xác cho local/production, điền cùng client ID vào backend/frontend, HTTPS ở production; cấu hình SMTP và kiểm tra cổng 587/465 theo nhà cung cấp, không ghi mật khẩu thực; kiểm kê người dùng `verified=false` và quan hệ trước migration; sao lưu và thử migration trên bản sao; deploy API/web đồng bộ vì verify/resend đổi hợp đồng; theo dõi lỗi gửi thư, giới hạn OTP và hướng dẫn user cũ xác thực qua endpoint chuyển tiếp. Không chạy migration production trong task này.
- [ ] **Kiểm tra thật bằng tài khoản được phép.** Sau khi người vận hành cấu hình, dùng hộp thư test nhận OTP, thử đăng ký email và Google, đăng nhập lại, tài khoản bị khóa, quên mật khẩu và email trùng; xác nhận thư tới hộp nhận. Nếu thiếu credential hoặc không có máy chủ, báo rõ chưa kiểm tra thật; không dùng SMTP placeholder làm bằng chứng.
- [ ] **Commit tài liệu và test.** Stage đúng tệp task; `git diff --cached --check`; `git commit -m "test(auth): verify Google and OTP account flows"`.

## Nguồn đã tham khảo

- [googleapis/google-auth-library-nodejs](https://github.com/googleapis/google-auth-library-nodejs): xác minh ID token bằng thư viện chính thức thay vì tự xử lý chữ ký.
- [nestjs/docs.nestjs.com](https://github.com/nestjs/docs.nestjs.com/blob/master/content/security/authentication.md): tham khảo ranh giới xác thực và liên kết tài khoản; giữ JWT/guards hiện có thay vì thay toàn bộ auth.
- [Google: verify ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token): `sub`, audience, issuer, expiry và quyền xác nhận email.
- [Google Identity Services JavaScript](https://developers.google.com/identity/gsi/web/reference/js-reference): nonce, callback và nút Google.
- [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): OTP một lần, hết hạn và không gửi mật khẩu qua email.
