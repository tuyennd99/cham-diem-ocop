# Bản nháp ticket: SEO sản phẩm OCOP

Nguồn: [Đặc tả SEO sản phẩm OCOP với TanStack Start](https://github.com/tuyennd99/cham-diem-ocop/issues/15). Đây là bản nháp để duyệt, chưa phải các issue con trên GitHub. Không triển khai trước khi thiết kế được người dùng duyệt.

Các ticket giữ một frontend hiện tại với Vite và TanStack Start, backend NestJS, URL sản phẩm hiện có và quyền truy cập hiện hành. Một hồ sơ chỉ đủ điều kiện SEO khi có `approvedAt` và trạng thái hiện tại là `APPROVED`, `SCORING` hoặc `COMPLETED`. Điểm, xếp sao chỉ công khai theo chính sách công bố kết quả hiện có. Không phát hành từng phần ra môi trường công khai khi toàn bộ quy tắc SEO và kiểm tra tích hợp chưa hoàn tất.

## 1. Trang chủ SSR với sản phẩm đã duyệt

**Chặn bởi:** Không có.

### Việc cần làm

Tích hợp TanStack Start vào frontend hiện tại để người truy cập và công cụ tìm kiếm nhận được trang chủ có nội dung trong HTML ban đầu. Trang chủ chỉ giới thiệu những sản phẩm đủ điều kiện SEO; các luồng đăng nhập, Người dùng, Giám khảo và Quản trị tiếp tục hoạt động phía trình duyệt. Tạo nguồn xác định điều kiện đủ dùng lại cho các trang tiếp theo.

### Tiêu chí nghiệm thu

- [ ] Build ứng dụng và request trực tiếp trang chủ trả HTML có nội dung, tiêu đề, mô tả, canonical và sản phẩm đủ điều kiện, không cần chạy JavaScript.
- [ ] Hồ sơ chưa được duyệt, đã trả lại hoặc thiếu dấu vết duyệt không xuất hiện trong HTML trang chủ; hồ sơ đã duyệt và vẫn đang chấm hoặc hoàn tất có thể xuất hiện.
- [ ] Không thay đổi hợp đồng API công khai hiện có cho các luồng khác; dữ liệu kết quả chưa công bố không bị lộ.
- [ ] Router và QueryClient được cô lập theo request SSR; kiểm tra đồng thời không lẫn session hoặc dữ liệu giữa người dùng. Header hoạt động đúng sau hydration.
- [ ] Kiểm tra route đăng nhập, điều hướng và một luồng khu vực công việc hiện có không hồi quy; backend lỗi không bị báo thành trang thành công rỗng.

## 2. Danh sách công khai có thể tìm kiếm và phân trang

**Chặn bởi:** Ticket 1.

### Việc cần làm

Dựng danh sách sản phẩm công khai trên máy chủ với cùng quy tắc duyệt, đồng thời giữ chức năng tìm kiếm, lọc và phân trang cho người truy cập.

### Tiêu chí nghiệm thu

- [ ] HTML ban đầu của danh sách chỉ chứa sản phẩm đủ điều kiện, có tên và liên kết tới chi tiết; tìm kiếm và lọc không đưa sản phẩm chưa đủ điều kiện vào nội dung có thể lập chỉ mục.
- [ ] Mỗi trang danh sách có URL riêng và liên kết HTML tuần tự; trang 2 có thể mở trực tiếp, refresh và điều hướng quay lại. Canonical của mỗi trang trỏ về trang đó; trang đầu có một URL nhất quán.
- [ ] Tiêu đề, mô tả và canonical có trong HTML ban đầu; các biến thể tìm kiếm/lọc không cần lập chỉ mục.
- [ ] Kiểm thử dữ liệu vượt quá một trang, có hồ sơ chưa duyệt và hồ sơ thiếu dấu vết duyệt; không trùng hoặc bỏ sót sản phẩm đủ điều kiện.
- [ ] API lỗi trả trạng thái lỗi phù hợp, không báo danh sách rỗng thành công; kiểm thử các trường hợp rỗng và lọc vẫn dùng được.

## 3. Chi tiết sản phẩm đã duyệt với metadata SEO

**Chặn bởi:** Ticket 1.

### Việc cần làm

Dựng trang chi tiết sản phẩm trên máy chủ theo URL hiện tại, có metadata và ảnh chia sẻ. Áp dụng cùng quy tắc duyệt để trang đủ điều kiện có thể được lập chỉ mục và trang chưa đủ điều kiện được đánh dấu phù hợp.

### Tiêu chí nghiệm thu

- [ ] HTML ban đầu của sản phẩm đủ điều kiện chứa tên, mô tả công khai, canonical, title, description và Open Graph; ảnh chia sẻ dùng URL công khai tuyệt đối, có fallback khi thiếu ảnh hoặc mô tả.
- [ ] Chi tiết hồ sơ chưa đủ điều kiện nhưng hiện được xem công khai vẫn truy cập trực tiếp và trả `noindex`; hồ sơ không còn công khai hoặc không tồn tại trả `404`.
- [ ] Hồ sơ `SCORING` hoặc `COMPLETED` thiếu `approvedAt` không được lập chỉ mục; khi điều kiện duyệt thay đổi, phản hồi tiếp theo phản ánh trạng thái mới.
- [ ] Điểm và xếp sao chưa công bố không xuất hiện trong HTML hoặc metadata; không coi điểm OCOP là đánh giá của khách hàng.
- [ ] API tạm lỗi trả lỗi server phù hợp, không giả thành `404`; dữ liệu có ký tự đặc biệt được escape, hydration và điều hướng hoạt động.

## 4. Sitemap và kiểm tra tích hợp SEO

**Chặn bởi:** Ticket 2 và ticket 3.

### Việc cần làm

Cung cấp sitemap và chỉ dẫn crawler cho các trang thực sự có thể lập chỉ mục, sau đó kiểm tra toàn bộ hành trình công khai trước khi bàn giao phát hành.

### Tiêu chí nghiệm thu

- [ ] Sitemap hợp lệ chứa trang chủ, danh sách và toàn bộ URL sản phẩm đủ điều kiện qua mọi trang dữ liệu; không trùng URL, không chứa hồ sơ chưa duyệt hoặc trang riêng tư.
- [ ] Khi sản phẩm được duyệt hoặc không còn đủ điều kiện, HTML và sitemap phản ánh thay đổi; không cache chung nội dung có thể gây trạng thái cũ. API lỗi làm sitemap báo lỗi, không trả sitemap rỗng thành công.
- [ ] `robots.txt` chỉ tới sitemap và không chặn crawler đọc trang cần nhận `noindex`. Kiểm thử HTTP, metadata, trạng thái, phân trang và sitemap theo cùng bộ dữ liệu.
- [ ] Kiểm thử đăng nhập, phân quyền và hai phiên đồng thời; ghi kết quả và các điều kiện cần cho runtime SSR, địa chỉ backend, hostname và phương án quay lại bản cũ.
- [ ] Bàn giao danh sách kiểm tra HTML gốc, chia sẻ và Search Console cho người vận hành; không tự triển khai production hoặc gửi sitemap chỉ vì ticket được tạo.

## Phụ thuộc dự kiến

- Ticket 1 có thể bắt đầu trước; ticket 2 và 3 có thể thực hiện sau ticket 1.
- Ticket 4 chờ ticket 2 và 3 để kiểm tra sitemap với các trang đã hoàn chỉnh.
