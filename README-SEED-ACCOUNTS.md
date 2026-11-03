# Tài khoản seed để kiểm thử

Mật khẩu mặc định khi tạo các tài khoản dưới đây: `OcopTest@2026!`

| Email | Vai trò và quyền |
| --- | --- |
| `admin@ocop.test` | Quản trị viên: quản lý và xem |
| `admin.score@ocop.test` | Quản trị viên: quản lý, xem và chấm điểm |
| `viewer@ocop.test` | Cán bộ: xem và báo cáo |
| `viewer.score@ocop.test` | Giám khảo: xem và chấm điểm |
| `judge@ocop.test` | Giám khảo: chấm điểm |
| `registrant@ocop.test` | Chủ thể OCOP |
| `htx.uminh@ocop.test` | Chủ thể OCOP: Hợp tác xã Mật ong rừng U Minh Hạ |
| `htx.rachgoc@ocop.test` | Chủ thể OCOP: Hợp tác xã Thủy sản Sinh thái Rạch Gốc |

Chạy seed bằng `pnpm --filter @ocop/api seed` sau khi cấu hình cơ sở dữ liệu. Seed không tạo tài khoản mẫu nếu `SEED_TEST_ACCOUNTS=false`; với schema có tên bắt đầu bằng `ocop_test_`, cần đặt `SEED_TEST_ACCOUNTS=true`.

Nếu `SEED_TEST_PASSWORD` hợp lệ được đặt khi seed, mật khẩu đó thay cho mật khẩu mặc định. Seed không đổi mật khẩu của tài khoản đã tồn tại, nên mật khẩu thực tế có thể khác sau các lần seed tiếp theo. Tài khoản bootstrap admin dùng email và mật khẩu từ `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD`, không có mật khẩu mặc định.
