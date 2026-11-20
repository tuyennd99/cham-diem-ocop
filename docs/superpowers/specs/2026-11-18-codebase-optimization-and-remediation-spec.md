# Đặc tả Hợp nhất: Vá lỗi Logic, Tối ưu Hiệu năng, Bảo mật, Kiến trúc và Giao diện Hệ thống Đánh giá Sản phẩm OCOP

Ngày: 18/11/2026 (Cập nhật hợp nhất rà soát backend: 19/11/2026)

Trạng thái: Đã hợp nhất các phát hiện rà soát backend (Đợt 1–3) và các hạng mục còn lại của `backend-remediation-plan.md` (Task 4–7) làm nguồn chân lý duy nhất. Hai lỗi baseline cần được xử lý trước khi triển khai.

---

## Problem Statement

Hệ thống đăng ký và đánh giá sản phẩm OCOP hiện đã đáp ứng đầy đủ luồng nghiệp vụ cho bốn vai trò (**Người dùng**, **Chủ trì**, **Giám khảo**, **Quản trị**), phân công theo **Cơ quan chủ trì quản lý** và quản lý theo **Địa bàn** / sự kiện. Tuy nhiên, qua rà soát toàn diện mã nguồn backend và frontend, hệ thống đang tồn tại năm nhóm vấn đề cần xử lý đồng bộ:

1. **Lỗi logic ngầm và bất nhất dữ liệu/nghiệp vụ ở backend**:
   - Truy vấn tiến độ **Giám khảo** trên bảng tổng quan (`dashboardData`) nối chéo đồng thời phân công theo hồ sơ và phân công theo phân loại cũ rồi dùng `COALESCE(p1.id, p2.id)`, gây tích Descartes và bỏ sót toàn bộ hồ sơ cũ nếu giám khảo có ít nhất một phân công theo hồ sơ, đồng thời thiếu điều kiện loại trừ hồ sơ đã có phân công riêng.
   - Thao tác trả hồ sơ (`returnProduct`) cho phép nhập lý do đến 1.000 ký tự nhưng ghi nguyên chuỗi vào `ProductStatusEvent.reason` và `AuditLog.reason` (`VarChar(255)`), khiến mọi lý do từ 256 ký tự trở lên bị lỗi `400` (`P2000`).
   - Khi **Người dùng** nộp hồ sơ không truyền `localityId`, `resolveOrCreateLocality` tự động kích hoạt lại (`isActive = true`) các **Địa bàn** đã bị **Quản trị** vô hiệu hóa. Đồng thời, kiểm tra trùng lặp thời gian sự kiện (`assertNoOverlappingEvent`) bỏ qua các bản ghi không có ngày, trong khi biểu mẫu tạo sự kiện mới của **Quản trị** chưa bắt buộc khoảng thời gian sự kiện.
   - Hàm so sánh kỳ báo cáo (`computeComparisonDelta`) gộp `previous === null` với `previous === 0`, biến chỉ tiêu thiếu lịch sử hoặc không có số kỳ trước thành `0` và báo độ lệch `+current` sai lệch.
   - Kiểm tra điều kiện **Giám khảo** và đơn vị công tác bị lệch giữa các luồng: `listEligibleJudgesForProduct` và `addProductJudgeAssignment` bỏ sót kiểm tra `organizationUnit.isActive` và `agency.isActive` (khác `approveProduct`); quản lý đơn vị công tác cho gắn **Cơ quan chủ trì quản lý** đã tắt và cho tắt đơn vị khi còn **Giám khảo** đang chấm hồ sơ mở.
   - Một số bất nhất nhỏ khác: `buildEvaluationPrintData` đánh dấu nhầm phiếu `EXCLUDED` thành `LIVE_DRAFT` (bỏ qua `submissionSnapshot`); `findProductResultsPrintData` đưa cả phân công giám khảo đã gỡ (`isActive = false`) vào danh sách; `PATCH /api/auth/me` xóa `phone` về `null` khi payload không gửi trường `phone`; `listUsers` lọc `kind=REGISTRANT` bỏ sót tài khoản đa vai trò (`roles` chứa `REGISTRANT`); `EvaluationsRepository.findAttachment` lệch điều kiện đọc `COMPLETED` ở nhánh cũ so với `getEvaluation`; `removeProductJudgeAssignment` không chặn các trạng thái chưa duyệt (`DRAFT`/`RETURNED`/`SUBMITTED`); thiếu trần `page` gây tràn `OFFSET` PostgreSQL (`500`), thiếu `@MaxLength` ở một số DTO, chưa map `P2034`/`P2003`, thiếu xử lý `ENOENT`/`unlink` an toàn và thiếu timeout SMTP.

2. **Nghẽn truy vấn cơ sở dữ liệu, khóa rộng và xung đột giao dịch**:
   - Khi tìm từ khóa trên danh mục công khai, danh sách hồ sơ của **Quản trị** / **Chủ trì**, hàng đợi **Giám khảo** hoặc danh sách phiếu chấm, API nạp ID và số thứ tự hồ sơ vào bộ nhớ để định dạng mã (`OCOP-000001`) và so khớp trong JS (riêng `listQueue` và `listEvaluations` quét không có phạm vi `baseWhere`, thậm chí `listEvaluations` gọi 2 lần).
   - `GET /api/my/products` không phân trang và kéo cả JSON snapshot (`registrationSnapshot`, `requiredAgencySnapshot`); `listQueue` kéo toàn bộ ứng viên về RAM khi sắp xếp theo trạng thái/điểm; `listEvaluations` kéo toàn bộ `submissionSnapshot`, `scores` và `category.assignments`, đồng thời sắp xếp `SCOPE` sai theo tổng tiêu chí danh mục.
   - Mỗi lượt mở trang tổng quan hoặc xuất báo cáo đều đọc toàn bộ bảng sản phẩm kèm toàn bộ lịch sử chuyển trạng thái và lặp lại lọc/gom nhóm 3 lần trong `buildAnalyticsDashboard` (`O(C × N)` và `24 × N`).
   - Tồn tại 5 vị trí dùng `Promise.all` bên trong interactive `$transaction` với `@prisma/adapter-pg`; `lockStaffMutation` khóa `FOR UPDATE` toàn bộ bảng `product_categories` và toàn bộ nhân sự kể cả khi chỉ khóa/mở tài khoản **Người dùng**; tồn tại nhiều truy vấn thừa trong cùng một yêu cầu (`AccountGuard` + `/auth/me` + `PATCH /auth/me`, `findAttachment` chạy 6 truy vấn, `saveDraft` truy vấn lại `subCriterion`, `deactivateJudge` đọc `User` 4 lần, `categoryExists` trước transaction, `pendingRegistrationStatus` dùng `FOR UPDATE` chỉ để đọc).
   - Duyệt hồ sơ ghi phân công tuần tự từng dòng; thiếu chỉ mục cho lọc ngày/địa bàn, `otp_codes(email, purpose, createdAt DESC)`, lọc JSONB `formData` và `localities(provinceName, name)`; chưa có dọn dẹp OTP và `pending_auth` hết hạn; `PrivateStorage` gọi `mkdirSync` đồng bộ mỗi lần tải tệp.

3. **Quan sát lỗi, bảo mật xác thực, cấu hình và rò rỉ dữ liệu thử nghiệm**:
   - Bộ lọc ngoại lệ toàn cục khi gặp lỗi máy chủ (`500`) bỏ qua thông báo lỗi và ngăn xếp lời gọi (stack trace); `env(process.env)` bị phân tích lặp lại theo từng yêu cầu; Swagger luôn bật trên `production` và nạp tài nguyên từ CDN bên ngoài.
   - `AuthRepository.saveOtp` chưa có cooldown 60 giây theo `(email, purpose)` ở tầng DB; `AuthService.register` chưa hỗ trợ gửi lại OTP khi tài khoản `REGISTRANT` đã tạo nhưng chưa xác thực; tạo `PendingAuth` trước khi gửi mail gây bản ghi mồ côi khi SMTP lỗi.
   - Giao diện đăng nhập điền sẵn mật khẩu tài khoản thử nghiệm làm giá trị mặc định.

4. **Hiệu năng máy chủ SSR, kích thước gói tải trình duyệt và phụ thuộc dư thừa**:
   - Máy chủ SSR đọc tệp tĩnh đồng bộ và thiếu `Cache-Control`; `/sitemap.xml` cần giữ `Cache-Control: no-store`.
   - Thư viện `lodash` kéo thừa vào cả backend và frontend, kèm một số phụ thuộc không sử dụng và plugin gỡ lỗi bật trong bản dựng production.

5. **Trùng lặp mã nguồn, cấu trúc NestJS, TypeScript strict và trải nghiệm UI/UX**:
   - Nhiều logic và mảnh truy vấn bị sao chép và đã bắt đầu lệch nhau (3 bản trích xuất `formData`, `activeJudgeWhere`, `organizationUnit` select, `hashPassword`/`isUniqueConstraint`, OTP hashing, sinh mã `XP<n>`, DTO transforms & phân trang); còn dead code (`staffRole`, `@AdminOnly`, `@ResponseMessage` thừa) và nhánh `typeof ... === 'function'` chỉ để phục vụ mock test thiếu.
   - `AdminRepository` quá lớn; `MyProductsController` phụ thuộc ngược `AdminService`; `AdminScoringController` thiếu guard decorator; `AdminReportQueryDto` kế thừa nhầm 4 tham số dashboard; filter/interceptor tự `new` thay vì Nest DI; `apps/be/tsconfig.json` đang tắt `strictNullChecks` và `noImplicitAny`.
   - Giao diện nạp trùng Google Fonts (kèm `Inter`), áp đặt mật độ thu gọn của `/admin` lên `/my` và `/judge`, thiếu tự lưu tạm bản nháp điểm chấm của **Giám khảo**, dùng `window.alert` khi mở tệp lỗi, nhiều biểu mẫu tách khỏi `useAppForm`, và trình soạn thảo/chi tiết hồ sơ quá lớn.

---

## Solution

Chuẩn hóa, vá lỗi và tối ưu hệ thống theo bốn gói đồng bộ (**Gói 0 → Gói A → Gói B → Gói C**), bảo toàn toàn bộ quy tắc tính điểm/xếp hạng sao và luồng trạng thái OCOP hiện hành:

1. **Gói 0 — Vá lỗi logic ngầm và chuẩn hóa ràng buộc dữ liệu (ưu tiên đầu tiên)**:
   - Viết lại truy vấn tiến độ **Giám khảo** trong `dashboardData` bằng CTE `UNION` + `NOT EXISTS` để đếm chính xác cả phân công theo hồ sơ lẫn phân công cũ mà không sinh tích Descartes.
   - Đồng bộ giới hạn lý do trả hồ sơ về `255` ký tự ở cả `ReturnProductDto` và giao diện modal trả hồ sơ của **Quản trị** / **Chủ trì**.
   - Tách rõ `previous === null` khỏi `previous === 0` trong `computeComparisonDelta` và cập nhật bộ định dạng hiển thị so sánh kỳ trên giao diện web.
   - Chặn `resolveOrCreateLocality` tự kích hoạt lại **Địa bàn** đã bị tắt (`409`), đồng thời bắt buộc nhập thời gian sự kiện (`effectiveFrom`, `effectiveTo`) khi **Quản trị** tạo sự kiện mới qua `/admin/localities` và cập nhật dữ liệu seed mẫu có thời gian sự kiện.
   - Đồng bộ điều kiện `organizationUnit.isActive` và `agency.isActive` ở mọi điểm chọn/gán **Giám khảo**; chặn gắn **Cơ quan chủ trì quản lý** đã tắt và chặn tắt đơn vị công tác khi còn **Giám khảo** có hồ sơ đang mở.
   - Vá các bất nhất ở dữ liệu in phiếu `EXCLUDED`, danh sách phân công trong bảng tổng hợp kết quả, `PATCH /api/auth/me` giữ nguyên `phone` khi không truyền, lọc `kind=REGISTRANT` cho tài khoản đa vai trò, điều kiện tải tệp đính kèm của **Giám khảo**, kiểm tra trạng thái khi gỡ giám khảo, giới hạn `page <= 100_000` + `@MaxLength` DTO, tách `AdminReportFilterQueryDto`, ánh xạ `P2034`/`P2003`, xử lý `ENOENT`/`unlink` an toàn và timeout SMTP.

2. **Gói A — Bảo mật, xác thực OTP, quan sát lỗi, SSR và tối ưu gói mã trình duyệt**:
   - Singleton cấu hình môi trường; kiểm tra tài khoản một lần mỗi yêu cầu (`AccountGuard`) và dùng lại cho `/auth/me` lẫn `PATCH /auth/me`; cooldown 60 giây cho `saveOtp` và hỗ trợ gửi lại OTP khi đăng ký lại tài khoản `REGISTRANT` chưa xác thực; xử lý gọn lỗi gửi mail khi tạo phiên chờ.
   - Ghi nhận đầy đủ `requestId`, thông điệp và stack trace đã che dữ liệu nhạy cảm cho lỗi `5xx`; tắt Swagger ở `production` và bỏ CDN ngoài.
   - Phục vụ tệp tĩnh SSR qua luồng bất đồng bộ kèm `Cache-Control`, giữ `/sitemap.xml` `no-store`; gỡ `lodash` và phụ thuộc dư thừa; chuẩn hóa 3 họ phông chữ và ẩn mật khẩu mẫu khỏi bản dựng production.

3. **Gói B — Tối ưu truy vấn, cơ chế khóa, phân trang `/my/products` và chỉ mục DB**:
   - Loại bỏ mọi `Promise.all` bên trong interactive `$transaction`; thu hẹp `lockStaffMutation` (không khóa `product_categories` khi thao tác tài khoản **Người dùng**); đối chiếu lại `categoryId` sau khi khóa trong `admin.repository.ts`.
   - Chuyển `GET /api/my/products` sang phân trang `{ data, meta }` kèm `select` tinh gọn và cập nhật ứng dụng web tương ứng.
   - Đẩy tra cứu mã hồ sơ `OCOP-000001` và sắp xếp danh sách xuống cơ sở dữ liệu; thu hẹp truy vấn báo cáo, loại bỏ duyệt mảng lặp trong `buildAnalyticsDashboard`; xóa các truy vấn thừa trong `findAttachment`, `saveDraft`, `deactivateJudge`, `ProductsService`, `pendingRegistrationStatus`, `listCategories`; bỏ `mkdirSync` đồng bộ mỗi lần upload.
   - Ghi phân công theo lô khi duyệt hồ sơ; dọn theo lô 100 bản ghi hết hạn cho `otp_codes` và `pending_auth`; đo kế hoạch truy vấn và bổ sung bộ chỉ mục DB.

4. **Gói C — Tái sử dụng mã nguồn, chuẩn hóa kiến trúc NestJS, TypeScript `strict` và hoàn thiện UI/UX**:
   - Gom hàm và mảnh truy vấn dùng chung (`extractSafeApplicationForm`, `select`/`where` dùng chung, mật khẩu, lỗi Prisma, OTP hashing, sinh mã địa bàn, DTO transforms & `PaginationQueryDto`).
   - Tách pure domain logic khỏi repository, tách `PrintDataService`, tách `AdminRepository` theo 4 miền; dùng Nest DI cho filter/interceptor; bổ sung guard decorator cho `AdminScoringController`; dọn dead code và các nhánh `typeof ... === 'function'` sau khi hoàn thiện mock test; tái sử dụng type `@ocop/shared`.
   - Bật `"strict": true` trong `apps/be/tsconfig.json`, sửa toàn bộ lỗi kiểu/null và thêm script `lint:check`.
   - Chuẩn hóa mật độ UI theo vai trò (vùng chạm ≥ 44 × 44 px trên `/my/**`), vòng đời bản nháp điểm chấm có kiểm tra phiên bản chống xung đột `409`, `useAppForm`, `toast.error`, focus ring và tách các thành phần giao diện lớn.

---

## User Stories

1. As a **Người dùng**, I want trang đăng nhập khởi tạo với ô mật khẩu trống, so that tôi không vô tình gửi mật khẩu tài khoản thử nghiệm khi đăng nhập bằng tài khoản thật của đơn vị mình.
2. As a developer hoặc người kiểm thử trên môi trường phát triển, I want mật khẩu mẫu chỉ tự điền khi tôi chọn tài khoản mẫu và được xóa khi tôi chuyển sang email khác, so that tôi có thể kiểm thử nhanh rồi đăng nhập bằng tài khoản thật một cách an toàn.
3. As a **Người dùng** có nhiều hồ sơ sản phẩm, I want danh sách hồ sơ của tôi (`GET /api/my/products`) được phân trang gọn nhẹ và tải nhanh mà không mang theo dữ liệu ảnh chụp lịch sử dư thừa, so that tôi quản lý nhiều hồ sơ mượt mà trên cả máy tính và điện thoại.
4. As a **Người dùng** hoặc khách tra cứu công khai, I want tìm sản phẩm theo tên, mã đầy đủ hoặc một phần mã hồ sơ, so that tôi có thể tra cứu trên danh mục lớn mà API chỉ nạp kết quả cần trả về.
5. As a **Chủ trì** hoặc **Quản trị**, I want lý do trả hồ sơ có giới hạn nhất quán giữa biểu mẫu và cơ sở dữ liệu (255 ký tự) và không bao giờ gặp lỗi `400` bất ngờ khi lưu lịch sử thao tác, so that việc trả hồ sơ diễn ra suôn sẻ.
6. As a **Chủ trì** hoặc **Quản trị**, I want bảng tổng quan hiển thị đúng tiến độ chấm của **Giám khảo** (không bỏ sót hồ sơ cũ hoặc tính trùng) và phân biệt rõ kỳ trước thiếu lịch sử với kỳ trước bằng `0`, so that số liệu điều hành đáng tin cậy.
7. As a **Quản trị**, I want **Địa bàn** đã tắt không thể bị **Người dùng** vô tình bật lại khi nộp hồ sơ, mọi sự kiện mới tạo đều có khoảng thời gian hợp lệ, và không thể tắt đơn vị công tác đang có **Giám khảo** chấm hồ sơ mở, so that tính toàn vẹn danh mục và phân công luôn được bảo đảm.
8. As a **Chủ trì** hoặc **Quản trị**, I want các bộ lọc **Địa bàn**, phân loại, trạng thái, ngày nộp, ngày hoàn tất và tìm kiếm nhân sự (kể cả tài khoản đa vai trò) hoạt động chính xác trên dữ liệu lớn, so that việc tra cứu hành chính hiệu quả.
9. As a **Chủ trì** hoặc **Quản trị**, I want bảng tổng quan và các báo cáo đăng ký / kết quả chỉ đọc dữ liệu cần cho kỳ và bộ lọc đang chọn, so that báo cáo phản hồi nhanh và vẫn giữ đúng số liệu kỳ trước, hồ sơ tồn và trạng thái tại ngày chốt.
10. As a **Chủ trì** hoặc **Quản trị**, I want thao tác duyệt hồ sơ thực hiện phân công tự động cho các **Giám khảo** thuộc **Cơ quan chủ trì quản lý** bằng thao tác ghi theo lô, và phiếu in của phiếu chấm bị loại trừ vẫn giữ đúng bản chụp lúc nộp, so that hiệu năng cao và hồ sơ lưu trữ trung thực.
11. As an authenticated user (**Người dùng**, **Chủ trì**, **Giám khảo**, **Quản trị**), I want máy chủ API dùng lại thông tin tài khoản đã kiểm tra trong cùng yêu cầu và cập nhật họ tên (`PATCH /api/auth/me`) không làm mất số điện thoại hiện có, so that thao tác hồ sơ cá nhân nhanh và an toàn.
12. As a **Quản trị**, I want yêu cầu dùng phiên cũ bị từ chối ngay sau khi giao dịch đổi quyền, khóa tài khoản hoặc đặt lại mật khẩu hoàn tất, đồng thời gửi OTP có thời gian chờ chống spam theo từng email, so that quyền đã thu hồi có hiệu lực tức thì và hộp thư không bị lạm dụng.
13. As a **Người dùng** sử dụng điện thoại di động để kê khai hồ sơ sản phẩm và tải minh chứng, I want các nút bấm và ô nhập liệu trong khu vực của **Người dùng** giữ kích thước vùng chạm tiêu chuẩn tối thiểu 44px thay vì mật độ thu gọn của **Quản trị**, so that tôi thao tác chính xác trên màn hình nhỏ.
14. As a **Chủ trì** hoặc **Quản trị** làm việc trên máy tính để bàn với bảng dữ liệu nhiều cột, I want chế độ mật độ thu gọn chỉ áp dụng cho khu vực quản trị, so that tôi quan sát được nhiều dòng hồ sơ và tiêu chí trên một màn hình.
15. As a **Giám khảo**, I want khôi phục điểm và ghi chú chưa lưu khi tải lại cùng tab hoặc sau khi kết nối lại, so that tôi có thể chấm tiếp nếu phiếu, tiêu chí và dữ liệu trên máy chủ vẫn khớp với lúc bắt đầu bản nháp.
16. As a **Người dùng**, **Chủ trì**, **Giám khảo**, hoặc **Quản trị**, I want thấy thông báo lỗi dạng toast nhất quán khi không mở được tệp minh chứng hoặc hình ảnh đính kèm thay vì `window.alert`, và nhận mã `404` rõ ràng nếu tệp vật lý không còn tồn tại, so that trải nghiệm xử lý lỗi đồng bộ.
17. As a người sử dụng bàn phím hoặc công nghệ hỗ trợ, I want mọi ô chọn lọc (combobox) hiển thị đường viền tiêu điểm (`focus ring`) có độ tương phản rõ ràng khi di chuyển bằng phím `Tab`, so that tôi luôn biết vị trí con trỏ hiện tại trên biểu mẫu.
18. As a khách truy cập trên mạng di động, I want ứng dụng chỉ tải một lần duy nhất 3 họ phông chữ chuẩn của hệ thống và không tải `lodash` trong gói mã khởi tạo, so that trang công khai hiển thị nhanh.
19. As a máy thu thập dữ liệu tìm kiếm hoặc khách truy cập, I want tệp tĩnh được phục vụ qua luồng bất đồng bộ và `/sitemap.xml` phản ánh ngay điều kiện lập chỉ mục mới, so that tài nguyên tĩnh tải hiệu quả và sitemap luôn chính xác.
20. As a kỹ sư vận hành hệ thống, I want bộ lọc lỗi máy chủ (`5xx`) ghi nhận đầy đủ `requestId`, thông điệp và stack trace đã che dữ liệu nhạy cảm, xử lý đúng xung đột giao dịch (`P2034`) và khóa ngoại (`P2003`), có timeout SMTP, ẩn Swagger trên `production` và tự dọn bản ghi xác thực hết hạn, so that vận hành ổn định và chẩn đoán sự cố nhanh.
21. As a kỹ sư phát triển giao diện và máy chủ, I want backend bật TypeScript `strict: true` kèm `lint:check`, các helper/DTO/query dùng chung không trùng lặp, mô-đun lớn được tách theo ranh giới nghiệp vụ và biểu mẫu web dùng chung `useAppForm`, so that việc bảo trì và mở rộng an toàn.

---

## Implementation Decisions

### 0. Vá lỗi logic ngầm & chuẩn hóa ràng buộc nghiệp vụ (Gói 0)
- **Tiến độ Giám khảo trong `dashboardData`.** Thay cặp `LEFT JOIN` chéo (`pja -> p1` và `ja -> p2`) bằng CTE `UNION` hai tập `(judgeId, productId)`: (1) phân công theo hồ sơ đang hoạt động (`pja.isActive = true`, trạng thái `APPROVED | SCORING`) và (2) phân công cũ theo phân loại (`ja`, trạng thái `SUBMITTED | APPROVED | SCORING` kèm điều kiện `NOT EXISTS (SELECT 1 FROM product_judge_assignments pja2 WHERE pja2."productId" = p."id")`), sau đó mới `LEFT JOIN evaluations` và gom nhóm theo `judgeId`.
- **Đồng bộ giới hạn lý do trả hồ sơ (`255` ký tự).** Hạ `@MaxLength(1000)` xuống `@MaxLength(255)` trên `ReturnProductDto.reason` để khớp với `ProductStatusEvent.reason` và `AuditLog.reason` (`VarChar(255)`) mà không cần thêm migration schema; cập nhật `maxLength={255}` ở modal trả hồ sơ trên `AdminProductDetailPage.tsx` và `AdminProductsPage.tsx`.
- **So sánh kỳ báo cáo khi kỳ trước không có giá trị (`previous === null`).** Trong `computeComparisonDelta`, tách `previous === null` khỏi `previous === 0`: khi `previous === null` trả `previous: null`, `deltaAbsolute: null`, `deltaPercent: null` (dùng `INSUFFICIENT_HISTORY` khi thiếu dữ liệu lịch sử hoặc không có cơ sở so sánh như `UNDER_ASSIGNED_BACKLOG` / `prevOpenBacklogAtAsOf === null`, dùng `NO_PRIOR_DATA` khi kỳ trước thực sự có giá trị `0` hoặc không có hồ sơ hoàn tất hợp lệ cho `PASS_RATE`). Cập nhật `formatComparisonDelta` ở `apps/web/src/lib/report-format.ts` để hiển thị `—` / nhãn rõ ràng khi `deltaAbsolute === null` thay vì ép `?? 0`.
- **Địa bàn / Sự kiện & `resolveOrCreateLocality`.**
  - Giữ cơ chế tự tạo bản ghi `Locality` mới từ `formData.{provinceName, localityName, localityCode}` khi `localityId` trống và chưa có bản ghi khớp, nhưng nếu bản ghi khớp đã tồn tại với `isActive = false`, trả `409 Conflict` giống `lockActiveLocality` (tuyệt đối không tự bật lại `isActive = true`). Cắt/kiểm tra `localityCode` không vượt quá `50` ký tự.
  - Bắt buộc `effectiveFrom` và `effectiveTo` trên `CreateLocalityDto` khi **Quản trị** tạo sự kiện mới qua `POST /admin/localities`, và không cho xóa trắng thành `null` khi cập nhật sự kiện đã có thời gian qua `PUT /admin/localities/:id`. Cập nhật `apps/be/prisma/seed/*` để toàn bộ dữ liệu sự kiện/địa bàn mẫu có khoảng thời gian sự kiện hợp lệ.
  - Với các bản ghi nền không có ngày (nếu phát sinh từ nhánh auto-map `resolveOrCreateLocality`): giữ tối đa 1 bản ghi không có ngày trên mỗi `(provinceName, name)` và không chặn việc tạo các sự kiện có thời gian.
- **Điều kiện Giám khảo đủ điều kiện & Đơn vị công tác.**
  - Dùng chung một điều kiện xác định **Giám khảo** đủ điều kiện cho `approveProduct`, `listEligibleJudgesForProduct` và `addProductJudgeAssignment`: tài khoản `isActive = true`, `verified = true`, `role !== REGISTRANT`, có `SCORE`, thuộc `OrganizationUnit` đang `isActive = true`, và thuộc `ManagingAgency` đang `isActive = true` trong tập cơ quan yêu cầu của hồ sơ/phân loại.
  - Trong `createOrganizationUnit` và `updateOrganizationUnit`: yêu cầu `ManagingAgency` được gắn phải có `isActive = true` (`400` nếu không); khi chuyển `OrganizationUnit.isActive` từ `true` sang `false`, kiểm tra và từ chối (`409 Conflict`) nếu đơn vị vẫn còn **Giám khảo** đang có hồ sơ mở (`SUBMITTED | APPROVED | SCORING`) qua phân công theo hồ sơ hoặc phân công theo phân loại cũ.
- **Dữ liệu in, gỡ phân công, hồ sơ cá nhân, lọc người dùng và tệp đính kèm.**
  - `buildEvaluationPrintData`: chỉ đặt `isDraft = (status === IN_PROGRESS)`; với `EXCLUDED`, ưu tiên đọc `submissionSnapshot` (nếu có) như `SUBMITTED`.
  - `findProductResultsPrintData`: lọc `judgeAssignments` theo `isActive: true` khi dựng `effectiveAssignments` (tách riêng với cờ xác định hồ sơ có sử dụng cơ chế phân công theo hồ sơ hay không).
  - `removeProductJudgeAssignment`: giữ hành vi cho phép gỡ trên `APPROVED | SCORING | COMPLETED` (tương thích luồng nghiệp vụ và kiểm thử hiện hành), nhưng chặn rõ `409 Conflict` nếu hồ sơ ở `DRAFT | RETURNED | SUBMITTED`.
  - `AuthService.updateProfile` (`PATCH /api/auth/me`): chỉ cập nhật `phone` khi `input.phone !== undefined` (giữ `current.phone` khi trường `phone` bị lược bỏ; vẫn xóa về `null` khi client gửi `phone: null` hoặc `""`).
  - `AdminUsersRepository.listUsers`: khi lọc `kind = REGISTRANT`, khớp `{ OR: [{ role: Role.REGISTRANT }, { roles: { has: Role.REGISTRANT } }] }` để không bỏ sót tài khoản đa vai trò.
  - `EvaluationsRepository.findAttachment`: áp dụng cùng điều kiện đọc `COMPLETED` ở nhánh phân công cũ như `getEvaluation` (chỉ cho phép khi giám khảo có phiếu `SUBMITTED`/`EXCLUDED`).
- **Validation đầu vào, xử lý lỗi và độ bền I/O.**
  - Đặt trần `@Max(100000)` cho `page` trên tất cả query DTO phân trang (bao gồm `PublicProductQueryDto`) và kiểm tra an toàn `skip <= 2_147_483_647` để tránh lỗi tràn `OFFSET` `500` từ PostgreSQL.
  - Bổ sung `@MaxLength` cho các trường chuỗi còn thiếu (`q`, `provinceName` trên `admin-catalogs.dto.ts` và `q`, `description` trên `admin-users.dto.ts`).
  - Tách `AdminReportFilterQueryDto` làm lớp cha chung cho `AdminDashboardQueryDto` và `AdminReportQueryDto`, loại 4 tham số dashboard-only khỏi `/api/admin/reports/*`.
  - Trong `ApiExceptionFilter`: thu hẹp kiểm tra lỗi Prisma theo mã chuẩn (`P2xxx`), bổ sung ánh xạ `P2034` → `409 Conflict` (xung đột đồng thời `RepeatableRead`) và `P2003` → `409 Conflict` / `400 BadRequest` tùy ngữ cảnh.
  - Trong `openStoredFile`: bắt `ENOENT` và ném `404 NotFoundException`. Trong `ProductsService.removeStoredAttachment` và `removeDraft`: bọc `safeUnlink` bằng `try/catch` log cảnh báo sau khi DB đã commit thay vì trả `500`.
  - Trong `MailService`: cấu hình `connectionTimeout`, `greetingTimeout`, `socketTimeout` (ví dụ `10_000ms` / `15_000ms`) cho Nodemailer transporter.

### 1. Xác thực, OTP, cấu hình môi trường và quan sát lỗi (Gói A)
- **Singleton cấu hình môi trường**: Hàm đọc cấu hình môi trường xác thực và đóng băng (freeze) đối tượng cấu hình một lần khi khởi động ứng dụng; cung cấp cơ chế đọc lại khi chạy kiểm thử đơn vị có thay đổi `process.env`; bỏ đọc trực tiếp `process.env.GOOGLE_CLIENT_ID` trong `GoogleIdentityService`.
- **Kiểm tra tài khoản một lần mỗi yêu cầu.** `AccountGuard` đọc trạng thái tài khoản từ DB cho mỗi yêu cầu qua guard, kiểm tra `isActive`, `verified` và `tokenVersion` khớp JWT, gắn đủ dữ liệu `PublicUser` nội bộ cho yêu cầu hiện tại. `GET /api/auth/me` và `PATCH /api/auth/me` dùng lại bản ghi đã nạp mà không truy vấn `findUserById` lần thứ hai; `RoleGuard` dùng trực tiếp quyền/vai trò đã tính sẵn.
- **Bảo vệ OTP & đăng ký lại tài khoản chưa xác thực (Task 4).** Bổ sung cooldown `60s` theo `(email, purpose)` trong `AuthRepository.saveOtp` để chống spam gửi mã từ nhiều IP; cho phép `AuthService.register` gửi lại OTP khi tài khoản `REGISTRANT` cũ đã tồn tại nhưng chưa xác thực (`verified: false`); khi gửi mail thất bại trong luồng `register`/`google`/`googleRegister`, dọn bản ghi `PendingAuth` vừa tạo (hoặc tránh để bản ghi mồ côi không có token trả về).
- **Ghi nhật ký lỗi máy chủ (`5xx`).** Phản hồi giữ mã HTTP và JSON `{ statusCode, message, requestId }` với thông điệp lỗi chung. Nhật ký lưu `requestId`, thông điệp và ngăn xếp lời gọi sau khi che dữ liệu nhạy cảm (mật khẩu, OTP, token, chuỗi kết nối DB) cho cả ngoại lệ thông thường và `HttpException` có mã `5xx`.
- **Giới hạn hiển thị Swagger & bỏ CDN (Task 5).** Chỉ tạo và đăng ký Swagger UI (`/docs`) cùng tài liệu OpenAPI (`/docs-json`, `/docs-yaml`) khi `NODE_ENV !== 'production'`, đồng thời loại bỏ `customJs`/`customCssUrl` trỏ CDN ngoài để tương thích CSP.

### 2. Máy chủ SSR, Sitemap, thu gọn gói mã và giao diện tĩnh (Gói A)
- **Phục vụ tệp tĩnh bất đồng bộ và lưu đệm**: Máy chủ SSR kiểm tra tệp bất đồng bộ và truyền luồng đọc (`createReadStream`) kèm `Cache-Control: public, max-age=31536000, immutable` cho `/assets/` và `Cache-Control: public, max-age=3600` cho tệp tĩnh gốc khác.
- **Độ mới của sitemap.** Mỗi yêu cầu `/sitemap.xml` tạo XML từ dữ liệu hiện hành và trả `Cache-Control: no-store`. Chỉ trả XML thành công khi đọc đủ các trang dữ liệu; lỗi API ở bất kỳ trang nào trả `5xx`.
- **Loại bỏ `lodash` và phụ thuộc dư thừa**: Thay thế toàn bộ hàm `lodash` ở cả `apps/be` và `apps/web` bằng hàm JS/TS chuẩn; gỡ bỏ `lodash`, `@types/lodash`, `@base-ui/react`, `@tanstack/react-router-ssr-query`; chỉ nạp plugin click-to-component ở chế độ phát triển.
- **Phông chữ & mật khẩu mẫu**: Xóa `@import` Google Fonts trong CSS và xóa `Inter` khỏi `<link>` HTML/SSR (giữ đúng `Be Vietnam Pro`, `Lora`, `JetBrains Mono`). Khởi tạo ô mật khẩu bằng `''`; mã tự điền mật khẩu mẫu chỉ tồn tại trong bản dựng phát triển và tự xóa khi đổi email nếu người dùng chưa tự sửa.

### 3. Tối ưu truy vấn, khóa giao dịch, phân trang `/my/products` và chỉ mục DB (Gói B)
- **An toàn giao dịch & thu hẹp khóa.**
  - Loại bỏ toàn bộ `Promise.all` bên trong interactive `$transaction` tại `evaluations.repository.ts`, `staff-access.ts`, `admin.repository.ts` và `admin-catalogs.repository.ts` (đổi sang `await` tuần tự hoặc mảng batch `$transaction([...], { isolationLevel: RepeatableRead })` cho giao dịch chỉ đọc).
  - Thu hẹp `lockStaffMutation`: tách riêng thao tác `updateUserStatus` của tài khoản `REGISTRANT` khỏi `lockStaffMutation` (không khóa bảng `product_categories`); với thao tác nhân sự, chỉ khóa phạm vi cần thiết (ví dụ advisory lock nhân sự và chỉ khóa danh mục liên quan khi thu hồi quyền `SCORE`).
  - Đối chiếu lại `product.categoryId === initial.categoryId` sau khi lấy khóa tại các thao tác quản trị trong `admin.repository.ts`.
- **Phân trang `GET /api/my/products`.** Chuyển `GET /api/my/products` sang hợp đồng phân trang `{ data, meta: { page, limit, total, totalPages } }` với query DTO dùng chung (`page = 1`, `limit = 20`, `limit <= 100`, hỗ trợ tìm kiếm/lọc nếu cần), dùng `select` tinh gọn cho danh sách (loại `registrationSnapshot`, `requiredAgencySnapshot` khỏi payload danh sách) và cập nhật hook/trang `/my/products` ở `apps/web`. Giữ nguyên hợp đồng mảng của `GET /api/my/registration-units` và giữ `/api/admin/judges` để không phá vỡ màn hình quản trị hiện có.
- **Tra cứu mã hồ sơ & sắp xếp xuống DB.** Chuyển so khớp chuỗi con không phân biệt hoa thường trên mã hiển thị `OCOP-000001` xuống PostgreSQL cho cả danh mục công khai, danh sách quản trị, hàng đợi giám khảo (`listQueue`) và danh sách phiếu chấm (`listEvaluations`, xóa gọi trùng 2 lần và áp dụng đúng `baseWhere`). Đẩy sắp xếp `evalStatus`/`totalScore` của `listQueue` và `SCOPE` của `listEvaluations` sang truy vấn chính xác; tinh gọn `select` ở `listProducts` (chỉ lấy ảnh đại diện đầu tiên `take: 1`) và `listEvaluations` (chỉ tải `scores` cho phiếu `IN_PROGRESS`, không kéo toàn bộ `submissionSnapshot` JSON lớn).
- **Thu hẹp truy vấn báo cáo & xóa truy vấn thừa.**
  - Thay bản chụp toàn bảng báo cáo bằng tập dữ liệu cần cho từng chỉ tiêu (giữ đủ kỳ hiện tại, kỳ trước, tồn và trạng thái tại mốc chốt theo `Asia/Ho_Chi_Minh`); hoãn cache báo cáo đến khi đo thực tế. Trong `buildAnalyticsDashboard`, chỉ deduplicate và lọc danh sách sản phẩm một lần, dùng 1 lượt duyệt `O(N)` cho `monthlyTrend` và tái sử dụng nhóm danh mục từ `regReport`/`resReport` cho `byCategory`.
  - Gộp/xóa các truy vấn lặp: giảm `EvaluationsRepository.findAttachment` từ 6 xuống 1–2 truy vấn; xóa query `tx.subCriterion.findMany` thừa và bỏ load `attachments` trong `saveDraft`; giảm `deactivateJudge` từ 4 xuống 1–2 truy vấn `User`; xóa `categoryExists()` thừa trước transaction trong `ProductsService`; đổi `pendingRegistrationStatus` sang `findUnique` chỉ đọc không dùng `FOR UPDATE`; bỏ `groupBy` khi `rows.length === 0` trong `listCategories`; bỏ `mkdirSync` đồng bộ trong `PrivateStorage._handleFile` (tạo thư mục một lần khi khởi động hoặc async).
- **Ghi phân công theo lô & dọn bảng xác thực.** Khi duyệt hồ sơ (`approveProduct`), ghi mới và cập nhật kích hoạt lại phân công theo lô trong cùng giao dịch, giữ nguyên cơ quan, đơn vị, cờ thủ công, yêu cầu bắt buộc nộp và thông tin phân công gốc. Khi phát hành OTP hoặc tạo phiên chờ xác thực, dọn theo lô tối đa 100 bản ghi hết hạn lâu nhất ở mỗi bảng mà không làm thất bại thao tác chính nếu bước dọn lỗi.
- **Chỉ mục cơ sở dữ liệu.** Đo kế hoạch truy vấn trước khi chốt chỉ mục: ngoài nhóm ứng viên `(status, submittedAt)`, `(status, completedAt)`, `localityId`, `(judgeId, status)`, bổ sung kiểm chứng cho `otp_codes(email, purpose, createdAt DESC)`, chỉ mục phục vụ lọc JSONB `products.formData` (`registrationType`, `assessmentYear`, `entityName`) và `localities(provinceName, name)`.

### 4. Tái sử dụng mã nguồn, kiến trúc NestJS, TypeScript `strict` & UI/UX theo vai trò (Gói C)
- **Gom mã dùng chung và dọn dead code.**
  - Hợp nhất 3 bản sao trích xuất `formData` thành 1 hàm `extractSafeApplicationForm` chuẩn (bao gồm đầy đủ `localityName`, `localityCode`) trong `src/utils/registration-snapshot.ts`.
  - Gom các Prisma fragment (`ACTIVE_JUDGE_WHERE`, `ORG_UNIT_SUMMARY_SELECT`, `MANAGING_AGENCY_SUMMARY_SELECT`, `REGISTRATION_UNIT_SELECT`), tiện ích mật khẩu (`src/utils/password.ts`), nhận diện lỗi Prisma (`src/prisma/errors.ts`), hàm sinh mã địa bàn `generateNextLocalityCode`, và DTO transforms + `PaginationQueryDto` + `toPaginatedResponse` (`src/dtos/common.dto.ts`).
  - Gom toàn bộ sinh mã OTP, HMAC và `hashToken` vào `OtpService` (loại bỏ bản sao trong `AuthService.google`).
  - Xóa dead code (`staffRole`, `@AdminOnly`, `@ResponseMessage` trên `StreamableFile`), tái sử dụng type từ `@ocop/shared` trong `src/types/api.ts`, và xóa các nhánh `typeof ... === 'function'` sau khi bổ sung đầy đủ mock trong unit tests.
- **Chuẩn hóa kiến trúc NestJS & tách mô-đun lớn.**
  - Tách pure domain logic kiểm tra form nộp sản phẩm và kiểm tra độ phủ/diff phân công sang `apps/be/src/utils/` (Task 6).
  - Tách `PrintDataService` độc lập để cắt phụ thuộc ngược `MyProductsController → AdminService`.
  - Tách `AdminRepository` theo 4 miền nghiệp vụ (hồ sơ quản trị, phân công & giám khảo, bộ tiêu chí & phiếu chấm, tổng quan & báo cáo) nhưng giữ nguyên giao diện công khai của `AdminService` (không tách `AppModule` thành nhiều feature module ở đợt này theo YAGNI).
  - Chuyển `ApiExceptionFilter`, `ApiResponseInterceptor` (inject `Reflector`), và `CleanupRejectedUploadInterceptor` sang cơ chế DI chuẩn của NestJS (`APP_FILTER`, `APP_INTERCEPTOR`, `@UseInterceptors(CleanupRejectedUploadInterceptor, ...)`).
  - Bổ sung decorator phân quyền rõ ràng cho `AdminScoringController` thay vì chỉ kiểm tra thủ công trong service.
- **TypeScript `strict` & ESLint (Task 7).** Bật `"strict": true` trong `apps/be/tsconfig.json`, sửa toàn bộ lỗi null/type và thêm script `"lint:check": "eslint \"src/**/*.ts\""` vào `apps/be/package.json`.
- **Giao diện, mật độ theo vai trò, bản nháp chấm điểm và biểu mẫu dùng chung.**
  - Tách mật độ thu gọn chỉ áp dụng cho tuyến `/admin/**` (kể cả hộp thoại); bảo đảm vùng chạm tối thiểu `44 × 44 px` trên `/my/**` ở thiết bị di động; giữ vòng focus rõ (`>= 2px`, tương phản `>= 3:1`) trên mọi combobox; thay `window.alert` khi mở tệp lỗi bằng `toast.error`; chuẩn hóa mã màu token và breakpoint.
  - Lưu tạm bản nháp điểm chấm trong `sessionStorage` theo `(userId, productId)` kèm định danh phiếu và mốc phiên bản từ API; kiểm tra mốc phiên bản trong cùng giao dịch lưu/nộp ở máy chủ, trả `409` khi lệch mốc, tách riêng thông báo kết quả lưu và nộp, xử lý mất phản hồi và xóa nháp sau khi xác nhận đã nộp.
  - Đồng bộ các biểu mẫu xác thực và quản trị về `useAppForm`; tách trình soạn thảo hồ sơ (`ProductDraftEditor`) và trang chi tiết hồ sơ (`AdminProductDetailPage`) thành các thành phần con có hợp đồng props rõ ràng.

---

## Testing Decisions

### Điểm kiểm thử và tiêu chí nghiệm thu

1. **Gói 0 — Kiểm thử hồi quy lỗi logic ngầm (`apps/be/test/*.db-spec.ts`, `apps/be/src/**/*.spec.ts`, `apps/web/test/*.test.ts`).**
   - **`dashboardData` tiến độ giám khảo.** Tạo giám khảo vừa có phân công theo hồ sơ (`APPROVED`/`SCORING`), vừa có phân công cũ ở danh mục khác (gồm 1 hồ sơ chưa có phân công riêng và 1 hồ sơ đã có phân công riêng của giám khảo khác). Xác nhận `assigned` và `submitted` đếm đúng tổng hai nhánh hợp lệ, không sót hồ sơ cũ và không đếm hồ sơ đã chuyển sang phân công riêng.
   - **Lý do trả hồ sơ (`255` ký tự).** Gửi `POST /api/admin/products/:id/return` với lý do đúng 255 ký tự → `201/200` thành công, ghi đủ `Product.returnReason`, `ProductStatusEvent.reason`, `AuditLog.reason`; gửi 256 ký tự → `400 BadRequest` ngay ở DTO validation. Xác nhận FE giới hạn `maxLength={255}`.
   - **So sánh KPI `previous === null`.** Kiểm thử `computeComparisonDelta` và `buildAnalyticsDashboard`: khi kỳ trước thiếu lịch sử (`prevOpenBacklogAtAsOf = null`), `PASS_RATE` kỳ trước không có hồ sơ hợp lệ, hoặc `UNDER_ASSIGNED_BACKLOG`, trả `previousValue: null`, `deltaAbsolute: null`, `deltaPercent: null` thay vì `0`; kiểm thử `formatComparisonDelta` phía web không hiển thị `0` hay `+N`.
   - **Địa bàn/Sự kiện & `resolveOrCreateLocality`.** Gửi tạo/nộp hồ sơ với `localityId: null` và `formData` trùng tên địa bàn đang `isActive = false` → trả `409` và bản ghi vẫn giữ `isActive = false`. Gửi `POST /api/admin/localities` thiếu `effectiveFrom` hoặc `effectiveTo` → `400`; chạy `prisma db seed` xác nhận mọi bản ghi mẫu đều có `effectiveFrom` và `effectiveTo` hợp lệ.
   - **Đơn vị công tác & Giám khảo đủ điều kiện.** Tắt `OrganizationUnit` khi còn giám khảo có hồ sơ mở → `409`; gán `ManagingAgency` đã tắt → `400`; giám khảo thuộc đơn vị đã tắt không xuất hiện trong `listEligibleJudgesForProduct` và bị từ chối ở `addProductJudgeAssignment`.
   - **Các vá lỗi bổ sung.** Kiểm thử `buildEvaluationPrintData` giữ snapshot cho phiếu `EXCLUDED`; `findProductResultsPrintData` bỏ giám khảo `isActive: false`; `removeProductJudgeAssignment` chặn `DRAFT`/`SUBMITTED` và giữ `COMPLETED`; `PATCH /api/auth/me` chỉ gửi `{ fullName }` giữ nguyên `phone`; `listUsers?kind=REGISTRANT` trả cả tài khoản `[REGISTRANT, VIEWER]`; `findAttachment` đồng nhất nhánh legacy `COMPLETED`; `?page=500000000` trả `400` thay vì `500`; mất tệp vật lý trả `404`; `P2034` trả `409`.

2. **Gói A & B — HTTP, dịch vụ và DB (`apps/be/test/*.db-spec.ts`, `apps/be/src/**/*.spec.ts`).**
   - **Phân trang `/my/products`.** Kiểm thử `GET /api/my/products?page=1&limit=10` trả `{ data, meta }` đúng thứ tự, không chứa `registrationSnapshot`/`requiredAgencySnapshot`, và giao diện `/my/products` phân trang hoạt động bình thường.
   - **Tra cứu mã và chỉ mục.** Qua danh mục công khai, danh sách hồ sơ, hàng đợi giám khảo và danh sách phiếu chấm, đối chiếu kết quả/tổng số/phân trang với hành vi hiện hành (`OCOP-000001`, `000001`, `OC`, `ocop-12`, tên, ID cũ, phạm vi quyền). Đo kế hoạch truy vấn và p95 trên ≥ 10.000 hồ sơ: tra cứu mã chọn lọc dùng chỉ mục và p95 thấp hơn baseline; lọc ngày nộp/hoàn tất và `otp_codes` dùng chỉ mục phù hợp.
   - **Thu hồi phiên, `/me` và OTP.** Xác nhận thu hồi phiên tức thì trên 2 tiến trình API khi đổi quyền/khóa/đặt lại mật khẩu; `/auth/me` và `PATCH /auth/me` chỉ đọc tài khoản 1 lần; `saveOtp` chặn gọi lại trong 60s; đăng ký lại tài khoản `REGISTRANT` chưa xác thực gửi lại được OTP; dọn theo lô 100 bản ghi hết hạn ở `otp_codes` và `pending_auth`.
   - **Số liệu báo cáo & phân công theo lô.** So sánh toàn bộ kết quả `dashboard`, `registrationsReport`, `resultsReport` trước/sau trên cùng dữ liệu; xác nhận số lệnh ghi phân công khi duyệt hồ sơ không tăng theo số giám khảo (2 → 20 giám khảo) và rollback trọn vẹn khi lỗi.
   - **Lỗi máy chủ & Swagger.** Xác nhận log `5xx` có `requestId`, thông điệp và stack đã che bí mật; `/docs`, `/docs-json`, `/docs-yaml` trả `404` ở `NODE_ENV=production` và không còn tham chiếu CDN ở `development`.

3. **Gói C — Chất lượng tĩnh, SSR và giao diện (`apps/be`, `apps/web`).**
   - **Static gates backend.** `pnpm --filter @ocop/api typecheck` (với `strict: true`), `pnpm --filter @ocop/api run lint:check` (`0 error, 0 warning`), `pnpm --filter @ocop/api build`, `pnpm --filter @ocop/api test -- --runInBand` và `pnpm --filter @ocop/api test:db` đều xanh.
   - **HTTP của máy chủ SSR (`seo-integration.check.mjs`, `built-server.check.mjs`).** Kiểm tra `/sitemap.xml` (`Cache-Control: no-store`, phản ánh ngay thay đổi duyệt/trả, `5xx` khi API lỗi), streaming tệp tĩnh + `Cache-Control` đúng cho `/assets/` và tệp gốc, đúng 1 stylesheet Google Fonts cho 3 họ phông chuẩn không có `Inter`.
   - **Giao diện, mật độ, bản nháp điểm và biểu mẫu (`apps/web/test/*.test.ts` + kiểm tra trình duyệt).** Kiểm tra mật khẩu mẫu chỉ có ở dev, vùng chạm ≥ `44 × 44 px` trên `/my` mobile (390×844), mật độ thu gọn trên `/admin` (1440×900), focus ring combobox (`>= 2px`, tương phản `>= 3:1`), khôi phục/xung đột `409`/kết quả lưu-nộp của bản nháp điểm chấm, và hồi quy `useAppForm`.

### Tiền lệ kiểm thử trong dự án (Prior Art)
- Kiểm thử đơn vị bộ lọc ngoại lệ, mã hồ sơ và báo cáo tại `apps/be/src/filters/api-exception.filter.spec.ts`, `apps/be/src/utils/reporting.spec.ts` và `apps/be/test/product-code.db-spec.ts`.
- Kiểm thử tích hợp DB cho quy trình duyệt/gỡ giám khảo, báo cáo, phân công, danh mục và đơn vị đăng ký tại `apps/be/test/workflow-issues-6-to-13.db-spec.ts`, `apps/be/test/admin-reports-dashboard.db-spec.ts`, `apps/be/test/assignment.db-spec.ts`, `apps/be/test/admin-catalogs.db-spec.ts`, `apps/be/test/registration-units.db-spec.ts`.
- Kiểm thử phía web tại `apps/web/test/product-draft-save.test.ts`, `apps/web/test/admin-reports-dashboard.test.ts`, `apps/web/test/seo-integration.check.mjs` và `apps/web/test/built-server.check.mjs`.

### Baseline trước triển khai

Hai lỗi dưới đây đã tái hiện ngày 18/11/2026 trên cây làm việc hiện tại với Node.js `v24.18.0`. Theo quy tắc baseline của dự án, cả hai lệnh phải chạy thành công trước khi bắt đầu triển khai đặc tả.

1. **Biểu mẫu bản nháp hồ sơ.** Ca `keeps hydrated values through re-renders and in-flight submission until reset is omitted before navigation` dừng với `test timed out after 8000ms`. Runner ghi nhận một ca bị hủy và mã thoát `1`. [Tệp kiểm thử](../../../apps/web/test/product-draft-save.test.ts)

   ```sh
   node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test --experimental-test-isolation=none --test-timeout=8000 --test-force-exit --test-name-pattern 'keeps hydrated values' apps/web/test/product-draft-save.test.ts
   ```

2. **SEO và SSR.** Vite dừng khi nạp `/src/entry-server.tsx` với `ReferenceError: module is not defined` (`ERR_AMBIGUOUS_MODULE_SYNTAX`) và mã thoát `1`. Lỗi xảy ra trước các kiểm tra hành vi sitemap. [Tệp kiểm thử](../../../apps/web/test/seo-integration.check.mjs)

   ```sh
   node apps/web/test/seo-integration.check.mjs
   ```

---

## Out of Scope

- Không thay đổi quy tắc tính điểm trung bình, ngưỡng xếp hạng sao OCOP hay quy trình chuyển trạng thái hồ sơ theo Quyết định 26/2026/QĐ-TTg (bao gồm 2 hành vi đã xác nhận: sản phẩm `SUBMITTED`/`SCORING` hiển thị công khai dù chưa có điểm và nộp hồ sơ không bắt buộc sẵn tệp ảnh/minh chứng).
- Không thay đổi cấu trúc biểu mẫu in ấn (Mẫu 01, phiếu chấm điểm, bảng tổng hợp kết quả).
- Không tách `AppModule` thành nhiều feature module ở đợt này (YAGNI); không xóa các endpoint cũ `/api/admin/judges` khi giao diện quản trị vẫn đang sử dụng; giữ nguyên hợp đồng mảng cho `GET /api/my/registration-units`.
- Cache xác thực giữa các yêu cầu, cache báo cáo, cache sitemap và hạ tầng cache hoặc hàng đợi phân tán nằm ngoài phạm vi đợt này.
- Không thiết kế lại giao diện trang công khai hoặc trang in ngoài phạm vi đã nêu.

---

## Further Notes

- Rà các thay đổi đang dở dang trong working tree trước khi triển khai để giữ phần sửa lỗi múi giờ Việt Nam (`Asia/Ho_Chi_Minh`), lọc báo cáo và các mục đã hoàn thành ở Task 1–3 của `backend-remediation-plan.md`.
- **Thứ tự triển khai 4 gói (kiểm chứng hồi quy sau mỗi gói)**:
  1. **Gói 0**: Hotfix lỗi logic ngầm, đồng bộ ràng buộc nghiệp vụ (địa bàn/sự kiện, đơn vị công tác, lý do trả 255 ký tự, `dashboardData` SQL, `computeComparisonDelta`, dữ liệu in, validation & xử lý lỗi) + cập nhật seed có thời gian sự kiện.
  2. **Gói A**: Bảo mật Auth/OTP (cooldown 60s, đăng ký lại chưa verify), singleton `env`, log `5xx`, ẩn Swagger & bỏ CDN, SSR streaming, gỡ `lodash`, phông chữ và mật khẩu mẫu dev.
  3. **Gói B**: Tối ưu Query, bỏ `Promise.all` trong interactive tx, thu hẹp `lockStaffMutation`, phân trang `/my/products` (BE + FE), đẩy tra cứu mã & sắp xếp xuống DB, thu hẹp báo cáo, bỏ truy vấn thừa, phân công theo lô, dọn OTP/pending_auth và bổ sung chỉ mục DB.
  4. **Gói C**: Tái sử dụng helper/select/DTO dùng chung, tách pure domain logic + `PrintDataService` + `AdminRepository` (4 miền), Nest DI cho filter/interceptor, dọn dead code + nhánh mock fallback, bật `strict: true` + `lint:check`, và hoàn thiện trải nghiệm FE theo vai trò (mật độ, bản nháp điểm chấm, `useAppForm`, tách component lớn).
