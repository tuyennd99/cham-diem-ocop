# Kịch bản kiểm thử (Test Cases) & Dữ liệu mẫu hệ thống chấm điểm OCOP

Tài liệu này cung cấp bộ dữ liệu mẫu điền sẵn và danh sách kịch bản kiểm thử chi tiết (End-to-End, Functional, Boundary, Negative & Security) để Tester kiểm thử trực tiếp trên ứng dụng web (`http://localhost:5173`) và đối chiếu với Backend (`http://localhost:3030/api`).

**Ngày đối chiếu mã nguồn: 25/10/2026.** Bộ gồm 66 ca: 6 E2E và 60 ca chi tiết. Các kết quả dưới đây là kỳ vọng kiểm thử, chưa phải kết quả đã chạy. Tài liệu mô tả hành vi hiện tại; riêng chênh lệch nghiệp vụ về giữ điểm khi đổi phạm vi được ghi tại ASG-03 để tiếp tục xác nhận.

---

## Phần I. Chuẩn bị môi trường & Bộ dữ liệu mẫu (Test Fixtures)

### 1.1. Kiểm tra điều kiện môi trường trước khi test

Chuẩn bị Node.js `>=24.7 <25`, pnpm theo `packageManager` trong `package.json`, PostgreSQL và database dành riêng cho đợt kiểm thử. Ghi commit/phiên bản triển khai, trình duyệt và tên database/schema vào nhật ký. Không chạy migrate/seed trên database vận hành để chuẩn bị test.

1. Từ thư mục gốc, chạy `pnpm install` nếu chưa cài dependency.
2. Nếu chưa có tệp cấu hình, sao chép `apps/be/.env.example` thành `apps/be/.env`, `apps/web/.env.example` thành `apps/web/.env`. Không ghi đè cấu hình đang có.
3. Trong cấu hình backend, đặt `DATABASE_URL` trỏ tới database kiểm thử, `JWT_SECRET` hợp lệ, cấu hình SMTP và thư mục lưu tệp. Giữ proxy frontend trỏ tới backend local nếu dùng các địa chỉ ở tài liệu.
4. Cấu hình SMTP bắt thư trong môi trường kiểm thử để đọc OTP cho email `@ocop.test`. Nếu dùng SMTP gửi thư thật, thay các email Chủ thể bằng địa chỉ hộp thư thật do tester quản lý và dùng nhất quán. Email `.test` không phải hộp thư công cộng.
5. Đặt `SEED_TEST_ACCOUNTS=true` cho phiên chạy seed. Có thể đặt `SEED_TEST_PASSWORD` từ 12 ký tự, tối đa 72 byte UTF-8; nếu bỏ trống, mật khẩu khi tạo mới tài khoản seed là `OcopTest@2026!`.

Chạy các lệnh sau từ thư mục gốc để tạo Prisma client, migrate và nạp danh mục:

```powershell
$env:SEED_TEST_ACCOUNTS = 'true'
pnpm --filter @ocop/api prisma generate
pnpm --filter @ocop/api prisma:migrate:deploy
pnpm --filter @ocop/api seed
Remove-Item Env:SEED_TEST_ACCOUNTS
pnpm dev
```

Kiểm tra nhanh trạng thái sẵn sàng:
- Mở `http://localhost:3030/api/system/health/ready` → trả về HTTP `200`.
- Mở `http://localhost:5173/api/categories` → trả về danh sách **26 phân loại sản phẩm** thuộc **6 nhóm ngành hàng**.
- Kiểm tra mở được trang đăng nhập, đăng nhập Admin seed và nhận được OTP qua hộp thư kiểm thử. Chưa đọc được OTP thì các ca đăng ký/quên mật khẩu là `BLOCKED`.

Seed không thay thế việc chuẩn bị fixture cho từng ca. Chạy lại seed không reset dữ liệu nghiệp vụ, không đổi mật khẩu tài khoản seed đã tồn tại; các thuộc tính như quyền/trạng thái của tài khoản seed có thể được cập nhật lại. Không chạy lại seed giữa các ca phân quyền.

### 1.2. Tài khoản seed và tài khoản tester tạo thêm

**Tài khoản có sẵn sau khi seed tạo mới** — cùng dùng `OcopTest@2026!`, trừ khi đã đặt `SEED_TEST_PASSWORD`:

| Vai trò / tổ hợp quyền | Email seed | Quyền nội bộ (`staffPermissions`) |
|---|---|---|
| Admin hệ thống | `admin@ocop.test` | `MANAGE`, `VIEW` |
| Admin kiêm chấm điểm | `admin.score@ocop.test` | `MANAGE`, `VIEW`, `SCORE` |
| Cán bộ chỉ xem | `viewer@ocop.test` | `VIEW` |
| Giám khảo kiêm xem dữ liệu | `viewer.score@ocop.test` | `VIEW`, `SCORE` |
| Giám khảo | `judge@ocop.test` | `SCORE` |
| Chủ thể seed, đã xác thực | `registrant@ocop.test` | Không có (`REGISTRANT`) |

Seed không gán đơn vị công tác theo bảng nghiệp vụ bên dưới. Nếu dùng tài khoản seed cho ca chấm/in có đơn vị, Admin phải gán đơn vị hoạt động trước. Không dùng `registrant@ocop.test` cho E2E-01 vì tài khoản đã tồn tại và đã xác thực.

**Tài khoản tạo thêm cho luồng E2E và các ca chi tiết:**

| Tên dùng trong kịch bản | Email | Mật khẩu mẫu | Quyền | Cách chuẩn bị |
|---|---|---|---|---|
| Giám khảo 1 (GK1) | `judge1@ocop.test` | `Judge1Ocop@2026!` | Chỉ `SCORE` | Admin tạo tại E2E-02, gán `SNNMT`. |
| Giám khảo 2 (GK2) | `judge2@ocop.test` | `Judge2Ocop@2026!` | Chỉ `SCORE` | Admin tạo tại E2E-02, gán `SCT`. |
| Chủ thể 1 | `htx.uminh@ocop.test` | `Chuthe@2026` | `REGISTRANT` | Đăng ký và xác thực tại E2E-01. |
| Chủ thể 2 | `trasen@ocop.test` | `Chuthe2@2026` | `REGISTRANT` | Đăng ký/xác thực riêng trước ca kiểm tra truy cập chéo. |

Giữ GK1/GK2 chỉ có `SCORE` để ca từ chối truy cập Admin/tệp ngoài phân công không bị quyền `VIEW` làm thay đổi kết quả. Dùng `viewer.score@ocop.test` khi kiểm tra `VIEW + SCORE`.

Trước lần chạy E2E đầu tiên, email Chủ thể 1 và hai giám khảo tạo thêm phải chưa tồn tại. Chạy lại bằng bộ email mới có hậu tố đợt chạy, rồi cập nhật ánh xạ trong nhật ký; không xóa dữ liệu cũ chỉ để tái sử dụng email. Các ca chi tiết dùng tài khoản đã tạo xong, mỗi ca có hồ sơ riêng; các ca đổi phân công cần tách bộ dữ liệu hoặc khôi phục cấu hình theo mục 1.7 vì phạm vi phân công áp dụng cho cả phân loại.

### 1.3. Dữ liệu danh mục mẫu (Đơn vị & Địa bàn)

**Đơn vị công tác (`/admin/users?tab=units`)**:
- Đơn vị 1: Mã `SNNMT` | Tên: `Sở Nông nghiệp và Môi trường` | Thứ tự: `1` | Trạng thái: `Đang hoạt động`
- Đơn vị 2: Mã `SCT` | Tên: `Sở Công Thương` | Thứ tự: `2` | Trạng thái: `Đang hoạt động`

Các đơn vị này được tạo tại E2E-02; nếu đã tồn tại thì dùng lại sau khi kiểm tra trạng thái, không tạo trùng mã. Ca tạo mới danh mục chạy riêng với mã có hậu tố đợt test.

**Địa bàn hành chính (`/admin/product-groups?tab=localities`)**:
- Địa bàn 1 (Đang hiệu lực): Mã `XP-UMINH-01` | Tên: `Xã Khánh An` | Loại: `COMMUNE` (Xã) | Tỉnh/TP: `Tỉnh Cà Mau` | Hiệu lực từ: `2020-01-01T00:00:00+07:00`
- Địa bàn 2 (Hết hiệu lực để test chặn): Mã `XP-CU-99` | Tên: `Xã Cũ Đã Sáp Nhập` | Loại: `COMMUNE` | Tỉnh/TP: `Tỉnh Cà Mau` | Hiệu lực đến: `2025-12-31T23:59:59+07:00`

Địa bàn hết hiệu lực được Admin tạo riêng. Để kiểm tra bản nháp cũ gắn địa bàn này: ban đầu cho địa bàn còn hiệu lực, tạo và lưu bản nháp có chọn địa bàn, sau đó Admin đặt ngày kết thúc về quá khứ. Không thể chọn địa bàn đã hết hiệu lực khi lập bản nháp mới.

### 1.4. Dữ liệu mẫu Hồ sơ sản phẩm (Mẫu số 01)

Sử dụng để nhập trên giao diện `/my/products/new` hoặc `/admin/registrations/new`:

- **Bước 1 — Đơn vị đăng ký**:
  - Địa bàn hành chính: `Xã Khánh An · Tỉnh Cà Mau`
  - Tỉnh/thành phố đăng ký: `Tỉnh Cà Mau`
  - Năm đăng ký (`assessmentYear`): `2026`
  - Tên chủ thể đăng ký (`entityName`): `Hợp tác xã Mật ong rừng U Minh Hạ`
  - Người đại diện theo pháp luật (`representativeName`): `Nguyễn Văn An`
  - Chức danh người đại diện (`representativeTitle`): `Giám đốc Hợp tác xã`
  - Địa chỉ liên hệ (`contactAddress`): `Ấp 3, Xã Khánh An, Huyện U Minh, Tỉnh Cà Mau`
  - Số điện thoại (`phone`): `0912345678`
  - Email liên hệ (`email`): `htx.uminh@ocop.test`
- **Bước 2 — Thông tin sản phẩm**:
  - Tên sản phẩm (`name`): `Mật ong rừng tràm U Minh nguyên chất 500ml`
  - Phân loại sản phẩm (`categoryId`): `Mật ong, mật khác và nông sản thực phẩm khác` (Mã: `honey-and-other-agri-food`, thuộc nhóm `Sản phẩm thực phẩm`)
  - Hình thức đăng ký (`registrationType`): `Đăng ký lần đầu` (`FIRST`)
  - Số lượng mẫu (`sampleQuantity`): `6`
  - Mô tả sản phẩm (`description`): `Mật ong khai thác tự nhiên từ rừng tràm U Minh Hạ, đóng chai thủy tinh 500ml, có truy xuất nguồn gốc QR và chứng nhận ATTP.`
- **Bước 3 — Cam kết và tệp**:
  - Tích chọn cam kết (`declarationAccepted`): `true` (Đã tích)
  - Tệp mẫu chuẩn bị trên máy test:
    1. `anh-chai-mat-ong.jpg` (Ảnh JPEG hợp lệ, dung lượng `< 2 MiB`)
    2. `giay-chung-nhan-attp.pdf` (Tệp PDF hợp lệ, dung lượng `< 5 MiB`)
    3. `file-qua-dung-luong.pdf` (Tệp bất kỳ `> 10 MiB` — dùng để test chặn lỗi `413`)
    4. `gia-mao.pdf` (File `.exe` hoặc `.txt` đổi đuôi thành `.pdf` — dùng để test chặn chữ ký file `415`)

### 1.5. Bảng lựa chọn điểm cho E2E-05 và E2E-06

Chọn đúng một mức có số điểm dưới đây cho từng mã tiểu tiêu chí của phân loại `honey-and-other-agri-food`. Nếu có nhiều mức cùng điểm, ghi nhãn mức đã chọn vào bằng chứng. Đây là dữ liệu kiểm thử phép tổng hợp, không phải hướng dẫn đánh giá chất lượng thực tế sản phẩm.

Bảng đối chiếu từ `apps/be/prisma/seed-data/criteria-sets-02-13.json`: 12 tiêu chí, 32 tiểu tiêu chí. Nếu bộ nguồn đã thay đổi so với bảng, dừng ca và cập nhật fixture theo phiên bản mới.

| Mã tiểu tiêu chí | GK1 (điểm) | GK2 (điểm) |
|---|---|---|
| `1.1` | 3 | 3 |
| `1.2` | 2 | 2 |
| `1.3` | 3 | 3 |
| `1.4` | 3 | 3 |
| `1.5` | 3 | 3 |
| `1.6` | 3 | 3 |
| `1.7` | 1 | 1 |
| `2.1` | 3 | 3 |
| `2.2` | 3 | 3 |
| `2.3` | 3 | 3 |
| `2.4` | 1 | 1 |
| `3.1` | 3 | 3 |
| `3.2` | 1 | 1 |
| `3.3` | 3 | 3 |
| `3.4` | 2 | 2 |
| `3.5` | 3 | 3 |
| `4.1` | 5 | 5 |
| `4.2` | 3 | 3 |
| `4.3` | 5 | 5 |
| `5.1` | 5 | 5 |
| `5.2` | 2 | 2 |
| `5.3` | 5 | 5 |
| `6.1` | 2 | 2 |
| `6.2` | 2 | 2 |
| `6.3` | 4 | 2 |
| `6.4` | 4 | 0 |
| `7` | 0 | 0 |
| `8` | 0 | 0 |
| `9` | 2 | 2 |
| `10` | 1 | 1 |
| `11` | 1 | 1 |
| `12` | 1 | 1 |
| **Tổng** | **82** | **76** |

### 1.6. Fixture đặc biệt và cách chuẩn bị

Các fixture dưới đây **không được tạo bởi lệnh seed mặc định**. Nhóm kỹ thuật chuẩn bị trong database kiểm thử bằng Prisma/fixture riêng và bàn giao ID, phiên bản dữ liệu cho tester; các giá trị thời gian phải đi cùng lịch sử trạng thái tương ứng. Chưa có fixture hoặc chưa có công cụ điều khiển lỗi mạng thì ghi `BLOCKED`, không tự đánh dấu đạt.

| Fixture | Ca sử dụng | Dữ liệu cần bàn giao |
|---|---|---|
| `CAT-INVALID` | CAT-01 | Hai phân loại riêng đang ngừng hoạt động, chưa có hồ sơ mở: một chưa có bộ tiêu chí, một có tổng tối đa 99. Dùng cách tạo fixture như `apps/be/test/admin-catalogs.db-spec.ts`; không sửa 26 bộ chuẩn. |
| `REP-CROSS` | REP-01 | Một hồ sơ hoàn tất, `submittedAt=2026-09-30T10:00:00+07:00`, `completedAt=2026-10-01T10:00:00+07:00`, finalScore=60, starRating=3; có các sự kiện nộp/hoàn tất đúng thời điểm. Tham khảo cách tạo lịch sử trong `apps/be/test/admin-reports-dashboard.db-spec.ts`. |
| `REP-LEGACY` | REP-02 | Một hồ sơ lịch sử đã nộp tháng 9/2026, không có localityId, mã/tên địa bàn tại nộp hoặc registrationSnapshot; thêm hai hồ sơ hoàn tất trong tháng 9, điểm 49 (2 sao) và 50 (3 sao). Không tạo hồ sơ lịch sử bằng thao tác nộp mới trên UI vì UI yêu cầu địa bàn. |
| `REP-BOUNDARY` | REP-03 | Hai hồ sơ: nộp/hoàn tất lần lượt `2026-09-30T23:59:59+07:00` và `2026-10-01T00:00:00+07:00`, có lịch sử tương ứng. Ghi ID để đối chiếu từng tập báo cáo. |
| `SCORE-OVERLAP` | SCORE-02 | Dữ liệu tổng hợp hai tiêu chí X/Y nêu trong ca; kiểm thử trực tiếp hàm `calculateFinalScore` hoặc DB riêng. Không thay cấu trúc Phần A/B/C của bộ phiếu chuẩn. |
| `SCORE-BOUNDARY` | SCORE-03 | Dùng hàm `calculateStars`/`formatExactScore` với các giá trị trong ca. Nếu kiểm tra giao diện, nhóm kỹ thuật bàn giao hồ sơ kết quả riêng có finalScore, starRating nhất quán; không sửa điểm một hồ sơ đã chấm thật. |
| `NET-UPLOAD` | FILE-06 | Công cụ chặn phản hồi upload sau khi máy chủ đã xử lý, hoặc mô phỏng 5xx; ghi điểm can thiệp. Nút Offline trước khi gửi chỉ chứng minh lỗi kết nối, chưa chứng minh tình huống đã lưu nhưng mất phản hồi. |
| `NET-CREATE` | FILE-07 | Cho `POST /api/my/products` đến máy chủ và tạo thành công, rồi ngắt phản hồi phía client; lưu ID phía máy chủ để đối chiếu số lượng hồ sơ. |

Kiểm tra biên tệp dùng kích thước byte chính xác: 10 MiB = 10485760 byte. Chuẩn bị tệp rỗng, tệp vượt 1 byte và tệp có đuôi/MIME đúng nhưng chữ ký sai. Tệp đúng 10 MiB phải có chữ ký đúng để kiểm tra dung lượng, không lẫn lỗi định dạng. Khi kiểm tra giới hạn 20 tệp qua API, chờ cửa sổ giới hạn upload 20 yêu cầu/phút hoặc dùng hồ sơ đã có sẵn tệp; không nhầm lỗi 429 với giới hạn số tệp.

### 1.7. Quy ước chạy và thu thập bằng chứng

- **UI**: thực hiện bằng giao diện, quan sát thông báo, trạng thái và Network. Nếu giao diện chặn trước khi gửi thì không gán mã HTTP cho ca đó.
- **API**: dùng Swagger tại `http://localhost:3030/docs` hoặc công cụ gửi HTTP. Đăng nhập đúng tài khoản, gửi Bearer token và lấy ID thật từ phản hồi; không dùng token trong URL hoặc đưa token vào ảnh/log chia sẻ. Với upload, dùng multipart trường `file`, không tự đặt boundary của Content-Type.
- **Hàm/DB**: ghi rõ ca dùng hàm tính toán hoặc fixture database. Kết quả của kiểm thử hàm không thay thế kiểm tra hiển thị trên trình duyệt.
- Mỗi điều kiện âm bắt đầu từ dữ liệu hợp lệ rồi chỉ thay một điều kiện. Ghi kết quả thực tế từng nhánh, mã HTTP nếu có và ID hồ sơ/phiếu liên quan.
- Phân công áp dụng cho cả phân loại; thay đổi tài khoản và danh mục cũng ảnh hưởng nhiều hồ sơ. Chạy các ca thay đổi phân công/trạng thái trong bộ dữ liệu tách biệt hoặc hoàn nguyên đúng cấu hình đã ghi trước ca. Không chạy song song các ca thay đổi cùng phân loại.
- Chạy E2E trên dữ liệu mới trước, sau đó chuẩn bị hồ sơ riêng cho từng nhóm ca. Ca bảo vệ Admin cuối cùng dùng môi trường chỉ có một MANAGE đang hoạt động/đã xác thực; seed thường tạo hai tài khoản MANAGE, nên không tự nhiên đáp ứng điều kiện này.
- Sau ca đổi mật khẩu, khóa tài khoản, đổi đơn vị, đổi địa bàn hoặc phân công, ghi lại thông tin mới và bàn giao/khôi phục dữ liệu trước ca tiếp theo. Không chạy seed để thay cho hoàn nguyên các ca đang thực hiện.

---

## Phần II. Kịch bản Luồng chuẩn xuyên suốt (End-to-End Happy Path)

Tester thực hiện tuần tự 6 bước dưới đây để nghiệm thu luồng chính từ đầu đến cuối:

| Bước | Vai trò | Màn hình / URL | Thao tác thực hiện | Kết quả kỳ vọng |
|---|---|---|---|---|
| **E2E-01** | Chủ thể 1 | `/register` → `/verify-otp` → `/login` | Đăng ký `htx.uminh@ocop.test`, lấy mã OTP 6 số, kích hoạt và đăng nhập. | Vào thẳng `/my/products`, hiển thị trạng thái *"Chưa có hồ sơ"*. |
| **E2E-02** | Admin | `/admin/users` & `/admin/product-groups` | Tạo đơn vị `SNNMT`, `SCT`; tạo địa bàn `Xã Khánh An`; tạo 2 tài khoản `judge1@ocop.test` và `judge2@ocop.test` có quyền `SCORE`. | 2 giám khảo xuất hiện trong danh sách với trạng thái `Đang hoạt động`, `Đã xác thực`. |
| **E2E-03** | Admin | `/admin/assignments` | Chọn `Giám khảo 1` + phân loại `Mật ong, mật khác...` + phạm vi `Toàn bộ tiêu chí` → Áp dụng. Lặp lại cho `Giám khảo 2` cùng phân loại → Nhấn **Lưu toàn bộ phân công**. | Phân loại `Mật ong...` báo độ phủ đầy đủ (0 tiêu chí thiếu), có 2 giám khảo phụ trách. |
| **E2E-04** | Chủ thể 1 | `/my/products/new` → `/my/products/:id` | Nhập dữ liệu mẫu mục `1.4`, đính kèm `anh-chai-mat-ong.jpg` + `giay-chung-nhan-attp.pdf` → **Lưu bản nháp** → Nhấn **Nộp hồ sơ**. | Hồ sơ chuyển từ `DRAFT` sang `SUBMITTED`, có ngày giờ nộp, khóa nút Sửa/Xóa. |
| **E2E-05** | Giám khảo 1 | `/judge` → `/judge/products/:id` | Mở hồ sơ `Mật ong rừng tràm...`, xem ảnh & PDF minh chứng. Chọn mức điểm cho đủ 32 tiểu tiêu chí theo cột GK1 ở mục `1.5`, tổng `82` điểm → **Lưu bản nháp** → **Nộp phiếu chấm**. | Sau khi lưu nháp: sản phẩm sang `SCORING`. Sau khi nộp: phiếu của GK1 khóa chỉ đọc (`SUBMITTED`), tổng điểm phiếu = `82`, nhưng sản phẩm **vẫn ở `SCORING`** (vì chờ GK2). |
| **E2E-06** | Giám khảo 2 | `/judge` → `/judge/products/:id` | Đăng nhập `judge2@ocop.test`, mở cùng hồ sơ, chấm đủ 32 tiểu tiêu chí theo cột GK2 ở mục `1.5`, tổng `76` điểm → **Nộp phiếu chấm**. | Ngay khi GK2 nộp xong: sản phẩm tự động chuyển sang **`COMPLETED`**, `finalScore = (82 + 76) / 2 = 79` điểm, `starRating = 4` (4 sao). Cả Chủ thể (`/my/products/:id`), Admin (`/admin/products/:id`) và Trang công khai (`/products/:id`) đều hiển thị **79 điểm · 4 sao**. |

---

## Phần III. Kịch bản kiểm thử chi tiết theo 10 phân nhóm

### Nhóm 1: Xác thực, OTP & Quản lý phiên (`AUTH`)

| Mã TC | Tên kịch bản | Điều kiện tiên quyết | Các bước thực hiện | Kết quả kỳ vọng |
|---|---|---|---|---|
| **AUTH-01** | Chặn đăng nhập khi chưa xác thực OTP | Vừa gửi form `/register` nhưng chưa nhập OTP. | Mở `/login`, nhập email và mật khẩu vừa đăng ký. | Báo lỗi tài khoản chưa xác thực (HTTP `401`/`403`), không cấp JWT, không vào được `/my/products`. |
| **AUTH-02** | OTP sai định dạng, sai mã và hết hạn (UI/API) | Tài khoản chưa xác thực; lấy được OTP từ hộp thư test. Mỗi nhánh có mã mới để tránh ảnh hưởng số lần thử. | UI: nhập 5 số hoặc dán `12345a`, kiểm tra ký tự chữ bị lọc và không thể gửi mã thiếu số.<br>API: gửi `code=12345a` tới `POST /api/auth/verify-otp`; tiếp theo thử mã 6 số chắc chắn khác mã đã nhận; cuối cùng chờ mã mới quá 5 phút rồi gửi. | UI chặn mã thiếu số trước khi gọi API, không bắt buộc một chuỗi thông báo của trình duyệt.<br>API: sai định dạng trả `400`; sai mã/hết hạn trả `401`. Không kích hoạt tài khoản. |
| **AUTH-03** | Đếm ngược gửi lại OTP và giới hạn API | Vừa đăng ký và tự chuyển sang `/verify-otp`; bộ đếm rate limit mới, cùng địa chỉ IP. | UI: kiểm tra nút bị khóa 60 giây, đợi hết rồi gửi lại.<br>API độc lập: dùng email đang chờ xác thực, gửi 4 yêu cầu `POST /api/auth/resend-otp` cùng IP trong 15 phút. Không tính lẫn lượt thử UI; dùng phiên backend kiểm thử mới nếu bộ đếm đã bị dùng. | UI hiện thời gian chờ và cho gửi lại khi hết đếm ngược.<br>API nhận tối đa 3 yêu cầu trong cửa sổ; yêu cầu thứ 4 trả `429`. Không thể bấm liên tiếp trên UI khi nút đã bị khóa. |
| **AUTH-04** | Biên mật khẩu 72 byte UTF-8 (UI/API) | Mở `/register` bằng email mới; khi thử đổi mật khẩu dùng mật khẩu hiện tại hợp lệ. | Tạo chuỗi `Đ` lặp 36 lần (36 ký tự, 72 byte) và 37 lần (37 ký tự, 74 byte). Kiểm tra từng chuỗi qua UI và gửi trực tiếp API đăng ký bằng email khác nhau. | Chuỗi 72 byte vượt qua kiểm tra độ dài; chuỗi 74 byte bị UI chặn trước khi gửi, hoặc API từ chối `400` nếu gửi trực tiếp. Không dùng ví dụ cũ `ĐặngThịHồngNhung_ĐặngThịHồngNhung_12345678`: chuỗi đó chỉ có 56 byte. |
| **AUTH-05** | Đổi mật khẩu: nhập sai mật khẩu hiện tại (Ngoại lệ giữ phiên) | Đang đăng nhập hợp lệ, mở `/account/password`. | Nhập `currentPassword` sai, `newPassword` hợp lệ → Nhấn Lưu. | BE trả `401` với message `Current password is incorrect`. **Phiên đăng nhập hiện tại KHÔNG bị xóa**, người dùng vẫn ở lại trang `/account/password` để nhập lại. |
| **AUTH-06** | Đổi mật khẩu thành công thu hồi toàn bộ phiên cũ | Cùng Chủ thể đăng nhập ở hai trình duyệt hoặc hai hồ sơ trình duyệt độc lập; lưu token B để kiểm tra API. | A đổi mật khẩu tại `/account/password`.<br>B tải lại `/my/products` để phát sinh yêu cầu được bảo vệ; gọi thêm `GET /api/auth/me` bằng token B cũ. | A xóa phiên và về `/login`. Yêu cầu được bảo vệ của B bị `401` vì token cũ đã bị thu hồi; giao diện yêu cầu đăng nhập lại. Không coi việc hai tab dùng chung bộ nhớ tự đăng xuất là bằng chứng đủ cho thu hồi token phía server. |
| **AUTH-07** | Quên mật khẩu và đặt lại bằng OTP | Tài khoản đã kích hoạt. | Vào `/forgot-password`, nhập email → nhận OTP → nhập OTP + mật khẩu mới → Đăng nhập bằng mật khẩu cũ và mật khẩu mới. | Mật khẩu cũ bị từ chối; mật khẩu mới đăng nhập thành công; mọi JWT cũ bị thu hồi. |

---

### Nhóm 2: Phân quyền tổ hợp & Quản trị người dùng (`RBAC` & `USR`)

| Mã TC | Tên kịch bản | Điều kiện tiên quyết | Các bước thực hiện | Kết quả kỳ vọng |
|---|---|---|---|---|
| **RBAC-01** | Quyền `MANAGE` tự động bao hàm `VIEW` nhưng không tự có `SCORE` | Đăng nhập Admin (`MANAGE`, `VIEW`). | 1. Mở `/admin/users` tạo mới nhân sự, tích chọn ô `Quản lý (MANAGE)`.<br>2. Kiểm tra danh sách giám khảo ở `/admin/assignments`. | 1. Ô `Xem dữ liệu (VIEW)` tự động được bao hàm; ô `Chấm điểm (SCORE)` vẫn để trống nếu không tích.<br>2. Tài khoản chỉ có `MANAGE + VIEW` **không xuất hiện** trong dropdown chọn Giám khảo chấm điểm. |
| **RBAC-02** | Tài khoản kiêm nhiệm `MANAGE + SCORE` | Admin cấp cả `MANAGE` và `SCORE` cho 1 tài khoản. | Đăng nhập tài khoản đó, kiểm tra thanh menu bên trái (Sidebar) và thử chấm điểm. | Sidebar hiển thị đầy đủ các phân hệ Quản trị **VÀ** có thêm mục **Hồ sơ được phân công** (`/judge`). Vào `/judge` chấm và nộp phiếu hoạt động bình thường. |
| **RBAC-03** | Tài khoản chỉ có quyền `VIEW` (Chỉ đọc & Ẩn bản nháp) | Đăng nhập `viewer@ocop.test` (chỉ có `VIEW`). | 1. Quan sát Sidebar.<br>2. Gõ trực tiếp URL `/admin/users` hoặc `/admin/registrations/new`.<br>3. Mở `/admin/products` và `/admin/registrations` khi hệ thống đang có hồ sơ `DRAFT`. | 1. Không có menu **Người dùng**.<br>2. Bị chặn chuyển hướng sang `/403` (Forbidden).<br>3. Danh sách chỉ hiển thị hồ sơ `SUBMITTED`, `SCORING`, `COMPLETED`; **tuyệt đối không thấy hồ sơ `DRAFT`** và không có nút Thêm/Sửa/Xóa/Lưu phân công. |
| **RBAC-04** | Chặn Chủ thể (`REGISTRANT`) và Giám khảo (`SCORE` đơn lẻ) vào trang Admin | Đăng nhập `htx.uminh@ocop.test` hoặc `judge1@ocop.test`. | Gõ trực tiếp `/admin`, `/admin/products`, `/admin/reports` trên thanh địa chỉ. | Chuyển hướng sang `/403`; các API `/api/admin/*` trả về HTTP `403 Forbidden`. |
| **RBAC-05** | VIEW + SCORE ngoài phân công | Dùng viewer.score@ocop.test đã gán đơn vị; không được giao phân loại hồ sơ đã nộp của Chủ thể 1. Có một phiếu nháp và một phiếu đã nộp của người khác. | Mở chi tiết/tệp hồ sơ qua khu vực Admin; gọi tuyến judge cho cùng hồ sơ. Xem/in nháp người khác rồi phiếu đã nộp qua tuyến admin. | Quyền VIEW cho phép đọc hồ sơ đã nộp, PDF và phiếu đã nộp qua Admin dù không được giao chấm. Tuyến judge từ chối ngoài phân công (`403`); không được xem nháp người khác, không được sửa dữ liệu quản trị chỉ bằng VIEW. Không áp dụng kỳ vọng SCORE đơn lẻ cho tài khoản kiêm VIEW. |
| **USR-01** | Bắt buộc nhập Lý do (Audit Reason) khi thao tác quản trị | Đăng nhập Admin (`MANAGE`), mở `/admin/users`. | Mở hộp thoại sửa thông tin/quyền/trạng thái hoặc reset mật khẩu của 1 tài khoản, để trống ô **Lý do thao tác** rồi nhấn Lưu. | Hệ thống chặn lưu, yêu cầu nhập lý do phục vụ lịch sử kiểm toán. |
| **USR-02** | Bảo vệ Quản trị viên cuối cùng của hệ thống | Hệ thống chỉ còn duy nhất 1 tài khoản đang hoạt động có quyền `MANAGE`. | Mở `/admin/users`, chọn chính tài khoản Admin đó → thử bỏ tích quyền `MANAGE` hoặc chuyển trạng thái sang **Đã khóa**. | BE từ chối thao tác (HTTP `400`/`409`), không cho phép làm hệ thống mất admin cuối cùng. |
| **USR-03** | Chặn khóa hoặc gỡ SCORE khi còn hồ sơ mở | GK1 chỉ có `SCORE`, đang được phân công phân loại có hồ sơ `SUBMITTED`/`SCORING`; có token GK1 còn hiệu lực. | Admin thử khóa GK1; tiếp theo thử đổi quyền sang chỉ `VIEW`. Kiểm tra lại người dùng, phân công và gọi API bằng token GK1. | Cả hai thao tác bị `409`, thông báo `Reassign open products before removing scoring access`. Tài khoản, quyền và phân công giữ nguyên; thao tác bị từ chối không thu hồi token. Kiểm tra thu hồi phiên sau thay đổi hợp lệ tại USR-04. |
| **USR-04** | Thay đổi quyền hợp lệ thu hồi phiên cũ | Giám khảo riêng chỉ SCORE, có đơn vị hoạt động, đang đăng nhập; mọi phân loại được giao không còn hồ sơ mở. Lưu token cũ. | Admin khóa tài khoản hoặc đổi sang chỉ VIEW, nhập lý do. Gọi GET /api/auth/me bằng token cũ; kiểm tra phân công và đăng nhập mới theo trạng thái sau thay đổi. | Thay đổi thành công, token cũ bị `401`, phân công SCORE bị gỡ. Tài khoản khóa không đăng nhập mới được; tài khoản chỉ VIEW đang hoạt động đăng nhập mới và chỉ dùng chức năng VIEW. Chạy hai nhánh trên tài khoản riêng hoặc khôi phục trạng thái giữa hai nhánh. |

---

### Nhóm 3: Danh mục Đơn vị, Nhóm sản phẩm & Địa bàn (`CAT` & `LOC`)

| Mã TC | Tên kịch bản | Điều kiện tiên quyết | Các bước thực hiện | Kết quả kỳ vọng |
|---|---|---|---|---|
| **CAT-01** | Không kích hoạt phân loại có bộ tiêu chí lỗi (Tổng ≠ 100) | Dùng fixture `CAT-INVALID` ở mục 1.6; phân loại riêng đang ngừng hoạt động, chưa có hồ sơ mở. | Admin mở phân loại riêng trên `/admin/product-groups`, thử kích hoạt khi chưa có bộ tiêu chí hoặc tổng tối đa khác 100. | Hệ thống từ chối kích hoạt; trạng thái cũ được giữ, phân loại không xuất hiện cho đăng ký mới. Không sửa bộ tiêu chí chuẩn đang dùng để tạo điều kiện lỗi. |
| **CAT-02** | Ngừng sử dụng phân loại sản phẩm khi đang có bản nháp và hồ sơ đã nộp | Phân loại A đang có Hồ sơ 1 (`DRAFT`) và Hồ sơ 2 (`SUBMITTED`). | 1. Admin vào `/admin/product-groups`, chuyển Phân loại A sang **Ngừng sử dụng**.<br>2. Chủ thể mở `/my/products/new` tạo hồ sơ mới.<br>3. Chủ thể mở Hồ sơ 1 (`DRAFT`) và bấm **Nộp hồ sơ**.<br>4. Giám khảo mở Hồ sơ 2 (`SUBMITTED`) để chấm điểm. | 1. Lưu thành công.<br>2. Phân loại A không còn xuất hiện khi tạo mới.<br>3. Hồ sơ 1 (`DRAFT`) vẫn mở xem/sửa được nhưng **bị chặn khi bấm Nộp** (yêu cầu đổi sang phân loại đang hoạt động).<br>4. Hồ sơ 2 (`SUBMITTED`) vẫn chấm điểm và ra kết quả bình thường. |
| **LOC-01** | Kiểm tra khoảng thời gian hiệu lực của Địa bàn (`effectiveFrom` / `effectiveTo`) | Có Địa bàn 2 (`XP-CU-99`) đã hết hiệu lực (`effectiveTo` trong quá khứ). | Chủ thể mở `/my/products/new` (Bước 1), tìm địa bàn `XP-CU-99`. | Địa bàn hết hiệu lực không nằm trong danh sách cho phép chọn mới. Nếu bản nháp cũ đang gắn địa bàn này, UI hiện cảnh báo *"Địa bàn đã ngừng hoạt động hoặc hết hiệu lực"* và chặn nộp cho tới khi chọn địa bàn hiệu lực. |
| **SNAP-01** | Bảo toàn Snapshot Đơn vị của Giám khảo và Địa bàn của Hồ sơ sau khi nộp | Hồ sơ đã nộp tại `Xã Khánh An`; GK1 thuộc `Sở Nông nghiệp` đã nộp phiếu chấm. | 1. Admin đổi tên `Xã Khánh An` thành `Phường Khánh An Mới`.<br>2. Admin chuyển GK1 sang đơn vị `Sở Công Thương`.<br>3. Mở xem và in lại Phiếu đăng ký + Phiếu chấm đã nộp. | Bản in và chi tiết lịch sử vẫn giữ nguyên tên **`Xã Khánh An`** và đơn vị **`Sở Nông nghiệp`** tại đúng thời điểm nộp (không làm sai lệch hồ sơ lịch sử). |

---

### Nhóm 4: Lập hồ sơ Chủ thể & Admin nhập hộ (`REG`)

| Mã TC | Tên kịch bản | Điều kiện tiên quyết | Các bước thực hiện | Kết quả kỳ vọng |
|---|---|---|---|---|
| **REG-01** | Lưu bản nháp khi mới nhập tối thiểu (Tên + Phân loại) | Đăng nhập Chủ thể, mở `/my/products/new`. | Để trống toàn bộ Bước 1 và Bước 3; chỉ sang Bước 2 nhập **Tên sản phẩm** và chọn **Phân loại** → nhấn **Lưu bản nháp**. | Lưu thành công hồ sơ `DRAFT` (cho phép `sampleQuantity = 0`, chưa tích cam kết, chưa chọn địa bàn). |
| **REG-02** | Mở trực tiếp URL sửa bản nháp, F5 tải lại và sửa 1 trường không mất trường khác | Đã có bản nháp điền đủ 3 bước tại `/my/products/:id/edit`. | 1. Nhấn `F5` (Reload) trực tiếp tại URL `/my/products/:id/edit`.<br>2. Chỉ sửa mỗi trường **Số lượng mẫu** từ `6` thành `10` rồi nhấn Lưu. | 1. Trang tải đúng dữ liệu từ `GET /my/products/:id`.<br>2. Sau khi lưu, toàn bộ các trường ở Bước 1, Bước 2, Bước 3 vẫn còn nguyên vẹn (FE gửi đủ object `formData`, không làm rỗng các trường khác). |
| **REG-03** | Chặn nộp khi thiếu từng điều kiện bắt buộc | Sao chép dữ liệu hợp lệ mục 1.4 vào các bản nháp riêng; mỗi lần chỉ bỏ một điều kiện. | Bỏ lần lượt địa bàn; từng trường bắt buộc trong 5 trường chủ thể/đại diện/chức danh/địa chỉ/tỉnh; cả phone và email; số lượng mẫu đặt 0; cam kết bỏ tích.<br>Kiểm tra UI, rồi gửi trực tiếp `POST /api/my/products/:id/submit` cho từng bản nháp. Biên năm/số lượng ngoài khoảng thử qua API tạo/cập nhật. | UI hiển thị lỗi hoặc thông báo máy chủ theo bước kiểm tra; không buộc có yêu cầu nếu bị chặn trước.<br>API nộp trả `400` cho từng bản nháp thiếu điều kiện, trạng thái vẫn `DRAFT`. API tạo/cập nhật từ chối năm ngoài 2020–2100, số lượng ngoài 0–100000 hoặc không nguyên; khi nộp số lượng phải từ 1. |
| **REG-04** | Chặn sửa/xóa sau khi đã nộp (kể cả từ tab trình duyệt mở sẵn trước đó) | Mở cùng 1 bản nháp trên Tab 1 (`/my/products/:id`) và Tab 2 (`/my/products/:id/edit`). | 1. Trên Tab 1: nhấn **Nộp hồ sơ** → thành công (`SUBMITTED`).<br>2. Quay sang Tab 2 (vẫn đang mở form sửa cũ): bấm **Lưu bản nháp** hoặc xóa tệp đính kèm. | Tab 2 nhận lỗi `409 Conflict` (*"Only draft products can be changed"*), dữ liệu đã nộp không bị ghi đè. Khi reload Tab 2, hệ thống hiện thông báo *"Hồ sơ không còn ở trạng thái bản nháp nên không thể sửa"*. |
| **REG-05** | Admin (`MANAGE`) nhập hộ hồ sơ cho Chủ thể | Đăng nhập Admin, mở `/admin/registrations/new`. | 1. Thử bấm Lưu khi chưa chọn Chủ thể hoặc chưa nhập Lý do thao tác.<br>2. Chọn Chủ thể `htx.uminh@ocop.test`, nhập lý do *"Nhập hộ hồ sơ giấy"*, điền thông tin và Lưu.<br>3. Đăng nhập lại bằng tài khoản Chủ thể `htx.uminh@ocop.test`, mở `/my/products`. | 1. Bị chặn, nhắc chọn chủ thể và nhập lý do.<br>2. Tạo bản nháp thành công, ghi nhận người tạo là Admin nhưng chủ sở hữu (`registrantId`) là Chủ thể.<br>3. Chủ thể nhìn thấy hồ sơ đó trong `/my/products` của mình. |
| **REG-06** | Nâng hạng và đánh giá lại tạo hồ sơ mới | Chủ thể có hồ sơ `COMPLETED` đạt 3 sao; ghi ID, điểm và sao cũ. | Thực hiện hai lần độc lập: tạo hồ sơ cùng tên với `UPGRADE`, rồi hồ sơ khác với `REASSESSMENT`, dùng dữ liệu hợp lệ và nộp. | Mỗi hồ sơ có ID mới độc lập; loại đăng ký được lưu/in đúng. Hồ sơ cũ giữ nguyên điểm, sao và lịch sử. Không coi lựa chọn loại đăng ký là thao tác sửa hồ sơ cũ. |

---

### Nhóm 5: Tệp đính kèm & Bảo mật file private (`FILE`)

| Mã TC | Tên kịch bản | Điều kiện tiên quyết | Các bước thực hiện | Kết quả kỳ vọng |
|---|---|---|---|---|
| **FILE-01** | Upload hợp lệ ảnh (`.jpg`, `.png`, `.webp`, `.gif`) và tài liệu `.pdf` | Đang tạo/sửa bản nháp. | Chọn 1 ảnh `.jpg` và 1 file `.pdf` (mỗi file `< 10 MiB`) → Lưu bản nháp → Bấm mở từng tệp ở trang chi tiết. | Ảnh phân loại là `IMAGE`, PDF phân loại là `EVIDENCE`; bấm mở tệp hiển thị đúng nội dung gốc. |
| **FILE-02** | Chặn dung lượng và số tệp tại giao diện | Bản nháp riêng; có tệp đúng MIME nhưng lớn hơn 10485760 byte; hồ sơ khác đã có 19 tệp. | Chọn tệp quá dung lượng rồi lưu. Thử lưu 21 tệp; với hồ sơ đã có 19 tệp, chọn thêm 2. Quan sát Network. | UI chặn với thông báo dung lượng/số lượng, không gửi yêu cầu tạo/cập nhật/upload khi kiểm tra trước khi lưu thất bại. Hồ sơ/tệp cũ giữ nguyên. Không kỳ vọng HTTP `413` ở nhánh UI chưa gửi yêu cầu; kiểm tra API tại FILE-05. |
| **FILE-03** | Tải nhiều tệp: lỗi xác định 4xx và thử lại cùng bản nháp | Chọn hai tệp đúng đuôi/MIME/kích thước; tệp 1 hợp lệ, tệp 2 có đuôi `.pdf` nhưng chữ ký sai để máy chủ từ chối. | Lưu bản nháp; tệp 1 nhận thành công, tệp 2 bị `415`. Ghi ID hồ sơ và ID tệp 1. Thay tệp 2 bằng PDF hợp lệ rồi lưu lại. | Hồ sơ và tệp 1 giữ nguyên ID, không có bản nháp thứ hai. Sau lỗi xác định, chỉ tệp chưa nhận còn trong danh sách chờ; sau khi sửa/chọn lại chỉ tải phần còn thiếu. Lỗi mạng/5xx kiểm tra riêng tại FILE-06. |
| **FILE-04** | Chặn tải PDF trái phép theo đúng tuyến truy cập | Hồ sơ đã nộp của Chủ thể 1 có PDF; Chủ thể 2 đã xác thực; GK1 chỉ SCORE và không được phân công phân loại hồ sơ. | Không token: gọi `/api/my/products/:id/attachments/:attachmentId` và tuyến công khai `/api/products/:id/attachments/:attachmentId`.<br>Token Chủ thể 2: gọi tuyến my.<br>Token GK1: gọi `/api/judge/products/:id/attachments/:attachmentId`.<br>Đối chiếu bằng Chủ thể 1, giám khảo được giao và VIEW qua tuyến admin. | Không token trên tuyến my: `401`; PDF trên tuyến công khai: `404`.<br>Chủ thể khác qua tuyến my: `404`; SCORE ngoài phân công qua tuyến judge: `403`. Các chủ thể được phép tải thành công qua Bearer token. VIEW xem hồ sơ đã nộp qua `/api/admin/products/:id/attachments/:attachmentId`; trường hợp VIEW + SCORE kiểm tra RBAC-05. |
| **FILE-05** | API kiểm tra dung lượng, chữ ký và giới hạn số tệp | Token Chủ thể sở hữu bản nháp; fixture tệp mục 1.6; bản nháp khác đã có 20 tệp. | Gửi trực tiếp POST /api/my/products/:id/attachments: tệp >10485760 byte; tệp PDF có chữ ký sai nhưng đuôi/MIME đúng; tệp rỗng; tệp hợp lệ thứ 21. Dùng tệp đúng 10485760 byte, chữ ký hợp lệ để kiểm tra biên chấp nhận. | Quá dung lượng trả `413`; sai chữ ký/tệp rỗng trả `415`; tệp thứ 21 trả `409`, số tệp vẫn 20. Tệp đúng 10 MiB được nhận nếu các điều kiện khác hợp lệ. Không có bản ghi attachment mới cho các yêu cầu bị từ chối; phân biệt 429 do rate limit với lỗi số lượng. |
| **FILE-06** | Upload bị mất phản hồi hoặc 5xx: kiểm tra trước khi chọn lại | Fixture NET-UPLOAD, hai tệp hợp lệ; tệp 1 đã tải thành công. | Làm kết quả upload tệp 2 không xác định; quan sát thông báo/nút Lưu. Khôi phục kết nối, mở liên kết kiểm tra hồ sơ, đối chiếu tệp máy chủ đã nhận rồi mở lại bản nháp và chỉ chọn phần thiếu. Chạy nhánh mất phản hồi và 5xx riêng. | Không tự thử lại; nút Lưu bị khóa trong trạng thái cần kiểm tra, danh sách tệp chờ được bỏ để tránh gửi trùng. Giữ ID hồ sơ/tệp đã lưu. Nếu máy chủ đã nhận tệp 2 thì không tải lại tệp đó; nếu chưa nhận, chọn lại sau khi kiểm tra. Không tạo bản nháp thứ hai. |
| **FILE-07** | Mất phản hồi sau khi tạo hồ sơ | Fixture NET-CREATE; tên hồ sơ có hậu tố duy nhất của đợt test; ghi số hồ sơ trước ca. | Nhấn Lưu bản nháp, cho máy chủ tạo Product rồi chặn phản hồi. Thử bấm Lưu lần nữa. Khôi phục kết nối và mở Hồ sơ của tôi để tìm tên/ID đã tạo. | UI báo chưa xác định kết quả tạo và chặn tạo lại trên form cũ. Chỉ có một Product mới, chưa tự tải tệp khi chưa nhận ID. Người dùng kiểm tra danh sách, mở lại bản nháp đã tạo và tiếp tục; không tự tạo thêm bản ghi. |

---

### Nhóm 6: Phân công giám khảo & Thay đổi phân công động (`ASG`)

| Mã TC | Tên kịch bản | Điều kiện tiên quyết | Các bước thực hiện | Kết quả kỳ vọng |
|---|---|---|---|---|
| **ASG-01** | Cảnh báo phân công thiếu độ phủ khi chưa có hồ sơ mở | Phân loại mật ong không có hồ sơ SUBMITTED/SCORING; mọi phân loại khác có hồ sơ mở đã phủ đủ tiêu chí. | GK1 chỉ được giao tiêu chí mã `1` và `2`; áp dụng vào bảng tạm, lưu và tải lại. Sau đó nộp một hồ sơ mới thuộc phân loại này, GK1 chấm và nộp đủ phần được giao. | Bảng tạm cảnh báo thiếu các tiêu chí `3`–`12`. Có thể lưu vì chưa có hồ sơ mở tại thời điểm lưu. Sau khi có hồ sơ và GK1 nộp phần được giao, sản phẩm vẫn SCORING, finalScore/starRating chưa có vì thiếu độ phủ. Khôi phục phân công đầy đủ trước ca khác. |
| **ASG-02** | Bảo toàn phân công của các nhóm khác khi đang bật bộ lọc | Hệ thống đang có phân công ở cả nhóm `Thực phẩm` và nhóm `Đồ uống`. | Tại `/admin/assignments`, lọc chỉ hiển thị nhóm `Thực phẩm` → thêm/sửa 1 giám khảo trong nhóm `Thực phẩm` → nhấn **Lưu toàn bộ phân công**. | Sau khi lưu và bỏ bộ lọc, toàn bộ phân công của nhóm `Đồ uống` vẫn còn nguyên vẹn (FE ghép thay đổi vào danh sách gốc trước khi gửi `PUT /admin/assignments`). |
| **ASG-03** | Đổi phạm vi thực sự trên phiếu nháp: ghi nhận hành vi hiện tại | GK1 được giao tiêu chí `1`–`12` và đã lưu điểm/ghi chú ở tiêu chí `1`, `2`. GK2 chưa có phiếu nộp. | Trong cùng lần lưu, đổi GK1 còn tiêu chí `1`; giao GK2 các tiêu chí `2`–`12` để giữ đủ độ phủ. Lưu rồi GK1 tải lại phiếu. | Lưu thành công; toàn bộ điểm và ghi chú nháp của GK1 bị xóa, kể cả điểm tiêu chí `1` còn thuộc phạm vi. Phiếu vẫn IN_PROGRESS, total=null và chỉ hiển thị phạm vi mới để chấm lại. Yêu cầu giữ điểm còn trong phạm vi được ghi riêng bên dưới, chưa coi là hành vi đã có. |
| **ASG-04** | Chặn đổi phạm vi/gỡ người đã nộp trên hồ sơ mở | Hồ sơ SCORING; GK1 đã nộp, GK2 chưa nộp; cả hai đang được giao toàn bộ. | Thử gỡ GK1 hoặc thu hẹp GK1 còn tiêu chí `1`, vẫn giữ GK2 toàn bộ để không vi phạm độ phủ; lưu từng lần. | API trả `409` với `Cannot change criteria for a submitted evaluation`. Phân công và phiếu đã nộp giữ nguyên. Không dùng cấu hình thiếu độ phủ vì sẽ gặp lỗi khác trước kiểm tra phiếu đã nộp. |
| **ASG-05** | Tự động hoàn tất (`COMPLETED`) ngay khi gỡ giám khảo chưa nộp thừa | Phân loại có GK1 và GK2 cùng chấm toàn bộ. GK1 đã nộp phiếu đạt `80` điểm (cột GK1 mục 1.5, đổi `6.3` từ 4 xuống 2); GK2 chưa nộp (hồ sơ đang `SCORING`). | Admin vào `/admin/assignments`, gỡ phân công của GK2 (lúc này chỉ còn GK1 đã phủ đủ 100% tiêu chí và đã nộp) → nhấn Lưu. | Trong cùng transaction lưu phân công, hệ thống tự động tính lại kết quả: hồ sơ chuyển ngay sang **`COMPLETED`** với `finalScore = 80`, `starRating = 4`. |
| **ASG-06** | Lưu thiếu độ phủ khi đã có hồ sơ mở phải rollback | Có hồ sơ SUBMITTED/SCORING thuộc mật ong, GK1 toàn bộ; các phân loại mở khác đã phủ đủ. Ghi phân công cũ. | Đổi GK1 chỉ còn tiêu chí mã `1`, không giao `2`–`12` cho ai; bấm Lưu toàn bộ phân công. | API trả `409`, thông báo phân công chưa phủ đủ tiêu chí. Tải lại vẫn thấy phân công cũ; điểm/phiếu nháp và trạng thái sản phẩm không bị thay đổi. Phải phủ đủ trước khi lưu được. |
| **ASG-07** | Phạm vi tương đương không xóa điểm nháp | GK1 toàn bộ, có điểm và ghi chú đã lưu ở tiêu chí `1`, `2`; chưa nộp phiếu. | Đổi từ Toàn bộ sang chọn đủ `1`–`12`, lưu; đổi thứ tự danh sách đủ qua API, lưu; cuối cùng đổi về Toàn bộ. Tải lại sau mỗi lần. | Các thay đổi có cùng tập tiêu chí không xóa điểm hoặc ghi chú. Chỉ thay đổi tập tiêu chí thực sự mới reset theo ASG-03. |

---

> **Điểm cần xác nhận nghiệp vụ (ASG-03):** Bản tài liệu trước yêu cầu giữ điểm nháp của các tiêu chí còn trong phạm vi mới. Mã nguồn hiện reset toàn bộ phiếu nháp bị đổi phạm vi (`apps/be/src/repositories/admin.repository.ts`, hàm `replaceAssignments`); bài kiểm thử `apps/be/test/assignment.db-spec.ts` cũng kỳ vọng reset. ASG-03 ghi nhận hiện trạng để kiểm tra hồi quy, không xác nhận yêu cầu giữ điểm đã được đáp ứng. Nếu nghiệp vụ yêu cầu giữ điểm, ghi nhận chênh lệch này thành yêu cầu thay đổi riêng và cập nhật kỳ vọng sau khi được chốt.

### Nhóm 7: Giám khảo chấm điểm (`JDG`)

| Mã TC | Tên kịch bản | Điều kiện tiên quyết | Các bước thực hiện | Kết quả kỳ vọng |
|---|---|---|---|---|
| **JDG-01** | Hàng chờ `/judge` chỉ hiển thị đúng phạm vi và trạng thái | Có hồ sơ ở trạng thái `DRAFT`, `SUBMITTED`, `SCORING`, `COMPLETED` thuộc nhóm được giao và nhóm không được giao. | Đăng nhập Giám khảo 1, mở `/judge`. | Chỉ hiển thị hồ sơ có trạng thái `SUBMITTED` hoặc `SCORING` thuộc đúng phân loại được phân công. Hồ sơ `DRAFT`, `COMPLETED` hoặc thuộc phân loại khác không xuất hiện. |
| **JDG-02** | Lưu nháp nhiều lần, thêm ghi chú và tải lại trang | Mở `/judge/products/:id`. | Chọn 3 tiểu tiêu chí, nhập ghi chú *"Minh chứng rõ ràng"* → nhấn **Lưu bản nháp** → Nhấn `F5` tải lại trang → Đổi sang mức điểm khác → Lưu lại. | Điểm tạm tính cập nhật tức thì trên thanh dưới cùng; sau khi F5 vẫn giữ đúng lựa chọn và ghi chú đã lưu; trạng thái sản phẩm chuyển sang `SCORING`. |
| **JDG-03** | UI chặn nộp khi thiếu tiểu tiêu chí được giao | Phân loại mật ong, GK1 toàn bộ, bộ nguồn hiện có 32 tiểu tiêu chí; đã lưu nháp 31 lựa chọn. | Mở phiếu, bỏ trống đúng một trong 32 tiểu tiêu chí rồi nhấn Nộp phiếu chấm. Quan sát Network. | UI báo `Chọn mức điểm cho mọi tiểu tiêu chí trước khi nộp.`, không gửi yêu cầu nộp. Phiếu vẫn IN_PROGRESS, chưa có submittedAt. Kiểm tra backend độc lập tại JDG-05. Nếu chỉ được giao một phần, dùng số tiểu tiêu chí trong phạm vi thay cho 32. |
| **JDG-04** | Khóa phiếu bất biến sau khi nộp (Chặn sửa/nộp lặp 409) | Giám khảo vừa nộp phiếu thành công (`SUBMITTED`). | 1. Quan sát giao diện phiếu chấm.<br>2. Nếu mở sẵn 1 tab cũ từ trước khi nộp, bấm **Lưu bản nháp** hoặc **Nộp phiếu chấm** trên tab cũ đó. | 1. Mọi ô radio và ô ghi chú đều bị `disabled`, hiện nhãn *"Đã nộp · chỉ đọc"*.<br>2. Tab cũ nhận lỗi `409 Conflict`, điểm đã nộp không bị thay đổi. |
| **JDG-05** | API chặn nộp phiếu chưa đủ điểm | GK1 toàn bộ, hồ sơ SCORING, phiếu nháp đã lưu 31/32 tiểu tiêu chí của bộ mật ong. | Gửi trực tiếp POST /api/judge/products/:id/evaluation/submit bằng token GK1, không đi qua nút nộp UI. | `409` với `Score every assigned subcriterion before submitting`. Phiếu vẫn IN_PROGRESS, submittedAt chưa có, điểm nháp giữ nguyên; chưa tính kết quả cuối. |
| **JDG-06** | Hai giám khảo nộp đồng thời | Hồ sơ SCORING chỉ có GK1/GK2 toàn bộ; cả hai đã lưu đủ điểm theo mục 1.5, chưa ai nộp. | Từ hai phiên độc lập, gửi hai yêu cầu nộp gần như đồng thời, không gửi thêm thao tác lưu. Đọc lại hai phiếu, sản phẩm và lịch sử trạng thái. | Hai phiếu nộp thành công; mỗi giám khảo chỉ có một phiếu. Sản phẩm COMPLETED, finalScore=79, starRating=4, completedAt có giá trị. Chỉ có một sự kiện chuyển sang COMPLETED; không kẹt SCORING hoặc tính kết quả thiếu một người. |

---

### Nhóm 8: Công thức tính điểm & Ngưỡng xếp hạng sao (`SCORE`)

| Mã TC | Tên kịch bản | Thiết lập dữ liệu chấm | Cách tính của hệ thống | Kết quả kỳ vọng |
|---|---|---|---|---|
| **SCORE-01** | Nhiều giám khảo chấm toàn bộ bộ tiêu chí | Dùng bảng mục 1.5: GK1 đổi tiểu tiêu chí `7` từ 0 lên 3 để đạt `85`; GK2 đổi `6.3` từ 2 lên 4 để đạt `78`. Cả hai chấm toàn bộ trên hồ sơ riêng. | Trung bình cộng tổng điểm các phiếu: `(85 + 78) / 2`. | `finalScore = 81.5`, `starRating = 4` (4 sao). |
| **SCORE-02** | Tính trung bình từng tiêu chí khi phạm vi giao nhau (hàm/fixture tổng hợp) | Fixture tổng hợp `SCORE-OVERLAP`: hai tiêu chí X tối đa 60 và Y tối đa 40; GK1 chỉ X=50, GK2 X=40 và Y=35. Đây không phải Phần A/B của bộ tiêu chí OCOP thật. | Tính trung bình từng tiêu chí có người được giao rồi cộng: X=(50+40)/2=45; Y=35; tổng=80. Thực hiện tại hàm tính điểm hoặc fixture DB riêng, không nhập trực tiếp tổng điểm qua giao diện bộ phiếu chuẩn. | finalScore=80, starRating=4. Không lấy trung bình tổng phiếu (50+75)/2=62.5. Bằng chứng phải ghi rõ dữ liệu tổng hợp và tầng kiểm thử. |
| **SCORE-03** | Biên sao và định dạng điểm (hàm/fixture chuyên biệt) | Dùng hàm tính sao với 29.99, 30, 49.99, 50, 69.99, 70, 89.99, 90; kiểm tra thêm 0, 100 và 89.999. Dùng fixture kết quả riêng nếu cần xem UI. | So với ngưỡng 30/50/70/90; gọi hàm định dạng điểm với 89.99 và 89.999. Không giả định có thể tạo tất cả số lẻ này bằng hai giám khảo chọn mức nguyên trên UI. | Sao tương ứng: 1,2,2,3,3,4,4,5; 0 là 1 sao, 100 là 5 sao, 89.999 vẫn 4 sao. Hàm formatExactScore hiện trả `89.99` cho cả 89.99 và 89.999, dùng dấu chấm và cắt tối đa 2 chữ số thập phân; 90 hiển thị `90`. Nhãn 5 sao là mức điểm/đề nghị xem xét, không phải quyết định công nhận. |
| **SCORE-04** | Bất biến kết quả sau khi hồ sơ đã `COMPLETED` | Hồ sơ đã `COMPLETED` với `81.5` điểm (4 sao). | Admin vào `/admin/assignments` thêm Giám khảo 3 vào phân loại đó hoặc gỡ Giám khảo 1, 2. | Hồ sơ đã `COMPLETED` giữ nguyên `finalScore = 81.5` và `starRating = 4`, không bị mở lại hay tính lại điểm. |

---

### Nhóm 9: In ấn 4 biểu mẫu A4 (`PRINT`)

| Mã TC | Tên kịch bản | Đường dẫn (URL) | Các bước kiểm tra | Kết quả kỳ vọng |
|---|---|---|---|---|
| **PRINT-01** | In mẫu phiếu chấm trắng theo phân loại | `/print/criteria-sets/:id` (từ `/admin/product-groups` hoặc `/admin/scoring-forms`) | Mở bằng tài khoản `MANAGE`, `VIEW`, hoặc `SCORE` (đối với bộ phiếu thuộc phạm vi của giám khảo đó) → Nhấn **In / Lưu PDF**. | Hiển thị đúng tên bộ tiêu chí, nguồn Quyết định 26/2026/QĐ-TTg, tổng 100 điểm, các cột điểm/nhận xét/chữ ký để trống; ẩn thanh menu khi in (`@media print`). |
| **PRINT-02** | In phiếu cá nhân theo trạng thái và quyền | Có phiếu nháp và phiếu đã nộp, trong đó có phiếu phạm vi một phần; VIEW dùng viewer@ocop.test chỉ VIEW. | GK mở `/print/judge/products/:productId` cho phiếu của mình. MANAGE mở `/print/evaluations/:evaluationId` cho phiếu nháp và đã nộp. VIEW mở bản in phiếu nháp của người khác, rồi phiếu đã nộp. | Phiếu nháp có nhãn `BẢN NHÁP — CHƯA NỘP`; phiếu đã nộp giữ đơn vị tại thời điểm nộp. Ngoài phạm vi ghi `Ngoài phạm vi phân công`, không biến thành 0 điểm. VIEW không đọc được nháp người khác; được xem phiếu đã nộp. Phân biệt productId và evaluationId trong hai URL. |
| **PRINT-03** | In bảng tổng hợp kết quả đánh giá | `/print/products/:id/results` | 1. Mở in khi hồ sơ đang `SCORING`.<br>2. Mở in khi hồ sơ đã `COMPLETED` (ví dụ đạt `92` điểm). | 1. Chỉ in tiến độ các phiếu hiện có, không in kết quả xếp sao cuối cùng giả định.<br>2. In đầy đủ điểm từng giám khảo, điểm trung bình cuối và ghi rõ *"Mức điểm 5 sao / đề nghị xem xét 5 sao"* (không in thành giấy chứng nhận công nhận). |
| **PRINT-04** | In phiếu đăng ký sản phẩm (Mẫu số 01) | `/print/products/:id/registration` | Mở từ trang chi tiết của Chủ thể hoặc Admin. | Hiển thị đầy đủ thông tin chủ thể, sản phẩm, loại đăng ký, địa bàn, danh sách tệp minh chứng và phần cam kết ký tên theo Mẫu số 01. |

---

### Nhóm 10: Tra cứu công khai, Báo cáo thống kê & Dashboard (`PUB`, `REP`, `DASH`)

| Mã TC | Tên kịch bản | Màn hình / URL | Các bước thực hiện | Kết quả kỳ vọng |
|---|---|---|---|---|
| **PUB-01** | Tìm kiếm, lọc nhóm và phân trang trên trang công khai | `/` và `/products` | 1. Lọc theo nhóm ngành hàng, nhập từ khóa `q` (tên sản phẩm hoặc mã hồ sơ).<br>2. Chuyển sang trang 2 rồi đổi bộ lọc nhóm ngành. | 1. Kết quả trả về từ server không phân biệt hoa/thường.<br>2. Khi đổi bộ lọc hoặc từ khóa, tham số `page` tự động reset về `1`. |
| **PUB-02** | Ẩn hồ sơ `DRAFT` và thông tin nhạy cảm trên trang công khai | `/products/:id` | 1. Lấy `id` của một hồ sơ đang là `DRAFT`, mở `/products/:id` ở trình duyệt ẩn danh.<br>2. Mở `/products/:id` của một hồ sơ đã `SUBMITTED`, kiểm tra Network response `GET /api/products/:id`. | 1. Trả về `404 Not Found` (không lộ bản nháp và ảnh của bản nháp).<br>2. JSON trả về **không chứa** `formData` (số điện thoại, email, người đại diện, địa chỉ) và **không chứa** tệp `EVIDENCE` (PDF). |
| **REP-01** | Báo cáo theo ngày nộp và ngày hoàn tất | Có fixture REP-CROSS mục 1.6: nộp 30/09/2026, hoàn tất 01/10/2026; đã ghi ID và dữ liệu kỳ nền trước test. | Chọn năm 2026, tháng 9; xem tab Hồ sơ đăng ký rồi Kết quả hoàn tất. Đổi sang tháng 10 và đối chiếu lại. | Hồ sơ nằm trong tập đăng ký tháng 9 và tập hoàn tất tháng 10; không nằm trong tập hoàn tất tháng 9 hay đăng ký tháng 10. Lấy chênh lệch so với dữ liệu kỳ nền nếu database có hồ sơ khác; không đổi đồng hồ máy để tạo fixture. |
| **REP-02** | Địa bàn chưa xác định và ngưỡng điểm đạt | Fixture REP-LEGACY: hồ sơ lịch sử không có localityId lẫn mã/tên địa bàn tại nộp/snapshot; có các hồ sơ hoàn tất 49 và 50 điểm trong kỳ. | Chọn năm/tháng của fixture, nhóm theo địa bàn và xem Đạt/Chưa đạt. Đối chiếu tổng từng nhóm với tổng toàn kỳ. | Hồ sơ lịch sử thiếu mọi dữ liệu địa bàn vào nhóm Chưa xác định địa bàn; tổng nhóm khớp toàn kỳ. Hồ sơ hoàn tất 49 điểm vào Chưa đạt, 50 điểm vào Đạt. Chỉ localityId=null nhưng vẫn có snapshot địa bàn không đủ để tạo ca chưa xác định. |
| **REP-03** | Biên tháng theo múi giờ Việt Nam | Fixture REP-BOUNDARY ở mục 1.6; ghi ID hai hồ sơ và số liệu nền. | Chọn năm 2026, tháng 9 và tháng 10; kiểm tra cả Hồ sơ đăng ký và Kết quả hoàn tất. So sánh tập ID, không chỉ nhìn tổng số. | Hồ sơ lúc 30/09 23:59:59+07 thuộc tháng 9; hồ sơ lúc 01/10 00:00:00+07 thuộc tháng 10. Không trùng/thiếu giữa hai kỳ dù giá trị lưu UTC rơi cùng ngày 30/09. |
| **DASH-01** | 8 KPI, ba liên kết danh sách và hồ sơ cần chú ý | Bộ lọc năm/tháng chứa ngày nộp fixture; danh sách cần chú ý chưa bị các hồ sơ cũ chiếm hết trang hiển thị. | Kiểm tra 8 KPI. Bấm liên kết trên 3 thẻ: đăng ký trong kỳ, hoàn tất trong kỳ, mức điểm 5 sao. Nộp một hồ sơ thuộc phân loại không có phân công, tải lại Tổng quan và tìm ID hồ sơ. | Ba liên kết mở `/admin/products` với bộ lọc tương ứng; 5 KPI còn lại không có liên kết danh sách. Hồ sơ thiếu phân công thuộc tập cần chú ý; kiểm tra trong phần danh sách hiển thị hoặc phản hồi API khi danh sách bị giới hạn. Không đòi mọi hồ sơ xuất hiện ngay ở trang đầu. |

---

## Phần IV. Mẫu bảng ghi nhận kết quả nghiệm thu (Test Execution Log)

Mỗi mã ca có một dòng riêng. Ghi từng nhánh trong Kết quả thực tế nếu ca có nhiều dữ liệu đầu vào. Không ghi PASS cho ca chưa chạy hoặc chỉ mới đọc mã nguồn.

- `PASS`: đã chạy, mọi kỳ vọng của ca đều đạt và có bằng chứng.
- `FAIL`: đã chạy, có kỳ vọng không đạt; ghi mã lỗi và dữ liệu tái hiện.
- `BLOCKED`: thiếu fixture, tài khoản, hộp thư, công cụ hoặc điều kiện khác; ghi rõ nguyên nhân.
- Để trống Kết quả cho ca chưa chạy. Ghi commit/build, trình duyệt và database/schema vào cột Phiên bản / Môi trường; dữ liệu biến đổi sau ca ghi trong Kết quả thực tế.

| Mã TC | Ngày chạy | Người test | Phiên bản / Môi trường | Kết quả (PASS / FAIL / BLOCKED) | Kết quả thực tế / ID dữ liệu | Mã lỗi / Bằng chứng |
|---|---|---|---|---|---|---|
| `E2E-01` | | | | | | |
| `E2E-02` | | | | | | |
| `E2E-03` | | | | | | |
| `E2E-04` | | | | | | |
| `E2E-05` | | | | | | |
| `E2E-06` | | | | | | |
| `AUTH-01` | | | | | | |
| `AUTH-02` | | | | | | |
| `AUTH-03` | | | | | | |
| `AUTH-04` | | | | | | |
| `AUTH-05` | | | | | | |
| `AUTH-06` | | | | | | |
| `AUTH-07` | | | | | | |
| `RBAC-01` | | | | | | |
| `RBAC-02` | | | | | | |
| `RBAC-03` | | | | | | |
| `RBAC-04` | | | | | | |
| `RBAC-05` | | | | | | |
| `USR-01` | | | | | | |
| `USR-02` | | | | | | |
| `USR-03` | | | | | | |
| `USR-04` | | | | | | |
| `CAT-01` | | | | | | |
| `CAT-02` | | | | | | |
| `LOC-01` | | | | | | |
| `SNAP-01` | | | | | | |
| `REG-01` | | | | | | |
| `REG-02` | | | | | | |
| `REG-03` | | | | | | |
| `REG-04` | | | | | | |
| `REG-05` | | | | | | |
| `REG-06` | | | | | | |
| `FILE-01` | | | | | | |
| `FILE-02` | | | | | | |
| `FILE-03` | | | | | | |
| `FILE-04` | | | | | | |
| `FILE-05` | | | | | | |
| `FILE-06` | | | | | | |
| `FILE-07` | | | | | | |
| `ASG-01` | | | | | | |
| `ASG-02` | | | | | | |
| `ASG-03` | | | | | | |
| `ASG-04` | | | | | | |
| `ASG-05` | | | | | | |
| `ASG-06` | | | | | | |
| `ASG-07` | | | | | | |
| `JDG-01` | | | | | | |
| `JDG-02` | | | | | | |
| `JDG-03` | | | | | | |
| `JDG-04` | | | | | | |
| `JDG-05` | | | | | | |
| `JDG-06` | | | | | | |
| `SCORE-01` | | | | | | |
| `SCORE-02` | | | | | | |
| `SCORE-03` | | | | | | |
| `SCORE-04` | | | | | | |
| `PRINT-01` | | | | | | |
| `PRINT-02` | | | | | | |
| `PRINT-03` | | | | | | |
| `PRINT-04` | | | | | | |
| `PUB-01` | | | | | | |
| `PUB-02` | | | | | | |
| `REP-01` | | | | | | |
| `REP-02` | | | | | | |
| `REP-03` | | | | | | |
| `DASH-01` | | | | | | |
