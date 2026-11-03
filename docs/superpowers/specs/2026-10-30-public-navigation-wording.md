# Điều hướng đăng ký và cách gọi người đăng ký

Trạng thái: người dùng đã xác nhận triển khai theo kế hoạch ngày 2026-10-30.

## Vấn đề

Nút “Tạo tài khoản chủ thể” trên header làm giao diện dư thừa. Cách gọi “chủ thể” trong một số nội dung cũng chưa rõ với người dùng.

## Giải pháp đề xuất

Bỏ nút tạo tài khoản trên header của trang công khai. Rà soát các nội dung hướng dẫn và điều hướng, dùng “người đăng ký” hoặc cách diễn đạt phù hợp với từng ngữ cảnh. Giữ chức năng đăng ký và các thuật ngữ trong biểu mẫu OCOP chính thức.

## Trường hợp sử dụng

1. Là khách chưa đăng nhập, tôi muốn header gọn hơn để tập trung vào điều hướng chính.
2. Là khách dùng điện thoại, tôi muốn menu không có nút tạo tài khoản trên header để giao diện nhất quán với máy tính.
3. Là người đã đăng nhập, tôi muốn tiếp tục vào khu vực làm việc từ header.
4. Là người muốn đăng ký, tôi muốn tiếp tục tìm thấy đường dẫn đăng ký ngoài header.
5. Là người đăng ký, tôi muốn các hướng dẫn và nhãn dễ hiểu để biết thao tác nào dành cho mình.
6. Là người sử dụng biểu mẫu OCOP, tôi muốn thuật ngữ chính thức được giữ nguyên để biểu mẫu tiếp tục đúng ngữ cảnh.

## Quyết định triển khai đề xuất

- Chỉ bỏ nút tạo tài khoản khỏi header khi chưa đăng nhập; giữ các hành động dành cho phiên đã đăng nhập.
- Rà soát nội dung hiển thị thông thường có từ “chủ thể”; thay theo ngữ cảnh, không thay máy móc.
- Giữ nguyên thuật ngữ trong biểu mẫu OCOP chính thức và nội dung pháp lý trích dẫn.
- Giữ đường dẫn đăng ký, xác thực email và quyền tài khoản hiện có; không đổi API hay cơ sở dữ liệu.
- Phạm vi thay từ ngoài header đã được người dùng xác nhận khi yêu cầu thực hiện kế hoạch.

## Quyết định kiểm tra đề xuất

- Kiểm tra hành vi trên giao diện trang công khai: header trên máy tính và menu di động khi chưa đăng nhập và đã đăng nhập; xác nhận đường dẫn đăng ký còn hoạt động ở nơi khác.
- Rà soát các nhãn đã đổi theo ngữ cảnh và xác nhận biểu mẫu chính thức vẫn giữ thuật ngữ cần thiết.
- Chạy kiểm tra kiểu dữ liệu. Dự án đã có các kiểm tra route và các kịch bản giao diện; ưu tiên dùng các điểm kiểm tra hiện có.
- Kiểm tra kết quả hiển thị và hành vi người dùng, tránh ràng buộc vào chi tiết cài đặt.

## Ngoài phạm vi

- Xóa chức năng hoặc tài khoản đăng ký.
- Thay đổi quy trình xác thực, quyền, nội dung pháp lý hoặc dữ liệu hồ sơ.
- Thiết kế lại toàn bộ giao diện.

## Ghi chú

Danh sách nhãn thay cụ thể cần được đối chiếu với ngữ cảnh thực tế khi thực hiện.
