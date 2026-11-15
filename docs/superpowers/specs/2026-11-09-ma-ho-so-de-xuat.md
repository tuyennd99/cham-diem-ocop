# Đặc tả: Mã hồ sơ dễ đọc

**Trạng thái:** Người dùng đã duyệt đặc tả, cách kiểm thử và ba ticket. Chưa triển khai.

## Problem Statement

Mã hồ sơ đang hiển thị là ID kỹ thuật dài, khó đọc và khó trao đổi. Người dùng, Chủ trì, Giám khảo, Quản trị và người tra cứu cần một mã dễ nhận biết mà không làm mất các liên kết, quyền truy cập hoặc dữ liệu hồ sơ hiện có.

## Solution

Giữ ID kỹ thuật của mỗi hồ sơ và bổ sung mã hồ sơ duy nhất, tự sinh để hiển thị và tìm kiếm. Hồ sơ cũ cũng có mã; các đường dẫn theo ID cũ tiếp tục hoạt động.

**Đã duyệt:** Cấp mã ngay khi tạo bản nháp; dùng số tăng dần toàn hệ thống và hiển thị dạng `OCOP-000123` (sáu chữ số là độ rộng tối thiểu); chấp nhận khoảng trống trong dãy; gán mã cho toàn bộ hồ sơ cũ mà không thay ID.

## User Stories

1. Là Người dùng, tôi muốn hồ sơ nháp được cấp mã dễ đọc để trao đổi với người hỗ trợ.
2. Là Người dùng, tôi muốn thấy mã trong danh sách hồ sơ để nhận biết hồ sơ của mình.
3. Là Người dùng, tôi muốn thấy cùng mã ở trang chi tiết để đối chiếu.
4. Là Người dùng, tôi muốn mã không đổi khi sửa, nộp, bị trả hoặc nộp lại để tránh nhầm lẫn.
5. Là Người dùng, tôi muốn hồ sơ cũ cũng có mã để tra cứu theo cùng cách.
6. Là Chủ trì, tôi muốn thấy mã hồ sơ khi xem xét hồ sơ để trao đổi chính xác.
7. Là Chủ trì, tôi muốn tìm bằng mã mới hoặc ID cũ để vẫn tra cứu được thông tin đã lưu.
8. Là Quản trị, tôi muốn tạo hộ hồ sơ và nhận mã duy nhất để hỗ trợ Người dùng.
9. Là Quản trị, tôi muốn tìm hồ sơ theo mã trong danh sách quản lý để xử lý nhanh.
10. Là Giám khảo, tôi muốn xem mã hồ sơ được giao để đối chiếu sản phẩm cần chấm.
11. Là Giám khảo, tôi muốn tìm hồ sơ được giao theo mã mà vẫn giữ phạm vi phân quyền.
12. Là người tra cứu, tôi muốn thấy mã sản phẩm được phép công khai để trao đổi về sản phẩm.
13. Là người tra cứu, tôi muốn tìm sản phẩm công khai theo mã để tìm đúng kết quả.
14. Là người in phiếu, tôi muốn thấy mã nhất quán trên phiếu đăng ký và phiếu chấm để đối chiếu.
15. Là người in lại phiếu cũ, tôi muốn nội dung nghiệp vụ đã ghi nhận không bị thay đổi khi hệ thống bổ sung mã.
16. Là người đã lưu liên kết, tôi muốn đường dẫn ID cũ vẫn hoạt động theo quyền hiện có.
17. Là người vận hành, tôi muốn tạo đồng thời nhiều hồ sơ mà không có mã trùng.
18. Là người vận hành, tôi muốn quá trình gán mã cho dữ liệu cũ bảo toàn ID, liên kết và số lượng hồ sơ.
19. Là người vận hành, tôi muốn không ai được truy cập thêm dữ liệu chỉ vì đoán được mã tăng dần.
20. Là người vận hành, tôi muốn các mã không bị cấp lại khi xóa nháp hoặc khi thao tác tạo thất bại trong quá trình vận hành bình thường.

## Implementation Decisions

### Nhận diện và mã hiển thị

- Giữ ID kỹ thuật đang là khóa chính và các khóa ngoại, đường dẫn, API hiện hành; không thay ID hiện có hoặc chuyển URL công khai sang mã mới.
- Thêm số hồ sơ duy nhất, không đổi, được PostgreSQL cấp bằng sequence; Prisma khai báo giá trị sinh và ràng buộc duy nhất. Không dùng `MAX + 1` và không thêm thư viện.
- Sinh số khi bản nháp được tạo, cho cả Người dùng tạo và Quản trị tạo hộ. Không cấp lại khi sửa, nộp, trả, nộp lại, duyệt hoặc chấm. Cho phép khoảng trống khi giao dịch thất bại hoặc bản nháp bị xóa; không suy ra thứ tự nộp từ mã.
- Hiển thị `OCOP-` cộng số có tối thiểu sáu chữ số, thêm số 0 bên trái khi cần; không cắt số khi vượt sáu chữ số. Đây là định dạng thống nhất cho mọi màn hình và phiếu, không phải dữ liệu nhập thủ công.
- Số mới được cấp an toàn khi tạo đồng thời; ràng buộc duy nhất của database là cơ chế chặn trùng. Không coi tính khó đoán của ID hoặc code là kiểm soát truy cập.

### Dữ liệu cũ và hợp đồng

- Gán số duy nhất cho mọi hồ sơ đã tồn tại theo thứ tự thời điểm tạo tăng dần, dùng ID làm tiêu chí phụ khi thời điểm bằng nhau. Đây là thứ tự chuyển đổi, không khẳng định thứ tự nộp hay số hồ sơ lịch sử.
- Chuyển đổi không xóa, đổi ID hoặc sửa khóa ngoại; kiểm tra số lượng hồ sơ trước/sau và thiết lập sequence để lần cấp tiếp theo không trùng các số đã gán. Không đặt sequence thấp hơn mức đã cấp nếu biết được. Khi nhập hoặc khôi phục dữ liệu, đối chiếu sequence với dữ liệu và mức đã cấp trước khi tiếp tục; bản sao lưu cũ có thể không ghi nhận các mã đã cấp sau thời điểm sao lưu, nên cần đối soát ngoài bản sao lưu trước khi cấp tiếp.
- Bổ sung mã vào dữ liệu API cần cho các màn hình và bản in, giữ các trường ID và cách tra cứu hiện hữu. Số hồ sơ không được người dùng tự chỉnh. Mã công khai không làm thay đổi chính sách công bố hoặc phân quyền.
- Ở các vị trí hiện gọi ID là “Mã hồ sơ”, hiển thị mã mới. Những nơi hiện hỗ trợ tìm theo mã hồ sơ phải tìm được mã mới và vẫn hỗ trợ tìm bằng ID cũ; tìm theo mã hiển thị không phân biệt hoa/thường, hỗ trợ chuỗi con như tìm ID hiện tại.
- Áp dụng cho hồ sơ của Người dùng, khu vực Chủ trì/Quản trị, Giám khảo, danh mục công khai và các phiếu đăng ký/chấm. Không thay đổi điều kiện hồ sơ được nhìn thấy trong từng khu vực.
- Snapshot đăng ký và chấm đã lưu là dữ liệu lịch sử: không sửa nội dung đã lưu. Khi in lại snapshot cũ, bổ sung mã không đổi của cùng hồ sơ và ghi rõ đó là mã hồ sơ hiện tại; không suy diễn mã là thông tin đã có tại thời điểm tài liệu cũ được lập. Tài liệu đã xuất trước đây không bị thay đổi.

## Testing Decisions

- Ranh giới chính là hành vi qua API và PostgreSQL thực, theo các kiểm thử tích hợp cơ sở dữ liệu hiện có; kiểm thử kết quả quan sát được, không phụ thuộc cách triển khai bên trong.
- Kiểm thử tạo đồng thời, số duy nhất, mã không đổi qua sửa và nộp lại; cho phép khoảng trống. Kiểm tra hồ sơ đã gán số không thể trùng và sequence tiếp tục sau chuyển đổi.
- Kiểm thử chuyển đổi trên dữ liệu có nhiều hồ sơ cũ, thời điểm tạo trùng nhau và các bản ghi liên quan; đối chiếu ID, số lượng, tệp, phiếu, phân công, quyền truy cập và liên kết cũ.
- Kiểm thử luồng hiển thị và tìm kiếm cho Người dùng, Chủ trì/Quản trị, Giám khảo và công khai: mã mới, ID cũ, chữ hoa/thường, chuỗi con, phân trang và ranh giới quyền.
- Kiểm thử in hồ sơ nháp, hồ sơ đã nộp và phiếu chấm; in lại snapshot cũ không sửa dữ liệu lịch sử và không mất nội dung. Kiểm thử số lớn hơn sáu chữ số.
- Tái sử dụng kiểm thử API/database và kiểm thử giao diện/in hiện có; bổ sung kiểm thử tại điểm quan sát cao nhất phù hợp, tránh dựng tầng kiểm thử mới không cần thiết.

## Out of Scope

- Thay khóa chính, đường dẫn, quyền truy cập hoặc quy trình duyệt/chấm hồ sơ.
- Đảm bảo dãy số liên tục không khuyết, reset theo năm/địa bàn, mã tùy biến hoặc nhập thủ công.
- Sửa tài liệu đã xuất, viết lại snapshot lịch sử, thêm thư viện tạo mã hoặc tự triển khai dữ liệu vận hành.

## Further Notes

- Người dùng đã duyệt các quyết định, ranh giới kiểm thử và ba ticket triển khai.
- Chưa kiểm tra database thực tế; cần khảo sát dữ liệu và xác minh phương án chuyển đổi khi triển khai.
