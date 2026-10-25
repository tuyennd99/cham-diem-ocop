# Hướng dẫn sử dụng hệ thống đánh giá, phân hạng sản phẩm OCOP

Tài liệu này hướng dẫn thao tác trực tiếp trên giao diện web của hệ thống chấm điểm OCOP theo trọn luồng nghiệp vụ: **Chủ thể đăng ký & nộp hồ sơ → Quản trị viên cấu hình & phân công → Giám khảo chấm điểm → Tổng hợp kết quả & In ấn**.

- **Địa chỉ ứng dụng (môi trường local)**: `http://localhost:5173`
- **Căn cứ nghiệp vụ**: [Quyết định số 26/2026/QĐ-TTg ngày 22/05/2026](https://chinhphu.vn/?classid=1&docid=218267&pageid=27160&typegroupid=5) (Bộ tiêu chí và quy trình đánh giá, phân hạng sản phẩm OCOP).
- **Ngày đối chiếu tài liệu với mã nguồn**: 25/10/2026. Địa chỉ trên dùng cho môi trường local; khi sử dụng chính thức, thay bằng địa chỉ do đơn vị quản trị cung cấp. Các đường dẫn trong ngoặc giúp tra cứu, thao tác chính thực hiện qua menu và nút trên giao diện.

---

## 1. Tổng quan luồng trạng thái trên hệ thống

Một hồ sơ sản phẩm OCOP đi qua 4 trạng thái tuần tự:

1. **`DRAFT` (Bản nháp)**: Chủ thể (hoặc Quản trị viên nhập hộ) mới tạo hồ sơ, đang bổ sung thông tin và tải tệp minh chứng. Có thể sửa hoặc xóa.
2. **`SUBMITTED` (Đã nộp)**: Chủ thể đã chốt và nộp hồ sơ. Hồ sơ bị khóa chỉnh sửa, xuất hiện trên trang công khai và vào hàng chờ của các Giám khảo được phân công.
3. **`SCORING` (Đang chấm)**: Ít nhất một Giám khảo đã bắt đầu lưu nháp hoặc nộp phiếu chấm cho hồ sơ này.
4. **`COMPLETED` (Hoàn tất)**: Tất cả Giám khảo được phân công vào phân loại sản phẩm đó đã nộp phiếu và phủ đủ 100% tiêu chí của bộ phiếu. Hệ thống tự động tính điểm trung bình cuối cùng (`finalScore`) và mức sao theo điểm (`starRating`).

Khi chia phạm vi chấm, hệ thống lấy trung bình điểm của những giám khảo được giao từng tiêu chí, rồi cộng các trung bình đó. Nếu mọi giám khảo đều chấm toàn bộ bộ phiếu, kết quả bằng trung bình tổng điểm các phiếu.

> **Lưu ý nghiệp vụ quan trọng**: Mức sao hiển thị trên hệ thống (`1★` đến `5★`) là **mức sao tính từ điểm chấm**, phục vụ hội đồng đánh giá. Đặc biệt với mức điểm `90–100` (`5★`), hệ thống ghi nhận là *"Mức điểm 5 sao / đề nghị xem xét 5 sao"*, không thay thế Quyết định công nhận OCOP chính thức của cơ quan có thẩm quyền.

---

## 2. Hướng dẫn cho Chủ thể OCOP (`REGISTRANT`)

Chủ thể là các doanh nghiệp, hợp tác xã, tổ hợp tác hoặc hộ sản xuất có sản phẩm tham gia đánh giá OCOP.

### Bước 2.1. Đăng ký tài khoản và xác thực OTP

1. Truy cập `http://localhost:5173/register`.
2. Nhập đầy đủ thông tin:
   - **Họ và tên**: Tên người liên hệ/đại diện (ví dụ: `Nguyễn Văn An`).
   - **Email**: Địa chỉ email đang hoạt động để nhận mã xác thực.
   - **Số điện thoại**: Không bắt buộc ở bước tạo tài khoản.
   - **Mật khẩu**: Tối thiểu **8 ký tự** (tối đa 72 byte UTF-8).
3. Nhấn nút gửi đăng ký. Hệ thống chuyển sang màn hình **Xác thực email** (`/verify-otp`).
4. Mở hộp thư email, lấy mã **OTP gồm 6 chữ số** (có hiệu lực trong **5 phút**), nhập vào ô mã xác thực và xác nhận.
   - Nếu chưa nhận được mã, sau **60 giây** có thể nhấn **Gửi lại mã**.

### Bước 2.2. Đăng nhập

1. Truy cập `http://localhost:5173/login`.
2. Nhập **Email** và **Mật khẩu** vừa kích hoạt.
3. Sau khi đăng nhập thành công, hệ thống tự động đưa Chủ thể về trang **Hồ sơ của tôi** (`/my/products`).

### Bước 2.3. Lập hồ sơ sản phẩm (Mẫu số 01) và tải minh chứng

1. Tại `/my/products`, nhấn nút **Tạo hồ sơ** (hoặc truy cập `/my/products/new`).
2. Biểu mẫu gồm **3 bước** (có thể chuyển qua lại giữa các bước và lưu nháp bất cứ lúc nào sau khi đã nhập Tên sản phẩm và Phân loại ở Bước 2):
   - **Bước 1 — Đơn vị đăng ký**:
     - Tìm và chọn **Địa bàn hành chính (xã/phường)** từ danh mục chuẩn hóa (có thể để trống khi lưu nháp, nhưng **bắt buộc phải chọn địa bàn đang hiệu lực trước khi nộp**).
     - Nhập **Tỉnh/thành phố đăng ký**, **Năm đăng ký** (số nguyên từ `2020` đến `2100`), **Tên chủ thể đăng ký**, **Người đại diện theo pháp luật**, **Chức danh người đại diện**, **Địa chỉ liên hệ**.
     - Nhập **Số điện thoại** và/hoặc **Email liên hệ** (khi nộp chính thức bắt buộc phải có ít nhất một trong hai thông tin này).
   - **Bước 2 — Thông tin sản phẩm**:
     - Nhập **Tên sản phẩm** (bắt buộc để lưu nháp, tối đa 255 ký tự).
     - Chọn **Phân loại sản phẩm** trong 26 phân loại thuộc 6 nhóm ngành hàng OCOP.
     - Chọn **Hình thức đăng ký**: Đăng ký lần đầu (`FIRST`), Nâng hạng (`UPGRADE`), hoặc Đánh giá lại (`REASSESSMENT`).
     - Nhập **Số lượng mẫu** (khi nộp chính thức phải từ `1` đến `100000`) và **Mô tả sản phẩm / câu chuyện sản phẩm**.
   - **Bước 3 — Cam kết và tệp**:
     - Tích chọn ô **Cam kết thông tin kê khai là đúng sự thật** (bắt buộc khi nộp hồ sơ).
     - Chọn tệp hình ảnh sản phẩm (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) và tài liệu minh chứng (`.pdf`). Mỗi tệp tối đa **10 MiB**, tối đa **20 tệp** cho một hồ sơ.
3. Nhấn **Lưu bản nháp**. Hệ thống tạo hồ sơ ở trạng thái `DRAFT`, tải lần lượt từng tệp đính kèm lên máy chủ và chuyển về trang chi tiết hồ sơ `/my/products/:id`.

### Bước 2.4. Chỉnh sửa bản nháp và Nộp hồ sơ chính thức

1. Khi hồ sơ đang ở trạng thái **Bản nháp (`DRAFT`)**:
   - Có thể nhấn **Sửa hồ sơ** (`/my/products/:id/edit`) để bổ sung thông tin, tải thêm tệp, hoặc nhấn **Xóa** bên cạnh tệp đính kèm để gỡ tệp.
   - Có thể xóa toàn bộ bản nháp tại danh sách `/my/products`.
2. Khi đã điền đủ các trường bắt buộc và tích cam kết:
   - Nhấn nút **Nộp hồ sơ** tại `/my/products` hoặc trong trang chi tiết `/my/products/:id` và xác nhận hộp thoại.
   - Hồ sơ chuyển sang trạng thái **Đã nộp (`SUBMITTED`)**. Từ thời điểm này, Chủ thể **không thể sửa hoặc xóa** hồ sơ và tệp đính kèm.

### Bước 2.5. Theo dõi tiến độ, xem kết quả và in ấn

1. Mở `/my/products/:id` để xem trạng thái xử lý:
   - Khi đang chờ hoặc đang chấm: hiển thị thông báo *"Hồ sơ đang chờ hội đồng hoàn tất đánh giá"*.
   - Khi hội đồng đã chấm xong (`COMPLETED`): hiển thị **Điểm tổng hợp chính xác** và **Mức sao đạt được**.
2. Chủ thể có thể mở các bản in chuẩn A4:
   - **In phiếu đăng ký (Mẫu số 01)**: `/print/products/:id/registration`
   - **In bảng tổng hợp kết quả**: `/print/products/:id/results`

### Bước 2.6. Quên mật khẩu và đổi mật khẩu

1. **Quên mật khẩu**: Tại trang đăng nhập, chọn **Quên mật khẩu** (`/forgot-password`), nhập email đã đăng ký và nhấn **Gửi mã xác thực**. Nhập OTP nhận qua email và mật khẩu mới rồi gửi biểu mẫu. Mật khẩu mới tối thiểu 8 ký tự, tối đa 72 byte UTF-8.
2. **Đổi mật khẩu khi đang đăng nhập**: Mở **Thông tin tài khoản** (`/account`), chọn **Đổi mật khẩu** (`/account/password`). Nhập mật khẩu hiện tại, mật khẩu mới và nhập lại mật khẩu mới để xác nhận.
3. Sau khi đổi hoặc đặt lại mật khẩu thành công, đăng nhập lại bằng mật khẩu mới. Các phiên đăng nhập cũ không còn hiệu lực. Nếu nhập sai mật khẩu hiện tại, sửa lại tại biểu mẫu; phiên đang dùng vẫn được giữ.

### Bước 2.7. Xử lý lỗi khi lưu hồ sơ hoặc tải tệp

- **Tệp sai định dạng, quá dung lượng hoặc vượt số lượng**: Sửa danh sách tệp theo thông báo rồi lưu lại. Kiểm tra cả tệp đã lưu và tệp đang chọn; tổng tối đa 20 tệp.
- **Một tệp bị máy chủ từ chối sau khi hồ sơ đã tạo**: Hồ sơ và những tệp đã nhận vẫn được giữ. Kiểm tra thông báo, sửa hoặc chọn lại tệp bị lỗi trước khi thử tiếp trên cùng bản nháp.
- **Mất mạng hoặc chưa rõ máy chủ đã nhận tệp chưa**: Dùng liên kết kiểm tra hồ sơ trong thông báo lỗi, xem danh sách tệp đã nhận rồi mở lại bản nháp và chỉ chọn tệp còn thiếu. Trong lúc chưa xác nhận được kết quả, nút lưu có thể bị khóa để tránh tải trùng.
- **Mất phản hồi ngay lúc tạo hồ sơ**: Kiểm tra **Hồ sơ của tôi** trước khi tạo lại. Nếu chưa tải được danh sách, khôi phục kết nối và kiểm tra tiếp; không tạo thêm khi chưa xác định hồ sơ cũ đã được lưu hay chưa.

---

## 3. Hướng dẫn cho Quản trị viên & Cán bộ nghiệp vụ (`MANAGE` / `VIEW`)

Hệ thống quản trị tách thành 3 quyền nội bộ có thể kết hợp trên cùng một tài khoản:
- **`MANAGE` (Quản lý)**: Toàn quyền quản trị danh mục, người dùng, phân công, nhập hộ hồ sơ nháp (bao hàm quyền `VIEW`).
- **`VIEW` (Xem dữ liệu)**: Chỉ đọc danh sách hồ sơ đã nộp, phiếu chấm đã nộp, kết quả, báo cáo và Dashboard (không thấy bản nháp `DRAFT`, không có quyền sửa/xóa).
- **`SCORE` (Chấm điểm)**: Quyền của Giám khảo để chấm các hồ sơ thuộc phân công. Một cán bộ vừa có `MANAGE` vừa có `SCORE` sẽ thấy cả khu vực Quản trị lẫn menu **Hồ sơ được phân công** (`/judge`).

### Bước 3.1. Chuẩn bị Danh mục Đơn vị và Địa bàn (Quyền `MANAGE`)

Trước khi tạo Giám khảo và nộp hồ sơ, Quản trị viên kiểm tra 2 danh mục nền tảng:
1. **Đơn vị công tác**:
   - Vào menu **Người dùng** (`/admin/users`) → chọn tab **Đơn vị công tác**.
   - Nhấn thêm mới đơn vị (ví dụ: Mã `SNN`, Tên `Sở Nông nghiệp và Môi trường`), nhập lý do thao tác và lưu.
2. **Địa bàn hành chính (Xã/Phường)**:
   - Vào menu **Nhóm sản phẩm & địa bàn** (`/admin/product-groups`) → chọn tab **Địa bàn**.
   - Thêm mới hoặc cập nhật xã/phường (Mã địa bàn, Tên xã/phường, Cấp xã/phường/thị trấn, Tỉnh/thành phố, Thời gian hiệu lực) kèm lý do thao tác.

### Bước 3.2. Tạo tài khoản Giám khảo / Cán bộ nội bộ (Quyền `MANAGE`)

1. Vào menu **Người dùng** (`/admin/users`).
2. Nhấn **Thêm người dùng nội bộ**.
3. Điền thông tin:
   - **Họ và tên**, **Email**, **Số điện thoại** (tùy chọn).
   - **Mật khẩu khởi tạo**: Bắt buộc tối thiểu **12 ký tự** (tối đa 72 byte UTF-8).
   - **Đơn vị công tác**: Chọn một đơn vị đang hoạt động.
   - **Quyền hạn**: Tích chọn **Chấm điểm (`SCORE`)** cho Giám khảo (có thể kết hợp thêm `VIEW` hoặc `MANAGE` tùy vị trí công tác).
   - **Lý do thao tác**: Ghi rõ căn cứ cấp tài khoản (ví dụ: *"Thành lập Hội đồng đánh giá OCOP đợt 1/2026"*).
4. Nhấn lưu. Tài khoản nội bộ do Quản trị viên tạo được kích hoạt sẵn (`verified = true`), Giám khảo có thể đăng nhập ngay mà không cần qua bước OTP.

### Bước 3.3. Phân công Giám khảo chấm điểm (Quyền `MANAGE`)

1. Vào menu **Phân công** (`/admin/assignments`).
2. Tại khung thiết lập phân công:
   - Chọn **Giám khảo** (danh sách chỉ hiển thị các tài khoản đang hoạt động và có quyền `SCORE`).
   - Chọn **Phân loại sản phẩm** (ví dụ: *Mật ong, mật khác và nông sản thực phẩm khác*).
   - Chọn **Phạm vi chấm**:
     - **Toàn bộ tiêu chí**: Giám khảo chấm tất cả tiêu chí của bộ phiếu đó (100 điểm).
     - **Chọn tiêu chí cụ thể**: Giám khảo chỉ chấm các tiêu chí được tích chọn (dùng khi chia tổ chuyên môn: người chấm phần A, người chấm phần B, C).
3. Nhấn **Áp dụng vào bảng tạm**.
   - Quan sát cột **Độ phủ tiêu chí** của phân loại sản phẩm đó: hệ thống sẽ cảnh báo nếu các giám khảo được giao chưa bao phủ hết 100% tiêu chí của bộ phiếu.
4. Nhấn nút **Lưu toàn bộ phân công** và xác nhận trong hộp thoại để ghi vào cơ sở dữ liệu.

> **Khi thay đổi phân công**: Nếu hệ thống có hồ sơ đã nộp hoặc đang chấm, danh sách phân công sau khi lưu phải phủ đủ tiêu chí của tất cả phân loại đang có hồ sơ mở. Nếu còn thiếu, thao tác lưu bị từ chối và phân công cũ được giữ. Với phiếu đã nộp thuộc hồ sơ đang chấm, không thể gỡ giám khảo hoặc đổi phạm vi của người đó. Khi phạm vi thực sự thay đổi trên phiếu nháp, hiện hệ thống xóa toàn bộ điểm và ghi chú nháp của phiếu bị ảnh hưởng; giám khảo phải chấm lại phạm vi mới. Chỉ đổi thứ tự lựa chọn, hoặc đổi giữa toàn bộ và danh sách đầy đủ cùng các tiêu chí, không làm mất điểm nháp.

Trước khi khóa tài khoản hoặc gỡ quyền chấm của giám khảo đang có hồ sơ mở, cần điều chỉnh phân công hợp lệ. Hệ thống từ chối thay đổi tài khoản nếu ràng buộc này chưa được xử lý.

### Bước 3.4. Nhập hộ Phiếu đăng ký cho Chủ thể (Quyền `MANAGE` - Tùy chọn)

Trong trường hợp Chủ thể nộp hồ sơ giấy và cán bộ hỗ trợ nhập lên phần mềm:
1. Vào menu **Phiếu đăng ký** (`/admin/registrations`) → nhấn **Nhập phiếu đăng ký** (`/admin/registrations/new`).
2. Tại mục **Ngữ cảnh thao tác quản trị**:
   - Tìm và chọn **Chủ thể đăng ký** (phải là tài khoản Chủ thể đã xác thực và đang hoạt động).
   - Nhập **Lý do thao tác** (bắt buộc để ghi nhận lịch sử kiểm toán/audit).
3. Điền 3 bước thông tin sản phẩm, chọn tệp minh chứng và nhấn **Lưu bản nháp**. Hệ thống chuyển đến trang chi tiết phiếu đăng ký.
4. Kiểm tra dữ liệu và tệp đã lưu. Tại trang chi tiết, chọn **Nộp hồ sơ thay chủ thể**, nhập lý do thao tác và xác nhận. Màn hình tạo/sửa bản nháp không có nút nộp trực tiếp.
5. Chủ thể nhìn thấy hồ sơ trong **Hồ sơ của tôi** (`/my/products`). Sau khi nộp, cả Chủ thể và Quản trị viên không thể sửa hoặc xóa hồ sơ, tệp đính kèm.

### Bước 3.5. Giám sát tiến độ, Báo cáo và In ấn (Quyền `MANAGE` hoặc `VIEW`)

- **Tổng quan (`/admin`)**: Xem 8 chỉ số KPI, biểu đồ xu hướng 12 tháng, phân bố sao (1–5★), bảng tiến độ từng giám khảo và danh sách **Hồ sơ cần chú ý** (hồ sơ đã nộp nhưng phân loại chưa được phân công đủ giám khảo).
- **Sản phẩm (`/admin/products`) & Phiếu đăng ký (`/admin/registrations`)**: Lọc, tìm kiếm, xem chi tiết thông tin sản phẩm, tệp hồ sơ, tiến độ từng giám khảo và kết quả tổng hợp.
- **Phiếu chấm OCOP (`/admin/scoring-forms`)**:
  - Tab **Bộ phiếu (26 mẫu)**: Xem cấu trúc chi tiết 26 bộ tiêu chí và nhấn **In mẫu trắng** (`/print/criteria-sets/:id`).
  - Tab **Phiếu chấm thực tế**: Tài khoản có `MANAGE` tra cứu phiếu nháp và phiếu đã nộp; tài khoản chỉ có `VIEW` tra cứu phiếu đã nộp. Mở **In phiếu chấm A4** (`/print/evaluations/:id`) theo quyền tương ứng. Quyền `SCORE` cho phép giám khảo xem/in phiếu của chính mình trong phạm vi được phép.
- **Báo cáo thống kê (`/admin/reports`)**: Chọn năm báo cáo và tháng; bỏ chọn tháng để xem cả năm. Giao diện hiện chưa có bộ lọc quý. Có thể nhóm theo xã/phường, nhóm ngành hoặc phân loại; chuyển giữa tab **Hồ sơ đăng ký** (theo ngày nộp) và **Kết quả hoàn tất** (theo ngày hoàn tất); xuất bản in A4 ngang.
- Trên **Tổng quan**, ba KPI có liên kết đến danh sách hồ sơ là **đăng ký trong kỳ**, **hoàn tất trong kỳ** và **mức điểm 5 sao**. Các KPI khác hiển thị số liệu, không có liên kết danh sách tương ứng.

---

## 4. Hướng dẫn cho Giám khảo (`JUDGE` / Tài khoản có quyền `SCORE`)

### Bước 4.1. Đăng nhập và mở Hàng chờ chấm điểm

1. Truy cập `http://localhost:5173/login`, đăng nhập bằng tài khoản Giám khảo được Quản trị viên cấp.
2. Hệ thống tự động chuyển tới màn hình **Hàng chờ chấm điểm** (`/judge`). (Nếu tài khoản kiêm nhiệm Quản trị viên, chọn menu **Hồ sơ được phân công** ở thanh bên trái).
3. Danh sách hiển thị tất cả hồ sơ ở trạng thái **Đã nộp (`SUBMITTED`)** hoặc **Đang chấm (`SCORING`)** thuộc các phân loại sản phẩm mà Giám khảo được phân công.

### Bước 4.2. Xem minh chứng và Chấm điểm từng tiêu chí

1. Nhấn vào một hồ sơ trong hàng chờ để mở màn hình làm việc `/judge/products/:id`.
2. Màn hình chia làm 3 khu vực:
   - **Cột trái (Điều hướng tiêu chí)**: Hiển thị thanh tiến độ số tiêu chí đã chấm và danh sách các tiêu chí thuộc phạm vi được giao (nhóm theo Phần A, Phần B, Phần C).
   - **Cột phải (Minh chứng hồ sơ)**:
     - Xem thông tin chủ thể và thông tin sản phẩm kê khai theo Mẫu số 01.
     - Nhấn vào ảnh thu nhỏ hoặc tên tệp PDF trong mục **Tệp minh chứng** để mở xem trực tiếp tài liệu gốc do chủ thể đính kèm.
   - **Khu vực giữa (Chấm điểm chi tiết)**:
     - Với mỗi **tiểu tiêu chí**, đọc kỹ nội dung và **tích chọn 1 mức điểm** phù hợp.
     - Có thể bấm mở mục **Ghi chú của giám khảo** dưới từng tiểu tiêu chí để nhập nhận xét/lý do chấm (tối đa 2000 ký tự).
     - Dùng nút **← Tiêu chí trước** / **Tiêu chí tiếp theo →** hoặc bấm trực tiếp vào danh sách bên trái để di chuyển.

### Bước 4.3. Lưu nháp, Nộp phiếu chấm và In phiếu

1. **Lưu nháp**:
   - Trong quá trình chấm, nhấn nút **Lưu bản nháp** ở thanh công cụ dưới cùng bất cứ lúc nào (kể cả khi chưa chọn đủ các tiêu chí).
   - Ngay lần lưu nháp đầu tiên, trạng thái hồ sơ sản phẩm sẽ chuyển từ `SUBMITTED` sang `SCORING`.
2. **Nộp phiếu chính thức**:
   - Kiểm tra thanh trạng thái đảm bảo **đã chọn mức điểm cho 100% tiểu tiêu chí** trong phạm vi được giao.
   - Nhấn nút **Nộp phiếu chấm** và xác nhận hộp thoại.
   - Sau khi nộp thành công, phiếu chuyển sang trạng thái **Đã nộp · chỉ đọc (`SUBMITTED`)**. Giám khảo **không thể sửa lại điểm** sau khi đã nộp.
   - Nếu chưa thể nộp do thay đổi phân công, tải lại phiếu để kiểm tra phạm vi mới. Điểm và ghi chú chưa lưu không được tự động lưu; nếu Quản trị viên thực sự đổi phạm vi của phiếu nháp, cần chấm lại theo lưu ý tại Bước 3.3.
3. **In phiếu chấm cá nhân**:
   - Nhấn nút **In phiếu chấm A4** ở góc trên bên phải (`/print/judge/products/:id`).
   - Nếu phiếu chưa nộp, bản in sẽ đóng dấu rõ **`BẢN NHÁP — CHƯA NỘP`**. Nếu đã nộp, bản in hiển thị đầy đủ điểm số, đơn vị công tác tại thời điểm nộp và ô ký tên cho Giám khảo.

---

## 5. Hướng dẫn Tra cứu công khai (Người dân & Khách vãng lai)

Không cần đăng nhập, người dùng có thể truy cập:
1. **Trang chủ (`http://localhost:5173/`)**: Xem giới thiệu hệ thống, danh mục nhóm ngành hàng và các hồ sơ sản phẩm tiêu biểu.
2. **Danh mục sản phẩm công khai (`http://localhost:5173/products`)**:
   - Tìm kiếm theo tên sản phẩm, mã hồ sơ, tên phân loại hoặc lọc theo nhóm ngành hàng.
   - Chỉ các hồ sơ ở trạng thái `SUBMITTED`, `SCORING`, `COMPLETED` mới xuất hiện (bản nháp `DRAFT` hoàn toàn ẩn).
3. **Chi tiết sản phẩm công khai (`/products/:id`)**:
   - Xem tên sản phẩm, nhóm/phân loại, mô tả, hình ảnh sản phẩm, trạng thái chấm và điểm số / xếp hạng sao (nếu đã hoàn tất).
   - Để bảo mật thông tin riêng tư, trang công khai **không hiển thị** số điện thoại, email cá nhân, thông tin đại diện pháp lý chi tiết và **không cho phép tải** các tệp PDF minh chứng nội bộ.
