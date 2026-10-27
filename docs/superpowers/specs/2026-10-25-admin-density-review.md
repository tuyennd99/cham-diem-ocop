# Rà soát kích thước và mật độ admin OCOP

Ngày: **25/10/2026**. Hướng: **nghiệp vụ OCOP, gọn và rõ**.

Phạm vi lần này: đánh giá giao diện đang chạy, đối chiếu CSS và sửa thông số thiết kế. **Chưa sửa mã giao diện.**

## 1. Kết luận

Control đang quá lớn vì ba nguyên nhân cộng dồn: chiều cao tối thiểu 44px áp đồng loạt, trường ngắn chia đều hết chiều rộng, và panel bộ lọc lồng hai lớp padding. Riêng trình nhập hồ sơ còn có lỗi grid kéo input một dòng lên khoảng 101px. Chỉ giảm font hoặc padding sẽ không giải quyết đủ.

Giữ những phần đang phù hợp: chữ control 14px, label rõ, sidebar 248px, màu trạng thái, bảng dùng chiều rộng vùng làm việc. Thu gọn control và khoảng cách trước; giữ khả năng đọc và vùng focus.

## 2. Bằng chứng trực tiếp

Đo DOM/computed style và quan sát Chrome local, không thay dữ liệu hoặc gửi biểu mẫu. Kích thước dưới đây là CSS px, làm tròn. Viewport tự nhiên thay đổi từ 1639px sang 2560px trong quá trình khảo sát; mỗi phép đo ghi riêng để tránh so sánh sai.

| Vùng | Viewport | Hiện trạng đo được | Tác động |
| --- | ---: | --- | --- |
| Tổng quan, sản phẩm, người dùng, phiếu chấm | 1639 | Button/input/select cao 44; trường lọc khoảng 409px rộng | Năm, tháng, trạng thái chiếm ngang như ô tìm kiếm |
| Bộ lọc các trang trên | 1639 | Panel ngoài cao 198, padding 16; panel con cao 108, padding 16; hành động xuống hàng riêng | Khoảng trắng và đường viền lặp, dữ liệu bị đẩy xuống |
| Khung admin | 1639 | Sidebar 248; topbar 65; main padding 24px 32px; khoảng khối 24 | Mỗi phần riêng không quá lớn, nhưng cộng với bộ lọc gây cảm giác thưa |
| Tab người dùng/phiếu chấm | 1639 | Cao 38, chữ 16; nhóm nút lọc trạng thái sản phẩm cao 44, chữ 14 | Thành phần cùng cấp có mật độ khác nhau |
| Báo cáo | 2560 | Vùng trang rộng 2248; năm/tháng/nhóm báo cáo khoảng 716×44; bộ lọc cao 198 | Trường ngắn bị kéo rộng quá mức trên màn hình lớn |
| Nhóm sản phẩm & địa bàn | 2560 | Vùng trang 2248; cây 256; vùng phải 1968; tìm kiếm/trạng thái khoảng 634×44 | Chia cột đều không phản ánh độ dài nội dung |
| Nhập phiếu đăng ký | 2560 | Editor rộng 2233; trường nửa hàng khoảng 1092; chọn địa bàn rộng 2199 | Biểu mẫu khó quét, mắt phải di chuyển xa |
| Tìm chủ thể trong phiếu đăng ký | 2560 | Input khoảng 1092×101; label cao 189; panel ngữ cảnh cao 342 | Input một dòng có diện tích như textarea, lỗi bố cục cần sửa trước |
| Ba bước nhập phiếu | 2560 | Mỗi nút khoảng 739×48 | Dải bước dài quá mức vì editor không giới hạn chiều rộng |

Các trang có phản hồi “Internal server error” ở vùng dữ liệu. Chưa đánh giá mật độ hàng có dữ liệu thật, bản ghi dài, ma trận phân công đã tải hoặc dialog có dữ liệu trong lần khảo sát này. Không suy ra hành vi các vùng đó từ trạng thái lỗi.

## 3. Nguyên nhân và ưu tiên

### D01 — Cao: input bị grid kéo giãn

`styles.css`, nhóm `.admin-step-grid` và label thuộc `.admin-form`, không căn đầu hàng. Trong trình nhập hồ sơ, cột chọn chủ thể có thêm lỗi/phân trang làm hàng cao lên; label ở cột tìm kiếm cũng giãn theo. Hai hàng auto của label nhận khoảng trống và kéo input lên 101px dù `min-height` chỉ là 44px.

Sửa tại quy tắc chung cho grid form: căn đầu hàng; label gom nội dung về đầu; đặt chiều cao rõ cho input một dòng/select. Tách textarea để không cắt nội dung. Kiểm tra lại khi cột cạnh có lỗi dài hoặc thông báo tải, không chỉ khi cả hai cột rỗng.

Nguồn: `apps/web/src/styles.css:3076`, `:3178`, `:3190`; `apps/web/src/components/products/ProductDraftEditor.tsx:482`.

### D02 — Cao: bộ lọc lồng padding và tách hành động

`admin-form filter-card` đã là panel có padding 16, nhưng `.admin-filters` bên trong tiếp tục có padding 16 và viền. Nút áp dụng và lọc nâng cao nằm dưới, tạo panel 198px ngay cả khi phần nâng cao đóng.

Chỉ một lớp panel; grid bên trong lo bố trí. Trên desktop, đặt bộ lọc thường dùng và hành động chung hàng khi đủ chỗ; căn đáy control. Khi không đủ chỗ thì wrap, không cố giữ chiều cao cố định. Giữ label và toàn bộ điều khiển nâng cao.

Nguồn: `apps/web/src/styles.css:3168`, `:3358`; `apps/web/src/pages/admin/AdminDashboardPage.tsx:152`; `apps/web/src/pages/admin/AdminReportsPage.tsx:376`.

### D03 — Vừa: trường ngắn giãn bằng trường dài

`repeat(auto-fit, minmax(..., 1fr))` phân phối cùng chiều rộng cho năm, tháng, trạng thái và tìm kiếm. Vấn đề tăng theo chiều rộng màn hình. Editor cũng bị bỏ `max-width`, khiến trường một dòng dài hơn 1000px.

Giữ bảng linh hoạt, giới hạn editor 960px; chọn độ rộng theo vai trò từng trường. Tái dùng class CSS ngữ nghĩa ít nhất cần thiết, không tạo bộ cấu hình kích thước riêng cho từng trang.

Nguồn: `apps/web/src/styles.css:3062`, `:3069`, `:3168`; `apps/web/src/components/products/ProductDraftEditor.tsx`.

### D04 — Vừa: nhiều nguồn đặt chiều cao control

`.button` đặt 44px và padding 10px 16px; Button variants tiếp tục dùng `min-h-11`/`size-11`; Radix Select dùng `min-h-11`; native select/input chịu quy tắc admin; `.input-control`/`.select-control` có quy tắc riêng. CSS ngoài layer có thể thắng utility Tailwind, nên đổi riêng `size='sm'` chưa chứng minh control sẽ nhỏ.

Thu gọn trong phạm vi admin và dialog admin. Giữ component dùng chung cho trang công khai, đăng nhập, chủ thể, giám khảo theo phạm vi hiện có; kiểm tra riêng trang tài khoản vì `AppLayout` hiện áp scope admin cho `/account/**`. Không đổi `.button` toàn cục để sửa mỗi admin.

Nguồn: `apps/web/src/styles.css:248`, `:3190`, `:3385`, `:3402`; `apps/web/src/components/ui/button.tsx:7`; `apps/web/src/components/ui/select.tsx:19`; `apps/web/src/layouts/AppLayout.tsx`.

## 4. Thông số thay thế

Đây là kích thước đề xuất để triển khai, chưa phải kết quả đã áp dụng.

| Thành phần | Desktop dùng chuột | Màn hình nhỏ / con trỏ thô |
| --- | --- | --- |
| Button thường | Cao 36; padding ngang 12; chữ 14 | Vùng bấm tối thiểu 44 |
| Nút phụ trong bảng / icon | Cao 32 / 32×32; chữ 14 | Vùng bấm tối thiểu 44; cho hàng cao theo |
| Input một dòng / select | Cao 36; padding ngang 10–12; chữ 14 | Cao tối thiểu 44; chữ nhập 16 |
| Textarea | Tối thiểu 80–96; padding 8–12 | Tăng theo nội dung, không ép về 36/44 |
| Tab / nút lọc trạng thái | Cao 36; chữ 14 | Vùng bấm tối thiểu 44 |
| Label → control | 4 | 4–8 |
| Khoảng nút / khoảng cột | 8 / 12 | 8 / 12 |
| Khoảng hàng form | 12–16 | 16 |
| Padding panel | 12–16, một lớp | 12–16, một lớp |
| Khoảng khối trang | 16; 24 khi đổi vùng lớn | 16–24 |
| Padding nội dung trang | 20–24 | 16 |
| Hàng bảng | Padding ô 8px 12px; hàng tự cao theo nội dung | Cho cuộn ngang cục bộ; không ép chữ nhỏ |
| Topbar | Khoảng 56–60 | Tự cao khi nội dung cần wrap |

Control 36px giảm khoảng 18% chiều cao so với 44px. Bộ lọc ba trường và hành động có thể hướng tới khoảng 84–96px khi đủ chỗ trên một hàng, thay cho 198px; đây là mục tiêu dự kiến, cần đo sau sửa, không phải cam kết cho mọi trang/viewport.

| Trường / vùng | Độ rộng đề xuất |
| --- | --- |
| Năm | 112px |
| Tháng | 144px |
| Trạng thái | 176px |
| Nhóm / phân loại | 240–280px; xem lại với nhãn dài thật |
| Tìm kiếm | 280–360px, được co khi cần |
| Form nhập hồ sơ | Tối đa 960px; 2 cột desktop, 1 cột khi không đủ chỗ |
| Nút | Vừa nội dung; không chia đều cả hàng trên desktop |
| Bảng / báo cáo | Dùng vùng nội dung khả dụng; không áp trần 960px của form |

Các độ rộng trên là preferred width, không phải min-width gây tràn mobile. Khi xuống hàng, trường chiếm chiều rộng hàng khả dụng. Không cố định height của panel, label, thông báo lỗi hoặc hàng bảng nhiều dòng.

### Khả năng tiếp cận

44×44 là mức mục tiêu tăng cường AAA của [WCAG 2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html), không phải quy định bắt buộc cho mọi control desktop ở mức AA. [WCAG 2.5.8 mức AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) dùng 24×24 CSS px hoặc các ngoại lệ được nêu. Giữ 44px cho màn hình nhỏ/con trỏ thô là lựa chọn sử dụng của sản phẩm. Thu gọn desktop vẫn phải giữ focus, nhãn, độ tương phản và khoảng cách giữa mục tiêu; không suy ra đạt WCAG chỉ từ chiều cao.

## 5. Trình tự sửa và nghiệm thu

1. Sửa grid kéo giãn và giới hạn chiều rộng editor; kiểm tra cột cạnh có lỗi dài.
2. Thống nhất control admin 36px, nút phụ 32px và ngoại lệ touch 44px; kiểm tra computed style của Button thường/nhỏ/icon, native select, Radix Select, Input, textarea, disabled/loading/focus.
3. Gỡ panel lọc lồng nhau; đặt chiều rộng theo trường và wrap hành động. Áp dụng Tổng quan, sản phẩm, phiếu đăng ký, phiếu chấm, người dùng, báo cáo; danh mục giữ cây và vùng bảng riêng.
4. Thu khoảng cách trang và panel, thống nhất tab; kiểm tra hàng bảng/ma trận phân công khi API có dữ liệu. Điều chỉnh padding bảng trong scope admin, giữ bản in.
5. Đo tại 375, 768, 1024, 1440 và 2560px; thêm kiểm tra reflow 320px và zoom 200%. Không tràn cả trang; control không chồng chữ; lỗi dài không kéo cao input; nhãn dài vẫn đọc và chọn được; form không bị cắt chiều cao.
6. Kiểm tra hồi quy tài khoản và những vùng dùng chung, public/auth/judge/registrant và bản in; xác nhận mật độ mới không đổi truy vấn, quyền hoặc thao tác lưu.

Chưa cần thư viện, component wrapper, chế độ chọn mật độ hay thay đổi nghiệp vụ. Thực hiện bằng thành phần và CSS đang có. Sau khi sửa phải ghi số đo thực tế, không dùng các mục tiêu ở trên làm bằng chứng đã đạt.

## 6. Bổ sung sidebar theo yêu cầu người dùng

Sidebar desktop mở rộng 248px, thu gọn 72px; có nút đổi trạng thái ở đầu sidebar, tên truy cập “Thu gọn thanh điều hướng” / “Mở rộng thanh điều hướng” và `aria-expanded` đúng trạng thái. Thu gọn vẫn giữ tên truy cập từng liên kết, icon và dấu hiệu mục đang chọn; tooltip hiện khi hover hoặc focus bàn phím. Vùng nội dung tự điều chỉnh, giữ trang, bộ lọc và dữ liệu nhập.

Dưới 1024px dùng drawer, sidebar desktop không để lại cột trống, kể cả khi trước đó đã thu gọn. Drawer giữ nhãn đầy đủ, Escape đóng và focus trả về nút mở. Chuyển động khoảng 150ms, tôn trọng reduced motion. Giữ cơ chế nhớ trạng thái sidebar đang có; không thêm lớp lưu trữ khác.

## 7. Đối chiếu bản sửa Open Design ngày 25/10

Đã xác nhận file nguồn và ứng dụng local có bản sửa mới: padding nội dung 20px 24px, khoảng khối 16px, nút sidebar hiện diện. Trên Tổng quan ở viewport 2560px, button/input/select vẫn cao 44px, năm/tháng rộng khoảng 719px và bộ lọc cao 178px. `.button` và nhóm input/select admin vẫn giữ 44px; các class chiều rộng mới chưa được dùng bởi component TSX; panel bộ lọc vẫn lồng nhau. Đây là cơ sở lập kế hoạch sửa tiếp, không yêu cầu làm lại toàn bộ thiết kế.
