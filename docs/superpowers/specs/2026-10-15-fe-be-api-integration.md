# Spec tích hợp API giữa frontend và backend OCOP

Ngày: 15/10/2026. Trạng thái: đặc tả để triển khai và nghiệm thu; chưa xác nhận kết nối database hoặc SMTP thực tế.

## 1. Mục tiêu và hiện trạng

Hoàn thiện tích hợp React frontend với NestJS backend hiện có để chạy trọn luồng: tra cứu công khai → đăng ký/OTP → tạo và nộp hồ sơ → phân công → chấm điểm → công bố kết quả.

FE đã gọi API thật cho các màn hình chính. Công việc này là đồng bộ cấu hình, hợp đồng dữ liệu và xử lý lỗi, sau đó kiểm chứng luồng thực tế; không xây lại lớp API.

Người dùng đã bổ sung `DATABASE_URL`. Việc này chưa chứng minh database truy cập được, schema đã migrate, dữ liệu tiêu chí đã seed hoặc API khởi động được. Tác vụ viết spec không chạy migration, seed, gửi email hay thay đổi dữ liệu.

Nguồn đối chiếu:

- [Thiết kế nghiệp vụ gốc](../../../2026-10-12-ocop-scoring-system-design.md).
- [Hướng dẫn chạy monorepo](../../../README.md), [vận hành API](../../../apps/be/docs/operations.md).
- [API client FE](../../../apps/web/src/lib/api.ts), [session](../../../apps/web/src/lib/auth.ts), [types dùng chung](../../../packages/shared/src/index.ts).
- [Controllers](../../../apps/be/src/controllers), [DTOs](../../../apps/be/src/dtos), [repositories](../../../apps/be/src/repositories).

Khi tài liệu cũ khác code đã triển khai, dùng các contract được đối chiếu trong spec này. Stack thực tế là React 19, Vite, TanStack Router, Tailwind 4; NestJS 11, Prisma 7 và PostgreSQL. Không chuyển sang TanStack Start hay thay thư viện form.

## 2. Phạm vi

Bao gồm public, xác thực, tài khoản, hồ sơ chủ thể, giám khảo, quản trị, tệp đính kèm và kết quả chấm. Tái sử dụng route guards, helper tệp và các lớp controller → service → repository hiện tại.

Quy ước tổ chức FE bổ sung ngày 22/10/2026 theo [README web](../../../apps/web/README.md#frontend-api-and-constants-convention): `src/api/` chứa Axios base dùng chung và các hàm gọi API theo nghiệp vụ; `src/constants/` chứa endpoint, query key và hằng số dùng lại. `src/queries/` gọi các hàm nghiệp vụ; component/page dùng hook hoặc hàm nghiệp vụ cho mutation, không gọi HTTP client trực tiếp. `lib/api.ts` hiện vẫn là fetch client đang chạy; các mẫu Axios chưa được tích hợp. Việc chuyển client phải giữ nguyên contract OCOP trong spec này.

Không thêm refresh token, endpoint logout, Redis, queue, SMS, S3, UI quản lý tiêu chí, thư viện kiểm chứng schema hoặc thiết kế lại giao diện. Axios là lựa chọn cho cấu trúc client dùng chung theo quy ước mới; tác vụ cập nhật tài liệu này không cài thư viện hoặc đổi code gọi API. Không sửa nội dung bộ tiêu chí trong tác vụ ghép API.

Workspace có thay đổi FE chưa commit, gồm chuyển các tiện ích sang `src/lib` và types sang `src/types`. Triển khai theo các đường dẫn hiện tại, giữ nguyên các thay đổi đang có.

## 3. Cấu hình và điều kiện khởi chạy

### 3.1. Backend

Đặt cấu hình private tại `apps/be/.env`; đối chiếu [`.env.example`](../../../apps/be/.env.example). Các lệnh workspace bên dưới chạy từ thư mục gốc repository.

| Biến | Yêu cầu |
|---|---|
| `DATABASE_URL` | PostgreSQL của môi trường OCOP dự định sử dụng; chỉ backend được đọc. |
| `JWT_SECRET` | Ít nhất 32 byte UTF-8; cấu hình hiện tại bắt buộc. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Đều bắt buộc để API khởi động; phải dùng SMTP hoạt động để nghiệm thu OTP thật. |
| `SMTP_PORT` | Mặc định `587`, số nguyên `1..65535`. |
| `PORT` | Mặc định `3030`. |
| `CORS_ORIGINS` | Mặc định `http://localhost:5173`; nhiều origin phân cách bằng dấu phẩy. Origin phải khớp protocol, hostname và port của FE. |
| `STORAGE_PATH` | Mặc định `storage` trong working directory của API; cấu hình thư mục private, có quyền ghi và lưu bền khi triển khai. |
| `TRUST_PROXY_HOPS` | Số nguyên không âm, mặc định code là `0`; đặt theo reverse proxy thực tế. |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | Chỉ dùng khi cần tạo admin đầu tiên bằng seed; xóa khỏi cấu hình sau đó. Mật khẩu tối thiểu 12 ký tự, tối đa 72 byte UTF-8. |

Không đưa DB URL, JWT secret, SMTP password hoặc mật khẩu bootstrap vào FE, log hay tài liệu. Không ghi đè `.env` đã có.

### 3.2. Frontend và đường đi request

Mặc định local: trình duyệt gọi `http://localhost:5173/api/...`; Vite proxy tới `http://localhost:3030/api/...`. Client nối `apiBase + path`, trong đó `path` bắt đầu bằng `/` và không chứa thêm `/api`.

```dotenv
# apps/web/.env.local — chỉ cấu hình công khai
VITE_API_URL=/api
```

`VITE_API_URL` là base URL mà trình duyệt sử dụng. Khi gọi khác origin, giá trị phải gồm prefix, ví dụ `https://api.example.com/api`; BE phải cho phép origin của FE. Biến Vite được đóng vào bundle lúc build; thay đổi cấu hình production phải build lại FE.

`VITE_API_PROXY` là target dành cho Vite dev server, không dùng ở production. Hiện `vite.config.ts` chỉ đọc `process.env.VITE_API_PROXY`, nên chưa bảo đảm đọc giá trị từ file `.env`. Cần sửa bằng `loadEnv` có sẵn của Vite, ưu tiên biến process nếu được cung cấp, giữ fallback `http://localhost:3030`. Target proxy không thêm `/api`, vì đường dẫn request đã có prefix.

Production ưu tiên FE và API cùng origin: reverse proxy chuyển `/api` tới NestJS, serve bundle FE, và fallback route ứng dụng về `index.html` để mở trực tiếp các URL con. Thư mục upload không được mount thành static public.

### 3.3. Kiểm tra và chuẩn bị database

Runtime dùng Node `>=24.7 <25`, pnpm theo `packageManager` của repository. Trước khi khởi chạy, Prisma Client phải được generate.

```powershell
pnpm install
pnpm --filter @ocop/api prisma generate
pnpm --filter @ocop/api prisma migrate status
```

`migrate status` dùng để đọc trạng thái; nó có thể trả exit code khác 0 khi có migration chưa áp dụng. Không suy ra từ đó rằng cần reset DB.

Chỉ áp dụng các lệnh ghi sau khi xác định đúng database OCOP mới hoặc đã có kế hoạch migration và backup phù hợp:

```powershell
pnpm --filter @ocop/api prisma:migrate:deploy
pnpm --filter @ocop/api seed
```

Migration `0009_ocop_domain` xóa domain task/report cũ, có `DROP ... CASCADE`. Không chạy toàn bộ migration chain lên database chưa rõ dữ liệu. Database đã ở schema OCOP `0009` cần migration tiến `0010_backend_stabilization`; giữ lịch sử migration.

Seed hiện nạp 26 phân loại sản phẩm và 26 bộ tiêu chí, nằm trong sáu nhóm lớn. Mỗi bộ có tổng điểm tối đa 100. Không hiểu “26 bộ” là mọi bộ đều có đúng 26 tiêu chí. Seed không tạo hồ sơ hoặc tài khoản demo; admin bootstrap chỉ được tạo khi cấu hình đủ hai biến tương ứng.

Sau khi môi trường đã sẵn sàng:

```powershell
pnpm dev
Invoke-RestMethod http://localhost:3030/api/system/health/live
Invoke-RestMethod http://localhost:3030/api/system/health/ready
Invoke-RestMethod http://localhost:5173/api/categories
```

`live` kiểm tra process; `ready` kiểm tra truy vấn DB bằng `SELECT 1`, chưa chứng minh schema/seed đúng. `categories` qua cổng FE kiểm tra thêm proxy, bảng dữ liệu và danh mục seed. Swagger tại `http://localhost:3030/docs`, OpenAPI JSON tại `/docs-json`.

## 4. Hợp đồng HTTP chung

### 4.1. JSON và phân trang

Success JSON có dạng:

```json
{
  "statusCode": 200,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

`meta` chỉ có trên danh sách phân trang. `message` có thể xuất hiện ở success envelope; một số auth endpoint còn trả `{message}` bên trong `data`. FE đọc `data` và `meta` qua client hiện có; không unwrap lần hai. JSON thành công dùng HTTP 2xx; không hardcode tất cả POST là 200. Auth POST trừ `change-password` đặt 200; các POST còn lại theo mặc định Nest là 201.

Error JSON có dạng:

```json
{
  "statusCode": 409,
  "message": "Only draft products can be changed",
  "requestId": "request-id-from-server"
}
```

`message` là chuỗi; lỗi validation nhiều trường được nối thành chuỗi, hiện không có `fieldErrors`. `requestId` có thể dùng để tra lỗi. Không yêu cầu FE gửi `X-Request-Id` khác origin vì CORS hiện chưa cho phép header đó.

ID là chuỗi do BE cấp; dùng nguyên ID từ API, không suy ra từ index hoặc tên. Timestamp truyền dạng chuỗi ISO; FE định dạng để hiển thị. `finalScore`, `starRating`, `submittedAt`, `total` có thể `null`; không đổi “chưa có kết quả” thành 0 điểm.

| HTTP | Hành vi FE cần đạt |
|---|---|
| `400` | Hiện lỗi payload/OTP/thiếu thông tin; giữ dữ liệu người dùng đang nhập. |
| `401` | Sai thông tin login: hiện lỗi. Token hết hạn/bị thu hồi: xóa session và về `/login`. Ngoại lệ đổi mật khẩu xem mục 5. |
| `403` | Hiện không có quyền, không render dữ liệu bị cấm; route guard có thể chuyển `/403`. |
| `404` | Hiện không tìm thấy hoặc không truy cập được hồ sơ/tệp; không tạo dữ liệu thay thế. |
| `409` | Trạng thái/phân công đã đổi hoặc dữ liệu trùng; thông báo và cho tải lại trạng thái BE. Không tự ghi đè. |
| `413`, `415` | Hiện lỗi quá dung lượng/định dạng tệp; giữ hồ sơ đã lưu. |
| `429` | Thông báo giới hạn thao tác, chờ rồi thử lại; không tự retry vòng lặp. |
| `5xx` hoặc mất mạng | Hiện lỗi kết nối và thao tác thử lại phù hợp; không hiển thị như danh sách trống thành công. |

GET danh sách public và admin products phân trang từ trang `1`, `limit` mặc định `20`, tối đa `100`. Danh sách my products, judge queue, judges và assignments hiện là mảng không phân trang; không tự thêm `meta` hoặc pagination contract cho chúng.

### 4.2. Các nguyên tắc gửi dữ liệu

- Client đang chạy dùng `api<T>` cho JSON, `apiBlob`/`openAttachment` cho binary. Khi chuyển theo quy ước mới ở mục 2, các hàm nghiệp vụ trong `src/api/` dùng chung Axios base và giữ nguyên contract JSON/binary; component/page không gọi client trực tiếp.
- JSON có `Content-Type: application/json`; `FormData` để trình duyệt tự đặt multipart boundary.
- DTO bật `whitelist` và `forbidNonWhitelisted`: không gửi `id`, `role`, `registrantId`, `status`, `finalScore` hoặc field chỉ phục vụ UI vào payload ghi.
- Types shared là hợp đồng compile-time, không kiểm chứng response ở runtime. Nghiệm thu contract bằng API smoke và trình duyệt; không thêm schema library trong phạm vi này.
- Chỉ cập nhật thành công sau response BE. Không tự retry POST/PUT/DELETE khi chưa biết request trước đã ghi thành công chưa.

## 5. Xác thực và tài khoản

Các đường dẫn bảng bên dưới đều có prefix `/api` khi gửi HTTP.

| Màn hình/chức năng | Method và endpoint | Body / data thành công |
|---|---|---|
| `/register` | `POST /auth/register` | `{email, fullName, password, phone?}` → `{message}` |
| `/verify-otp` | `POST /auth/verify-otp` | `{email, code}` → `{message}`; không cấp token |
| Gửi lại mã đăng ký | `POST /auth/resend-otp` | `{email}` → thông báo chung |
| `/login` | `POST /auth/login` | `{email, password}` → `{accessToken, expiresIn, user}` |
| `/forgot-password`, bước gửi mã | `POST /auth/forgot-password` | `{email}` → thông báo chung |
| `/forgot-password`, bước đặt lại | `POST /auth/reset-password` | `{email, code, newPassword}` → `{message}` |
| `/account` | `GET /auth/me` | `{id, email, fullName, phone, role, verified}` |
| `/account/password` | `POST /auth/change-password` | `{currentPassword, newPassword}` → `{message}` |

Các yêu cầu bắt buộc:

1. Email được trim và lowercase; OTP là chuỗi đúng sáu chữ số, giữ số 0 đầu. OTP hết hạn sau năm phút; không lưu password hoặc OTP vào storage/log.
2. Mật khẩu đăng ký/reset/đổi tối thiểu tám ký tự; BE giới hạn tối đa 72 byte UTF-8. Form `maxLength=72` không thay được giới hạn byte với tiếng Việt. Mật khẩu admin cấp cho giám khảo tối thiểu 12 ký tự.
3. Đăng ký lưu email chờ xác thực trong `sessionStorage` key `ocop.pendingEmail`. Khi SMTP lỗi, account có thể đã tồn tại: giữ đường tới xác thực/gửi lại mã, không bắt người dùng đăng ký lại liên tục.
4. Resend/forgot-password trả thông báo chung, kể cả account không tồn tại hoặc gửi mail lỗi. Response 200 không chứng minh mail đã đến. “Đổi email nhận mã” chỉ chọn account khác đang chờ xác thực; không cập nhật email account đã tạo.
5. Login chỉ thành công khi account verified và active. JWT có `expiresIn=604800` giây, tương đương bảy ngày. Lưu `{accessToken,user}` trong `localStorage` key `ocop-session`; session tồn tại qua lần đóng/mở trình duyệt cho tới khi xóa hoặc token bị từ chối.
6. Gửi `Authorization: Bearer <accessToken>` qua client chung. Redirect sau login: ADMIN `/admin/products`, JUDGE `/judge`, REGISTRANT `/my/products`.
7. Logout hiện là xóa local session; không có endpoint logout hay refresh token. Đổi/reset mật khẩu thành công thu hồi mọi JWT cũ qua `tokenVersion`; đổi mật khẩu tại FE phải xóa session và về login.
8. Sai mật khẩu hiện tại trả 401 với message chính xác `Current password is incorrect`. Client hiện dựa vào chuỗi này để giữ session. Giữ contract và test ngoại lệ này; không đổi riêng message BE trong đợt ghép API.
9. Route guard FE chỉ hỗ trợ điều hướng. JWT, account active/verified và role vẫn do BE kiểm tra; không tin role hoặc user ID do FE gửi.

Rate limit auth hiện tại: register/resend/forgot `3/15 phút`; login `10/phút`; verify/reset/change-password `5/phút`. UI resend có đếm ngược 60 giây nhưng BE vẫn là nguồn quyết định giới hạn.

## 6. Public và danh mục

| Màn hình | API | Contract |
|---|---|---|
| `/`, `/products` | `GET /categories` | Mảng phân loại kèm `groupCode`, `groupName`, `classificationGroup`, `classificationSubgroup`, `criteriaSet.criteria[].subCriteria[].options[]`. |
| `/` | `GET /products?page=1&limit=8&categoryId=...` | Danh sách nổi bật; bỏ `categoryId` khi không lọc. |
| `/products` | `GET /products?page=1&limit=20&categoryId=...&q=...` | Tìm kiếm server theo tên, ID, tên phân loại, tên nhóm; không phân biệt hoa/thường. `q` tối đa 100 ký tự. |
| `/products/:id` | `GET /products/:id` | Chi tiết public, cùng tập field public như danh sách. |
| Ảnh public | `GET /products/:id/attachments/:attachmentId` | Binary image inline; có thể dùng trực tiếp làm `img.src`. |

Product public gồm `id`, `name`, `description`, `status`, `finalScore`, `starRating`, `createdAt`, category summary và attachments `{id,fileName}`. Không có `formData`, thông tin liên hệ account, evidence PDF hoặc storage key.

Chỉ công khai `SUBMITTED`, `SCORING`, `COMPLETED`; `DRAFT` không xuất hiện và mở detail/ảnh public phải thất bại. Bỏ lọc rỗng khỏi URL, dùng `URLSearchParams`; đổi bộ lọc/từ khóa đưa `page` về 1. Kết quả và tổng trang phải lấy từ server, không lọc lại riêng trang hiện tại.

Danh mục rỗng, danh sách sản phẩm rỗng, loading và lỗi kết nối phải phân biệt được. Seed mới có danh mục nhưng chưa có sản phẩm công khai là trạng thái hợp lệ.

## 7. Hồ sơ chủ thể và upload

Mọi endpoint `/my/products` chỉ dành cho `REGISTRANT` và chỉ truy cập hồ sơ thuộc account hiện tại.

| Màn hình/thao tác | API | Kết quả |
|---|---|---|
| `/my/products` | `GET /my/products` | Mảng hồ sơ của người đăng nhập. |
| `/my/products/:id`, trang edit | `GET /my/products/:id` | Hồ sơ đầy đủ, `formData` và metadata tệp; edit dùng endpoint này. |
| `/my/products/new` | `POST /my/products` | Tạo `DRAFT`, trả hồ sơ có `id`. |
| `/my/products/:id/edit` | `PUT /my/products/:id` | Cập nhật draft, trả hồ sơ mới. |
| Xóa nháp | `DELETE /my/products/:id` | `{id}`; không được xóa hồ sơ đã nộp. |
| Nộp hồ sơ | `POST /my/products/:id/submit` | Không gửi body; trả hồ sơ `SUBMITTED` và `submittedAt`. |
| Upload | `POST /my/products/:id/attachments` | Multipart một field `file`; trả `{id,type,fileName,createdAt}`. |
| Đọc tệp của mình | `GET /my/products/:id/attachments/:attachmentId` | Binary có Bearer token. |
| Xóa tệp nháp | `DELETE /my/products/:id/attachments/:attachmentId` | `{id}`; chỉ khi hồ sơ còn `DRAFT`. |

Ví dụ body tạo hồ sơ đủ điều kiện nộp; `categoryId` lấy từ `GET /categories`:

```json
{
  "categoryId": "category-id-from-api",
  "name": "Sản phẩm thử nghiệm tích hợp",
  "description": "Mô tả sản phẩm",
  "formData": {
    "entityName": "Hợp tác xã thử nghiệm",
    "representativeName": "Nguyễn Văn A",
    "representativeTitle": "Giám đốc",
    "contactAddress": "Địa chỉ liên hệ",
    "provinceName": "Tỉnh/thành phố đăng ký",
    "phone": "0900000000",
    "email": "registrant@example.com",
    "registrationType": "FIRST",
    "sampleQuantity": 1,
    "assessmentYear": 2026,
    "declarationAccepted": true
  }
}
```

- Tạo draft cần `categoryId` tồn tại, `name` không trắng và `formData` là object; cho phép `formData={}` để lưu chưa hoàn chỉnh.
- `PUT` cho phép bỏ qua field không đổi. Nếu gửi `formData`, BE thay toàn bộ object; FE phải gửi toàn bộ dữ liệu form hiện tại, không gửi một field để mong BE merge. `description=null` dùng để xóa mô tả; không gửi `null` cho `name`, `categoryId`, `formData`.
- Khi nộp: năm field văn bản chủ thể/đại diện/chức danh/địa chỉ/tỉnh phải có; có ít nhất `phone` hoặc `email`; loại đăng ký `FIRST|UPGRADE|REASSESSMENT`; số mẫu nguyên `1..100000`; năm nguyên `2020..2100`; cam kết bằng boolean `true`.
- Nháp cho phép số mẫu `0`, năm chưa có, cam kết `false`; số từ input phải chuyển sang number, ô trống cần bỏ field thích hợp. Không gửi `registrationType=""` khi chưa chọn; có thể bỏ field ở draft.
- `name` tối đa 255 ký tự, mô tả 10000; tên chủ thể/đại diện/chức danh 255, địa chỉ 1000, tỉnh 100, phone 30, email 320. Field lạ bị từ chối.
- Ảnh và minh chứng tùy chọn. Upload sau khi tạo thành công để có product ID. UI chọn nhiều tệp nhưng gửi lần lượt một request/tệp; không gửi JSON/base64.
- Chấp nhận PNG, JPEG (`.jpg/.jpeg`), GIF, WebP, PDF; tối đa `10 * 1024 * 1024` byte/tệp, gọi đúng là 10 MiB. BE kiểm tra extension, MIME và chữ ký nội dung; `image/*` trên input hiện rộng hơn contract và cần thu hẹp.
- Nếu upload thứ hai lỗi sau khi hồ sơ/tệp thứ nhất đã lưu: giữ product ID, hiện phần đã thành công, thử lại không tạo hồ sơ mới hoặc upload lại tệp đã thành công trong phiên đó. Sau mất mạng không rõ kết quả, tải lại metadata tệp trước khi người dùng quyết định thử lại.
- Mở private file qua `apiBlob`/`openAttachment`; link/ảnh trực tiếp không tự có Bearer header. Không dựng URL từ `filePath`, không đưa token vào query string.
- Sau nộp, UI bỏ thao tác sửa/xóa/upload. BE vẫn từ chối nếu tab cũ cố gửi request. Không thêm bước admin duyệt hồ sơ: flow hiện đi thẳng `DRAFT → SUBMITTED`.

## 8. Giám khảo, phiếu chấm và tổng hợp

Các endpoint chỉ dành cho `JUDGE` và phải nằm trong phân công của account.

| Màn hình/thao tác | API | Contract |
|---|---|---|
| `/judge` | `GET /judge/products` | Mảng hồ sơ `SUBMITTED/SCORING` thuộc nhóm được phân công; evaluations chỉ là phiếu của người đang đăng nhập. |
| `/judge/products/:id` | `GET /judge/products/:id/evaluation` | `{product, criteria, evaluation}`; GET chưa tạo phiếu hoặc chuyển trạng thái sản phẩm. |
| Lưu nháp | `PUT /judge/products/:id/evaluation` | `{scores:[{subCriterionId,optionId,note?}]}`; trả `{id,status,scores}`. |
| Nộp phiếu | `POST /judge/products/:id/evaluation/submit` | Không body; trả `{id,status:"SUBMITTED",total}`. |
| Mở ảnh/minh chứng | `GET /judge/products/:id/attachments/:attachmentId` | Binary có Bearer và kiểm tra phân công. |

Chi tiết `product` trong response phiếu hiện có `id`, `name`, `description`, `formData`, category `{id,name,groupName}`, attachments `{id,type,fileName}`. Không giả định object này có `status`, `createdAt`, `evaluations` hoặc `attachments.createdAt` như object queue/hồ sơ chủ thể.

Phiếu chưa lưu: `{id:null,status:"IN_PROGRESS",total:null,scores:[]}`. `criteria` đã được BE lọc theo phân công; FE hiển thị trực tiếp và chỉ gửi `optionId` do API cấp. `note` tối đa 2000 ký tự; tối đa 1000 score/request, không lặp `subCriterionId`.

Lưu nháp thay thế toàn bộ tập scores, không merge. FE phải gửi toàn bộ lựa chọn hiện tại. BE không nhận điểm tự do, total hay sao từ FE. Lưu nháp thành công chuyển sản phẩm sang `SCORING`.

Nộp phải thực hiện `PUT` lưu toàn bộ lựa chọn trước, chỉ `POST submit` khi PUT thành công. BE yêu cầu đủ mọi tiểu tiêu chí trong phạm vi. Nếu POST lỗi sau PUT, nháp đã được lưu; UI phải diễn đạt đúng và giữ dữ liệu.

Phiếu `SUBMITTED` chỉ đọc; lưu lại hoặc nộp lặp trả 409. Sau khi sản phẩm `COMPLETED`, sản phẩm biến mất khỏi queue; vẫn mở trực tiếp phiếu đã nộp nếu còn quyền phân công. Khi phân công thay đổi và BE từ chối dữ liệu cũ, tải lại criteria/phiếu, không tự gửi lại lựa chọn cũ.

Quy tắc kết quả do BE quyết định:

1. Chỉ hoàn tất khi có phân công phủ đủ bộ tiêu chí và mọi giám khảo đang được phân công đã nộp hợp lệ.
2. Mọi người chấm toàn bộ: trung bình tổng điểm các phiếu. Phân công một phần: trung bình điểm từng tiêu chí giữa những người được giao tiêu chí đó, rồi cộng các trung bình.
3. `finalScore` có thể là số thập phân. FE hiển thị số của BE; nếu làm tròn để trình bày, không dùng số đã làm tròn để tự xếp sao.
4. Ngưỡng sao hiện tại: `[90,100]` là 5; `[70,90)` là 4; `[50,70)` là 3; `[30,50)` là 2; dưới 30 là 1. Dùng `starRating` từ BE.
5. Khi hoàn tất, sản phẩm `COMPLETED`; thay phân công sau đó không tự sửa kết quả lịch sử.

Đây là mô tả quy tắc code hiện tại; không phải đợt thẩm định pháp lý bộ tiêu chí.

## 9. Quản trị

Tất cả endpoint `/admin` yêu cầu `ADMIN`.

| Màn hình/thao tác | API | Body / data |
|---|---|---|
| `/admin` | `GET /admin/dashboard` | `{productsByStatus, judges, needsAttention}`. |
| `/admin/judges` | `GET /admin/judges` | Mảng giám khảo. |
| Tạo giám khảo | `POST /admin/judges` | `{email,fullName,password,phone?}`; mật khẩu 12 ký tự tối thiểu, tối đa 72 byte UTF-8. |
| Sửa giám khảo | `PUT /admin/judges/:id` | `{fullName?,phone?,reason?}`; `phone=null` để xóa. Không gửi email/role/isActive. |
| Ngừng hoạt động | `DELETE /admin/judges/:id` | Vô hiệu hóa account, không xóa lịch sử chấm. |
| Reset mật khẩu | `POST /admin/judges/:id/reset-password` | `{password,reason?}`; thu hồi JWT cũ của giám khảo. |
| `/admin/assignments` | `GET /admin/assignments` và `GET /categories` | Danh sách phân công và cây tiêu chí để lựa chọn. |
| Lưu phân công | `PUT /admin/assignments` | `{assignments:[{judgeId,categoryId,criterionIds:[]}],reason?}`. |
| `/admin/products` | `GET /admin/products?page=1&limit=20` | Phân trang mọi trạng thái, kèm registrant và trạng thái phiếu. Không gửi `q/status/categoryId` vì DTO này chưa hỗ trợ. |
| `/admin/products/:id` | `GET /admin/products/:id/results` | `{id,name,status,finalScore,starRating,category,evaluations}`; mỗi phiếu có judge, status, total, scores và option points. |

`PUT assignments` thay thế toàn bộ danh sách toàn hệ thống. FE phải tải đủ danh sách, chỉnh sửa trên bản đầy đủ rồi gửi toàn bộ; không gửi riêng nhóm đang hiển thị. `assignments=[]` là yêu cầu xóa toàn bộ, không phải “không thay đổi”.

`criterionIds=[]` là toàn bộ tiêu chí của nhóm. Chỉ gửi criterion ID thuộc đúng nhóm; mỗi cặp judge/category duy nhất. Không dùng vị trí mảng làm ID.

BE bảo vệ phiếu đã nộp và độ phủ tiêu chí khi thay phân công đang chấm. Thay phạm vi của giám khảo đang có nháp có thể xóa điểm nháp ngoài quy trình cũ và đặt lại total; UI phải thông báo cần tải lại. Khi đổi phân công làm đủ điều kiện hoàn tất, BE tổng hợp trong cùng transaction. FE không tự tính trạng thái sản phẩm.

Hiện không có endpoint admin tải attachment hoặc sửa hồ sơ thay chủ thể. Không dùng đường `/my/products` với admin để vượt role; không thêm tính năng đó trong đợt tích hợp này.

## 10. Các điểm cần đồng bộ trước nghiệm thu

Đây là yêu cầu triển khai tiếp theo, chưa được sửa bởi tài liệu này.

| Ưu tiên | File | Thay đổi và cách xác nhận |
|---|---|---|
| P1 | `apps/web/src/pages/RegistrantPages.tsx` | Edit gọi `GET /my/products/:id` thay vì tải cả danh sách rồi find. Mở URL edit trực tiếp, tải lại trang, thử ID không thuộc mình. |
| P1 | `apps/web/src/types/registrant.ts`, `types/judge.ts`, `types/product.ts` | Tách type category đầy đủ từ `/categories` với category summary của product; type product/attachment trong phiếu theo đúng response mục 8. Không bắt BE thêm field FE không cần. |
| P1 | `apps/web/vite.config.ts` | Nạp `VITE_API_PROXY` từ file env bằng `loadEnv`; ưu tiên process env, giữ fallback. Kiểm tra cả default và target tùy chỉnh khi khởi động dev server. |
| P1 | `apps/web/src/pages/RegistrantPages.tsx` | Thu hẹp file accept và kiểm tra dung lượng theo đúng danh sách/10 MiB; giữ hồ sơ và phần upload đã thành công khi lỗi. |
| P1 | `apps/web/src/pages/RegistrantPages.tsx` | Danh sách my products chỉ hiện empty khi không loading và không lỗi; chặn gửi lặp mutation lúc đang xử lý. |
| P2 | `apps/web/src/pages/AuthPages.tsx`, `lib/api.ts` | Kiểm chứng đăng ký lỗi SMTP và ngoại lệ 401 sai mật khẩu hiện tại; chỉ sửa nếu hành vi chưa đạt. Không đổi message BE đơn lẻ. |
| P2 | `apps/web/README.md` | Sửa mô tả tìm kiếm: `q` đã tìm trên server; session localStorage tồn tại qua lần mở trình duyệt; ghi kết quả kiểm chứng thực tế sau triển khai. |

Files phụ thuộc cần kiểm tra khi sửa: route `_app.my.products.$id.edit.tsx`, `lib/use-api.ts`, `lib/attachments.ts`, các types shared và DTO/repository liên quan. Giữ `routeTree.gen.ts` do router plugin sinh; không sửa bằng tay. Không phục hồi các utility cũ đã chuyển khỏi gốc `src`.

## 11. Trình tự bàn giao

1. Xác nhận env và trạng thái schema bằng kiểm tra không ghi; chuẩn bị DB đúng môi trường, danh mục và admin khi cần.
2. Đồng bộ proxy, type/payload và các lỗi UI ở mục 10; giữ nguyên client/API hiện có.
3. Nghiệm thu public và auth; tiếp theo hồ sơ/upload; cuối cùng admin/phân công/chấm/kết quả. Mỗi nhóm phải có loading, empty và lỗi tương ứng.
4. Chạy kiểm tra tĩnh/unit, DB suite riêng và hành trình trình duyệt bên dưới. Ghi bằng chứng theo từng trường hợp, không thay bằng nhận xét “FE/BE đã ghép xong”.

## 12. Nghiệm thu

### 12.1. Lệnh kiểm tra

```powershell
pnpm typecheck
pnpm build
pnpm --filter @ocop/api test --runInBand
```

Chỉ chạy DB suite sau khi cung cấp `TEST_DATABASE_URL` trỏ PostgreSQL local, database có hậu tố `_test`:

```powershell
pnpm --filter @ocop/api test:db
```

Không suy ra `TEST_DATABASE_URL` từ DB người dùng. Harness hiện tạo schema ngẫu nhiên, migrate/seed trong schema đó, mock gửi mail và dọn schema khi xong. Suite này không chứng minh SMTP thật hoạt động. Không thay guard an toàn để chạy trên database khác.

Tận dụng các test [auth](../../../apps/be/test/auth.db-spec.ts), [backend](../../../apps/be/test/backend.db-spec.ts), [evaluation](../../../apps/be/test/evaluation.db-spec.ts), [assignment](../../../apps/be/test/assignment.db-spec.ts), [OpenAPI](../../../apps/be/test/openapi.db-spec.ts) và [seed](../../../apps/be/test/seed.db-spec.ts). Khi sửa logic FE không tầm thường, thêm check nhỏ nhất tái hiện lỗi; không thêm test framework chỉ để phục vụ tác vụ này.

### 12.2. Ma trận kiểm tra thực tế

Thực hiện thao tác ghi, tạo tài khoản và gửi OTP trên môi trường nghiệm thu được chọn, bằng dữ liệu thử riêng.

| Mã | Trường hợp | Kết quả bắt buộc |
|---|---|---|
| ENV-01 | Chạy API và gọi live/ready; gọi categories qua cổng FE | Process, DB, schema/seed và proxy đều có bằng chứng riêng. |
| PUB-01 | Xem danh sách, lọc nhóm, tìm `q`, phân trang | Tổng số/trang từ BE; tìm được hồ sơ ở ngoài trang đầu; reset trang khi đổi lọc. |
| PUB-02 | Truy cập draft/ảnh draft/evidence bằng public URL | Không trả dữ liệu private; public detail không có formData/contact/evidence. |
| AUTH-01 | Register, nhận OTP thật, verify, login | Chưa verify không login; mã đúng kích hoạt account; vào đúng khu vực role. |
| AUTH-02 | OTP sai/hết hạn, resend, SMTP lỗi | Hiện lỗi phù hợp; có đường phục hồi; không lộ OTP/password trong storage/log. |
| AUTH-03 | Sai login, token hết hạn/thu hồi, sai role, logout | Login báo lỗi; session invalid bị xóa; sai role bị chặn; logout không để lại token local. |
| AUTH-04 | Đổi mật khẩu sai hiện tại, đổi thành công, reset | Sai hiện tại giữ session; thành công buộc login; JWT cũ bị BE từ chối. |
| REG-01 | Tạo draft còn thiếu, sửa, mở URL edit trực tiếp, reload | Dữ liệu đã lưu còn nguyên; không cần tải toàn bộ hồ sơ; không xóa field form khi sửa. |
| REG-02 | Nộp thiếu field/cam kết, nộp đầy đủ | Thiếu bị chặn; đủ chuyển SUBMITTED; file tùy chọn; tab cũ không sửa được hồ sơ đã nộp. |
| FILE-01 | Upload ảnh/PDF hợp lệ, sai MIME/chữ ký, quá 10 MiB | Hợp lệ tải lại được; sai bị từ chối; không tạo hồ sơ trùng khi upload lỗi một phần. |
| FILE-02 | Chủ thể khác, judge ngoài phân công, anonymous mở private file | BE từ chối; người có quyền mở file bằng Bearer được. |
| ADM-01 | Tạo/sửa/reset/ngừng hoạt động judge | Dữ liệu cập nhật đúng; reset thu hồi token; deactivate giữ lịch sử và chặn account. |
| ADM-02 | Sửa một nhóm khi còn phân công nhóm khác | Payload giữ đầy đủ nhóm khác; xử lý `criterionIds=[]` đúng; không mất phân công ngoài màn hình. |
| JDG-01 | Mở phiếu, chọn, lưu, reload, thay option/note | Đọc lại đúng dữ liệu BE; lựa chọn chỉ thuộc phạm vi, điểm tạm tính không thay total BE. |
| JDG-02 | Nộp thiếu, nộp đủ, nộp lặp, sửa phiếu đã nộp | Thiếu bị chặn; đủ khóa phiếu; lặp/sửa bị từ chối; mất mạng giữa PUT/POST vẫn còn nháp. |
| SCORE-01 | Hai judge chấm toàn bộ và hai judge chia tiêu chí | Kết quả đúng hai công thức; chờ đủ người và độ phủ; public/my/admin cùng score/sao sau tải lại. |
| SCORE-02 | Điểm 29.99, 30, 50, 70, 89.99, 90; đổi phân công sau completed | Sao đúng ngưỡng, không dựa số đã làm tròn; kết quả completed giữ nguyên. |
| UI-01 | API chậm, không có dữ liệu, lỗi 5xx, ngắt mạng, thử lại | Loading/empty/error phân biệt; không hiện empty như kết quả thành công sau lỗi. |
| DEPLOY-01 | Mở trực tiếp route con và tải lại, upload rồi restart API | SPA routing chạy; private storage lưu bền; ảnh public vẫn đúng quyền. |

### 12.3. Điều kiện hoàn thành và ghi nhận bằng chứng

- Các mục 10 đã sửa hoặc có lý do cụ thể chứng minh không cần sửa; không để type yêu cầu field BE không trả.
- Typecheck, build, unit và DB suite có kết quả mới; test trình duyệt bao phủ ba role và public.
- Mỗi trường hợp ghi `PASS`, `FAIL` hoặc `BLOCKED`, cùng môi trường, lệnh/bước chạy, kết quả thực tế; dữ liệu và log được che thông tin nhạy cảm.
- Thiếu SMTP hoặc DB test phải ghi rõ mục bị chặn. Không coi việc thêm `DATABASE_URL`, compile thành công hoặc response 200 resend là bằng chứng tích hợp hoàn chỉnh.

Tại thời điểm viết spec: đã đối chiếu mã nguồn và tài liệu; chưa chạy ứng dụng, build/test, kết nối DB, migration/seed hoặc SMTP thật. Chưa có kết quả nghiệm thu runtime mới.
