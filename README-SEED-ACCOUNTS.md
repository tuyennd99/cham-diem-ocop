# Tài khoản seed để kiểm thử

Mật khẩu mặc định khi tạo các tài khoản dưới đây: `OcopTest@2026!`

| Email | Vai trò và quyền | Đơn vị / Cơ quan chủ trì quản lý |
| --- | --- | --- |
| `admin@ocop.test` | Quản trị (`ADMIN`, kiêm Chủ trì `VIEWER`) | Sở Nông nghiệp và Môi trường (Bộ Nông nghiệp và Môi trường) |
| `admin.score@ocop.test` | Quản trị kiêm Giám khảo (`ADMIN`, `VIEWER`, `JUDGE`) | Sở Công Thương (Bộ Công Thương) |
| `viewer@ocop.test` | Chủ trì (`VIEWER`) | Sở Văn hóa, Thể thao và Du lịch (Bộ Văn hóa, Thể thao và Du lịch) |
| `viewer.score@ocop.test` | Chủ trì kiêm Giám khảo (`VIEWER`, `JUDGE`) | Sở Công Thương (Bộ Công Thương) |
| `judge@ocop.test` | Giám khảo (`JUDGE`) | Sở Nông nghiệp và Môi trường (Bộ Nông nghiệp và Môi trường) |
| `registrant@ocop.test` | Người dùng (`REGISTRANT`) | Chủ thể OCOP Mẫu |
| `htx.uminh@ocop.test` | Người dùng (`REGISTRANT`) | Hợp tác xã Mật ong rừng U Minh Hạ |
| `htx.rachgoc@ocop.test` | Người dùng (`REGISTRANT`) | Hợp tác xã Thủy sản Sinh thái Rạch Gốc |

Một tài khoản có thể kiêm nhiều vai trò hợp lệ, nhưng **Người dùng** (`REGISTRANT`) và **Giám khảo** (`JUDGE`) phải là hai tài khoản khác nhau.

Chạy seed bằng `pnpm --filter @ocop/api seed` sau khi cấu hình cơ sở dữ liệu. Seed không tạo tài khoản mẫu nếu `SEED_TEST_ACCOUNTS=false`; với schema có tên bắt đầu bằng `ocop_test_`, cần đặt `SEED_TEST_ACCOUNTS=true`.

Nếu `SEED_TEST_PASSWORD` hợp lệ được đặt khi seed, mật khẩu đó thay cho mật khẩu mặc định. Seed không đổi mật khẩu của tài khoản đã tồn tại, nên mật khẩu thực tế có thể khác sau các lần seed tiếp theo. Tài khoản bootstrap admin dùng email và mật khẩu từ `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD`, không có mật khẩu mặc định.
