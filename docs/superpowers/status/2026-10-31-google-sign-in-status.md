# Trạng thái tính năng đăng nhập Google và xác thực OTP

Cập nhật: 31/10/2026. Nhánh đồng bộ: `codex/restore-file-based-routing`.

## Tính năng đang làm gì?

Bổ sung đăng nhập bằng Google cạnh đăng nhập email/mật khẩu. Đăng ký mới bằng email hoặc Google chỉ tạo tài khoản người đăng ký sau khi người dùng xác minh OTP gửi tới email. Khi đăng ký bằng Google, email được điền sẵn, tên Google được gợi ý nếu có, người dùng phải xác nhận tên đơn vị/người đăng ký; số điện thoại là tùy chọn.

Nếu Google đã liên kết với tài khoản, đăng nhập lại vào đúng tài khoản đó. Nếu email Google trùng một tài khoản hiện có, dùng cùng tài khoản; lần liên kết đầu tiên có thể cần OTP tùy khả năng Google xác minh quyền sở hữu email. Người quên mật khẩu xác minh OTP rồi tự đặt mật khẩu mới. Không gửi mật khẩu qua email và không lưu mật khẩu Google.

OTP giảm đăng ký tự động và xác nhận người dùng nhận được thư; không bảo đảm chặn toàn bộ bot.

## Những gì tính năng cần làm

- Giữ đăng nhập email/mật khẩu và bổ sung lựa chọn Google.
- Xác minh ID token Google ở backend; không tin email hoặc trạng thái xác minh do trình duyệt tự khai báo.
- Không tạo tài khoản trước khi OTP đúng; không tạo tài khoản thứ hai nếu email/danh tính Google đã thuộc về một tài khoản.
- Giữ nguyên vai trò, quyền, mật khẩu và dữ liệu tài khoản hiện có khi liên kết Google.
- Bảo toàn luồng xác minh cho tài khoản cũ chưa hoàn tất đăng ký.
- Giới hạn OTP: mã tối đa 5 phút, phiên tạm tối đa 15 phút, gửi lại cách nhau ít nhất 60 giây; sau 5 lần nhập sai phải bắt đầu phiên đăng ký/liên kết mới. Gửi lại không đặt lại số lần sai.
- Giữ OTP, token và thông tin bí mật khỏi URL, log và mã nguồn.

## Đã làm

Sáu commit trên nhánh tính năng `codex/google-auth-otp`:

1. `5a40dd1` — chỉ tạo đăng ký email sau khi OTP hợp lệ; giữ luồng khôi phục cho tài khoản cũ.
2. `9b7c92d` — xác minh danh tính Google ở backend và hỗ trợ đăng nhập bằng danh tính đã liên kết.
3. `2a116b2` — đăng ký Google sau OTP và liên kết với tài khoản hiện có.
4. `250b861` — giao diện Google, xác nhận hồ sơ, các màn OTP và xử lý phiên.
5. `3a8bfbe` — kiểm thử API/cơ sở dữ liệu và hướng dẫn cấu hình, triển khai.
6. `c7bf462` — giữ nguyên giới hạn số lần OTP, bỏ phiên OTP cũ khi bắt đầu lại, xử lý phiên hết hạn, bổ sung kiểm thử và hướng dẫn dọn phiên tạm.

Rà soát nguồn sau commit cuối kết luận **sẵn sàng hợp nhất**; cả ba lỗi quan trọng và ba điểm nhỏ đã được xử lý. Nhánh đã được hợp nhất fast-forward vào `codex/restore-file-based-routing`; nhánh `codex/google-auth-otp` đã xóa sau khi xác nhận commit nằm trong nhánh hiện tại. Các thay đổi giao diện cục bộ chưa commit được giữ ngoài các commit tính năng.

Kiểm tra trên checkout sau khi hợp nhất và khôi phục các chỉnh sửa giao diện đã qua:

- Cơ sở dữ liệu: 15/15 bộ, 159/159 kiểm thử.
- Backend unit: 21/21 bộ, 165/165 kiểm thử.
- Web: 41/41 kiểm thử; kiểm tra API/GIS callback và router đều qua.
- Typecheck và build toàn workspace đều qua.

Hướng dẫn vận hành trong `apps/be/README.md` yêu cầu dọn phiên OTP hết hạn ít nhất mỗi ngày bằng thao tác chỉ xóa phiên đã hết hạn; chưa thêm lịch tự động.

## Các quyết định triển khai

- Dùng worktree riêng để giữ nguyên thay đổi chưa commit ở checkout gốc; đổi lại cần một lượt tích hợp cuối.
- Lưu hash SHA-256 của nonce để đối chiếu claim trong ID token đã ký, không lưu nonce thô; nếu hợp đồng OAuth thay đổi thì cần bổ sung nonce vào API/client.
- Phần xác thực sở hữu Google dựa trên `sub` ổn định; nếu email Google đổi, vẫn đăng nhập tài khoản đã liên kết cho đến khi có chính sách chuyển/liên kết tài khoản rõ ràng.
- Giữ màn xác minh OTP cũ để người dùng chưa xác thực trước migration vẫn khôi phục được; đổi lại có thêm một chế độ trong giao diện.
- Dùng hạ tầng mail và biến môi trường hiện có để gửi OTP liên kết Google; phạm vi có thêm các tệp mail/config liên quan.
- Dùng biến môi trường và API contract đã có từ các phần trước thay vì thêm thay đổi trùng lặp; nếu kiểm tra trước đó bỏ sót cấu hình thì vẫn cần bổ sung sau.
- Xác minh Google thật, gửi thư thật và kiểm tra CSP/COOP là bước vận hành vì phụ thuộc thông tin môi trường; cấu hình vẫn có thể phát sinh lỗi cho đến khi được thử trực tiếp.
- Giữ bộ đếm OTP qua mỗi lần gửi lại; người nhập sai năm lần phải bắt đầu phiên mới, theo quy tắc chống lạm dụng đã duyệt.

## Còn thiếu / chưa làm

Các mục dưới đây chưa được xác nhận hoàn thành trên môi trường thật. Chỉ đánh dấu hoàn thành sau khi có kết quả kiểm tra tương ứng.

### 1. Cấu hình Google OAuth

- [ ] Xác định domain HTTPS của frontend và các tài khoản Google được phép dùng để thử.
- [ ] Trong Google Cloud, tạo OAuth client loại **Web application**; cấu hình màn hình đồng ý, người dùng thử nếu ứng dụng còn ở chế độ thử nghiệm, và các yêu cầu xác minh nếu Google yêu cầu.
- [ ] Thêm chính xác origin frontend vào **Authorized JavaScript origins**. Với local, thêm `http://localhost` và `http://localhost:5173`; với production, dùng origin HTTPS thực tế, không kèm đường dẫn. Nguồn: [Google Identity Services setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
- [ ] Điền cùng một client ID vào `GOOGLE_CLIENT_ID` của backend và `VITE_GOOGLE_CLIENT_ID` của web; thêm origin vào `CORS_ORIGINS`. Khởi động lại backend và build lại web. Không đưa client secret vào mã nguồn.
- [ ] Thử trên trình duyệt tại domain thực tế: nút Google xuất hiện, popup đăng nhập hoạt động và có thể hủy/thử lại. Kiểm tra CSP/COOP theo cấu hình thực tế.

### 2. Cấu hình gửi OTP qua SMTP

- [ ] Điền `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` và `SMTP_FROM` bằng thông tin do nhà cung cấp cấp. Lưu mật khẩu trong cấu hình bí mật của máy chủ, không đưa vào Git.
- [ ] Nếu dùng Gmail, kiểm tra tài khoản có cho phép mật khẩu ứng dụng hay không. Google yêu cầu bật xác minh hai bước; tài khoản tổ chức có thể bị quản trị viên giới hạn. Mật khẩu ứng dụng khác mật khẩu đăng nhập thông thường. Nguồn: [Google: mật khẩu ứng dụng](https://support.google.com/accounts/answer/185833?hl=vi).
- [ ] Với Gmail SMTP, xác minh cấu hình nhà cung cấp: `smtp.gmail.com`, cổng `465` dùng TLS ngay từ đầu hoặc `587` dùng STARTTLS. Backend hiện dùng tên đăng nhập/mật khẩu SMTP; chưa cấu hình OAuth2 cho SMTP. Nguồn: [Google: Gmail SMTP](https://developers.google.com/workspace/gmail/imap/imap-smtp).
- [ ] Kiểm tra máy chủ VNPT kết nối được cổng đã chọn, tài khoản được phép gửi và `SMTP_FROM` hợp lệ. Cấu hình placeholder `smtp.example.com` không gửi thư thật.
- [ ] Gửi OTP tới hộp thư kiểm thử, xác nhận thư đến hộp nhận hoặc spam, người gửi đúng và mã còn hiệu lực. Lưu kết quả kiểm tra, không lưu OTP hoặc mật khẩu.

### 3. Chuẩn bị và triển khai dữ liệu

- [ ] Kiểm kê tài khoản `verified=false`, trạng thái khóa, vai trò và dữ liệu liên quan; giữ luồng xác minh cũ cho người dùng đủ điều kiện.
- [ ] Sao lưu cơ sở dữ liệu và `STORAGE_PATH`, kiểm tra khả năng khôi phục; diễn tập migration `0015_pending_auth` và `0016_google_identity` trên bản sao.
- [ ] Sau khi diễn tập đạt, người vận hành áp dụng migration và triển khai backend/web cùng đợt. Chưa chạy migration trên production trong lần làm việc này.
- [ ] Thiết lập quy trình xóa các phiên `pending_auth` đã hết hạn ít nhất hằng ngày và theo dõi kết quả. Hiện đã có hướng dẫn thao tác, chưa có lịch tự động. Chỉ xóa phiên hết hạn; không xóa người dùng hoặc phiên còn hiệu lực.

### 4. Kiểm tra thực tế trước khi sử dụng

- [ ] Đăng ký email mới: nhận OTP, nhập sai/hết hạn và nhập đúng; xác nhận tài khoản chỉ được tạo sau OTP đúng, mã cũ không dùng lại được.
- [ ] Đăng ký Google mới: xác nhận tên đơn vị, có thể bỏ trống số điện thoại, nhận OTP, hoàn tất và đăng nhập lại cùng tài khoản.
- [ ] Thử Google đã dùng, email trùng tài khoản cũ, liên kết qua OTP khi được yêu cầu, tài khoản bị khóa và tài khoản cũ chưa xác thực.
- [ ] Thử quên mật khẩu: nhận OTP, tự đặt mật khẩu mới, đăng nhập lại và xác nhận phiên cũ bị thu hồi.
- [ ] Xác nhận giới hạn gửi lại, năm lần nhập sai, lỗi gửi thư và hiển thị lỗi Google; kiểm tra không tạo tài khoản trùng.

### 5. Dọn môi trường phát triển

- [ ] Git đã gỡ đăng ký worktree phụ và nhánh đã được hợp nhất. Thư mục dư chỉ còn `apps/` và `node_modules/` do Windows báo đường dẫn quá dài; lệnh xóa phần dư bị cơ chế bảo vệ chặn. Bốn tài liệu và 58 tệp biên bản đã được sao chép vào checkout gốc.

Các kiểm tra tự động đã dùng PostgreSQL cục bộ và mô phỏng Google/thư. Chúng không chứng minh đăng nhập Google thật, thư đến hộp nhận hay CSP/COOP trên production. Cảnh báo deprecation của `pg@8` đã tồn tại trước thay đổi này.

## Tham khảo mã nguồn mở

- [googleapis/google-auth-library-nodejs](https://github.com/googleapis/google-auth-library-nodejs): dùng thư viện chính thức để backend xác minh chữ ký và các claim của Google ID token.
- [MomenSherif/react-oauth](https://github.com/MomenSherif/react-oauth): tham khảo luồng Google Identity Services và callback; dùng để định hướng hành vi giao diện.
- [better-auth/better-auth](https://github.com/better-auth/better-auth): tham khảo ranh giới liên kết tài khoản và bảo toàn chủ thể đăng nhập.

Hướng dẫn kỹ thuật chi tiết: [triển khai và kiểm tra xác thực](../../../apps/be/README.md#authentication-rollout-and-live-verification). Tài liệu liên quan: [đặc tả](../specs/2026-10-31-google-sign-in-spec.md), [kế hoạch gốc](../plans/2026-10-31-google-sign-in.md), [nghiên cứu Google](../../research/2026-10-31-google-sign-in.md).
