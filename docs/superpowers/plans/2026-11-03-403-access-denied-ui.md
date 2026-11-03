# 403 Access Denied UI Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` when executing this plan. Steps use checkboxes for tracking.

**Goal:** Giúp người gặp trang 403 hiểu lý do bị chặn và quay về đúng khu vực một cách dễ dàng trên máy tính và điện thoại.

**Architecture:** Chỉnh riêng `ForbiddenPage`, dùng lại logo, nút, màu và phông chữ sẵn có. Giữ `useSession`, `homeFor` và đích `/` khi không có phiên; không sửa guard hay trang 404.

**Tech Stack:** React, TypeScript, TanStack Router, Tailwind CSS v4, Lucide và Node test runner hiện có.

**Spec:** Ảnh trang 403 người dùng cung cấp; `PRODUCT.md`; `docs/open-design/ocop-ui-review-prompts.md`, mục 9; mã và token hiện tại. `design.md` chỉ áp dụng cho admin, dùng làm tham khảo nhận diện chứ không áp quy định admin sang mọi vai trò.

## Primary goal

Người dùng biết trang bị từ chối vì thiếu quyền, biết có thể liên hệ quản trị viên, và có một nút đưa về khu vực phù hợp với phiên hiện tại.

## Global Constraints

- Giữ tiếng Việt, nhận diện OCOP và các token đã có; không thêm thư viện, ảnh, gradient hay hoạt ảnh mới.
- Giữ `<main id='content'>`, một `h1`, nút liên kết thật, focus bàn phím và vùng chạm tối thiểu 44px.
- Giữ `homeFor(session.user.role, session.user.staffPermissions)` cho phiên có người dùng; không có phiên thì về `/`.
- Không hiển thị token, vai trò, email, thông tin tài nguyên bị từ chối hoặc hứa hẹn có kênh hỗ trợ chưa xác nhận.
- Không thay lớp CSS dùng chung `.route-main`, `.route-panel`, `.eyebrow`, trang 404, route guard, API hay các thay đổi đang có của người dùng.
- Kiểm tra không tràn ngang tại 320, 375, 414, 768, 1024 và 1440px; kiểm tra Tab, focus và nội dung thực tế trong trình duyệt.

## Phase 0: Documentation Discovery

**How this serves the primary goal:** Xác định đúng nguồn giao diện, đích quay về và quy tắc thị giác trước khi sửa.

- `apps/web/src/routes/403.tsx:1-6` nối route `/403` tới `apps/web/src/pages/errors/ForbiddenPage.tsx`; trang đứng trực tiếp dưới root.
- `apps/web/src/pages/errors/ForbiddenPage.tsx` dùng `useSession(): Session | null` và `homeFor(role, staffPermissions)`. `apps/web/src/lib/auth.ts:6-15` quy định thứ tự MANAGE, SCORE, VIEW và registrant; dùng nguyên hàm thay vì tự chọn URL hay `history.back()`.
- `apps/web/src/components/app-logo.tsx` cung cấp nhận diện OCOP; `apps/web/src/components/ui/button.tsx` hỗ trợ `<Button asChild>` và vòng focus. `apps/web/src/styles.css:41-76` định nghĩa màu và font.
- `apps/web/src/pages/errors/NotFoundPage.tsx` và `apps/web/src/pages/auth/AuthFrame.tsx` cùng dùng các lớp `route-*`; không sửa các lớp chung để tránh làm đổi trang khác.
- Nguồn mở: [shadcn-admin — forbidden.tsx](https://github.com/satnaing/shadcn-admin/blob/main/src/features/errors/forbidden.tsx) dùng trạng thái rõ, mô tả ngắn và nút phục hồi; [Ant Design Pro — trang 403](https://github.com/ant-design/ant-design-pro/blob/master/src/pages/exception/403/index.tsx) dùng kết quả lỗi và hành động về trang chủ. Cả hai repository có giấy phép MIT. Chọn ý tưởng thông báo/ngõ ra, không sao chép code hoặc thêm dependency; giữ đích theo `homeFor` của dự án.

### Đánh giá giao diện trước sửa

- Ảnh gốc và route đang chạy cho thấy panel nằm cao, nhiều khoảng trống phía dưới; tiêu đề lớn nhưng lý do thiếu quyền chỉ hiện ở nhãn nhỏ. Hướng dẫn hiện tại chưa nói cách xử lý khi cần quyền.
- Nút hiện có tên rõ, cao 44px, có focus và đưa phiên không đăng nhập về `/`. Kiểm tra bàn phím và viewport 320px không thấy bị cắt. Chưa kiểm tra screen reader hay các vai trò có phiên thật.
- Đánh giá độc lập A: 20/32 cho tám heuristic áp dụng; ngăn lỗi và tăng tốc quy trình không đủ phạm vi để chấm. Đây là nhận định thiết kế, không phải chứng nhận WCAG. Detector B quét TSX trả `[]`, không chứng minh CSS hoặc tương tác đều đạt.
- Thứ tự thiết kế: nhận diện và mã 403 trong hàng đầu; tiêu đề nói rõ thiếu quyền; lời nhắc liên hệ quản trị viên; một nút quay về. Dùng một panel duy nhất, không tạo các card lồng nhau.

## Phase 1: Refine the 403 page

**How this serves the primary goal:** Đưa lý do và cách tiếp tục lên vị trí dễ đọc mà vẫn giữ đúng điều hướng theo vai trò.

### Task 1: Update `ForbiddenPage`

**Files:**
- Modify: `apps/web/src/pages/errors/ForbiddenPage.tsx`

**Interfaces:**
- Consumes: `useSession()`, `homeFor(role, staffPermissions)`, `Button` với `asChild`, `Link`, `AppLogo`, `ArrowLeft`.
- Produces: `ForbiddenPage()` với `main#content`, một heading được gắn nhãn cho section và một link về `home`.

- [x] **Step 1: Thay nội dung file bằng implementation sau**

```tsx
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { Button } from '@/components/ui/button';
import { homeFor, useSession } from '../../lib/auth';

export function ForbiddenPage() {
  const session = useSession();
  const home = session ? homeFor(session.user.role, session.user.staffPermissions) : '/';

  return (
    <main id='content' className='bg-bg flex min-h-screen min-h-svh items-center justify-center px-4 py-10 sm:px-6'>
      <section aria-labelledby='forbidden-title' className='border-border bg-surface w-full max-w-xl rounded-xl border'>
        <header className='border-border flex items-center justify-between gap-4 border-b px-6 py-4 sm:px-10'>
          <AppLogo />
          <span className='text-muted-foreground shrink-0 text-sm font-medium'>
            <span className='sr-only'>Mã lỗi </span>403
          </span>
        </header>
        <div className='flex flex-col items-start gap-6 px-6 py-8 sm:px-10 sm:py-10'>
          <div className='flex flex-col gap-4'>
            <h1 id='forbidden-title' className='mb-0! text-3xl! leading-tight! sm:text-4xl!'>
              Bạn không có quyền truy cập trang này
            </h1>
            <p className='text-muted-foreground text-base leading-relaxed'>
              Nếu bạn cần truy cập trang này, hãy liên hệ quản trị viên.
            </p>
          </div>
          <Button asChild className='w-full sm:w-auto'>
            <Link to={home}>
              <ArrowLeft aria-hidden='true' className='size-4' />
              {session ? 'Về khu vực của tôi' : 'Về trang chủ'}
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
```

The `!` utility suffix is required here because the existing unlayered global `h1` rule otherwise overrides Tailwind typography utilities. The arrow is decorative; the link text names the destination.

- [x] **Step 2: Review diff**

Run `git diff -- apps/web/src/pages/errors/ForbiddenPage.tsx`. Expected: only the 403 component changes; the role-based `homeFor` call and `/` fallback remain intact.

**Anti-pattern guards:** Không dùng back history làm CTA; không đưa `accessToken` hay thông tin người dùng lên trang; không thêm card/CTA giả; không sửa CSS toàn cục.

## Phase 2: Verification

**How this serves the primary goal:** Chứng minh trang dễ đọc, có lối thoát bằng bàn phím và không làm đổi các đích truy cập đã tồn tại.

### Task 2: Verify behavior and rendering

**Files:**
- Verify: `apps/web/src/pages/errors/ForbiddenPage.tsx`
- Existing checks: `apps/web/test/session-contract.test.ts`, `apps/web/test/router.check.mjs`

**Interfaces:**
- Consumes: component Task 1, existing `homeFor` role rules and route guards.
- Produces: passing checks and an honest record of which browser/session states were observed.

- [x] **Step 1: Kiểm tra kiểu và route**

```powershell
pnpm --filter @ocop/web typecheck
node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test --test-isolation=none apps/web/test/session-contract.test.ts
pnpm --filter @ocop/web exec node test/router.check.mjs
pnpm --filter @ocop/web build
```

Expected: typecheck, existing session tests, route check and production build pass. Nếu Vite bị `spawn EPERM`, ghi rõ và dùng cách chạy được cấp quyền thay vì báo pass giả.

- [x] **Step 2: Kiểm tra trong trình duyệt**

Mở `/403`; tại các viewport 320, 375, 414, 768, 1024 và 1440px xác nhận heading, mô tả và nút không bị cắt hoặc tràn. Dùng Tab để thấy focus; kích hoạt link không có phiên để xác nhận về `/`. Kiểm tra URL, một `h1`, `main#content`, tên link, biểu tượng ẩn khỏi screen reader và 404 không đổi. Đối chiếu các vai trò qua test `homeFor`; chỉ nhận xét các phiên thực sự đã quan sát.

- [x] **Step 3: Kiểm tra diff và dọn artefact tạm**

Run `git diff --check -- apps/web/src/pages/errors/ForbiddenPage.tsx` and inspect the scoped diff. Expected: no whitespace errors, no dependency or shared CSS changes, no temporary server left running. Report browser/theme/screen-reader states not actually tested.

**Anti-pattern guards:** Không coi detector sạch là chứng nhận accessibility; không kiểm thử hành vi của vai trò bằng cách giả nhận đã quan sát phiên thật; không ghi đè thay đổi đang có.

### Kết quả thực thi ngày 03/11/2026

- Web typecheck, Prettier của component, 8/8 session tests, router check 35 URL và production build đều pass. Vite cần chạy ngoài giới hạn tiến trình mặc định trên Windows; lần chạy mặc định gặp `spawn EPERM`.
- Trong trình duyệt, sáu viewport 320–1440px không tràn ngang; tên OCOP không bị cắt và nút cao 44px. Tab cho thấy focus; Enter tại phiên không đăng nhập về `/`. Phiên registrant hiện có hiển thị link `/my/products`. Trang 404 vẫn có nội dung cũ.
- Màu tính từ token đang render: chữ phụ trên nền trắng khoảng 6,75:1, chữ trắng trên nút xanh khoảng 7,1:1. Đây là kiểm tra riêng các cặp màu này, không phải chứng nhận WCAG toàn trang.
- Chưa kiểm tra screen reader thực tế, zoom trình duyệt hoặc phiên ADMIN/JUDGE thật; các quy tắc đích vai trò được kiểm tra bởi session tests hiện có.
