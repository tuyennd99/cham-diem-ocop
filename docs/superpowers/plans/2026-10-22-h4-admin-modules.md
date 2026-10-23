# H4 — Admin Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Hoàn thiện các phân hệ Người dùng, Nhóm sản phẩm, Sản phẩm và Phiếu đăng ký trên nền H3, nghiệm thu PROD-01, REG-01..02 và phần binary/upload của FILE-01.

**Architecture:** Giữ một Product cho mỗi lần đăng ký; hai menu Sản phẩm/Phiếu đăng ký dùng chung API, ID, bộ lọc và editor. Mở rộng các transaction/guard/audit hiện có, chia công việc thành ba phần có thể kiểm tra và review riêng.

**Tech Stack:** React 19, Vite, TanStack Router/Query, Zustand, Axios; NestJS, Prisma 7, PostgreSQL; Jest và node:test/tsx đang có; pnpm.

**Spec:** docs/superpowers/specs/2026-10-17-admin-modules-spec.md, mục 3–6, 8.1–8.2, 11–14. Phạm vi H4 lấy từ backlog trong Hãy khảo sát dự án trong Working Directory hiện tạ.md, dòng 300–305.

## Global Constraints

- “MANAGE không tự cấp SCORE.”
- “Tài khoản nội bộ active phải có ít nhất một quyền.”
- “Thay quyền, khóa tài khoản hoặc reset mật khẩu làm tăng tokenVersion; phiên cũ bị thu hồi.”
- “Không xóa cứng tài khoản đã có hồ sơ/phiếu/audit.”
- “Đơn vị không đồng nghĩa với quyền hoặc phân công chấm.”
- “Không chuyển một phân loại đã có hồ sơ nộp sang nhóm/bộ tiêu chí khác.”
- “Không cung cấp sửa tự do điểm, lựa chọn hoặc nội dung 26 bộ tiêu chí trên UI này.”
- “Không tự suy ra xã/phường từ địa chỉ nhập tay.”
- “formData tiếp tục là replace toàn bộ theo contract hiện có.”
- “Ảnh và tệp minh chứng tiếp tục là tùy chọn.”
- Giữ prefix /api, envelope JSON và binary download hiện tại; phân trang mặc định 20, tối đa 100.
- Giữ PNG/JPEG/GIF/WebP/PDF, tối đa 10 MiB/tệp, một field file/request và giới hạn 20 tệp/hồ sơ từ thay đổi hiện tại ở checkout chính.
- Mutation không tự retry; upload chưa rõ kết quả phải đọc lại metadata trước khi người dùng chọn lại.
- FE gọi nghiệp vụ qua src/api và src/queries; tái sử dụng UI components và form library đã được tích hợp khi chốt baseline.
- Controller admin dùng requestMeta(request) đã có; không copy helper riêng từ bản H3 cũ.
- Không thêm dependency, feature module NestJS, cache, queue, dữ liệu danh mục giả hoặc một bảng Registration riêng.
- Migrations mới chỉ tiến tới; không sửa 0011 hay các migration trước. DB test dùng DATABASE_URL local qua harness schema ocop_test_<uuid>; không ghi/xóa public, không đổi .env hay in bí mật.

## Hiện trạng làm căn cứ

- H3 hoàn tất ở nhánh codex/admin-foundation, commit e8c38df, worktree C:/Users/lllll/.codex/worktrees/admin-foundation/chamdiemocop.
- H3 đã có OrganizationUnit, ProductGroup, Locality, quyền kết hợp, sự kiện trạng thái và snapshot phiếu chấm. H3 chưa có registrationSnapshot của Product, API CRUD đầy đủ hoặc locality trong DTO/editor.
- AdminRepository đã có updateStaffAccess với lock/kiểm tra người MANAGE cuối, audit và thu hồi token. Không viết một cơ chế thứ hai cho endpoint mới.
- ProductsRepository đã khóa category/product trong các thao tác nháp/nộp/tệp. ProductsService đã kiểm file, lưu private và dọn file khi lỗi.
- Checkout D:/project/chamdiemocop đang ở main 7238a66, có nhiều thay đổi chưa commit: giao diện/form mới, UI components, upload tối đa 20 tệp, Prisma error mapping, requestMeta và harness chỉ dùng DATABASE_URL.
- Đặc tả giữa main và H3 không có khác biệt nội dung sau khi bỏ khác biệt khoảng trắng. Không coi các dòng lịch sử trong tài liệu khảo sát là lệnh triển khai mới.

## Chốt phạm vi và giao diện giữa các phần

| Thứ tự | Kế hoạch | Kết quả độc lập |
|---|---|---|
| A | [Người dùng và Đơn vị](2026-10-22-h4-users-and-units.md) | MANAGE quản lý tài khoản/đơn vị, tìm chủ thể hợp lệ để nhập hộ; adapter giám khảo dùng chung quy tắc. |
| B | [Nhóm sản phẩm và Địa bàn](2026-10-22-h4-catalogs.md) | Danh mục có audit, ngừng dùng an toàn, API lựa chọn locality; seed không ghi đè metadata quản trị. |
| C | [Sản phẩm và Phiếu đăng ký](2026-10-22-h4-products-and-registrations.md) | Bộ lọc/detail/tệp nội bộ; nhập hộ; locality và snapshot tại nộp; hai menu cùng hồ sơ. |

Triển khai A → B → C. B sử dụng fixture kiểm thử và audit helper của A; C sử dụng tra cứu chủ thể của A và locality/danh mục của B. Mỗi task có test đỏ → sửa → test xanh → review → commit cục bộ.

### Task 0: Chốt baseline tích hợp trước khi triển khai

**Files:** Không chỉnh source trong bước lập kế hoạch. Khi thực thi, các file xung đột chính là admin.controller.ts, products.repository.ts, test/support/db-app.ts, web api/auth.ts, lib/auth.ts, route-guards.ts, session-store.ts, AppLayout.tsx và ProductEditorPage.tsx.

**Consumes:** H3 e8c38df và các thay đổi người dùng đang làm ở main.
**Produces:** Một worktree thực thi có cả H3 và các thay đổi được giữ lại từ checkout chính, dependency trỏ đúng source của worktree.

- [ ] Đọc trạng thái thực tế bằng các lệnh sau; ghi commit baseline vào biên bản H4.

~~~powershell
git status --short --branch
git worktree list
git log -1 --oneline
git diff --stat
~~~

- [ ] Tạo/reuse worktree riêng qua using-git-worktrees. Chốt bản tích hợp chứa H3 và thay đổi hiện tại trước khi làm A; không reset, force checkout, bỏ file chưa commit hoặc tự stash làm biến mất công việc ở main.
- [ ] Giải quyết xung đột theo hành vi: giữ quyền H3 và snapshot phiếu; giữ UI/form/components mới, MAX_ATTACHMENTS_PER_PRODUCT=20, requestMeta chung, error mapping và harness DATABASE_URL từ main.
- [ ] Kiểm tra package @ocop/shared và dependency của web trỏ tới đúng worktree. Nếu thiếu dependency, dùng pnpm install --frozen-lockfile ở worktree; không dùng junction trỏ source cũ để tuyên bố typecheck thành công.
- [ ] Chạy baseline typecheck/build, API unit và các check web hiện có. Lỗi sẵn có phải ghi riêng; chỉ sửa lỗi do tích hợp cần cho H4.
- [ ] Review baseline và commit phần tích hợp được phép, rồi bắt đầu A. Không merge vào main, push hay chạy migration trên public chỉ vì kế hoạch được tạo.

## Quy tắc triển khai đề xuất cho H4

1. VIEW vẫn đọc toàn phạm vi triển khai đối với hồ sơ đã nộp; không đọc bản nháp hoặc danh sách người dùng/đơn vị.
2. Chỉ tạo mới tài khoản nội bộ từ admin. Không đổi REGISTRANT thành nội bộ, không sửa role/verified bằng payload. Email của tài khoản đã tạo chỉ đọc; không phát sinh luồng đổi email/OTP mới.
3. MANAGE được sửa tên/điện thoại, khóa/mở và reset tài khoản đã có; reset REGISTRANT giữ sàn mật khẩu hiện có 8 ký tự, reset nội bộ dùng sàn 12; cả hai tối đa 72 byte UTF-8, không tự đổi verified.
4. Staff mới bắt buộc chọn đơn vị active; bản ghi cũ chưa gán được giữ null khi không thay đơn vị. Không cho bỏ đơn vị đã gán; đơn vị ngừng dùng được giữ nguyên trên tài khoản cũ.
5. Legacy POST /admin/judges cũng phải chọn organizationUnitId active khi tạo mới. Thêm field vào DTO/OpenAPI và đổi UI /admin/judges thành redirect tới /admin/users?permission=SCORE. Các legacy admin writes yêu cầu reason; body cũ thiếu đơn vị khi tạo hoặc thiếu reason nhận 400 có thông báo. Giữ đường dẫn và các field phản hồi cũ; ghi rõ thay đổi validation trong OpenAPI/biên bản để người dùng API cũ biết.
6. Phân loại mới được tạo inactive, chưa có bộ phiếu. Chỉ mở active sau khi quy trình seed đã kiểm chứng nạp bộ của chính phân loại và tổng điểm bằng 100; H4 không có UI/API tự soạn hoặc gắn nhầm bộ phiếu.
7. Mã nhóm/địa bàn/đơn vị và ID phân loại ổn định, không đổi trong PUT. Không có endpoint xóa cứng danh mục. Chỉ dữ liệu test dùng mã TEST-...; dữ liệu vận hành do người có MANAGE nhập từ danh sách đã đối chiếu.
8. Tất cả bản nháp được giữ khi danh mục/địa bàn ngừng dùng. Có thể sửa phần khác và giữ lựa chọn cũ; BE kiểm tra trạng thái/hiệu lực đầy đủ khi nộp.
9. Product.registrationSnapshot version 1 được BE tạo lúc nộp. Bản ghi cũ giữ null; không dựng dữ liệu “tại lúc nộp” từ người/danh mục đã đổi.
10. Chủ hồ sơ không đổi sau khi tạo. MANAGE thao tác bằng principal của mình; registrantId là chủ thể, createdById và actor sự kiện/audit là người thực hiện.
11. Bốn bố cục in A4 và các endpoint print-data thuộc H5 theo backlog. H4 chuẩn bị snapshot và kiểm binary; không hiện nút In mẫu trắng/In phiếu khi H5 chưa có. FILE-01 phần print-data chỉ được đóng ở H5.

## Nghiệm thu tổng

| Tiêu chí | Bằng chứng khi thực thi |
|---|---|
| USR-01..04 giữ nguyên | staff-access.db-spec + test người dùng/legacy adapter; hai yêu cầu đồng thời không loại MANAGE cuối. |
| ORG-01 | Nghỉ dùng/đổi tên đơn vị không khóa user hoặc sửa snapshot phiếu đã nộp. |
| CAT-01..02 | ID 6 nhóm/26 phân loại gốc giữ nguyên; bảo vệ liên kết đã nộp, seed lại không xóa metadata quản trị. |
| PROD-01 | Hai menu trả cùng Product ID; tạo từ một menu xuất hiện ở menu kia, không nhân bản Product. |
| REG-01 | Nhập hộ cho active verified REGISTRANT; chủ thể thấy hồ sơ; audit/event ghi đúng manager. VIEW không xem nháp/ghi. |
| REG-02 | Nháp thiếu thông tin được lưu; nộp cần locality/bộ phiếu hợp lệ và form đầy đủ; trạng thái sau nộp chặn sửa/tệp ở cả hai API. |
| FILE-01 trong H4 | File sai, >10 MiB hoặc vượt 20 bị chặn; lỗi một phần giữ ID/tệp thành công; binary kiểm quyền/đối tượng, không lộ storage key. |
| Snapshot phục vụ H5 | Đổi tên user/category/locality sau nộp không đổi registrationSnapshot; null lịch sử được giữ rõ ràng. |

## Xác minh cuối khi thực thi

~~~powershell
pnpm --filter @ocop/api typecheck
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/api test --runInBand
pnpm --filter @ocop/api test:db
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/session-contract.test.ts ../web/test/product-editor-categories.test.ts ../web/test/admin-users.test.ts ../web/test/admin-catalogs.test.ts ../web/test/product-draft-save.test.ts
pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/web exec node test/proxy.check.mjs
pnpm --filter @ocop/api build
pnpm --filter @ocop/web build
git diff --check
~~~

Không áp dụng các lệnh test này trong lượt lập kế hoạch. Khi thực thi, browser acceptance dùng tài khoản/tệp fixture trong môi trường cô lập, ghi kết quả theo ma trận từng subplan. Không bổ sung framework E2E để chạy một lượt nghiệm thu.

Đo danh sách H4 theo mục tiêu hiệu năng đề xuất của spec: p95 không quá 3 giây với 10.000 hồ sơ và 50 phiên đọc đồng thời trên môi trường được ghi cấu hình. Dùng fixture schema cô lập và request driver sẵn có; ghi số liệu, dataset và cấu hình đo. Nếu chưa có điều kiện đo 50 phiên thì ghi rõ chưa nghiệm thu hiệu năng, không suy từ typecheck/build; báo cáo/Dashboard thuộc H6.

## Tự rà soát kế hoạch

- Phạm vi H4 đối chiếu đầy đủ mục 4, 5, 6, 8.1–8.2 của spec. Mục 8.3 và nút in ở 5.1 được gắn phụ thuộc H5 rõ ràng.
- Interface giữa A/B/C dùng cùng user, catalog, Product và ApiResult; snapshot không nằm trong input DTO.
- Các bước có file, contract, ca test, lệnh và kết quả mong đợi; không có bước giả lập dữ liệu thật.
- Chưa triển khai, chưa chạy test hay migration, chưa commit/push trong lượt lập kế hoạch.
