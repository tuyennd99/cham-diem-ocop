Bạn là AI agent phát triển dự án **Hệ thống đăng ký, đánh giá và phân hạng sản phẩm OCOP**.

## 1. Mục đích dự án

Hệ thống hỗ trợ đăng ký hồ sơ sản phẩm OCOP, duyệt hồ sơ, phân công giám khảo, chấm điểm, tổng hợp và công bố kết quả, thống kê, in biểu mẫu và tra cứu sản phẩm công khai.

Bốn vai trò nghiệp vụ (theo `GLOSSARY.md`):

- **Người dùng**: tạo, nộp, sửa hồ sơ của mình và xem kết quả đã công bố.
- **Chủ trì**: xem, duyệt hoặc trả hồ sơ đã nộp; theo dõi, bổ sung giám khảo; công bố kết quả.
- **Giám khảo**: chấm hồ sơ được phân công trên phiếu của chính mình.
- **Quản trị**: có toàn bộ quyền vận hành, quản lý tài khoản, đơn vị, danh mục và bộ tiêu chí.

Ngoài ra, khách chưa đăng nhập xem trang sản phẩm công khai.

Giao diện và nội dung nghiệp vụ dùng tiếng Việt. Dùng thuật ngữ trong `GLOSSARY.md`. Biểu mẫu, bộ tiêu chí và danh mục cơ quan chủ trì quản lý gắn với văn bản áp dụng (Quyết định 26/2026/QĐ-TTg); khi thay đổi nghiệp vụ, đối chiếu tài liệu dự án và văn bản, không tự suy diễn quy định pháp luật.

## 2. Cấu trúc dự án

TypeScript monorepo dùng pnpm workspace, Node.js 24:

- `apps/be` (`@ocop/api`): API NestJS, Prisma, PostgreSQL. Tổ chức theo controller, service, repository, guard, DTO và utility.
- `apps/web` (`@ocop/web`): React, Vite, TypeScript, có SSR cho trang công khai (`src/server.ts`, `src/entry-server.tsx`).
- `packages/shared` (`@ocop/shared`): kiểu dữ liệu, hằng số vai trò/quyền và hợp đồng dùng chung.
- `apps/be/prisma`: schema, migrations, dữ liệu tiêu chí và seed.
- `docs`: tài liệu nghiệp vụ, thiết kế, kế hoạch và kiểm chứng. Quy trình hiện hành: `docs/quy-trinh-danh-gia-ho-so.md`.
- `GLOSSARY.md`, `PROGRESS.md` (nhật ký kiểm chứng), `README-SEED-ACCOUNTS.md` ở thư mục gốc.

Frontend dùng TanStack Router, Query, Form, Table, Axios, Zustand và các thành phần giao diện hiện có.

Trước khi thay đổi, tìm thành phần hoặc quy ước tương ứng trong dự án và ưu tiên tái sử dụng.

## 3. Các chức năng chính

### Tài khoản và xác thực

Đăng ký, đăng nhập, xác thực email bằng OTP, khôi phục mật khẩu, quản lý tài khoản và đăng nhập Google. Tài khoản chỉ được tạo sau khi xác thực OTP; đăng ký Google xác nhận họ tên trước; liên kết Google với email khác có thể cần OTP. Luồng đăng ký dùng `registrationToken`.

Tôn trọng quy tắc xác thực và phân quyền hiện có. Không ghi mật khẩu, OTP, token hoặc thông tin nhạy cảm vào mã nguồn, tài liệu, URL hoặc log.

### Hồ sơ sản phẩm

Người dùng tạo hồ sơ nháp theo Mẫu số 01, tải ảnh hoặc minh chứng, sửa và nộp. Người dùng có thể lưu **đơn vị đăng ký** (`RegistrationUnit`, trang `/my/settings`) để dùng lại. Hồ sơ có mã số (`codeNumber`) và địa bàn (tỉnh, xã/phường) được xác định từ thông tin trên hồ sơ.

Hồ sơ gắn với phân loại sản phẩm và bộ tiêu chí tương ứng. Seed có 6 nhóm, 26 phân loại và 26 bộ tiêu chí tổng 100 điểm; kiểm tra seed và dữ liệu thực tế trước khi đổi danh mục hoặc cách tính điểm.

### Duyệt, phân công, chấm và công bố

Luồng trạng thái `ProductStatus`: `DRAFT → SUBMITTED → (RETURNED → SUBMITTED) → APPROVED → SCORING → COMPLETED`; công bố theo `ProductPublicationState`: `UNPUBLISHED → PUBLISHED`, mở lại để chấm bổ sung chuyển sang `UPDATING`. Chi tiết, code và test đối chiếu nằm trong `docs/quy-trinh-danh-gia-ho-so.md`.

- Chủ trì/Quản trị duyệt hoặc trả hồ sơ kèm lý do; hồ sơ chưa duyệt không được chấm.
- Khi duyệt, hệ thống tự phân công (`ProductJudgeAssignment`) mọi giám khảo đang hoạt động thuộc đơn vị liên kết với các cơ quan chủ trì quản lý (`ManagingAgency`) của phân loại. Thiếu giám khảo vẫn duyệt và cảnh báo; Chủ trì/Quản trị bổ sung ở tab Tiến độ.
- Mỗi giám khảo chấm toàn bộ tiêu chí trên phiếu riêng (`Evaluation`). Không ai được chấm vào phiếu của người khác, kể cả Quản trị.
- Hồ sơ hoàn tất khi có ít nhất một phiếu hợp lệ và đủ phiếu của giám khảo được đánh dấu phải nộp (`mustSubmitToComplete`, thường là giám khảo bổ sung thủ công). Phiếu nộp thêm làm tính lại kết quả.
- Mở lại phiếu/hồ sơ, gỡ hoặc khôi phục giám khảo phải giữ lịch sử (`EvaluationHistoryEvent`, `ProductResultHistory`, `ProductStatusEvent`, `AuditLog`); không xóa cứng phiếu, điểm.
- Người dùng và trang công khai chỉ thấy điểm, mức sao sau khi công bố.

Điểm và mức sao hệ thống tính phục vụ đánh giá; không mô tả chúng là quyết định công nhận OCOP chính thức của cơ quan có thẩm quyền.

### Quản trị

Khu vực `/admin` gồm tổng quan, sản phẩm, phiếu đăng ký, phân công, phiếu chấm, báo cáo, danh mục sản phẩm, người dùng và đơn vị. Quản trị (`MANAGE`) có thể tạo và sửa phiếu đăng ký thay người dùng; Chủ trì thì không. Quyền truy cập phải được kiểm tra tại backend, kể cả với tệp và dữ liệu tải xuống.

## 4. Trạng thái hiện tại và phần còn dở

Không nhầm thiết kế dự kiến với chức năng đã triển khai. Kiểm tra lại mã vì mô tả dưới đây có thể đã cũ.

**Vai trò trong mã** (enum `Role`, `StaffPermission`):

| Nghiệp vụ  | Role         | Quyền nhân viên       |
| ---------- | ------------ | --------------------- |
| Người dùng | `REGISTRANT` | —                     |
| Chủ trì    | `VIEWER`     | `VIEW`                |
| Giám khảo  | `JUDGE`      | `SCORE`               |
| Quản trị   | `ADMIN`      | `MANAGE` (kéo `VIEW`) |

`User` có `role` (vai trò chính), `roles[]` (kiêm nhiệm) và `staffPermissions[]`. Luôn dùng `effectiveStaffPermissions`, `effectiveUserRoles`, `resolveRolesAndPermissions` trong `apps/be/src/utils/staff-permissions.ts`; không tự suy quyền từ `role`. Một tài khoản không được đồng thời là `REGISTRANT` và `JUDGE`.

**Đặc tả** [#6](https://github.com/tuyennd99/cham-diem-ocop/issues/6) (bốn vai trò, duyệt rồi tự phân công theo cơ quan, bỏ sự kiện và nhóm giám khảo) đã được triển khai phần lớn (migration `0019_roles_approval_agencies_workflow`, test `apps/be/test/workflow-issues-6-to-13.db-spec.ts`). Phần còn lại và dữ liệu cũ:

- **Sự kiện chưa bỏ hết**: `Locality` vẫn có `eventName`, khoảng thời gian hiệu lực/đăng ký và trang quản trị "Sự kiện" (`/admin/localities`). Hồ sơ mới không phải chọn sự kiện. Không mở rộng tính năng sự kiện; chỉ gỡ khi được giao.
- **Phân công cũ theo phân loại** (`JudgeAssignment`, trang `/admin/assignments`) còn để phục vụ hồ sơ cũ chưa có phân công riêng. Không dùng nó cho hồ sơ mới.
- Bảng `LegacyCategoryMetadata`, `LegacyProductGroupMetadata` là dữ liệu chuyển đổi; không xây tính năng mới trên chúng.

Ticket quản lý tại GitHub `tuyennd99/cham-diem-ocop` (xem `docs/agents/issue-tracker.md`, nhãn trong `docs/agents/triage-labels.md`). Đọc issue và bình luận mới nhất trước khi làm; phụ thuộc có thể chỉ được ghi bằng văn bản trong ticket. Kiểm tra `PROGRESS.md` để biết những gì đã và chưa được kiểm chứng.

## 5. Quy ước frontend

- Route theo cấu trúc tệp TanStack Router trong `apps/web/src/routes`; chặn quyền bằng `requirePermission`/`requireRole` trong `src/lib/route-guards`.
- Không sửa trực tiếp `routeTree.gen.ts` (tệp sinh tự động).
- Gọi API qua hàm nghiệp vụ trong `apps/web/src/api` và hook trong `apps/web/src/queries`; endpoint và hằng số trong `apps/web/src/constants`; vai trò và quyền lấy từ `@ocop/shared`. Không gọi HTTP trực tiếp từ trang. Xem `apps/web/README.md`.
- Form dùng các thành phần form dùng chung (`useAppForm` và controller sẵn có); menu trong `src/config/menu-nav.tsx`.
- Trang công khai được render SSR: không dùng API chỉ có ở trình duyệt khi render, và kiểm tra lại bằng các check SSR.
- Giữ giao diện tiếng Việt, rõ trạng thái tải, lỗi và thành công; bảo đảm thao tác bàn phím và khả năng truy cập cơ bản.

## 6. Dữ liệu và bảo mật

PostgreSQL lưu dữ liệu nghiệp vụ; ảnh và minh chứng lưu trong `STORAGE_PATH`. Trang công khai chỉ đọc ảnh của hồ sơ được phép công khai; minh chứng và tệp khác phải qua luồng có kiểm tra quyền. Bộ nhớ đệm tệp riêng tư ở frontend tách theo phiên.

Thao tác thay đổi trạng thái, phân công, phiếu chấm phải chạy trong transaction, giữ thứ tự khóa hiện có và ghi audit/lịch sử.

Không tự xóa hoặc đặt lại cơ sở dữ liệu, kho tệp, tài khoản hay dữ liệu ngoài phạm vi được yêu cầu. Trước khi thay đổi dữ liệu, xác định đúng môi trường và tác động.

- `pnpm dev:cloud` mở tunnel `127.0.0.1:15432` tới cơ sở dữ liệu cloud. Khi `DATABASE_URL` trỏ tới cổng này, mọi lệnh (seed, migrate, test DB) đều tác động lên cloud dù host là `127.0.0.1`.
- Hồ sơ thử nghiệm cũ đã bị xóa khỏi cơ sở dữ liệu phát triển theo [#14](https://github.com/tuyennd99/cham-diem-ocop/issues/14).
- `README.md` nói seed không tạo tài khoản hay hồ sơ mẫu, nhưng `apps/be/prisma/seed/seed.ts` hiện tạo tài khoản test và dữ liệu mẫu (`sample-data.ts`, có ghi đè phiếu/điểm mẫu) trừ khi `SEED_TEST_ACCOUNTS=false`. Không tự chạy seed trên dữ liệu đang dùng.
- Không chép mật khẩu tài khoản test vào báo cáo; xem `README-SEED-ACCOUNTS.md` khi cần.

## 7. Chạy và kiểm thử

Đọc `README.md`, `apps/be/README.md`, `apps/web/README.md` để lấy hướng dẫn hiện hành. Lệnh thường dùng từ thư mục gốc:

- `pnpm dev` (cơ sở dữ liệu cục bộ) hoặc `pnpm dev:cloud`: chạy frontend `:5173` và API `:3030/api`.
- `pnpm typecheck`, `pnpm build` (web gồm cả bản SSR).
- Backend: `pnpm --filter @ocop/api lint:check`, `pnpm --filter @ocop/api test -- --runInBand`.
- Backend với PostgreSQL: `pnpm --filter @ocop/api test:db` (hoặc `-- --runTestsByPath test/<tệp>.db-spec.ts` cho phạm vi hẹp). Test tự tạo và xóa schema `ocop_test_*`, chỉ nhận host cục bộ; toàn bộ bộ test mất khoảng 30 phút.
- Frontend: `pnpm --filter @ocop/web format:check`; unit test `node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test apps/web/test/*.test.ts scripts/dev-cloud.test.mjs`; check script `node apps/web/test/<tên>.check.mjs` (SSR, router, API boundary, built server…).

Chọn kiểm thử phù hợp phạm vi thay đổi. Với phân quyền, hồ sơ, phân công, chấm điểm và công bố, ưu tiên kiểm thử hành vi qua API với cơ sở dữ liệu; bổ sung kiểm tra giao diện khi cần. Không coi mock SMTP, Google hoặc giao diện giả lập là bằng chứng dịch vụ thật hoạt động.

Không chạy seed, migration hoặc test DB khi chưa xác định đúng `DATABASE_URL` và tác động. Không đưa bí mật vào lệnh hoặc báo cáo. Khi hoàn tất một phần việc đáng kể, ghi kết quả kiểm chứng và phần chưa kiểm chứng vào `PROGRESS.md` theo định dạng sẵn có.

## 8. Cách làm việc

1. Đọc `AGENTS.md`, `GLOSSARY.md`, tài liệu liên quan, issue và mã đang dùng trước khi quyết định cách sửa.
2. Tôn trọng thay đổi có sẵn của người dùng; không hoàn tác hoặc ghi đè công việc ngoài phạm vi.
3. Sửa đúng nguyên nhân và hoàn chỉnh các phần liên quan: API, giao diện, hợp đồng trong `packages/shared`, migration, dữ liệu và kiểm thử khi cần.
4. Với chức năng chưa quen thuộc, tham khảo dự án mã nguồn mở trên GitHub theo `AGENTS.md`; nêu ngắn gọn nguồn đã xem hoặc nói rõ nếu không tìm được.
5. Ưu tiên giải pháp đơn giản, tái sử dụng thành phần và phụ thuộc đã có; không thêm tính năng hoặc trừu tượng hóa chưa cần thiết.
6. Không sửa kỳ vọng của test có sẵn để cho qua khi chưa được người dùng đồng ý.
7. Không khẳng định thay đổi đã hoạt động khi chưa kiểm chứng. Khi bàn giao, nêu kết quả, kiểm thử đã chạy và phần còn hạn chế.

Nếu tài liệu, issue và mã mâu thuẫn, chỉ ra sự khác biệt. Dùng yêu cầu mới nhất của người dùng và đặc tả đã xác nhận để xác định hành vi mong muốn; dùng mã để xác định hành vi hiện tại.
