# Vận hành API OCOP

## Khởi tạo và chạy

1. Tạo PostgreSQL database riêng cho OCOP; không trỏ API vào database của hệ thống cũ.
2. Sao chép `.env.example` thành `.env` và đặt `DATABASE_URL`, `JWT_SECRET` (ít nhất 32 byte), `CORS_ORIGINS`, SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) và `STORAGE_PATH`.
3. Cài dependencies và tạo Prisma Client: `pnpm install`, `pnpm --filter @ocop/api prisma generate`.
4. Triển khai schema và dữ liệu chính thức bằng `pnpm --filter @ocop/api prisma:migrate:deploy` rồi `pnpm --filter @ocop/api seed`.
5. Tạo administrator đầu tiên bằng cách đặt `BOOTSTRAP_ADMIN_EMAIL` và một `BOOTSTRAP_ADMIN_PASSWORD` riêng (ít nhất 12 ký tự, tối đa 72 byte UTF-8) trong `.env` trước lệnh seed; xóa hai biến bootstrap sau đó. Seed nạp 26 bộ tiêu chí chính thức và không tạo tài khoản/sản phẩm demo.
6. Build và chạy production: `pnpm --filter @ocop/api build`, sau đó `pnpm --filter @ocop/api start:prod`. Script production khởi chạy `dist/src/main.js`.

API dùng prefix `/api`, mặc định nghe cổng `3030`; Swagger ở `/docs`. Frontend mặc định chạy cổng `5173`. `STORAGE_PATH` phải là thư mục private trên persistent storage, được backup cùng database. File ảnh và PDF tối đa 10 MiB mỗi file.

## Migration và token khi phát hành

Giữ nguyên lịch sử migration đã commit. Với database đã ở schema OCOP `0009`, chạy migration tiến `0010_backend_stabilization` trước khi rollout API mới; migration bổ sung các cột còn thiếu và đồng bộ mã hóa tiêu chí chính thức, không thay `0009` hoặc xóa lịch sử OCOP. Với database hoàn toàn mới, chạy toàn bộ `prisma:migrate:deploy` theo thứ tự.

`tokenVersion` được thêm với mặc định `0`. Token được cấp trước thay đổi này có thể thiếu trường đó và sẽ bị từ chối; người dùng cần đăng nhập lại. Khi đổi hoặc reset mật khẩu, phiên bản token tăng để thu hồi access token cũ. Cần chạy migration trước khi triển khai ứng dụng có kiểm tra phiên bản.

## Kiểm tra sức khỏe và theo dõi

- `GET /api/system/health/live` chỉ xác nhận process đang chạy, không truy cập database.
- `GET /api/system/health/ready` chạy `SELECT 1` trong transaction có timeout; trả 503 nếu database không sẵn sàng.
- Lỗi 5xx được ghi với `requestId`, method, pathname không query, loại exception và mã lỗi nếu có. Message, stack, body và credentials không được đưa vào log.
- Có thể gửi `X-Request-Id` gồm 1–100 ký tự chữ/số/dấu `._-`; giá trị sai định dạng được thay bằng UUID. API trả `requestId` tùy chọn trong error envelope.

## Reverse proxy, backup và khôi phục

- Chỉ public HTTPS 443; reverse proxy chuyển `/api` vào Backend và đặt `TRUST_PROXY_HOPS` theo số proxy tin cậy.
- PostgreSQL chỉ nhận kết nối từ Backend; không public cổng `5432`.
- Đặt `CORS_ORIGINS` đúng danh sách origin của Frontend.
- Backup database và `STORAGE_PATH` trong cùng cửa sổ thời gian; mã hóa backup và thử khôi phục định kỳ ở môi trường riêng.

## Kiểm thử database

`pnpm --filter @ocop/api test:db` chỉ chạy khi `TEST_DATABASE_URL` trỏ tới PostgreSQL local (`localhost`, `127.0.0.1` hoặc `::1`) và database có hậu tố `_test`. Harness tạo schema ngẫu nhiên riêng cho mỗi lần chạy rồi xóa schema đó. Không dùng `DATABASE_URL`, database dùng chung hoặc production để chạy test.
