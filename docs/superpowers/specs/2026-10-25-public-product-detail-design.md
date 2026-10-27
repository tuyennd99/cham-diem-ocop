# Thiết kế đề xuất: sửa UI chi tiết sản phẩm OCOP

Ngày: 25/10/2026. Trạng thái: kế hoạch đã thu hẹp theo yêu cầu người dùng; chưa triển khai.

## Mục tiêu và căn cứ

Sửa bố cục của `/products/$id` để tên sản phẩm, mô tả, ảnh và trạng thái đánh giá dễ đọc, tận dụng diện tích hợp lý với dữ liệu API hiện có. Người dùng đã chọn **chỉnh bố cục, chỉ sửa UI**; tài liệu này thay thế phạm vi dữ liệu/backend trong bản kế hoạch trước.

Nguồn: `PRODUCT.md`, giao diện hiện có, `PublicProductDetailPage.tsx`, và `.impeccable/critique/2026-10-25T14-49-31Z__apps-web-src-pages-public-publicproductdetailpage-tsx.md`. Mode: Read; code-first; giữ màu xanh OCOP, nền sáng và font hiện tại. `design.md` ở root áp dụng cho admin, không phải nguồn để đổi giao diện public.

## Phạm vi

Chỉ sửa hai file triển khai:

- `apps/web/src/pages/public/PublicProductDetailPage.tsx`
- `apps/web/src/styles.css` — CSS có scope riêng cho public detail.

Dùng các trường hiện có: name, description, category, status, finalScore, starRating, attachments. Không sửa schema, migration, API, type dữ liệu, form nhập, admin/registrant, header/footer hoặc bộ lọc catalog. Không thêm dependency.

Mong muốn địa điểm và chi tiết tham quan đã được ghi nhận nhưng nằm ngoài đợt sửa UI này, vì API chưa trả các trường đó. Không thêm khối địa điểm trống, câu hứa “đang bổ sung”, hoặc suy diễn địa chỉ/giờ mở cửa từ mô tả và hồ sơ đăng ký.

## Bố cục được chọn

Thứ tự đọc:

1. Liên kết “← Danh sách sản phẩm”.
2. Nhãn trạng thái, tên sản phẩm và tên danh mục.
3. Vùng nội dung: ảnh chính bên trái; giới thiệu và kết quả đánh giá bên phải.
4. Các ảnh còn lại, nếu có.

Tất cả nằm trong `.container` hiện có, tối đa 1440px; liên kết, tiêu đề và vùng nội dung dùng chung trục trái. Bỏ `.route-panel` lớn bao toàn trang; không tạo một khung trắng có nhiều khoảng trống.

| Hạng mục | Desktop | Màn hình nhỏ |
| --- | --- | --- |
| Padding trang | 24px trên, 48px dưới | 20px trên, 32px dưới ở dưới 768px |
| Header → nội dung | 24px | 20px |
| Vùng ảnh / nội dung | Từ 1024px: hai cột 5:7, gap 32px | Dưới 1024px: một cột, gap 24px |
| H1 | Lora 40px, line-height 1.25 | Lora 30px dưới 768px |
| H2 | Be Vietnam Pro 600, 20px | Cùng quy tắc |
| Nội dung | 16px, line-height 1.6, tối đa 70ch | Cùng quy tắc |
| Ảnh bổ sung | Ba cột từ 1024px | Hai cột từ 480px; một cột dưới 480px |

Giữ gutter của container, không cộng thêm lớp padding ngang. Tên sản phẩm dài tối đa 255 ký tự xuống dòng tự nhiên; không ellipsis. Chỉ hiển thị `category.name` dưới tên sản phẩm để tránh lặp hai cấp danh mục. Phần “Giới thiệu” chỉ xuất hiện khi có description.

Trên tablet/mobile: trạng thái và tên → ảnh chính → giới thiệu → kết quả → ảnh bổ sung. DOM theo thứ tự này, không dùng CSS order để đảo thứ tự đọc. Vùng ảnh chính ở layout một cột tối đa 640px và căn trái.

Khi không có attachment, dùng một cột nội dung: giới thiệu, kết quả và một thông báo thiếu ảnh gọn. Không giữ cột ảnh rỗng hoặc placeholder lớn.

## Cách trình bày ảnh

- Một ảnh: hiển thị thành ảnh chính rộng hết cột ảnh, khung 4:3, `object-fit: contain` và nền phụ hiện có; không cắt bao bì hoặc cảnh vật.
- Nhiều ảnh: ảnh đầu ở vùng chính, các ảnh còn lại trong section “Hình ảnh khác” bên dưới vùng chính, tận dụng toàn chiều rộng container. Không thêm slider, modal zoom hoặc nút chưa có chức năng.
- Không có ảnh: “Chưa có hình ảnh công khai cho sản phẩm này.” Lỗi tải ảnh: “Không tải được hình ảnh này.” tại vị trí ảnh; phần thông tin vẫn đọc được.
- Ảnh đầu không lazy-load; ảnh tiếp theo lazy-load. URL và thứ tự attachment giữ theo API hiện có.
- Alt dùng tên sản phẩm và số thứ tự vì API chưa có chú thích ảnh; không bịa mô tả nội dung ảnh.
- Giữ attachment “OCOP Viet Nam” đang có. Chưa xác định nó là ảnh sản phẩm hay ảnh thay thế; đợt UI không tự xóa, nhận diện theo tên file hoặc thay bằng ảnh điểm đến khác.

## Trạng thái và kết quả

Các thay đổi câu chữ chỉ nằm trong trang detail, không sửa constant dùng chung:

| Status | Nhãn tại detail | Nội dung giải thích |
| --- | --- | --- |
| SUBMITTED | Đã tiếp nhận | Hồ sơ đã được tiếp nhận và đang chờ đánh giá. |
| SCORING | Đang đánh giá | Hồ sơ đang được chấm theo bộ tiêu chí OCOP. |
| COMPLETED | Đã hoàn tất đánh giá | Hiển thị kết quả có sẵn; thiếu điểm: “Chưa có kết quả đánh giá để hiển thị.” |

Hiển thị kết quả chỉ ở COMPLETED. Dùng `formatExactScore` và `formatStarRatingLabel` hiện có; xử lý điểm và sao thiếu độc lập, không hiện “null sao”. Bên dưới kết quả có câu: “Kết quả được tính từ phiếu chấm trong hệ thống, không thay thế quyết định công nhận OCOP.” Không thay đổi cách tính điểm hoặc dữ liệu trạng thái.

## Loading và lỗi

- Initial loading: skeleton theo bố cục header + ảnh + nội dung, có thông báo đang tải. Không hiện thông báo thiếu ảnh hoặc kết quả khi request chưa xong.
- 404: “Không tìm thấy sản phẩm công khai”, liên kết về danh sách.
- Lỗi mạng khi chưa có dữ liệu: “Chưa tải được sản phẩm”, nút “Thử lại” gọi refetch có sẵn.
- Refresh lỗi khi có cache: giữ nội dung, hiện thông báo cập nhật thất bại và nút thử lại. Không thay nội dung đã đọc bằng màn hình lỗi toàn trang.
- Tất cả trạng thái dùng cùng container và khoảng cách, tránh thay đổi chiều rộng đột ngột.

## Nghiệm thu

Dùng viewport 320, 390, 768, 1440, 1920px. Kiểm tra tên 255 ký tự; description rỗng/dài/nhiều dòng; 0/1/nhiều ảnh, ảnh dọc/ngang/lỗi; ba status, điểm hoặc sao null; loading, 404, lỗi mạng và cache có dữ liệu.

Không cuộn ngang toàn trang; không cắt chữ để ép vừa; nút/link có focus rõ và vùng bấm tối thiểu 44px trên thiết bị cảm ứng. Ghi lại ảnh đối chiếu và kết quả kiểm tra khi triển khai. Chất lượng ảnh và việc thiếu dữ liệu địa điểm/tham quan là giới hạn nội dung còn lại sau đợt UI.

