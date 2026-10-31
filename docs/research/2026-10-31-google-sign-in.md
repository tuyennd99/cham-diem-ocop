# Thông tin đăng nhập Google và trường đăng ký OCOP

Ngày khảo sát: 2026-10-31, Asia/Saigon. Phạm vi: tài liệu chính thức của Google và mã nguồn tại thời điểm khảo sát; khi đó chưa triển khai hoặc thử đăng nhập Google. Xem [trạng thái hiện tại](../superpowers/status/2026-10-31-google-sign-in-status.md).

## Kết luận cho dự án

Đăng nhập Google có thể cung cấp email và gợi ý tên cá nhân, nhưng không cung cấp mật khẩu Google hay đảm bảo tên đơn vị OCOP và số điện thoại liên hệ. Vì vậy vẫn cần cho người dùng nhập hoặc xác nhận tên người đăng ký/đơn vị; số điện thoại hiện là tùy chọn. Nguồn: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [RegisterPage.tsx](../../apps/web/src/pages/auth/RegisterPage.tsx), [RegisterDto](../../apps/be/src/dtos/auth.dto.ts).

## Thông tin Google cung cấp

- Với OpenID Connect, `sub` là mã tài khoản Google ổn định, duy nhất và không tái sử dụng. `email` được cung cấp khi yêu cầu scope `email`, nhưng có thể thay đổi; `email_verified` cho biết Google đã xác minh địa chỉ. Các claim `name`, `given_name`, `family_name`, `picture` có thể có tùy scope và không được đảm bảo; `hd` chỉ xuất hiện cho tài khoản thuộc tổ chức Google Cloud/Workspace. ID token còn có các claim kỹ thuật như `iss`, `aud`, `iat`, `exp`. Nguồn: [Google OpenID Connect: ID token payload](https://developers.google.com/identity/openid-connect/openid-connect#an-id-tokens-payload).
- Số điện thoại không nằm trong danh sách claim đăng nhập thông thường. People API có dữ liệu số điện thoại, nhưng cần quyền truy cập bổ sung `user.phonenumbers.read`; người dùng có thể không có dữ liệu phù hợp hoặc không cấp quyền. Nguồn: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect#an-id-tokens-payload), [People API people.get](https://developers.google.com/people/api/rest/v1/people/get), [OAuth scopes](https://developers.google.com/identity/protocols/oauth2/scopes#people).

## Đối chiếu biểu mẫu hiện tại

| Trường | Yêu cầu hiện tại | Dữ liệu Google và cách dùng |
| --- | --- | --- |
| `fullName` | Bắt buộc, 1–255 ký tự; nhãn yêu cầu tên người đăng ký hoặc đơn vị theo giấy phép. | `name` có thể gợi ý tên hiển thị của chủ tài khoản, không bảo đảm có mặt hoặc là tên đơn vị. Cho người dùng nhập/xác nhận, không tự coi là tên pháp lý. |
| `email` | Bắt buộc, được chuẩn hóa, duy nhất trong cơ sở dữ liệu. | Có thể lấy `email` nếu yêu cầu scope tương ứng; xác minh token và xử lý trường hợp thiếu email. `email_verified` không đồng nghĩa Google luôn có thẩm quyền hiện tại đối với hộp thư bên thứ ba. |
| `phone` | Không bắt buộc, tối đa 30 ký tự. | Không nhận từ đăng nhập cơ bản; để trống hoặc cho người dùng nhập. People API cần quyền bổ sung. |
| `password` | Bắt buộc, 8–72 ký tự, có giới hạn 72 byte UTF-8; lưu dưới dạng bcrypt. | Google không cung cấp mật khẩu tài khoản Google trong ID token. Đăng nhập Google thuần cần thay đổi mô hình và luồng mật khẩu hiện tại hoặc vẫn yêu cầu mật khẩu riêng của ứng dụng. |

Nguồn cho bảng: [RegisterPage.tsx](../../apps/web/src/pages/auth/RegisterPage.tsx), [RegisterDto](../../apps/be/src/dtos/auth.dto.ts), [AuthService](../../apps/be/src/services/auth.service.ts), [schema.prisma](../../apps/be/prisma/schema.prisma), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect#an-id-tokens-payload), [People API people.get](https://developers.google.com/people/api/rest/v1/people/get).

## Điều kiện khi tích hợp

- Máy chủ cần xác minh chữ ký ID token, `aud`, `iss`, `exp` và kiểm tra `hd` nếu giới hạn tổ chức. Dùng `sub` làm định danh Google và lưu liên kết với người dùng; email có thể dùng để tìm tài khoản có sẵn nhưng không làm định danh Google. Google khuyến nghị xác nhận quyền truy cập tài khoản cũ khi liên kết. Nguồn: [Google: xác minh ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
- Google có thẩm quyền đối với địa chỉ Gmail, hoặc Workspace khi `email_verified` là true và có `hd`. Với địa chỉ bên thứ ba không thuộc các trường hợp này, `email_verified` có thể phản ánh việc xác minh trong quá khứ; Google khuyến nghị thêm thử thách xác minh. Vì vậy không nên bỏ OTP hiện có chỉ dựa vào `email_verified` cho mọi email. Nguồn: [Google: xác minh ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [AuthService](../../apps/be/src/services/auth.service.ts).
- Mô hình hiện tại bắt buộc `password`, không có trường liên kết Google; đăng ký tạo tài khoản `REGISTRANT` chưa xác thực rồi gửi OTP, còn đăng nhập kiểm tra mật khẩu, `verified` và `isActive`. Tích hợp cần quyết định cách lưu định danh Google, xử lý mật khẩu và liên kết tài khoản trùng email, đồng thời giữ các kiểm tra trạng thái. Đây là suy luận từ mã hiện tại, chưa phải thiết kế đã triển khai. Nguồn: [schema.prisma](../../apps/be/prisma/schema.prisma), [AuthRepository](../../apps/be/src/repositories/auth.repository.ts), [AuthService](../../apps/be/src/services/auth.service.ts).
