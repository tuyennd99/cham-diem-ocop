<!-- Hallmark · pre-emit critique: Philosophy 5 · Hierarchy 4 · Execution 4 · Specificity 5 · Restraint 5 · Variety 4. Tự rà soát tài liệu, không phải chứng nhận UI. -->

# Đánh giá UI/UX và thiết kế lại admin OCOP

Ngày khảo sát: **24/10/2026, giờ Việt Nam**. Trạng thái: **tài liệu đề xuất; chưa triển khai giao diện**.

Hướng đã được người dùng chọn: **Nghiệp vụ OCOP, gọn và rõ**.

**Bổ sung 25/10/2026:** [Rà soát kích thước và mật độ sau triển khai](2026-10-25-admin-density-review.md). Dùng thông số mới tại tài liệu bổ sung và mục 4, 6 của `design.md` khi chỉnh width, height, padding và margin; không tiếp tục áp control 44px đồng loạt cho desktop.

## 1. Kết luận

Admin đã có các luồng nghiệp vụ quan trọng: phân quyền, tìm kiếm phía máy chủ, phân trang, nhập Mẫu 01 ba bước, lý do thao tác, phân công có xem trước thay đổi, phiếu chấm và bản in. Cần giữ các nền tảng này.

Vấn đề chính là thiếu quy chuẩn áp dụng xuyên suốt: danh sách hồ sơ bị giới hạn 680px trong khi trang khác dùng hết chiều rộng; control có nơi gần như chữ thuần; menu chọn hai mục; thông tin kỹ thuật và phần thống kê chiếm chỗ trước việc cần xử lý. Có lỗi responsive và nhãn lọc ngày cần sửa trước khi chỉnh thẩm mỹ.

Đề xuất thiết kế một bàn làm việc chung: sidebar xanh đậm, tiêu đề chức năng gọn, bộ lọc nhất quán, bảng dễ quét, trang chi tiết có ngữ cảnh và thao tác đúng quyền. Quy chuẩn nằm tại [design.md](../../../design.md), chỉ áp dụng khu vực admin.

## 2. Cách khảo sát và giới hạn bằng chứng

Đã đọc route admin, khung ứng dụng, CSS, các trang admin, trình nhập hồ sơ dùng chung, query hồ sơ, control Input/Dialog, nhãn trạng thái và hợp đồng truy vấn sản phẩm. Đối chiếu với các đặc tả admin trước đó và mẫu đang mở trong Open Design.

Đã quan sát trình duyệt local đang đăng nhập bằng tài khoản có **MANAGE + VIEW**. Chỉ điều hướng, mở tab/bộ lọc/hộp thoại; không bấm lưu, tạo, nộp, khóa, thay quyền, tải tệp hoặc thay thế phân công. Không tạo dữ liệu để lấy ảnh minh họa.

| Bề mặt | Bằng chứng trực tiếp | Giới hạn |
| --- | --- | --- |
| Tổng quan | Trang chạy thật; KPI, bộ lọc, bảng và nội dung hiện tại | Các chỉ tiêu hồ sơ đang bằng 0 |
| Nhóm sản phẩm | Bảng phân loại đang có dữ liệu; cây nhóm; hộp tạo phân loại | Không lưu danh mục |
| Địa bàn | Tab và form tạo đã quan sát; đọc form sửa | Không có bản ghi địa bàn để thử sửa |
| Người dùng | Danh sách, hộp tạo tài khoản; tab đơn vị | Không thử đổi quyền/khóa/đặt lại mật khẩu |
| Phiếu chấm | Danh mục bộ phiếu có dữ liệu; tab phiếu thực tế | Danh sách phiếu thực tế rỗng |
| Sản phẩm và phiếu đăng ký | Hai danh sách rỗng; bộ lọc nâng cao; đo responsive | Chưa kiểm tra hàng hồ sơ có dữ liệu |
| Tạo phiếu đăng ký | Trang tạo, chọn chủ thể, bước đầu tiên | Không điền/lưu; bước sau khảo sát từ mã nguồn |
| Phân công | Trang, cảnh báo, form chọn và ma trận đang hiển thị | Không sửa/lưu phân công |
| Báo cáo | Trang thật, bộ lọc, metadata và bảng báo cáo | Không mở hộp in hoặc xuất PDF |
| Chi tiết, sửa hồ sơ, kết quả | Khảo sát từ component và route hiện có | Không có hồ sơ để xác minh bằng trình duyệt |
| Open Design | Xem prototype `ocop-quan-ly-san-pham-admin.html` trong ứng dụng | Prototype có số liệu minh họa; không phải dữ liệu hệ thống |

Đây là đánh giá chuyên gia dựa trên giao diện và mã nguồn, chưa có phỏng vấn hoặc đo thời gian hoàn thành tác vụ. Không chấm điểm trải nghiệm người dùng như số đo thực nghiệm.

### Đo responsive hiện trạng

Đo danh sách sản phẩm khi mở bộ lọc nâng cao bằng kích thước DOM của trình duyệt; đơn vị CSS px, làm tròn. Chiều rộng root trên desktop có thể trừ thanh cuộn.

| Viewport | Chiều rộng root | Main | Panel | Kết luận |
| --- | ---: | ---: | ---: | --- |
| 320 | 693 | 682 | 650 | Tràn ngang |
| 375 | 693 | 682 | 650 | Tràn ngang, nội dung bên phải ngoài màn hình |
| 414 | 693 | 682 | 650 | Tràn ngang |
| 768 | 753 | 505 | 428 | Chưa thấy tràn root trong phép đo này; nội dung bị nén |
| 1440 | 1425 | 1177 | 680 | Dư thừa khoảng trống, panel bị giới hạn |

Hộp “Thêm phân loại sản phẩm” tại **375×812**: cao khoảng **925px**, mép trên **−56px**, mép dưới **868px**, `overflow-y: visible`. Đầu/cuối dialog ngoài viewport. Đây là lỗi đã quan sát, không chỉ dự đoán từ CSS.

Đã khôi phục viewport trình duyệt về mặc định sau phép đo. Chưa kiểm tra responsive tất cả trang.

## 3. Phạm vi trang và cấu trúc hiện có

| URL / vùng | Nhiệm vụ | Component / ràng buộc |
| --- | --- | --- |
| `/admin` | Theo dõi tiến độ, chỉ tiêu và hồ sơ cần xử lý | `AdminDashboardPage`; VIEW |
| `/admin/products` | Tra cứu sản phẩm/hồ sơ | `AdminProductsPage mode='products'`; VIEW |
| `/admin/products/$id` | Xem thông tin, phiếu, tệp, tiến độ, kết quả | `AdminProductDetailPage`; VIEW; thao tác nháp MANAGE |
| `/admin/registrations` | Quản lý phiếu đăng ký trên cùng hồ sơ sản phẩm | `AdminProductsPage mode='registrations'`; VIEW |
| `/admin/registrations/new` | Nhập hộ chủ thể | `ProductDraftEditor mode='admin'`; MANAGE |
| `/admin/registrations/$id` | Chi tiết phiếu | `AdminProductDetailPage mode='registrations'`; VIEW |
| `/admin/registrations/$id/edit` | Sửa bản nháp | `ProductDraftEditor mode='admin'`; MANAGE |
| `/admin/product-groups` | Nhóm lớn, phân loại, địa bàn | `AdminProductGroupsPage`, `CategoryEditorDialog`, `LocalitiesPanel`; VIEW/MANAGE theo thao tác |
| `/admin/scoring-forms` | Bộ mẫu, phiếu chấm thực tế và in | `AdminScoringFormsPage`; VIEW hoặc SCORE, dữ liệu theo quyền |
| `/admin/assignments` | Xem/phân công giám khảo và phạm vi | `AdminAssignmentsPage`; VIEW xem, MANAGE sửa |
| `/admin/reports` | Báo cáo theo ngày nộp hoặc hoàn tất | `AdminReportsPage`; VIEW |
| `/admin/users` | Người dùng và đơn vị | `AdminUsersPage`, `UserEditorDialog`, `OrganizationUnitsPanel`; MANAGE |
| `/admin/judges` | URL tương thích | Redirect tới `/admin/users?permission=SCORE`; không dựng thêm trang giám khảo |
| Tab Kết quả | Điểm tổng hợp và chi tiết giám khảo | `AdminProductResultsPage`, được nhúng trong trang chi tiết |
| Liên kết `/print/**` | Mẫu trắng, Mẫu 01, phiếu chấm, tổng hợp | Giữ trang in/guard hiện có; kiểm tra hồi quy khi sửa CSS |

Hai danh sách sản phẩm/phiếu đăng ký dùng cùng endpoint list và cùng product ID (`queries/admin-products.ts:12`). Không tạo thêm đối tượng “phiếu đăng ký” độc lập trong thiết kế.

## 4. Phát hiện theo mức ưu tiên

P1: có thể khiến người dùng hiểu sai hoặc không tiếp cận được nội dung. P2: làm chậm công việc hoặc gây thiếu nhất quán. P3: chi tiết thị giác/nội dung. Đây là mức ưu tiên sửa UI, không phải kết luận về lỗ hổng bảo mật.

### P1 — sửa trước

| ID | Phát hiện và ảnh hưởng | Bằng chứng | Hướng sửa |
| --- | --- | --- | --- |
| A01 | Root tràn ngang ở 320–414px; thao tác và nội dung phía phải không nằm trong màn hình | Đo trực tiếp; `styles.css:1322`, `:2951`, `:2993`; topbar và các min-width của con cần được xét cùng grid | Grid/flex cho phép co về 0; control xếp dọc; menu mobile có nút mở; bảng cuộn riêng. Không che lỗi bằng cắt root |
| A02 | Hộp tạo phân loại vượt chiều cao màn hình | Đo 375×812; `CategoryEditorDialog.tsx:93`; Dialog mặc định không có giới hạn cao, trong khi `UserEditorDialog.tsx:451` đã có | Giới hạn chiều cao và cuộn nội dung; giữ đóng, tiêu đề và hành động tiếp cận được |
| A03 | Nhãn “Khoảng ngày” đảo căn cứ: mặc định `submittedAt` nhưng hiển thị “Hoàn thành”; `completedAt` lại ghi “Nộp” | `AdminProductsPage.tsx:405`; đã thấy ở bộ lọc thật | Dùng nhãn đúng “Ngày nộp” / “Ngày hoàn tất”; hiển thị căn cứ đang áp dụng và cho đổi bằng giá trị query hiện có |
| A04 | Danh sách mở từ liên kết báo cáo có điều kiện ngầm: query lấy group/category/date từ URL, UI thiếu group/category và `dateRange` khởi tạo rỗng | `AdminProductsPage.tsx:35`, `:103`, `:108`, `:110`; đọc source | Hiển thị đầy đủ query đã áp dụng; input và chip đọc cùng một trạng thái; URL là nguồn khi vào/quay lại trang |

### P2 — nhất quán luồng công việc

| ID | Phát hiện và ảnh hưởng | Bằng chứng | Hướng sửa |
| --- | --- | --- | --- |
| A05 | Danh sách bị bó vào panel 680px, chứa tiếp các card lọc/bảng; bảng rộng khó đọc | React desktop và Open Design khác rõ; `AdminProductsPage.tsx:177`, `styles.css:944` | Bỏ container form khỏi trang danh sách; một panel cho bảng, toolbar ở ngoài |
| A06 | “Tổng quan” và mục con cùng được tô active | DOM tại `/admin/products`: cả hai link có `data-status='active'`; `AppLayout.tsx:30` | Exact match cho Tổng quan, giữ match theo nhóm cho chi tiết hồ sơ |
| A07 | Control và bố cục bộ lọc không đồng nhất: nhiều dropdown hiện sát label, khó nhận ra vùng nhập | Quan sát dashboard/users/catalog/scoring/reports; Input chỉ có font và màu (`components/ui/input.tsx:12`); `admin-user-filters` được dùng nhưng không có CSS định nghĩa | Hoàn thiện hình thức control ở tầng dùng chung; bổ sung bố cục bộ lọc có scope; rà mọi caller của Input trước chỉnh |
| A08 | Nhiều label trong bộ lọc sản phẩm không liên kết control; nút mở bộ lọc chưa thông báo expanded; nhóm status dùng tab nhưng thiếu panel/keyboard của tab | `AdminProductsPage.tsx:195`, `:257`, `:294` trở đi; DOM có combobox không tên | Label/id hoặc bao control đúng; trạng thái mở ARIA; dùng nhóm nút lọc hoặc Tabs hoàn chỉnh |
| A09 | Sản phẩm và Phiếu đăng ký gần như cùng câu mô tả, tab “Tất cả sản phẩm” và thông báo rỗng | Đã quan sát hai route; `AdminProductsPage` chỉ đổi H1 theo mode | Dùng lời dẫn theo tác vụ; sản phẩm ưu tiên theo dõi kết quả, phiếu ưu tiên nhập/sửa/nộp; giữ cùng dữ liệu |
| A10 | Đổi giám khảo trong editor phân công không nạp lại phạm vi cũ; đổi phân loại mới nạp phạm vi. Có nguy cơ áp dụng nhầm tập tiêu chí trước đó | `AdminAssignmentsPage.tsx:233` so với `:244`; `applyScope` tại `:93`; source, chưa lưu thử | Khi đổi bất kỳ khóa nào, nạp scope của đúng cặp giám khảo–phân loại; không giữ scope của cặp khác |
| A11 | Ma trận liệt kê tất cả phân loại và chuỗi tên tiêu chí còn thiếu rất dài; xem trước/lưu ở cuối trang | Trang thật; `AdminAssignmentsPage.tsx:300`, `:368` | Lọc theo nhóm/phân loại, thu gọn tiêu chí thiếu, thanh thay đổi luôn tiếp cận được; giữ diff và xác nhận thay thế toàn bộ |
| A12 | Bộ lọc phiếu thực tế yêu cầu mã sản phẩm/người chấm; chi tiết cấu trúc mẫu xuất hiện sau bảng dài | `AdminScoringFormsPage.tsx:235`, `:324`, `:331` | Tìm theo tên bằng `q` trước; mã là nâng cao; mở chi tiết trong Dialog rộng dùng lại query hiện có |
| A13 | Địa bàn và đơn vị mở sẵn form tạo dài trước danh sách, mỗi bản ghi sửa là một form riêng | `LocalitiesPanel.tsx:232`, `:411`; `OrganizationUnitsPanel.tsx:180`, `:311` | Danh sách trước, form thêm/sửa mở theo yêu cầu; không đổi hành vi cập nhật/lý do |
| A14 | Trang chi tiết/kết quả lặp tiêu đề, lộ enum; tab kết quả tạo thêm H1 trong trang đã có H1 | `AdminProductDetailPage.tsx:89`, `:192`, `:287`, `:296`; `AdminProductResultsPage.tsx:38`, `:40` | Một H1 và thanh ngữ cảnh chung; status tiếng Việt; kết quả nhúng bắt đầu bằng H2 |
| A15 | Tổng quan dồn tám KPI ngang hàng trước việc cần xử lý; lời dẫn mô tả số lượng khối, chưa giúp quyết định | Trang thật; `AdminDashboardPage.tsx:74`, `:281`, `:304` | Đưa việc cần xử lý và bốn chỉ tiêu ưu tiên lên trước; vẫn giữ toàn bộ tám chỉ tiêu và bảng đối chiếu ở phần phân tích |
| A16 | Báo cáo trình bày như bản in ngay trên màn hình, tab rất dài và đưa tên API vào nhãn | Trang thật; `AdminReportsPage.tsx:251`, `:420` trở đi | Tab “Hồ sơ đăng ký” / “Kết quả hoàn tất”; hướng dẫn căn cứ bằng tiếng Việt; bảng màn hình thoáng hơn, bản in giữ đủ nội dung |

### P3 — hoàn thiện nội dung và thị giác

| ID | Phát hiện | Bằng chứng | Hướng sửa |
| --- | --- | --- | --- |
| A17 | Tiêu đề serif quá lớn, eyebrow mono/viết hoa và “PHÂN HỆ” lặp; tài khoản hiển thị mã quyền nguyên dạng | `styles.css:130`, `:951`; `AdminDashboardPage.tsx:74`; `AdminUsersPage.tsx:40` | Be Vietnam Pro cho tiêu đề nghiệp vụ; Lora giữ ở nhận diện; nhãn quyền có giải thích tiếng Việt |
| A18 | Số lượng “6 nhóm/26 mẫu” ghi cứng trong phần nội dung dù có API quản lý danh mục | `AdminProductGroupsPage.tsx:211`, `:229`; `AdminScoringFormsPage.tsx:64`, `:76` | Nhãn tab trung tính hoặc số từ metadata đúng phạm vi; không dùng số giả trong thiết kế |
| A19 | Empty state sản phẩm không có lối tạo ngay trong khối; phân trang địa bàn ở editor có thể ghi “Trang 1 / 0” | Quan sát danh sách rỗng và trang tạo; `ProductDraftEditor.tsx:422` | Phân biệt rỗng ban đầu/rỗng do lọc; CTA theo quyền; 0 kết quả không biểu diễn như trang hợp lệ có mẫu số 0 |

**Tổng: 4 P1 · 12 P2 · 3 P3.**

### Ghi chú theo Hallmark

Hai “tell” có bằng chứng trực tiếp: **Card-in-card** ở danh sách hồ sơ (`AdminProductsPage.tsx:177`, CSS panel) và **Eyebrow on every section** theo mô thức nhãn phân hệ ở đầu nhiều trang admin. Chúng được xử lý bằng bỏ lớp bao thừa và tiêu đề chức năng gọn. Không gán lỗi vì bảng nghiệp vụ có nhiều cột, hoặc vì các trang cùng một sản phẩm dùng chung bố cục.

## 5. So sánh phương án

| Phương án | Lợi ích | Đánh đổi | Quyết định |
| --- | --- | --- | --- |
| A. Chỉnh màu/khoảng cách từng trang | Ít thay đổi cục bộ | Không giải quyết control chung, responsive, query ngầm và thao tác phân công | Không đủ |
| B. Chuẩn hóa khung và mẫu nghiệp vụ trong cấu trúc hiện có | Sửa gốc thiếu nhất quán, tái dùng API/UI, cải thiện cả danh sách và biểu mẫu | Cần kiểm tra hồi quy component dùng chung | **Đề xuất** |
| C. Xây admin mới, đổi route và lớp dữ liệu | Tự do bố cục | Phạm vi lớn, phải kiểm lại quyền/lưu/tệp/in; không cần cho yêu cầu hiện tại | Không chọn |

Không sao chép nguyên prototype thành app mới. Dùng React hiện có làm sản phẩm; prototype là tài liệu tham chiếu. Sidebar xanh đậm và cấu trúc danh sách của prototype có thể kế thừa, nhưng số đếm, tên sản phẩm và kết quả minh họa không được đưa vào giao diện thật.

## 6. Thiết kế lại từng trang

Các bố trí dưới đây là wireframe nội dung, không biểu diễn dữ liệu thật. `[số từ API]` là chú thích thiết kế; giao diện thật chỉ hiển thị số sau khi truy vấn thành công.

### 6.1. Tổng quan

**Câu hỏi chính:** còn việc gì và cần mở khu vực nào để xử lý?

```text
Tổng quan OCOP                                  [Báo cáo] [Tải lại]
[Năm] [Tháng] [Nhóm] [Bộ lọc khác] [Áp dụng]
Kỳ đang xem / mốc chốt / dữ liệu cập nhật

Đăng ký trong kỳ | Hoàn tất trong kỳ | Chờ/đang chấm | Chưa đủ phân công
[số từ API và diễn giải căn cứ của từng chỉ tiêu]

Hồ sơ cần xử lý tiếp                     Tiến độ giám khảo
[danh sách và hành động mở hồ sơ]          [bảng ngắn, xem đầy đủ]

Phân tích trong kỳ
[4 chỉ tiêu còn lại] [xu hướng] [nhóm] [tiến độ kỳ] [mức sao]
[bảng đối chiếu kỳ trước và tổng hiện tại theo trạng thái]
```

Giữ tám KPI hiện có, phân cấp thành bốn ưu tiên vận hành và bốn phân tích kết quả. Không cộng/trộn các tập thống kê khác căn cứ thời gian. Thuật ngữ “hồ sơ nộp trong kỳ” khác “hoàn tất trong kỳ” và “tồn tại mốc chốt”; giải thích dưới chỉ tiêu.

Không vẽ đường xu hướng khi toàn bộ dữ liệu rỗng; dùng thông báo có ích và giữ bảng số liệu truy cập được. Có thể dùng bảng và thanh tiến độ hiện có, chưa cần thư viện biểu đồ mới.

Liên kết xem chi tiết chỉ được gọi là “Xem danh sách tương ứng” khi query biểu diễn đúng tập thống kê. Hiện tại link của KPI tồn/thiếu phân công chỉ là `status=SUBMITTED`, và các KPI đạt/chưa đạt cùng dẫn tới tập hoàn tất. Với hợp đồng `AdminProductQuery` hiện có chưa lọc được tất cả tập này, dùng nhãn trung thực “Mở hồ sơ đã nộp” / “Mở kết quả hoàn tất”, hoặc không gắn link vào KPI; không tuyên bố drill-down chính xác. Backend mở rộng là công việc riêng nếu sau này yêu cầu.

### 6.2. Sản phẩm và Phiếu đăng ký

```text
Sản phẩm OCOP                                  [+ Thêm phiếu đăng ký]
Theo dõi hồ sơ, tiến độ chấm và mức sao theo điểm.
[Tất cả] [Bản nháp*] [Đã nộp] [Đang chấm] [Hoàn tất]
[Tìm sản phẩm / mã] [Nhóm lớn] [Phân loại] [Bộ lọc khác] [Áp dụng]
Đang lọc: [điều kiện có tên] ...                           [Xóa bộ lọc]
--------------------------------------------------------------------
Sản phẩm / mã | Chủ thể | Địa bàn / năm | Trạng thái | Kết quả | Mở
--------------------------------------------------------------------
[phạm vi bản ghi / tổng]                             [Trước] [Sau]
* Bản nháp chỉ xuất hiện khi phạm vi quyền cho phép.
```

“Phiếu đăng ký” dùng cùng bảng, nhưng lời dẫn “Nhập và quản lý phiếu đăng ký cho chủ thể”, nút “Nhập phiếu đăng ký”, tab đầu “Tất cả phiếu”. Không đổi dữ liệu hoặc tự lọc chỉ bản nháp trên route này.

Từ khóa sản phẩm và từ khóa chủ thể là hai trường đúng với hợp đồng `q`/`registrantQ`; không hứa một ô tìm mọi đối tượng khi API không làm vậy. Bộ lọc nâng cao giữ loại đăng ký, năm đánh giá, mức sao theo điểm, địa bàn, chưa gắn địa bàn, căn cứ ngày, từ/đến ngày và sắp xếp. Danh sách địa bàn có tìm và phân trang, không chỉ hiển thị trang đầu.

Không tự thêm badge số lượng từng trạng thái nếu endpoint không cung cấp tổng theo cùng bộ lọc. ID thật có thể rút gọn thị giác, nhưng xem/copy được giá trị đầy đủ; không dựng mã `PRD-*` giả. Ảnh nhỏ chỉ là tín hiệu phụ; đọc ảnh riêng tư bằng cơ chế Blob hiện có.

Chưa hoàn tất hiển thị trạng thái chờ tương ứng; không in `0 sao` khi kết quả chưa có. Footer phân trang dùng metadata máy chủ, xử lý tập rỗng riêng.

### 6.3. Chi tiết hồ sơ và tab kết quả

```text
[Quay lại danh sách, giữ bộ lọc]
Tên sản phẩm                         [Trạng thái] [Thao tác theo quyền]
Mã hồ sơ / chủ thể / phân loại / ngày nộp
[Thông tin] [Phiếu đăng ký] [Tệp] [Tiến độ] [Kết quả]

Nội dung tab, không lặp lại tên sản phẩm/H1
```

Thông tin dùng cặp nhãn/giá trị có nhóm; Phiếu đăng ký tách rõ dữ liệu lưu khi nộp và bản nháp hiện tại. Không sửa snapshot đã nộp hoặc tự điền lịch sử còn thiếu.

Tệp hiển thị tên, loại, thao tác mở; thumbnail không làm giãn chiều cao dòng quá mức. Nếu xóa tệp cần lý do, hỏi ngay tại tác vụ; giữ quyền chỉ sửa/xóa bản nháp hiện có. Không thay URL riêng tư bằng URL công khai.

Tiến độ dùng timeline từ `statusEvents`, nhãn Việt và ngày giờ, chỉ hiện sự kiện có thật. Kết quả dùng H2 “Kết quả chấm”, tổng cuối nếu đã hoàn tất; từng giám khảo có trạng thái và điểm trong phạm vi. Không cộng đơn giản các tổng giám khảo thành tổng sản phẩm.

Hành động “Sửa phiếu”, “Nộp thay”, “Xóa bản nháp” tách rõ. Nộp/xóa mở xác nhận với tên hồ sơ và lý do; lỗi giữ nguyên nội dung. In phiếu/tổng hợp đi đúng route hiện có.

### 6.4. Tạo và sửa phiếu đăng ký

Giữ `ProductDraftEditor`, ba bước và lệnh lưu nháp hiện tại. Phần chọn chủ thể và lý do thao tác đặt trong một khối ngữ cảnh admin rõ ràng, không để Input không có viền nổi lẫn vào văn bản.

- Đầu trang: “Nhập phiếu đăng ký” / “Sửa phiếu đăng ký”, tên chủ thể đã chọn, tình trạng bản nháp và quay lại.
- Bước 1: chủ thể/đơn vị đăng ký, địa bàn, liên hệ; hai cột trên desktop, một cột trên điện thoại.
- Bước 2: thông tin sản phẩm, phân loại; nêu rõ danh mục không còn hiệu lực khi có.
- Bước 3: cam kết và tệp; giữ giới hạn 20 tệp, 10 MiB/tệp và loại tệp từ cơ chế hiện có.
- Cuối vùng nhập: “Quay lại”, “Tiếp tục”, “Lưu bản nháp”; không thêm nút nộp tự động vào hành vi lưu nháp.

Label bắt buộc/tùy chọn rõ. Tóm tắt lỗi dẫn tới đúng bước/trường. Chuyển bước không xóa giá trị. Lưu thất bại/không biết kết quả tạo phải giữ cơ chế chặn gửi lặp và yêu cầu kiểm tra bản ghi hiện có; không tự retry toàn bộ upload.

Editor chia sẻ với chủ thể: thay đổi bố cục admin cần có scope hoặc biến thể hiện có, kiểm lại `mode='owner'` trước khi hoàn tất.

### 6.5. Nhóm sản phẩm và địa bàn

Giữ ba tab: **Phân loại sản phẩm**, **Nhóm lớn**, **Địa bàn**. Bỏ số 26 ghi cứng trên tab.

Phân loại: cây nhóm bên trái 240–270px trên desktop; bên phải bộ lọc và bảng. Trên màn hình nhỏ cây thành bộ chọn nhóm. Bảng ưu tiên tên phân loại, bộ tiêu chí/điểm, tình trạng mở đăng ký, số hồ sơ tham chiếu và thao tác. Mã dài, nguồn đầy đủ và lịch sử phiên bản đặt trong vùng chi tiết xem được, không chiếm phần lớn bảng.

Xem tiêu chí mở Dialog có cuộn, giữ query detail hiện có và nút in mẫu trắng. Thêm/sửa phân loại dùng dialog có giới hạn chiều cao; thông báo rõ phân loại mới chưa nhận đăng ký khi chưa có bộ tiêu chí đủ điều kiện. Không thêm trình biên soạn bộ tiêu chí chưa có API.

Nhóm lớn và địa bàn: danh sách + bộ lọc trước, nút thêm mở form theo yêu cầu; sửa một bản ghi tại một thời điểm. Địa bàn giữ mã không tự suy từ địa chỉ, loại Xã/Phường và trạng thái mở cho đăng ký mới.

Ngày hiệu lực dùng nhập ngày/giờ địa phương dễ hiểu, chuyển đúng offset Việt Nam trước gửi; không bỏ phần giờ hoặc độ chính xác sẵn có khi sửa bản ghi. Khoảng hiệu lực vẫn theo hợp đồng nửa kín. Đây là thay đổi trình bày, không thay luật kiểm tra ngày và bảo vệ hồ sơ lịch sử.

### 6.6. Phiếu chấm OCOP

Hai tab **Bộ phiếu** và **Phiếu chấm thực tế**. Tab mẫu: tìm tên/mã/nguồn, nhóm lớn, trạng thái, danh sách; phần phiên bản/nguồn đầy đủ có thể mở chi tiết. Chi tiết dùng Dialog rộng thay vì xuất hiện dưới toàn bộ bảng.

Tab thực tế: từ khóa theo `q`, nhóm, trạng thái; productId/judgeId ở nâng cao để điều tra theo mã khi cần. Không thêm picker phụ thuộc endpoint mới. Mỗi dòng có sản phẩm, người chấm/đơn vị tại thời điểm nộp, phạm vi, trạng thái, ngày nộp và tổng trong phạm vi. Điểm một phần phải hiện mẫu số và nhãn “Phạm vi một phần”.

Giữ giới hạn dữ liệu VIEW/MANAGE/SCORE. Tài khoản chỉ SCORE không được thấy dữ liệu ngoài phạm vi nhờ thay đổi thiết kế. Bản in đã nộp/bản nháp giữ nhãn và quy tắc hiện có. Không có nút sửa phiếu đã nộp nếu API không hỗ trợ.

### 6.7. Phân công

```text
Phân công giám khảo
[Nhóm lớn] [Phân loại] [Chỉ hiển thị chưa phủ đủ]
Đã phủ [số từ dữ liệu hiện có] / cần phân công

Phân loại                         Giám khảo / phạm vi
[danh sách có trạng thái phủ]      [toàn bộ / chọn tiêu chí]
                                  [checkbox từng tiêu chí]
                                  [Áp dụng vào bản thay đổi]

Thay đổi chưa lưu: thêm / gỡ / đổi phạm vi
[Xem thay đổi] [Hủy thay đổi] [Lưu toàn bộ phân công]
```

“Toàn bộ tiêu chí” là lựa chọn rõ ràng, không bắt người dùng hiểu quy ước mảng rỗng. Payload vẫn giữ quy ước `criterionIds=[]` hiện có. Khi đổi giám khảo hoặc phân loại, nạp đúng phạm vi của cặp được chọn. Chọn ô không được âm thầm gỡ phân công; dùng thao tác gỡ có nhãn.

Chỉ lọc để trình bày; tập assignments gửi lên vẫn là toàn bộ tập đã tải cùng các chỉnh sửa, không chỉ các dòng đang thấy. Giữ kiểm tra phủ tiêu chí, bảng diff và xác nhận phạm vi thay thế; dialog xác nhận có tổng thêm/gỡ/đổi và danh sách phân loại liên quan. Nếu backend từ chối, giữ bản thay đổi để sửa.

Thanh lưu bám đáy vùng làm việc khi có thay đổi, không che hàng/nút focus. VIEW có danh sách chỉ đọc và giải thích ngắn; không hiển thị nút lưu vô dụng.

### 6.8. Người dùng và đơn vị

Giữ hai tab **Người dùng**, **Đơn vị**. Danh sách người dùng dùng tìm tên/email/điện thoại, loại tài khoản và trạng thái ở hàng chính; quyền, đơn vị, xác thực trong nâng cao. Quyền hiển thị badge “Quản lý”, “Xem dữ liệu”, “Chấm điểm”, có giải thích mã khi cần.

Hộp tạo tài khoản giữ tất cả trường/lý do/đơn vị theo API. Khi chưa có đơn vị hoạt động, thông báo kèm nút sang tab Đơn vị; không chỉ để nút tạo bị khóa mà không có đường xử lý.

Hộp sửa chia bốn vùng: **Hồ sơ**, **Quyền và đơn vị**, **Trạng thái**, **Mật khẩu**; mỗi vùng giữ lệnh lưu riêng. Chủ thể không được chỉnh email/xác thực/quyền nội bộ. Khóa tài khoản, đổi quyền và đặt lại mật khẩu phải cho người quản trị thấy đối tượng và ảnh hưởng trước xác nhận; giữ cơ chế xử lý phiên bị thu hồi hiện có.

Đơn vị: bảng/danh sách trước, form thêm/sửa theo yêu cầu. “Ngừng nhận tài khoản mới” không đổi thành “Xóa đơn vị”. Các đơn vị đang được tham chiếu phải tiếp tục hiển thị ở tài khoản liên quan.

### 6.9. Báo cáo thống kê

Thứ tự: tiêu đề và nút in, hai tab ngắn, bộ lọc, bản tóm tắt kỳ, chỉ tiêu, bảng, chú thích. Tab **Hồ sơ đăng ký** căn cứ ngày nộp; **Kết quả hoàn tất** căn cứ ngày hoàn tất. Có giải thích bằng tiếng Việt cạnh tab, không đưa tên cột API vào nhãn thao tác.

Giữ tất cả cột và tổng hợp hiện có; nhóm đầu cột theo tiến độ, kết quả và chất lượng dữ liệu. Bảng cuộn cục bộ, tiêu đề hàng/cột rõ; không thu nhỏ chữ để cố nhét 16 cột vào điện thoại. Metadata kỹ thuật có thể mở “Chi tiết kỳ báo cáo”; mốc chốt, kỳ chưa kết thúc và cảnh báo chất lượng dữ liệu vẫn thấy ngay.

In/Lưu PDF tiếp tục dùng cơ chế hiện có; bản in đủ cột, kỳ, căn cứ, mốc chốt, cảnh báo và chú thích mức sao. Không thêm xuất Excel, đặt lịch gửi báo cáo hoặc sửa công thức thống kê trong đợt UI.

## 7. Quy tắc liên trang và trạng thái

### Quyền và hành động

| Người sử dụng | Trải nghiệm |
| --- | --- |
| VIEW | Tra cứu admin và báo cáo theo quyền; không điều khiển thay đổi |
| MANAGE | Bao hàm VIEW; quản lý người dùng/danh mục, nhập/sửa/nộp hộ bản nháp, phân công |
| SCORE | Bộ phiếu/phiếu chấm theo phạm vi và khu vực giám khảo hiện có; không suy ra VIEW |
| Kết hợp | Hiển thị hợp của các khả năng được cấp, không suy từ tên vai trò cũ |

Đây là giữ hợp đồng hiện có, không thiết kế lại RBAC. Menu ẩn không thay thế guard hoặc kiểm tra quyền phía máy chủ.

### Tải, lỗi và tập rỗng

Lần tải đầu giữ chỗ đúng dạng bảng/form; cập nhật bộ lọc không làm mất toàn bộ cấu trúc. Khi đang dùng dữ liệu cũ trong lúc tải lại, phải báo “Đang cập nhật” để không nhầm dữ liệu với điều kiện mới.

Rỗng ban đầu có hành động tạo theo quyền. Không có kết quả lọc có “Xóa bộ lọc”. Lỗi tải có “Thử lại” và giữ điều kiện. Không đủ quyền có đường về khu vực được phép; không lộ chi tiết nội bộ. Lỗi một nguồn phụ như đơn vị/địa bàn được báo tại control liên quan thay vì giả vờ danh sách trống.

### Quay lại và bảo toàn dữ liệu

Quay lại từ chi tiết giữ bộ lọc/tab/trang qua URL. Form đang nhập giữ giá trị khi chuyển bước hoặc API lỗi. Thay đổi chưa lưu của hồ sơ/phân công/dialog được cảnh báo trước rời; không tự lưu và không tự bỏ bản thay đổi.

Không đổi khóa query hoặc cache theo cách làm dữ liệu người dùng trước xuất hiện trong phiên mới. Không thay cơ chế lưu nháp/upload, snapshot khi nộp, bảo vệ tệp riêng tư hoặc độ chính xác điểm.

## 8. Bề mặt dự kiến chạm khi triển khai

Đợt này chỉ tạo `design.md` và tài liệu này. Bảng sau là phạm vi **dự kiến**, chưa phải các file đã sửa.

| Nhóm | File / vùng | Ràng buộc kiểm tra |
| --- | --- | --- |
| Khung | `apps/web/src/layouts/AppLayout.tsx`, `apps/web/src/styles.css` | Scope admin; giữ khu vực chủ thể/giám khảo; không đưa header công khai trở lại |
| Control | `apps/web/src/components/ui/input.tsx`; Select/Badge/Dialog/Tabs khi thực sự cần | Rà mọi caller trước sửa; dialog dài có cuộn; focus và tên control |
| Hồ sơ | `pages/admin/AdminProductsPage.tsx`, `AdminProductDetailPage.tsx`, `AdminProductResultsPage.tsx` | Hai mode chung; query/URL, permission và riêng tư tệp |
| Nhập liệu | `components/products/ProductDraftEditor.tsx` | Giữ mode owner, ba bước, chặn tạo lặp, upload từng phần |
| Danh mục | `AdminProductGroupsPage.tsx`, `CategoryEditorDialog.tsx`, `LocalitiesPanel.tsx` | Bộ tiêu chí 100 điểm, hiệu lực địa bàn và dữ liệu lịch sử |
| Phiếu | `AdminScoringFormsPage.tsx` | Phạm vi SCORE, điểm một phần và các route in |
| Phân công | `AdminAssignmentsPage.tsx` | Mảng rỗng = toàn bộ, thay thế toàn bộ tập, diff/confirm và không gửi lặp |
| Người dùng | `AdminUsersPage.tsx`, `UserEditorDialog.tsx`, `OrganizationUnitsPanel.tsx` | Không trộn mutation quyền/trạng thái; giữ xử lý phiên hiện tại |
| Phân tích | `AdminDashboardPage.tsx`, `AdminReportsPage.tsx` | Không đổi công thức/căn cứ; link đúng ý nghĩa; giữ đủ báo cáo |
| Nhãn | `constants/product-status.ts` và nhãn quyền ở tầng hiện có | Dùng chung enum, không thêm trạng thái |
| Kiểm tra | Các test web hiện có, thêm đúng hồi quy logic thay đổi | Không tạo framework test/UI mới chỉ cho đợt này |

Không dự kiến xóa file production, tạo route thay thế hay đổi schema/API. Không sửa `PublicLayout.tsx`, `LoginPage.tsx`, `routes/__root.tsx` để phục vụ thiết kế admin nếu không có bằng chứng cần thiết.

Các thay đổi đã có trước khảo sát ở PublicLayout, AdminProductsPage, LoginPage, `__root.tsx`, styles.css phải được giữ và đối chiếu khi triển khai; không reset file về Git để có “nền sạch”.

## 9. Thứ tự thực hiện sau khi duyệt thiết kế

1. Sửa nền: co giãn khung, active menu, control, label và dialog; kiểm tra public/auth/owner/judge không bị ảnh hưởng.
2. Chuẩn hóa danh sách sản phẩm/phiếu đăng ký làm trang mẫu; sửa nhãn ngày và hiển thị đủ bộ lọc từ URL.
3. Chi tiết/kết quả và trình nhập hồ sơ; giữ toàn bộ an toàn dữ liệu/tệp.
4. Danh mục, địa bàn, người dùng và đơn vị; form mở theo yêu cầu.
5. Phiếu chấm và phân công; kiểm riêng đổi cặp giám khảo/phân loại và payload thay thế toàn bộ.
6. Tổng quan và báo cáo; phân cấp thông tin, sửa lời dẫn/liên kết, kiểm bản in.
7. Kiểm tra theo ma trận phía dưới, đối chiếu React với thiết kế ở cùng kích thước/quyền/dữ liệu.

Đây là thứ tự bàn giao theo bề mặt, chưa phải kế hoạch thay đổi mã nguồn từng bước. Sau khi người dùng xem thiết kế, mới lập kế hoạch triển khai cụ thể theo Superpowers.

## 10. Điều kiện nghiệm thu

### Hình thức và khả năng tiếp cận

- [ ] Kiểm tra 320, 375, 414, 768, 1024, 1440px và màn hình rộng hiện tại; root không tràn ngang, bảng cuộn cục bộ khi cần.
- [ ] Không dùng cắt overflow để giấu control/nội dung; không có dialog bị mất title/nút ở viewport 375×812.
- [ ] Một mục menu chính active; một H1 mỗi trang; tiêu đề/CTA nhất quán, tên dài không làm vỡ bố cục.
- [ ] Tab/Shift+Tab, Enter/Space, Escape và đóng/mở menu/dialog hoạt động; focus trở về nơi hợp lý, không bị thanh lưu che.
- [ ] Control có label đọc được bằng công nghệ hỗ trợ; lỗi/đang cập nhật/thành công có thông báo phù hợp.
- [ ] Kiểm tương phản thực tế; reduced motion; không dùng màu làm dấu hiệu duy nhất.

### Bộ lọc và dữ liệu

- [ ] Áp dụng/xóa/đổi trang/quay lại giữ đúng query; group/category/date từ báo cáo hiển thị đầy đủ; input không rỗng khi query có ngày.
- [ ] `submittedAt` được ghi là Ngày nộp; `completedAt` là Ngày hoàn tất; mốc hết khoảng ngày vẫn đúng biên Việt Nam.
- [ ] Thử 0, 1, 20 và trên 20 hồ sơ bằng fixture được phép; phân trang theo metadata; tìm trên máy chủ, không chỉ dữ liệu đã tải.
- [ ] Thử tên dài, ID dài, không ảnh, không địa bàn, chưa có điểm, điểm bằng 0, điểm lẻ và kết quả theo phạm vi một phần.
- [ ] Không số đếm giả, không mã giả, không hiển thị “công nhận chính thức” từ dữ liệu chỉ có sao theo điểm.
- [ ] Loading/empty/error/forbidden và lỗi nguồn danh mục phụ phân biệt được; lỗi không hiện như dữ liệu bằng 0.

### Thao tác cần bảo toàn

- [ ] VIEW/MANAGE/SCORE và tổ hợp được kiểm riêng bằng fixture hoặc phiên phù hợp; không chỉ dựa vào tài khoản admin đang xem.
- [ ] Đổi giám khảo khi đang chọn phân loại nạp đúng scope; mảng rỗng vẫn nghĩa toàn bộ; lọc ma trận không làm mất assignments không hiển thị.
- [ ] Lưu phân công vẫn có xem trước và xác nhận toàn bộ; lỗi giữ bản thay đổi, nút đang gửi không gửi lặp.
- [ ] Lưu hồ sơ người dùng không đổi trạng thái/quyền ngoài ý định; thao tác thu hồi phiên giữ hành vi hiện tại.
- [ ] Editor admin và owner cùng hoạt động; lỗi tạo không rõ kết quả không tạo bản ghi trùng; upload lỗi một phần không tự gửi lại tệp có kết quả chưa rõ.
- [ ] Hồ sơ đã nộp không bị sửa snapshot; tệp riêng tư vẫn qua API có quyền; ảnh không tải được không làm mất khả năng mở hồ sơ.
- [ ] Kiểm preview in Mẫu 01, mẫu trắng, phiếu chấm, tổng hợp và báo cáo ngang; không cắt cột hay mất chú thích.

### Cách chứng minh

Thay đổi CSS thuần: kiểm hình ảnh và bàn phím tại viewport đại diện, không viết unit test lặp CSS. Logic URL/ngày/phạm vi phân công thay đổi: để lại một hồi quy nhỏ chạy được cho mỗi nhóm hành vi và chạy các test liên quan sẵn có. Khi có source mới, chạy web typecheck/build và kiểm API boundary theo script hiện có; không báo các kiểm tra đó đã chạy trong đợt viết tài liệu.

## 11. Nguồn và tình trạng xác minh

- Quy chuẩn mới: [design.md](../../../design.md).
- Bối cảnh nghiệp vụ: [Đặc tả admin](2026-10-17-admin-modules-spec.md).
- Lịch sử kiểm tra: [H4 admin verification](../../verification/2026-10-22-h4-admin-modules.md). Bản này có cập nhật PostgreSQL ngày 24/10; không dùng lỗi kết nối cũ để kết luận môi trường hiện tại hỏng.
- Prompt Open Design cũ: [ocop-ui-review-prompts.md](../../open-design/ocop-ui-review-prompts.md). Một số mô tả “chưa có endpoint/trang” đã cũ; triển khai hiện tại là căn cứ đánh giá.
- Khả năng đọc chữ: [W3C WCAG Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Responsive và bảng cuộn: [W3C WCAG Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Hành vi focus/dialog: [WAI-ARIA APG Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Đã tự rà soát tính nhất quán giữa đề xuất và hợp đồng hiện tại, đường dẫn tài liệu, phạm vi file và phân biệt bằng chứng trực tiếp/suy luận từ source. Chưa sửa giao diện; chưa chạy kiểm thử mutation, bản in hoặc toàn bộ vai trò. Các checkbox nghiệm thu là yêu cầu tương lai, không phải kết quả đã đạt.
