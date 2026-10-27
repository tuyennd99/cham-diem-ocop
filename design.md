<!-- Hallmark · pre-emit critique: Philosophy 5 · Hierarchy 4 · Execution 4 · Specificity 5 · Restraint 5 · Variety 4. Tự rà soát tài liệu; không phải điểm kiểm thử giao diện. -->

# Thiết kế admin — OCOP Đánh Giá

Ngày: 24/10/2026. Trạng thái: **đề xuất để duyệt trước triển khai**.

Cập nhật 25/10/2026: [rà soát kích thước admin](docs/superpowers/specs/2026-10-25-admin-density-review.md). Quy chuẩn mật độ tại mục 4 và 6 dưới đây thay thế đề xuất control tối thiểu 44px áp dụng đồng loạt trước đó; đây là thông số bàn giao, chưa phải xác nhận CSS đã được sửa.

Người dùng đã chọn hướng **“Nghiệp vụ OCOP, gọn và rõ”**. Các quyết định chi tiết dưới đây chưa phải giao diện đã triển khai.

## 1. Phạm vi và nguồn chuẩn

Tài liệu này là nguồn thiết kế chung cho `/admin/**`, các hộp thoại thuộc admin và biến thể `mode='admin'` của trình nhập hồ sơ. Các trang admin dùng cùng nhận diện, thành phần và quy tắc tương tác; không chọn một theme khác cho từng trang.

Không áp dụng thay đổi thị giác sang trang công khai, xác thực, chủ thể hoặc giám khảo. `AppLayout`, các thành phần UI và trình nhập hồ sơ đang dùng chung: khi triển khai phải giữ hành vi của những khu vực đó. Trang in giữ quy cách tài liệu hiện có.

Chi tiết khảo sát, bằng chứng, bản bố trí từng trang và nghiệm thu: [Đánh giá và thiết kế lại admin](docs/superpowers/specs/2026-10-24-admin-ui-ux-redesign-design.md).

## 2. Mục đích sử dụng

Cán bộ cần tìm đúng hồ sơ, biết hồ sơ đang ở bước nào, kiểm tra minh chứng, phân công đủ tiêu chí và đọc đúng kết quả. Quản trị viên thêm nhiệm vụ quản lý người dùng, đơn vị và danh mục. Giao diện ưu tiên các công việc này.

Thứ tự thông tin: **đang ở đâu — đang xem tập dữ liệu nào — trạng thái — việc có thể làm tiếp**.

Genre: modern-minimal, điều chỉnh cho nghiệp vụ hành chính OCOP. Cấu trúc ứng dụng: sidebar cố định trên desktop, thanh ngữ cảnh gọn, tiêu đề trang, bộ lọc, vùng làm việc. Danh sách dùng bảng; chi tiết dùng tab; nhập liệu giữ ba bước. Không dùng cấu trúc landing page cho admin.

Nhận diện riêng đến từ màu xanh OCOP, từ vựng hồ sơ/chủ thể/phân loại/tiêu chí, Mẫu 01 và phạm vi chấm. Không thêm ảnh trang trí, gradient, hiệu ứng xuất hiện khi cuộn hoặc số liệu minh họa vào sản phẩm thật.

## 3. Khảo sát nền tảng đang có

| Hạng mục | Hiện trạng được tái dùng | Nguồn |
| --- | --- | --- |
| Nền tảng | React, Vite, TanStack Router/Query, Tailwind v4 | `apps/web/package.json` |
| Chữ | Be Vietnam Pro, Lora, JetBrains Mono đã được tải | `apps/web/src/styles.css:1`, `apps/web/index.html` |
| Màu | Token OKLCH xanh lá, nền sáng, trắng, vàng và màu nguy hiểm | `apps/web/src/styles.css:41` |
| Thành phần | Button, Input, Select, Tabs, Dialog, Badge, Table, Alert, Skeleton | `apps/web/src/components/ui/` |
| Khung | Sidebar, topbar, main; skip link đã có | `AppLayout.tsx`, `routes/__root.tsx` |
| Chuyển động | CSS và `tw-animate-css`; không có thư viện motion riêng trong web dependencies | `apps/web/package.json` |
| Bố cục | Có thang khoảng cách Tailwind; CSS cũ có nhiều giá trị riêng | `apps/web/src/styles.css` |

Giữ palette và font đang có. Thay đổi vai trò font trong admin, mật độ, thứ bậc và tính nhất quán của control. Không thêm dependency.

## 4. Khung và điều hướng

- Desktop từ 1024px: sidebar rộng 248px, cao ít nhất `100dvh`, tự cuộn khi cần; nội dung không bị sidebar đè. Topbar cao khoảng 56–60px. Nội dung có lề 20–24px.
- Từ 768 đến dưới 1024px: menu thu gọn bằng nút “Điều hướng”; giữ vùng nội dung cho bảng. Không chuyển thành dải chín liên kết phải cuộn ngang.
- Dưới 768px: nút “Điều hướng” mở menu bằng Dialog hiện có; focus được quản lý, chọn trang xong đóng menu. Topbar cho phép tên người dùng rút gọn; thông tin đầy đủ xem trong tài khoản.
- Main và bảng rộng linh hoạt theo vùng làm việc. Giới hạn riêng form nhập hồ sơ tối đa 960px; không cho ô năm, tháng hoặc trường ngắn giãn đều theo toàn bộ chiều rộng màn hình. Không áp giới hạn form lên bảng dữ liệu.
- Tiêu đề và mô tả ở bên trái; một thao tác chính ở bên phải. Dưới 768px thao tác xuống dòng riêng. Không bọc cả trang danh sách trong `.route-panel` rộng 680px.
- Admin không có header/footer công khai. Giữ một thanh công cụ làm việc để định vị và truy cập tài khoản.
- Chỉ một mục điều hướng chính được chọn. “Tổng quan” khớp chính xác `/admin`; mục hồ sơ khớp cả trang chi tiết/tạo/sửa thuộc nhóm đó.

Nhóm menu, giữ các URL hiện có:

| Nhóm hiển thị | Thứ tự |
| --- | --- |
| Làm việc | Tổng quan; Sản phẩm; Phiếu đăng ký |
| Đánh giá | Phân công; Phiếu chấm OCOP; Báo cáo thống kê |
| Quản trị | Nhóm sản phẩm & địa bàn; Người dùng |
| Tài khoản | Tài khoản; Trang công khai; Đăng xuất |

Các nhóm chỉ xuất hiện khi có mục được phép xem. Icon dùng Lucide đã cài, luôn kèm chữ ở menu đầy đủ. Không thêm tìm kiếm toàn hệ thống, thông báo hay menu giả chưa có dữ liệu.

## 5. Màu và token

Giữ tên token hiện có làm nguồn giá trị; các alias admin dưới đây là hợp đồng cho bước triển khai, chưa được thêm vào CSS. Không tạo thêm một tệp palette tách rời.

| Vai trò | Token hiện có / alias đề xuất | Giá trị chuẩn |
| --- | --- | --- |
| Nền ứng dụng | `--bg` | `oklch(0.982 0.006 151)` |
| Bề mặt | `--surface` | `oklch(1 0 0)` |
| Bề mặt phụ | `--surface-soft` | `oklch(0.961 0.011 150)` |
| Chữ chính | `--fg` | `oklch(0.244 0.036 153)` |
| Chữ phụ | `--muted` | `oklch(0.468 0.038 153)` |
| Phân cách | `--border` | `oklch(0.909 0.015 151)` |
| Thao tác chính | `--accent` | `oklch(0.448 0.119 149)` |
| Hover chính | `--accent-hover` | `oklch(0.369 0.097 150)` |
| Nền lựa chọn | `--accent-soft` | `oklch(0.944 0.019 149)` |
| Cảnh báo / mức sao | `--gold-text`, `--gold-soft` | Giá trị hiện có; không dùng vàng sáng cho chữ nhỏ |
| Nguy hiểm | `--danger` | `oklch(0.468 0.138 37)` |
| Sidebar | `--admin-sidebar-bg: var(--fg)`; `--admin-sidebar-fg: var(--surface)` | Xanh đậm, chữ sáng |
| Focus | `--admin-focus: var(--gold-text)` | Outline rõ; phải đo trên nền thực tế |

Màu chính dùng cho CTA và mục đang chọn. Vàng dành cho cảnh báo và kết quả sao. Trạng thái luôn có chữ, không chỉ chấm màu. Sidebar là vùng nhận diện; nội dung giữ nền sáng, không phủ xanh các panel.

Không tuyên bố palette đã đạt WCAG cho mọi tổ hợp. Khi triển khai phải đo cả chữ nhỏ, focus, selected, disabled và thông báo trên nền thực tế.

## 6. Chữ, khoảng cách và mật độ

| Vai trò | Quy tắc |
| --- | --- |
| Tên hệ thống | Lora 700, 20px, chữ đứng |
| H1 admin | Be Vietnam Pro 600/700; 28px desktop, 24px mobile; line-height 1.3 |
| H2 | Be Vietnam Pro 600, 20px; line-height 1.4 |
| Nội dung / form | Be Vietnam Pro 400/500, 14px trên desktop; 16px cho trường nhập trên màn hình nhỏ; line-height 1.4–1.5 |
| Bảng / menu / nút | Be Vietnam Pro 400–600, 14px; chữ phụ tối thiểu 12px |
| Điểm / số lượng | Font body với `tabular-nums`; căn phải khi là cột số |
| Mã kỹ thuật | JetBrains Mono, dùng hạn chế trong vùng chi tiết hoặc khi cần sao chép |

Không dùng Lora cỡ 48–52px cho H1 nghiệp vụ, không dùng mono cho toàn bộ chỉ tiêu, không thêm nhãn “PHÂN HỆ” và tên trường API trên đầu mỗi trang. Tiêu đề, tab và nút dùng sentence case tiếng Việt.

Khoảng cách thống nhất theo đơn vị 4px: 4, 8, 12, 16, 24, 32, 48. Token `--admin-space-*` chỉ cần tạo cho những giá trị được dùng; Tailwind dùng cùng thang. Khoảng cách giữa tiêu đề và bộ lọc 16px, giữa các khối 16px; dùng 24px khi chuyển vùng nội dung lớn. Label và input cách 4px, hàng form cách 12–16px, các nút cách 8px. Panel có một lớp padding 12–16px, không lồng thêm panel bộ lọc bên trong.

Desktop dùng chuột: button, input một dòng và select cao 36px; nút phụ trong bảng 32px, icon 32×32px. Giữ chữ 14px, không thu chữ để bù kích thước. Textarea tối thiểu 80–96px và tự cuộn/mở rộng theo nội dung; không ép chung chiều cao với input. Trên màn hình nhỏ hoặc con trỏ thô, vùng bấm tối thiểu 44px. Input/nút bo 8px theo `--radius`; panel dữ liệu bo 8px; badge có thể dạng pill. Panel chỉ cần viền mảnh, không đổ bóng lặp lại. Dialog dùng shadow hiện có.

Chiều cao input một dòng phải ổn định kể cả khi cột cạnh có lỗi hoặc chú thích dài: grid căn đầu hàng, label không phân phối khoảng trống vào các hàng con. Chiều rộng bộ lọc theo nội dung: năm 112px, tháng 144px, trạng thái 176px, nhóm 240–280px, tìm kiếm 280–360px; cho phép xuống dòng khi không đủ chỗ. Nút vừa nội dung, không chia đều cả hàng trừ hành động chính trên mobile.

## 7. Mẫu thành phần dùng chung

### Bộ lọc

Tái dùng control hiện có. Mỗi trường có label được liên kết; placeholder chỉ gợi ý. Hàng đầu chứa từ khóa, tối đa hai bộ lọc thường dùng và nút “Áp dụng”. Hàng nâng cao đóng/mở có `aria-expanded`, `aria-controls`; số bộ lọc đang áp dụng và bản tóm tắt vẫn thấy khi đóng.

Nhập chữ/ngày/số chưa gọi truy vấn cho tới “Áp dụng” hoặc Enter. Đổi trang giữ tập bộ lọc đã áp dụng. “Xóa bộ lọc” đưa về mặc định của trang, trang 1. Bộ lọc, tab và trang được phản ánh vào URL để quay lại danh sách đúng ngữ cảnh. Chỉ đồng bộ các giá trị query hiện có, không thêm lớp lưu trữ.

Nhóm sản phẩm thay đổi thì xóa phân loại con không còn phù hợp; loại địa bàn thay đổi thì xóa địa bàn không còn phù hợp. Không cho giao diện giữ một lựa chọn ngầm không có trong tập hiển thị.

### Bảng và danh sách

Giữ HTML table, `scope`, caption hoặc tên vùng. Cột định danh ở trái, số ở phải, thao tác cuối. Tên dài xuống dòng; ID dài không quyết định chiều rộng trang. Một lớp panel chứa bảng và chân phân trang, không card lồng card.

Trên màn hình nhỏ, bảng cần quan hệ hàng/cột được cuộn trong vùng có nhãn, focus được bằng bàn phím và có gợi ý cuộn. Toàn trang không tràn ngang. Không giấu thông tin hoặc thao tác quan trọng để làm vừa ảnh chụp. Danh sách đơn giản có thể đổi thành các hàng dọc khi vẫn giữ nhãn trường.

### Form và dialog

Giữ Dialog/Tabs của Radix. Form dài giới hạn chiều cao theo viewport và cuộn bên trong; title và nút đóng luôn tiếp cận được. UserEditorDialog đã có giới hạn chiều cao; áp dụng cùng nguyên tắc cho CategoryEditorDialog.

Tách sửa hồ sơ, quyền/đơn vị, trạng thái và mật khẩu thành các vùng rõ ràng, mỗi vùng dùng đúng lệnh lưu hiện có. Không gom thành một payload “Lưu tất cả”. Lý do thao tác bắt buộc ở các nơi API yêu cầu.

Form có thay đổi chưa lưu cần cảnh báo trước rời trang/đóng bằng cơ chế sẵn có của router; không thêm autosave. Lỗi giữ nguyên dữ liệu đã nhập, tập trung lỗi vào trường hoặc vùng hành động liên quan.

### Hành động và trạng thái

| Trạng thái | Hiển thị / hành vi |
| --- | --- |
| Mặc định | Nút ghi động từ và đối tượng: “Lưu quyền”, “Nộp hồ sơ”, “In mẫu trắng” |
| Hover / active | Đổi nền/viền vừa đủ, không nhảy kích thước |
| Focus | Outline rõ, không dùng `outline: none` đơn lẻ |
| Disabled | Không thao tác được; có lý do gần control khi người dùng cần biết |
| Đang tải | Giữ bố cục bằng Skeleton hiện có, vùng dữ liệu có `aria-busy` |
| Đang lưu | Khóa gửi lặp, giữ nhãn theo tác vụ: “Đang lưu…” |
| Lỗi | Nêu tác vụ thất bại và bước tiếp theo, có “Thử lại” khi thích hợp |
| Thành công | Phản hồi ngay cạnh vùng thay đổi, `role='status'`; không toast trùng lặp |

Không có bản ghi, không có kết quả lọc, không đủ quyền và lỗi tải là bốn trường hợp khác nhau. Không biến lỗi truy vấn thành “0 hồ sơ”.

## 8. Từ vựng và giới hạn nghiệp vụ

| Giá trị dữ liệu | Nhãn admin |
| --- | --- |
| `DRAFT` | Bản nháp |
| `SUBMITTED` | Đã nộp |
| `SCORING` | Đang chấm |
| `COMPLETED` | Hoàn tất |
| `VIEW` | Xem dữ liệu |
| `MANAGE` | Quản lý |
| `SCORE` | Chấm điểm |

Giữ mã quyền trong phần giải thích khi cần. `MANAGE` bao hàm `VIEW`, không tự bao hàm `SCORE`. Không đổi quyền bằng thay đổi menu. Trạng thái phiếu chấm phân biệt với trạng thái hồ sơ sản phẩm.

“Nhóm lớn” và “Phân loại sản phẩm” là hai cấp khác nhau. Phân công theo phân loại hiện có, không đổi sang nhóm lớn vì rút gọn giao diện.

Sao tính từ điểm hệ thống không tự đồng nghĩa quyết định công nhận chính thức. Dùng “Mức sao theo điểm” tại các nơi dữ liệu chỉ có điểm/sao; giữ chú thích trong báo cáo và bản in. Đây là cách diễn đạt theo hợp đồng hiện có, không phải kết luận pháp lý mới.

Không thêm trạng thái duyệt, từ chối, yêu cầu bổ sung, hạn xử lý hoặc thông báo chưa có trong hợp đồng. Không tạo số hồ sơ dễ đọc giả để thay ID hiện có.

## 9. Responsive, khả năng tiếp cận và motion

Nghiệm thu ở 320, 375, 414, 768, 1024 và 1440px; thêm màn hình rộng đang dùng. Tại 320px vẫn đọc và thao tác được, không cắt nội dung bằng `overflow-x: hidden`. Sửa grid/flex và min-width gốc; chỉ dùng `overflow-x: clip` trên vùng admin ngoài cùng sau khi đã kiểm tra không mất nội dung.

Chữ thường tối thiểu 4.5:1, chữ lớn 3:1 theo [WCAG Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Trang reflow ở 320 CSS px; bảng hai chiều được cuộn cục bộ theo [WCAG Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). Dialog giữ focus bên trong, Escape đóng và trả focus về nơi mở theo [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Giữ skip link. Icon trang trí `aria-hidden`; nút icon có tên. Dùng Tabs hiện có cho tab nội dung; bộ lọc trạng thái có thể là nhóm nút `aria-pressed` thay vì giả tab không có panel.

Chuyển động chỉ phục vụ phản hồi: màu/viền 120–150ms, mở panel/dialog tối đa 180ms. Không animate vị trí hàng bảng. Tôn trọng `prefers-reduced-motion`; không thêm reveal, counter hoặc thư viện animation.

## 10. Nguyên tắc bàn giao và kiểm tra

Khi được duyệt, triển khai khung và control dùng chung trước, rồi danh sách hồ sơ làm trang mẫu; tiếp theo các trang còn lại. Chỉ tách một thành phần chung khi ít nhất hai trang thật sự cần cùng hành vi.

Không viết lại route tree, API, query key, quyền, snapshot hay luồng upload để phục vụ hình thức. Mọi thay đổi cần backend được ghi riêng, không âm thầm đưa vào bản thiết kế giao diện.

Đối chiếu React và mẫu thiết kế bằng cùng viewport, cùng quyền, cùng trạng thái dữ liệu. Số liệu và ảnh trong mẫu Open Design là nội dung minh họa; không dùng làm dữ liệu thật hoặc tiêu chí khớp số lượng.

Hoàn tất chỉ khi đạt checklist trong đặc tả. Tài liệu hiện tại chưa chứng minh giao diện mới đã responsive, đạt WCAG hay qua kiểm thử người dùng.
