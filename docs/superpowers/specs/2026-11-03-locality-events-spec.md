# Đặc tả dự thảo: Chuyển Địa bàn thành Sự kiện, tự sinh mã theo số thứ tự và tách hai khoảng thời gian

Ngày: 03/11/2026. Trạng thái: dự thảo để xem xét; chưa triển khai.

## Problem Statement

Hiện tại phân hệ quản trị đang gọi mỗi bản ghi là "Địa bàn", yêu cầu quản trị viên nhập mã địa bàn (hoặc tự gộp mã hành chính cố định `XP-<code_xã>`) và chỉ có một khoảng thời gian hiệu lực duy nhất (`effectiveFrom` – `effectiveTo`). Mô hình này phát sinh ba bất cập:

1. Một xã/phường tổ chức nhiều đợt đánh giá OCOP theo từng giai đoạn (ví dụ đợt 1 từ 01/05/2026 đến 31/10/2026, đợt 2 từ 01/11/2026 đến 31/12/2026) không thể dùng mã hành chính cố định lặp lại và cũng không có tên sự kiện riêng để phân biệt các đợt.
2. Quản trị viên không muốn phải nhập mã thủ công mà muốn hệ thống tự cấp mã duy nhất theo số thứ tự tăng dần (`XP1`, `XP2`, …, `XP14`, `XP234`).
3. Khoảng thời gian diễn ra sự kiện của xã và khoảng thời gian mở cổng cho chủ thể đăng ký hồ sơ sản phẩm vào sự kiện đó đang bị gộp làm một, đồng thời chưa có kiểm tra chống trùng lặp thời gian sự kiện giữa các đợt của cùng một xã/phường.

## Solution

Chuyển khái niệm quản lý từ **Địa bàn** sang **Sự kiện** (đợt tổ chức đánh giá OCOP gắn với một Tỉnh/Thành phố và một Xã/Phường cụ thể):

- Bổ sung trường bắt buộc **Tên sự kiện** (ví dụ: "Đánh giá OCOP đợt 1 năm 2026").
- Bỏ ô nhập mã trên biểu mẫu tạo/sửa; backend tự sinh mã duy nhất theo số thứ tự bản ghi (`XP<số_thứ_tự>`, ví dụ bản ghi thứ 14 là `XP14`, bản ghi thứ 234 là `XP234`) và giữ cố định suốt vòng đời bản ghi.
- Tách thời gian thành 2 khoảng riêng biệt, không cho chọn ngày quá khứ khi tạo mới/chỉnh sửa:
  1. **Thời gian sự kiện** (thời gian sự kiện diễn ra tại địa bàn): hai sự kiện của cùng một Xã/Phường trong cùng Tỉnh/Thành phố không được giao nhau về khoảng thời gian sự kiện. Ví dụ đã có sự kiện của Xã A từ `01/05/2026` đến `31/10/2026` thì tạo tiếp sự kiện cho Xã A từ `01/10/2026` đến `31/12/2026` sẽ báo lỗi trùng thời gian; tạo từ `01/11/2026` đến `31/12/2026` thì thành công.
  2. **Thời gian mở đăng ký** (thời gian người dùng có thể đăng ký sản phẩm vào sự kiện đó): nằm trong khoảng Thời gian sự kiện; cổng đăng ký/nộp hồ sơ của chủ thể chỉ cho phép chọn và nộp vào sự kiện đang hoạt động và đang trong Thời gian mở đăng ký.
- Giữ nguyên thông tin Tỉnh/Thành phố và Xã/Phường trên bản ghi để hồ sơ sản phẩm, phiếu in Mẫu số 01, bộ lọc và báo cáo thống kê theo Xã/Phường tiếp tục hoạt động xuyên suốt.

## User Stories

1. Là quản trị viên (`MANAGE`), tôi muốn menu và tiêu đề trang quản lý hiển thị là "Sự kiện" thay cho "Địa bàn", để phản ánh đúng nghiệp vụ tổ chức từng đợt đánh giá OCOP tại xã/phường.
2. Là quản trị viên, tôi muốn nhập **Tên sự kiện** khi tạo hoặc cập nhật sự kiện, để phân biệt rõ các đợt tổ chức khác nhau của cùng một xã/phường.
3. Là quản trị viên, tôi muốn hệ thống tự động sinh mã theo công thức `XP<số_thứ_tự>` (ví dụ `XP14`, `XP234`) khi thêm mới mà không cần nhập tay trên form, để tránh trùng mã và thống nhất quy tắc đánh mã.
4. Là quản trị viên, tôi muốn xem mã tự sinh (`XP14`, `XP234`, …) trên bảng danh sách và khi mở hộp thoại cập nhật (ở trạng thái chỉ đọc), để tra cứu và đối chiếu dễ dàng.
5. Là quản trị viên, tôi muốn chọn Tỉnh/Thành phố và Xã/Phường từ danh mục hành chính có sẵn cho mỗi sự kiện, để chuẩn hóa địa bàn phục vụ thống kê và in phiếu.
6. Là quản trị viên, tôi muốn khai báo **Thời gian sự kiện** (từ ngày – đến ngày) riêng biệt với **Thời gian mở đăng ký** (từ ngày – đến ngày), để tách bạch thời hạn diễn ra đợt đánh giá với thời hạn nhận hồ sơ của chủ thể.
7. Là quản trị viên, tôi muốn cả hai trường thời gian trên biểu mẫu không cho phép chọn ngày trong quá khứ, để tránh nhập nhầm mốc thời gian đã qua.
8. Là quản trị viên, tôi muốn hệ thống kiểm tra và từ chối khi tạo hoặc sửa một sự kiện có **Thời gian sự kiện** giao với một sự kiện khác của cùng Tỉnh/Thành phố và Xã/Phường, để một xã không có hai đợt sự kiện chồng lấn thời gian.
9. Là quản trị viên, tôi muốn tạo được sự kiện tiếp theo cho cùng một Xã/Phường ngay sau khi sự kiện trước kết thúc (ví dụ đợt 1 từ `01/05/2026` đến `31/10/2026`, đợt 2 từ `01/11/2026` đến `31/12/2026`), để lên kế hoạch liên tiếp trong năm.
10. Là quản trị viên, tôi muốn hệ thống kiểm tra **Thời gian mở đăng ký** không vượt ra ngoài **Thời gian sự kiện** và ngày kết thúc không nhỏ hơn ngày bắt đầu, để dữ liệu thời gian luôn hợp lệ.
11. Là quản trị viên hoặc người có quyền xem (`VIEW`), tôi muốn tìm kiếm và lọc danh sách sự kiện theo Tỉnh/Thành phố, từ khóa (mã, tên sự kiện, tên xã/phường) và trạng thái, để tra cứu nhanh.
12. Là người đăng ký (`REGISTRANT`) hoặc quản trị viên nhập hộ, khi tạo/chỉnh sửa và nộp hồ sơ sản phẩm, tôi muốn chỉ các sự kiện đang hoạt động và đang nằm trong **Thời gian mở đăng ký** mới được phép chọn và nộp mới, để hồ sơ chỉ được nộp đúng hạn mở đăng ký.
13. Là người đăng ký, tôi muốn thấy tên sự kiện kèm xã/phường hoặc thông tin địa bàn rõ ràng khi chọn trên phiếu đăng ký sản phẩm, để chọn đúng đợt đăng ký tại địa phương mình.
14. Là người dùng xem phiếu in Mẫu số 01, bảng tổng hợp kết quả, báo cáo thống kê và Dashboard, tôi muốn dữ liệu địa bàn Xã/Phường và Tỉnh/Thành phố gắn với hồ sơ vẫn hiển thị và thống kê chính xác như hiện tại.

## Implementation Decisions

- **Giữ tương thích bảng và khóa ngoại hiện có**: Tiếp tục sử dụng thực thể `Locality` (bảng `localities` và khóa ngoại `localityId` trên `Product`) làm bản ghi Sự kiện để không phá vỡ lịch sử hồ sơ đã nộp, snapshot Mẫu số 01 và các truy vấn báo cáo thống kê theo Xã/Phường.
- **Bổ sung trường dữ liệu trên bản ghi**:
  - `eventName`: chuỗi bắt buộc (1–255 ký tự, đã cắt khoảng trắng thừa) lưu Tên sự kiện. Với dữ liệu cũ khi nâng cấp migration, backfill `eventName` mặc định từ tên xã/phường hiện có để không làm rỗng dữ liệu lịch sử.
  - `sequenceNumber`: số nguyên tự tăng hoặc lấy theo thứ tự tạo để cấp mã tự động `XP<số_thứ_tự>` (ví dụ thứ tự 14 → `XP14`, thứ tự 234 → `XP234`). Nếu mã `XP<n>` đã tồn tại do dữ liệu seed/cũ, tiến tới số thứ tự tiếp theo chưa dùng để đảm bảo tính duy nhất (`@unique` trên `code`).
  - **Hai khoảng thời gian lưu theo kiểu nửa kín `[start, endExclusive)` tính theo múi giờ `Asia/Ho_Chi_Minh` (`+07:00`)**:
    - **Thời gian sự kiện**: dùng cặp trường `eventFrom` và `eventTo` (hoặc ánh xạ `effectiveFrom` / `effectiveTo` cho khoảng thời gian sự kiện và bổ sung `registrationFrom` / `registrationTo` cho khoảng thời gian mở đăng ký). Cả hai khoảng đều bắt buộc khi tạo/sửa sự kiện trên giao diện mới.
    - Trên giao diện người dùng chọn theo ngày (`dd/MM/yyyy` → `YYYY-MM-DD`): ngày bắt đầu chuyển thành `00:00:00+07:00` của ngày đó, ngày kết thúc `D` chuyển thành `00:00:00+07:00` của ngày kế tiếp `D + 1` (nửa kín `[from, toExclusive)`). Nhờ đó đợt 1 kết thúc ngày `31/10/2026` (`toExclusive = 2026-11-01T00:00:00+07:00`) và đợt 2 bắt đầu ngày `01/11/2026` (`from = 2026-11-01T00:00:00+07:00`) tiếp giáp đúng tại mốc `2026-11-01T00:00:00+07:00` mà không giao nhau.
- **Quy tắc kiểm tra thời gian tại Backend và Frontend**:
  - Ngày kết thúc phải sau ngày bắt đầu đối với cả Thời gian sự kiện (`eventFrom < eventTo`) và Thời gian mở đăng ký (`registrationFrom < registrationTo`).
  - Thời gian mở đăng ký phải nằm trong Thời gian sự kiện (`registrationFrom >= eventFrom` và `registrationTo <= eventTo`).
  - Trên biểu mẫu quản trị, cả hai trường chọn khoảng ngày bật `disablePast` và chặn chọn ngày quá khứ.
  - **Chống trùng lặp Thời gian sự kiện của cùng một xã/phường**: Trong cùng một transaction có khóa chống ghi đồng thời theo cặp `(provinceName, name)` (chuẩn hóa chữ thường/trim), kiểm tra không có bản ghi nào khác (khác `id` hiện tại khi cập nhật) của cùng Tỉnh/Thành phố và Xã/Phường có khoảng `[eventFrom, eventTo)` giao với khoảng `[newEventFrom, newEventTo)` theo công thức giao hai khoảng nửa kín: `existing.eventFrom < newEventTo AND newEventFrom < existing.eventTo`. Nếu giao nhau, trả lỗi `409 Conflict` với thông báo rõ ràng bằng tiếng Việt.
- **Quy tắc mở cổng đăng ký sản phẩm**:
  - Truy vấn danh sách địa bàn/sự kiện công khai (`GET /localities`) và kiểm tra khóa khi lưu/nộp hồ sơ (`lockActiveLocality` trong `ProductsRepository`) kiểm tra `isActive = true` và thời điểm hiện tại `now` nằm trong **Thời gian mở đăng ký** (`registrationFrom <= now < registrationTo`, hoặc tương thích ngược với bản ghi cũ chưa có `registrationFrom`/`registrationTo` thì dùng `effectiveFrom`/`effectiveTo`).
- **Giao diện quản trị (`/admin/localities`)**:
  - Đổi nhãn hiển thị trên thanh điều hướng, tiêu đề trang, bộ lọc, cột bảng và hộp thoại từ "Địa bàn" sang "Sự kiện" (vẫn giữ thông tin Tỉnh/Thành phố và Xã/Phường).
  - Trong hộp thoại Tạo/Cập nhật sự kiện:
    - Khi tạo mới: ẩn ô nhập mã (hoặc hiển thị ghi chú mã tự sinh theo số thứ tự `XP...`), có các trường: **Tên sự kiện**, **Tỉnh / thành phố**, **Xã / phường**, **Thời gian sự kiện**, **Thời gian mở đăng ký**.
    - Khi cập nhật: hiển thị mã `code` ở chế độ chỉ đọc (`disabled`), cho phép sửa Tên sự kiện, Tỉnh/Thành phố, Xã/Phường, Thời gian sự kiện, Thời gian mở đăng ký.
    - Nút hành động cuối biểu mẫu căn phải (`justify-end`), nhãn nút lưu là **Lưu** và nút hủy là **Đóng**.
- **Nhật ký kiểm toán (`AuditLog`)**:
  - Ghi nhận đầy đủ `eventName`, `code` tự sinh, `provinceName`, `name` (Xã/Phường), `eventFrom`/`eventTo` và `registrationFrom`/`registrationTo` trong `afterData`/`beforeData`.

## Testing Decisions

- **Ranh giới kiểm thử chính (Seam)**:
  1. **Integration test tại tầng HTTP API + PostgreSQL (`apps/be/test/admin-catalogs.db-spec.ts` và `apps/be/src/dtos/admin-catalogs.dto.spec.ts`)**: gọi trực tiếp qua HTTP `/admin/localities`, `/localities` và luồng nộp sản phẩm để kiểm chứng toàn bộ hành vi từ DTO validation, sinh mã tự động `XP<số_thứ_tự>`, khóa giao dịch chống trùng khoảng thời gian của cùng xã, đến lọc sự kiện trong hạn mở đăng ký.
  2. **Unit/Contract test tại Frontend (`apps/web/test/admin-catalogs.test.ts` và `apps/web/test/form-contract.typecheck.tsx`)**: kiểm tra hợp đồng payload gửi lên API, kiểu dữ liệu TypeScript và helper kiểm tra khoảng ngày.
- **Các kịch bản kiểm thử bắt buộc**:
  - Tạo sự kiện không cần gửi `code` → hệ thống tự sinh mã theo thứ tự (ví dụ khi đang có 13 bản ghi thì bản ghi thứ 14 nhận mã `XP14`; khi thứ tự là 234 nhận mã `XP234`) và lưu đúng `eventName`.
  - Tạo sự kiện 1 cho Xã A từ `01/05/2026` đến `31/10/2026` (`[2026-05-01T00:00:00+07:00, 2026-11-01T00:00:00+07:00)`) thành công.
  - Tạo sự kiện 2 cho cùng Xã A từ `01/10/2026` đến `31/12/2026` → bị từ chối với mã `409 Conflict` do giao khoảng thời gian.
  - Tạo sự kiện 2 cho cùng Xã A từ `01/11/2026` đến `31/12/2026` → thành công (`201 Created`).
  - Tạo sự kiện cho Xã B (khác xã) trùng khoảng `01/05/2026` – `31/10/2026` → thành công vì khác xã.
  - Cập nhật sự kiện của Xã A sang khoảng thời gian giao với sự kiện khác của Xã A → bị từ chối `409 Conflict`; cập nhật chính sự kiện đó giữ nguyên hoặc thu hẹp khoảng thời gian không giao với sự kiện khác → thành công (`200 OK`).
  - Kiểm tra Thời gian mở đăng ký nằm ngoài Thời gian sự kiện → bị từ chối `400 Bad Request`.
  - Kiểm tra `GET /localities` và nộp hồ sơ sản phẩm chỉ chấp nhận sự kiện đang nằm trong khoảng Thời gian mở đăng ký.

## Out of Scope

- Không thay đổi cấu trúc 26 bộ tiêu chí chấm điểm OCOP hoặc cách tính điểm/xếp hạng sao.
- Không tách bảng `localities` thành hai bảng vật lý riêng biệt gây đứt gãy khóa ngoại `localityId` của các hồ sơ `Product` hiện có.
- Không tự động xóa hoặc sửa đổi các hồ sơ sản phẩm đã nộp (`SUBMITTED`, `SCORING`, `COMPLETED`) thuộc các đợt trước.

## Further Notes

- Quy ước khoảng thời gian nửa kín `[from, toExclusive)` theo múi giờ Việt Nam (`+07:00`) đã có sẵn trong `apps/web/src/lib/admin-date.ts` (`vietnameseDayStartIso` và `nextVietnameseDayIso`), giúp chuyển đổi ngày kết thúc `31/10/2026` thành `2026-11-01T00:00:00+07:00` để so sánh liền kề với `01/11/2026` (`2026-11-01T00:00:00+07:00`) chính xác tuyệt đối.
