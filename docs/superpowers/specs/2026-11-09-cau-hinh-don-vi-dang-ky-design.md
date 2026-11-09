# Cấu hình đơn vị đăng ký

## Mục tiêu và phạm vi

Người dùng lưu danh sách đơn vị đăng ký của riêng tài khoản để điền nhanh khi tạo hoặc sửa hồ sơ sản phẩm. Việc chọn đơn vị là tùy chọn; người dùng vẫn được nhập thông tin trực tiếp như hiện nay.

Chức năng này chỉ áp dụng cho người dùng tự quản lý hồ sơ của mình. Giữ nguyên luồng quản trị tạo hoặc sửa hồ sơ thay hiện có, không thêm danh sách đơn vị hay chức năng quản lý đơn vị vào luồng đó. Không tự nhập danh sách từ các hồ sơ cũ.

## Dữ liệu và quyền truy cập

Lưu mỗi đơn vị thành một bản ghi riêng, gắn với tài khoản sở hữu. Thông tin gồm tên đơn vị sản xuất, người đại diện, chức vụ, số điện thoại, địa chỉ liên hệ, tỉnh/thành phố và xã/phường; lưu mã xã/phường nếu có để điền lại chính xác. Email liên hệ tiếp tục theo cách hiện tại: lấy từ tài khoản khi tạo hồ sơ, giữ email đã lưu khi sửa hồ sơ; không lưu email riêng cho đơn vị. Năm đăng ký và các thông tin của sản phẩm không thuộc dữ liệu đơn vị.

Để lưu một đơn vị, yêu cầu tên đơn vị, người đại diện, chức vụ, địa chỉ, tỉnh/thành phố và xã/phường; số điện thoại là tùy chọn vì hồ sơ đã có email tài khoản. Kiểm tra độ dài và định dạng theo giới hạn hiện có của các trường tương ứng. Các yêu cầu này không làm thay đổi điều kiện lưu nháp của hồ sơ.

Mỗi yêu cầu xem, thêm, sửa hoặc xóa đơn vị phải xác thực người dùng và giới hạn theo tài khoản sở hữu ở phía máy chủ. Không nhận quyền sở hữu từ dữ liệu do trình duyệt gửi. Quản trị không dùng chức năng này để xem hoặc sửa danh sách của tài khoản khác.

Khi chọn một đơn vị, sao chép các trường tương ứng vào hồ sơ. Hồ sơ không phụ thuộc vào bản ghi đơn vị sau khi chọn: sửa hoặc xóa đơn vị không thay đổi các hồ sơ đã tạo, kể cả bản nháp. Việc nộp hồ sơ tiếp tục sử dụng cơ chế lưu ảnh chụp thông tin hiện có. Không tự thay đổi hay xóa dữ liệu hồ sơ cũ.

## Trải nghiệm sử dụng

- Thêm mục **Cấu hình chung** trong khu vực người dùng để xem danh sách và thêm, sửa, xóa đơn vị của mình. Yêu cầu xác nhận trước khi xóa; thông báo khi danh sách rỗng và khi tải hoặc lưu thất bại.
- Trên màn hình tạo hoặc sửa hồ sơ của người dùng, cho phép chọn đơn vị đã lưu hoặc chuyển sang nhập tay. Điền lại các trường đơn vị và địa bàn từ lựa chọn; năm đăng ký giữ theo hồ sơ. Khi lựa chọn làm thay thế dữ liệu đơn vị đã nhập, thông báo để người dùng xác nhận trước.
- Chỉ khi nhập đơn vị mới, hiện checkbox **Lưu đơn vị này vào Cấu hình chung**. Khi lưu hồ sơ và checkbox được chọn, lưu thông tin đơn vị nếu đầy đủ và hợp lệ. Sau khi lưu thành công, không tạo lại bản ghi khi người dùng tiếp tục lưu cùng hồ sơ.
- Khi chọn đơn vị có sẵn, không hiện checkbox; chỉnh thông tin trong hồ sơ chỉ áp dụng cho hồ sơ. Muốn sửa đơn vị đã lưu, người dùng vào Cấu hình chung.
- Nếu thông tin đơn vị chưa đủ hoặc lưu đơn vị thất bại, vẫn giữ hồ sơ đã lưu và báo rõ đơn vị chưa được lưu. Nếu không xác định được kết quả lưu đơn vị do lỗi kết nối, hướng dẫn kiểm tra danh sách trước khi thử lại để tránh tạo trùng.

Địa bàn được điền theo thông tin đã lưu, nhưng việc kiểm tra và xác định địa bàn hợp lệ khi nộp hồ sơ vẫn tuân theo quy tắc hiện hành. Không sao chép sự kiện đánh giá hoặc mặc định một sự kiện chỉ dựa trên đơn vị.

## Thành phần và luồng dữ liệu

Mở rộng cơ sở dữ liệu với bảng đơn vị thuộc tài khoản, kèm thay đổi cấu trúc dữ liệu tương ứng. Bổ sung chức năng máy chủ cho các thao tác danh sách, thêm, sửa và xóa; xác thực dữ liệu theo giới hạn các trường hiện có và kiểm tra quyền sở hữu cho từng thao tác.

Giao diện Cấu hình chung sử dụng các thành phần biểu mẫu và mẫu gọi dữ liệu sẵn có. Màn hình hồ sơ dùng danh sách của người dùng đang đăng nhập, sao chép thông tin vào biểu mẫu hiện có và giữ cơ chế lưu hồ sơ, tệp đính kèm và nộp hồ sơ hiện hành. Lưu đơn vị từ checkbox là thao tác riêng có thông báo kết quả rõ ràng; lỗi của thao tác này không làm mất hồ sơ đã lưu.

## Kiểm tra

- Thêm, sửa, xóa và chọn đơn vị của chính mình; xác nhận không thể truy cập hoặc sửa đơn vị của tài khoản khác bằng cách thay đổi mã định danh trong yêu cầu.
- Chọn đơn vị điền đúng thông tin và địa bàn, không thay năm đăng ký; nhập tay vẫn hoạt động; xác nhận khi thay dữ liệu đã nhập.
- Checkbox lưu đơn vị mới một lần; hồ sơ nháp được giữ và có thông báo khi thiếu thông tin hoặc lưu đơn vị thất bại.
- Sửa hoặc xóa đơn vị không thay đổi bản nháp, hồ sơ đã nộp hoặc bản in đã có; hồ sơ cũ vẫn mở và sửa theo quy tắc hiện hành.
- Luồng quản trị tạo, sửa hồ sơ thay và các quy tắc kiểm tra, nộp hồ sơ hiện tại tiếp tục hoạt động.
