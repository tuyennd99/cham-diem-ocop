# Prompt Open Design: OCOP

Báo cáo nguồn được tạo trên nhánh/commit khác; các prompt dưới đây nhắm vào phần giao diện còn thiếu trong checkout hiện tại. Dùng riêng từng prompt. Giữ ngôn ngữ giao diện tiếng Việt và bộ nhận diện hiện có trong `apps/web/src/styles.css` (xanh lá, nền sáng ấm, Be Vietnam Pro/Lora/JetBrains Mono). Thiết kế responsive, bàn phím và screen reader dùng được; không dựng số liệu giả.

## 1. Xác thực email OTP — màn hình mới `/verify-otp`

Thiết kế màn hình xác thực email riêng cho đăng ký OCOP. Có nhập email, mã 6 chữ số, trạng thái đang gửi/đang xác thực, mã sai hoặc hết hạn, gửi lại mã với đếm ngược 60 giây, đổi email và quay lại đăng nhập. Dùng `POST /api/auth/verify-otp` và `POST /api/auth/resend-otp`; nội dung phản hồi gửi lại phải trung tính để không tiết lộ email đã đăng ký hay chưa. Tối ưu auto-fill OTP, dán đủ 6 số, focus, lỗi từng trường và thông báo `aria-live`. Cung cấp desktop, mobile, loading, error và success states.

## 2. Đổi mật khẩu — màn hình mới `/account/password`

Thiết kế trang đổi mật khẩu trong khu vực tài khoản, dùng `POST /api/auth/change-password`. Trường mật khẩu hiện tại, mật khẩu mới, nhập lại mật khẩu; chỉ báo yêu cầu tối thiểu 8 ký tự, nút hiện/ẩn, lỗi xác thực và xác nhận thành công. Không hiển thị lại mật khẩu. Ghi rõ trong handoff: API hiện không thu hồi các JWT đã phát hành ở thiết bị khác. Thêm liên kết từ trang `/account`. Cung cấp desktop/mobile và trạng thái đang gửi, sai mật khẩu hiện tại, mật khẩu mới không hợp lệ, thành công.

## 3. Dashboard quản trị — màn hình mới `/admin`

Thiết kế trang tổng quan cho quản trị viên OCOP: số hồ sơ theo trạng thái, số phiếu đã nộp/chưa hoàn tất theo giám khảo, nhóm hồ sơ cần xử lý tiếp, liên kết nhanh đến hồ sơ, giám khảo và phân công. Dùng nhãn tiếng Việt cho `DRAFT`, `SUBMITTED`, `SCORING`, `COMPLETED`. Không dùng biểu đồ nếu các thẻ số và bảng tiến độ truyền đạt rõ hơn. Backend hiện chưa có endpoint tổng hợp riêng; ghi rõ dữ liệu/API còn cần, không tạo dữ liệu mẫu như dữ liệu thật. Có empty/loading/error state và bố cục mobile.

## 4. Phiếu chấm — chỉnh `/judge/products/$id`

Thiết kế lại phiếu chấm để thay `<select>` bằng các lựa chọn điểm dạng radio card, mỗi lựa chọn hiện điểm và mô tả nguyên văn. Thêm điều hướng tiêu chí bên cạnh, tiến độ đã chọn `x/y`, tổng điểm tạm tính, phạm vi tiêu chí được giao, vùng đọc thông tin Mẫu 01 bằng nhãn dễ quét thay vì JSON, và khu vực mở ảnh/PDF minh chứng. Nút lưu nháp và nộp phiếu rõ ràng; nộp cần xác nhận, phiếu đã nộp ở trạng thái chỉ đọc. Chỉ hiện tiêu chí được phân công từ API. Thiết kế mobile không dùng sidebar cố định; giữ thao tác bàn phím và focus rõ.

## 5. Phân công — chỉnh `/admin/assignments`

Thiết kế ma trận phân công theo nhóm sản phẩm và giám khảo, cho phép xem nhanh phạm vi tiêu chí, phát hiện nhóm chưa được phủ đủ tiêu chí, và xem trước khác biệt trước khi lưu. Endpoint `PUT /api/admin/assignments` thay thế toàn bộ danh sách phân công, nên nút lưu phải nói rõ phạm vi thay thế và yêu cầu xác nhận khi có thay đổi; không làm người dùng tưởng chỉ lưu dòng đang sửa. Hiện cảnh báo thiếu phủ tiêu chí trước khi gửi; lỗi backend cần chỉ ra nhóm liên quan. Có loading/error/success và responsive mobile.

## 6. Trang chủ và tra cứu — chỉnh `/` và `/products`

Thiết kế trang chủ giới thiệu OCOP có dải đủ 5 mức sao, gồm cả dưới 30 điểm là 1 sao, và lưới sản phẩm nổi bật có lọc nhóm. Trang `/products` cần ô tìm kiếm toàn bộ danh mục, lọc nhóm, phân trang giữ nguyên bộ lọc và nút xóa từ khóa. Tìm kiếm gọi API với `q`, `categoryId`, `page`, không chỉ lọc 20 hồ sơ đang tải. Không tự đặt ngưỡng sao khác: 90/70/50/30 điểm lần lượt đạt 5/4/3/2 sao, dưới 30 là 1 sao. Có empty/loading/error state.

## 7. Chi tiết công khai — chỉnh `/products/$id`

Thiết kế trang chi tiết sản phẩm công khai với tên, nhóm/phân nhóm, mô tả, thư viện ảnh, trạng thái tiếng Việt và kết quả tổng điểm/sao khi đã có. Không hiện email, điện thoại, dữ liệu nội bộ hay tệp PDF minh chứng. API hiện chỉ trả kết quả tổng; nếu đề xuất bảng điểm từng tiêu chí, đánh dấu rõ là cần API/publication-policy bổ sung và chỉ hiển thị khi hồ sơ đã hoàn tất, không mock điểm chi tiết.

## 8. Kết quả chủ thể — chỉnh `/my/products/$id`

Thiết kế phần kết quả trong hồ sơ chủ thể: trạng thái, thời điểm nộp ổn định, tổng điểm và số sao khi đã tổng hợp; nếu chưa hoàn tất thì giải thích đang chờ đánh giá. Có khu vực điểm theo tiêu chí chỉ khi API chủ thể được phép trả breakdown. Trạng thái “yêu cầu bổ sung” chưa tồn tại trong state machine hiện tại: không vẽ như tính năng đã dùng; có thể trình bày riêng một phương án đề xuất kèm yêu cầu trạng thái/lý do từ backend.

## 9. Trang lỗi và trạng thái tải — thêm 403/404, áp dụng chung

Thiết kế trang 403 và 404 nhất quán với giao diện OCOP, giải thích ngắn gọn, có đường quay lại nơi an toàn (khu vực phù hợp với vai trò hoặc trang chủ). Thêm skeleton tải cho danh sách hồ sơ, dashboard và phiếu chấm; giữ chỗ đúng kích thước để tránh nhảy bố cục. Không hiển thị thông tin nhạy cảm trong lỗi quyền truy cập. Thiết kế desktop/mobile và trạng thái giảm chuyển động.
