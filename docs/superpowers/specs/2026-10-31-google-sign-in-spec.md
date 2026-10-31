# Đặc tả: Đăng nhập và đăng ký bằng Google

Ngày: 31/10/2026. Đặc tả đã được duyệt và phần mã đã triển khai. Xem [trạng thái và các việc còn thiếu](../status/2026-10-31-google-sign-in-status.md) để theo dõi cấu hình và kiểm tra thực tế.

## Problem Statement

Người dùng hiện phải đăng ký bằng email, mật khẩu và xác thực OTP trước khi đăng nhập. Họ cần thêm lựa chọn dùng tài khoản Google để tiếp cận hệ thống, trong khi tài khoản, hồ sơ và quyền đã có phải được bảo vệ.

## Solution

Người dùng đăng nhập bằng email/mật khẩu hoặc Google. Khi đăng ký bằng email hoặc Google, người dùng xác thực OTP gửi tới email trước khi tài khoản người đăng ký được tạo. Đăng ký bằng Google đã được dùng phải báo tài khoản Google đã được dùng. Khi quên mật khẩu, người dùng nhập email, nhận OTP và tự đặt mật khẩu mới sau khi xác thực mã. Khi Google trùng email với tài khoản cũ, hai cách đăng nhập dùng chung một tài khoản; lần liên kết đầu có thể yêu cầu OTP như mô tả bên dưới.

## User Stories

1. Là người mới, tôi muốn chọn Google để đăng ký, để không phải tạo mật khẩu khi bắt đầu.
2. Là người mới, tôi muốn thấy email Google được điền sẵn, để biết email nào gắn với tài khoản.
3. Là người mới, tôi muốn thấy tên Google được gợi ý nếu có, để giảm việc nhập liệu.
4. Là người mới, tôi muốn xác nhận hoặc sửa tên người đăng ký hoặc đơn vị, để thông tin phù hợp giấy phép của mình.
5. Là người mới, tôi muốn có thể nhập số điện thoại hoặc bỏ trống, để cung cấp thông tin liên hệ khi cần.
6. Là người mới, tôi muốn được cấp vai trò người đăng ký, để tạo và quản lý hồ sơ sản phẩm.
7. Là người đã có tài khoản, tôi muốn đăng nhập bằng Google khi email trùng, để tiếp tục dùng dữ liệu và quyền hiện có.
8. Là người đã đăng nhập Google trước đó, tôi muốn đăng nhập lại vào cùng tài khoản, để không tạo bản ghi trùng.
9. Là người dùng, tôi muốn được thông báo khi Google bị hủy, từ chối hoặc không cung cấp thông tin cần thiết, để biết cách tiếp tục.
10. Là người dùng bị khóa, tôi muốn hệ thống từ chối đăng nhập, để trạng thái khóa vẫn có hiệu lực.
11. Là người dùng email và mật khẩu, tôi muốn các chức năng đăng nhập, xác thực và khôi phục mật khẩu hiện tại tiếp tục hoạt động.
12. Là người vận hành, tôi muốn cấu hình SMTP và thử gửi OTP thật, để thư xác thực đến được người nhận.
13. Là người vận hành, tôi muốn cấu hình Google theo từng môi trường mà không đưa bí mật vào mã nguồn, để triển khai an toàn.
14. Là người mới, tôi muốn xác thực OTP gửi tới email trước khi tài khoản được tạo, để chứng minh tôi có thể nhận thư.
15. Là người vận hành, tôi muốn giới hạn yêu cầu OTP và số lần nhập sai, để giảm việc tạo tài khoản tự động và lạm dụng gửi thư.
16. Là người đăng ký bằng email, tôi muốn xác thực OTP trước khi tài khoản được tạo, để chỉ tài khoản đã xác thực mới được tạo.
17. Là người đăng ký bằng Google, tôi muốn biết nếu tài khoản Google đó đã được dùng, để chuyển sang đăng nhập.
18. Là người quên mật khẩu, tôi muốn nhận OTP qua email và tự đặt mật khẩu mới, để lấy lại quyền truy cập.
19. Là người có tài khoản cũ, tôi muốn xác thực OTP khi liên kết Google với email bên thứ ba mà Google không xác nhận được quyền sở hữu hiện tại, để bảo vệ tài khoản.

## Implementation Decisions

- Giữ lựa chọn đăng nhập email/mật khẩu hiện có; bổ sung lựa chọn Google ở luồng xác thực. Không giả định người dùng Google có mật khẩu Google trong hệ thống.
- Google cung cấp email, mã định danh Google ổn định `sub` và có thể cung cấp tên hiển thị. Email dùng để đối chiếu tài khoản hiện có; `sub` dùng để nhận diện liên kết Google về sau. Không dùng tên Google như tên pháp lý đã được xác nhận.
- Với email chưa có tài khoản, hiển thị email và gợi ý tên nếu có; người dùng phải nhập hoặc xác nhận tên người đăng ký/đơn vị hợp lệ. Số điện thoại là tùy chọn. Gửi OTP tới email và chỉ tạo tài khoản `REGISTRANT` sau khi xác thực OTP thành công, kể cả với Gmail hoặc Google Workspace. Không cấp phiên đăng nhập trước khi hoàn tất xác thực và tạo tài khoản.
- Với đăng ký email/mật khẩu, chỉ tạo tài khoản sau khi OTP email hợp lệ; giữ an toàn thông tin đăng ký tạm và tương thích với đặc tả đăng ký sau OTP hiện có.
- Trên luồng đăng ký Google, nếu danh tính Google đã gắn với tài khoản, báo “Tài khoản Google này đã được dùng” và hướng dẫn đăng nhập; không tạo tài khoản thứ hai. Nếu email trùng một tài khoản chưa liên kết, không tạo thêm tài khoản và hướng dẫn người dùng sang luồng đăng nhập để liên kết theo chính sách bên dưới.
- Gắn OTP với yêu cầu đăng ký Google đã xác minh, giới hạn số lần gửi và nhập sai, đặt thời hạn và ngăn sử dụng lại. OTP giảm lạm dụng tạo tài khoản và chứng minh quyền nhận thư; không bảo đảm chặn toàn bộ bot. Không tạo bản ghi người dùng trước OTP thành công.
- Với email đã có tài khoản đã xác thực và còn hoạt động, đăng nhập vào tài khoản đó, không tạo tài khoản mới và không thay đổi vai trò, quyền, hồ sơ hoặc mật khẩu. Lần đầu liên kết Google với email bên thứ ba mà Google không có thẩm quyền xác nhận quyền sở hữu hiện tại, gửi OTP tới email và chỉ liên kết, cấp phiên sau khi OTP hợp lệ. Với Gmail hoặc Google Workspace đáp ứng điều kiện Google xác nhận quyền sở hữu, có thể liên kết và đăng nhập ngay. Các lần đăng nhập sau dùng liên kết `sub` đã xác thực; vẫn kiểm tra tài khoản còn hoạt động và được xác thực.
- OTP liên kết gắn với yêu cầu và danh tính Google đã xác minh; sai, hết hạn, dùng lại hoặc vượt giới hạn đều không liên kết hoặc cấp phiên. Không tự kích hoạt tài khoản chưa xác thực chỉ nhờ email trùng; hướng dẫn người dùng xác thực email theo luồng hiện có.
- Xác minh ID token ở backend bằng thư viện đáng tin cậy: chữ ký, issuer, audience và thời hạn; từ chối token không hợp lệ hoặc thiếu dữ liệu cần thiết. Không tin email, vai trò hoặc trạng thái xác thực do trình duyệt tự khai báo.
- Không cho phép tài khoản bị khóa đăng nhập. Không tự nâng quyền hoặc tự kích hoạt tài khoản hiện có chưa xác thực mà không có xác minh quyền sở hữu phù hợp. Giữ kiểm tra phiên và chuyển hướng theo quyền hiện có.
- Lưu liên kết Google với ràng buộc duy nhất; xử lý đồng thời và email trùng sao cho không tạo hai tài khoản hoặc ghi đè tài khoản có sẵn. Không lưu mật khẩu Google hoặc mã xác thực trong log.
- Cần điều chỉnh mô hình mật khẩu và các luồng liên quan cho tài khoản chỉ dùng Google, đồng thời bảo toàn dữ liệu và hành vi tài khoản mật khẩu hiện có. Không tự đặt mật khẩu biết trước hoặc giả vờ người dùng đã có mật khẩu.
- Quên mật khẩu: gửi OTP tới email, sau đó cho người dùng tự đặt mật khẩu mới khi OTP hợp lệ. Không gửi mật khẩu qua email hoặc thay mật khẩu khi mới yêu cầu OTP. Giữ các giới hạn OTP, phản hồi chung và thu hồi phiên cũ sau khi đặt lại mật khẩu như luồng hiện tại.
- Dùng dịch vụ SMTP hiện có để gửi OTP khi luồng yêu cầu; cấu hình bằng biến môi trường, không lưu thông tin xác thực trong mã hoặc tài liệu. SMTP placeholder trong môi trường phát triển chỉ ghi log và không chứng minh gửi thư thật. Với Gmail trên VNPT Cloud, máy chủ cần kết nối SMTP đi và tài khoản được phép dùng phương thức xác thực đã cấu hình.
- Đặc tả đăng ký sau OTP ngày 23/10/2026 là đề xuất chưa áp dụng. Yêu cầu mới bao gồm áp dụng nguyên tắc tạo tài khoản sau OTP cho cả đăng ký email/mật khẩu; đối chiếu đặc tả đó và xử lý các hợp đồng, dữ liệu cũ liên quan khi lập kế hoạch.

## Testing Decisions

- Ưu tiên kiểm thử hành vi từ giao diện/API và dữ liệu quan sát được, không khóa kiểm thử vào cách tổ chức nội bộ. Điểm kiểm thử chính đề xuất là hành trình xác thực qua API cùng cơ sở dữ liệu; mô phỏng phản hồi Google và dịch vụ thư tại ranh giới bên ngoài.
- Kiểm tra tạo người đăng ký mới, xác nhận tên, số điện thoại tùy chọn, thiếu email/tên, hủy Google và đăng nhập lại cùng danh tính.
- Kiểm tra không tạo tài khoản hoặc cấp phiên trước OTP thành công; từ chối OTP sai, hết hạn, dùng lại và vượt giới hạn; gửi lại và các yêu cầu đồng thời không tạo tài khoản trùng.
- Kiểm tra đăng ký email/mật khẩu chỉ tạo tài khoản sau OTP; đăng ký Google đã liên kết báo đã được dùng và không tạo bản ghi thứ hai.
- Kiểm tra email trùng theo từng loại tài khoản, tài khoản chưa xác thực hoặc bị khóa, không thay đổi quyền/dữ liệu, và xử lý đồng thời hoặc yêu cầu lặp.
- Kiểm tra OTP liên kết lần đầu đối với email bên thứ ba không do Google xác nhận quyền sở hữu hiện tại: sai, hết hạn hoặc dùng lại không cấp phiên; OTP đúng liên kết đúng tài khoản và các lần tiếp theo đăng nhập qua `sub`. Kiểm tra Gmail/Workspace đủ điều kiện liên kết ngay và tài khoản bị khóa hoặc chưa xác thực vẫn bị từ chối.
- Kiểm tra token sai chữ ký, sai audience/issuer, hết hạn hoặc thiếu claim; từ chối mà không cấp phiên hoặc tạo tài khoản.
- Kiểm tra hồi quy đăng nhập mật khẩu, đăng ký/OTP, quên và đổi mật khẩu, thu hồi phiên và phân quyền. Dựa trên các kiểm thử API và cơ sở dữ liệu xác thực hiện có.
- Kiểm tra giao diện biểu mẫu và lỗi; thử cấu hình SMTP thật với hộp thư được phép sử dụng. Kiểm thử giả lập thư không chứng minh thư đã đến hộp nhận.

## Out of Scope

- Lấy số điện thoại bằng Google People API, đồng bộ ảnh đại diện hoặc truy cập dữ liệu Google ngoài thông tin đăng nhập cơ bản.
- Thêm nhà cung cấp đăng nhập khác, tự cấp quyền nhân viên, hoặc thay thế hệ thống email/OTP hiện có.
- Tự xóa hoặc thay đổi dữ liệu tài khoản hiện hữu ngoài các thao tác được xác thực và yêu cầu.

## Further Notes

- Google lưu ý `email_verified` có thể không chứng minh quyền sở hữu hiện tại với email bên thứ ba không thuộc Gmail hoặc Google Workspace; quyết định yêu cầu OTP một lần khi liên kết dựa trên giới hạn này. Nguồn: [Google: Verify the Google ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
- Người dùng đã chọn gửi OTP để tự đặt mật khẩu thay cho gửi mật khẩu qua email. Nguồn tham khảo: [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
- Việc gửi OTP thật phụ thuộc cấu hình SMTP và khả năng kết nối của môi trường triển khai; chưa có bằng chứng thử gửi từ máy chủ VNPT Cloud.
- Ghi chép nguồn: [Nghiên cứu thông tin đăng nhập Google](../../research/2026-10-31-google-sign-in.md).
