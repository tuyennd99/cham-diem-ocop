# Kiến trúc Backend OCOP

API NestJS quản lý đăng ký sản phẩm OCOP, chấm điểm, phân công giám khảo và trang sản phẩm công khai. Request chạy qua controller → service → repository → Prisma/PostgreSQL; DTO kiểm tra input, guards áp dụng xác thực/vai trò/rate limit, còn exception filter chuẩn hóa lỗi.

## Luồng nghiệp vụ

- Người đăng ký tạo sản phẩm ở `DRAFT`, cập nhật hồ sơ và tải minh chứng ảnh/PDF lên private storage, rồi gửi để chấm (`SUBMITTED`).
- Admin duy trì danh mục và phân công giám khảo. Giám khảo lưu và gửi phiếu chấm theo tiêu chí đã seed từ Quyết định 26/2026/QĐ-TTg cùng phụ lục.
- Sản phẩm đi theo trạng thái `DRAFT` → `SUBMITTED` → `SCORING` → `COMPLETED`. Kết quả cuối được tính từ đánh giá hợp lệ và ngưỡng sao 90/70/50/30.
- Criteria và lựa chọn điểm là dữ liệu chính thức; không thêm nội dung hoặc điểm tiêu chí tùy ý.

## API và bảo mật

- Prefix là `/api`; Swagger UI ở `/docs`.
- Vai trò API: `REGISTRANT`, `JUDGE`, `ADMIN`. Endpoint công khai được đánh dấu bằng `@Public`; endpoint còn lại cần Bearer JWT và kiểm tra trạng thái/vai trò tài khoản.
- Access JWT dùng HS256, issuer `ocop-api`, audience `ocop-web`, thời hạn 7 ngày. Email OTP đăng ký/đặt lại mật khẩu hết hạn sau 5 phút và cho tối đa 5 lần thử.
- Mật khẩu băm bằng bcrypt 12 rounds; đầu vào tối đa 72 UTF-8 byte.
- Rate limit tổng thể và giới hạn riêng được khai báo tại throttler/endpoint decorator. Không có refresh-cookie, CSRF hoặc WebSocket notification flow.
- Upload ảnh/PDF nằm trong `STORAGE_PATH`, tối đa 10 MiB mỗi file; tiêu chí giới hạn được định nghĩa trong `src/utils/private-storage.ts`.

## Health và xử lý lỗi

`GET /api/system/health/live` không truy vấn dependency bên ngoài. `GET /api/system/health/ready` chạy `SELECT 1` trong transaction với giới hạn statement 2 giây, transaction 3 giây và max wait 1 giây; lỗi DB trả 503.

Error envelope có `statusCode`, `message` và `requestId` tùy chọn. Filter giữ message HTTP an toàn; lỗi 5xx chỉ ghi request ID, method, pathname không query, loại exception và `code` nếu có. Message, stack và dữ liệu request không được log.

## Cấu trúc mã nguồn

```text
apps/be/src/
  constants/     # Chính sách dùng chung trong API
  config/        # Bootstrap HTTP và kiểm tra env
  controllers/   # Route và DTO bindings
  dtos/          # Ràng buộc request và Swagger schema
  filters/       # Error envelope và log an toàn
  guards/        # JWT, trạng thái tài khoản, vai trò, rate limit
  prisma/        # Prisma client và SQL helper schema-aware
  repositories/  # Truy vấn/transaction
  services/      # Luồng nghiệp vụ
  utils/         # Scoring, request metadata, file/storage helpers
  test/          # Unit và PostgreSQL integration tests
```

Migration có thứ tự trong `prisma/migrations`; giữ nguyên migration đã phát hành và thêm migration tiến cho thay đổi schema. Seed kiểm tra dữ liệu tiêu chí trước khi ghi, sau đó nạp bundle chính thức và có thể bootstrap administrator đầu tiên qua `BOOTSTRAP_ADMIN_EMAIL` cùng `BOOTSTRAP_ADMIN_PASSWORD`.

## Kiểm thử và vận hành

- Unit tests: `pnpm --filter @ocop/api test -- --runInBand`.
- Typecheck/build: `pnpm --filter @ocop/api typecheck` và `pnpm --filter @ocop/api build`.
- PostgreSQL tests: `pnpm --filter @ocop/api test:db`, chỉ với `TEST_DATABASE_URL` local trỏ tới database `_test`; harness cô lập mỗi run trong schema riêng. Không chạy test DB bằng `DATABASE_URL`.
- Build production rồi chạy `pnpm --filter @ocop/api start:prod`, khởi chạy `dist/src/main.js`.
- Hướng dẫn bootstrap, migration, token rollout, health checks và backup nằm tại [operations.md](operations.md).
