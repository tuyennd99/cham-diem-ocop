# Hướng dẫn vận hành

## Khởi tạo

1. Tạo database và user PostgreSQL riêng, chỉ cấp quyền trên database ứng dụng.
2. Sao chép `.env.example` thành `.env`, thay toàn bộ secret và mật khẩu mẫu.
3. Chạy `pnpm prisma migrate deploy`.
4. Chỉ khi cần dữ liệu khởi tạo, chạy `pnpm prisma db seed`. Mật khẩu user
   `admin` mặc định là `123456`; ghi đè bằng `SEED_ADMIN_PASSWORD` khi cần.
5. Gắn `STORAGE_PATH` vào persistent volume private và chạy Backend cổng `3030`.

## Reverse proxy và mạng

- Internet chỉ truy cập HTTPS `443`.
- Reverse proxy chuyển `/api` vào `127.0.0.1:3030`.
- The `/api/socket.io` route must proxy HTTP/1.1 WebSocket upgrades, including
  the `Upgrade` and `Connection` headers.
- PostgreSQL chỉ nhận kết nối từ Backend; không public cổng `5432`.
- Cấu hình `CORS_ORIGINS` đúng danh sách origin Frontend, không dùng `*`.

## Backup và khôi phục

- Backup PostgreSQL và thư mục `STORAGE_PATH` trong cùng một cửa sổ thời gian.
- Mã hóa bản backup, giới hạn người truy cập và đặt chính sách lưu giữ.
- Kiểm tra restore định kỳ trên môi trường tách biệt; đối chiếu metadata file
  trong database với file vật lý.

## Theo dõi

- Dùng `/api/v1/system/health/live` cho liveness.
- Dùng `/api/v1/system/health/ready` cho readiness database.
- Theo dõi lỗi scheduler 00:05, dung lượng persistent volume, kết nối database,
  tỷ lệ 4xx/5xx và audit log.

## Sự cố

- Khi nghi lộ secret: thay JWT/CSRF secret, khóa tài khoản liên quan và xem audit.
- Khi file volume lỗi: dừng ghi mới, bảo toàn database và phục hồi cặp
  database/file từ cùng mốc.
- Không xóa thủ công audit log hoặc lịch sử phiên bản báo cáo.
