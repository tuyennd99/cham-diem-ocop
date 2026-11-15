# Đặc tả & Prompt Open Design: Thiết kế lại các giao diện Trang chủ OCOP

Ngày lập: 09/11/2026
Phạm vi:
- **Trang chủ Quản trị (Tổng quan OCOP)**: `/admin` (`apps/web/src/pages/admin/AdminDashboardPage.tsx`)
- **Trang chủ Công khai**: `/` (`apps/web/src/pages/public/HomePage.tsx`)
- **Trang chủ Giám khảo (Hàng chờ chấm)**: `/judge` (`apps/web/src/pages/judge/JudgeQueuePage.tsx`)
- **Trang chủ Chủ thể (Hồ sơ của tôi)**: `/my/products` (`apps/web/src/pages/registrant/MyProductsPage.tsx` → `AdminProductsPage.tsx`)

Tài liệu này dùng để đưa trực tiếp vào **Open Design** để thiết kế lại các giao diện trang chủ dựa trên kết quả kiểm toán (`impeccable audit`, `hallmark audit`, `frontend-design`) và tuân thủ hệ thống thiết kế đã khóa tại `DESIGN.md`.

---

## Phần 1. Bối cảnh hệ thống & Ràng buộc bắt buộc cho Open Design

Khi đưa vào Open Design, giữ nguyên các nguyên tắc cốt lõi sau:

1. **Ngôn ngữ & Nghiệp vụ**:
   - Toàn bộ nhãn, thông báo, trạng thái dùng **tiếng Việt** đúng thuật ngữ OCOP.
   - Tuyệt đối không tạo số liệu giả (`+47%`, `10.000+ hồ sơ`...) như dữ liệu thật của sản phẩm. Mọi số liệu trong bản vẽ phải khớp với cấu trúc dữ liệu API thật của hệ thống.
   - Giữ rõ chú thích pháp lý: *"Mức sao theo điểm (chưa đồng nghĩa quyết định công nhận OCOP chính thức)"*.
   - Ngưỡng sao OCOP theo Quyết định 26/2026/QĐ-TTg (thang 100 điểm): **5 sao** (90–100), **4 sao** (70–89), **3 sao** (50–69), **2 sao** (30–49), **1 sao** (dưới 30 điểm).

2. **Hệ thống Token Màu sắc (OKLCH) & Chữ (`DESIGN.md`)**:
   - **Font chữ**:
     - Tên hệ thống / Tiêu đề trưng bày trang công khai: `Lora` (700, chữ đứng, không in nghiêng).
     - Toàn bộ H1, H2, H3, bảng, form, nút, số liệu KPI trong khu vực làm việc (`/admin`, `/judge`, `/my/products`): `Be Vietnam Pro` (400/500/600/700). **Không dùng `JetBrains Mono` cho số liệu KPI lớn**; dùng `Be Vietnam Pro` kèm `font-variant-numeric: tabular-nums`.
     - Mã kỹ thuật / ID hồ sơ: `JetBrains Mono` (12px).
   - **Bảng màu gốc**:
     - Nền ứng dụng (`--bg`): `oklch(0.982 0.006 151)`
     - Bề mặt (`--surface`): `oklch(0.996 0.002 151)` (ấm nhẹ sắc xanh, tránh `#ffffff` phẳng tuyệt đối)
     - Bề mặt phụ (`--surface-soft`): `oklch(0.961 0.011 150)`
     - Chữ chính (`--fg`): `oklch(0.244 0.036 153)`
     - Chữ phụ (`--muted`): `oklch(0.468 0.038 153)`
     - Viền (`--border`): `oklch(0.909 0.015 151)`
     - Màu nhấn chính (`--accent`): `oklch(0.448 0.119 149)` · Nền nhấn nhạt (`--accent-soft`): `oklch(0.944 0.019 149)`
     - Màu sao / cảnh báo (`--gold-text`): `oklch(0.476 0.103 61)` · Nền vàng nhạt (`--gold-soft`): `oklch(0.974 0.035 84)`
     - Màu nguy hiểm (`--danger`): `oklch(0.468 0.138 37)`
     - Sidebar khu vực làm việc: nền xanh đậm `var(--fg)`, chữ sáng `var(--surface)`.
   - **6 Trạng thái hồ sơ sản phẩm (`ProductStatus`) — Phải tách biệt sắc độ rõ ràng**:
     - `DRAFT` (Bản nháp): Xám trung tính (Slate).
     - `SUBMITTED` (Chờ duyệt / Đã tiếp nhận): Xanh dương hành chính (Cobalt Blue).
     - `RETURNED` (Đã trả lại / Bị trả lại): Cam hổ phách đậm / Đỏ gạch nhạt (Cảnh báo cần sửa — **không dùng chung màu xám của Bản nháp**).
     - `APPROVED` (Đã duyệt): Xanh ngọc lam (Teal / Cyan — **không dùng chung màu của Chờ duyệt**).
     - `SCORING` (Đang chấm / Đang đánh giá): Vàng nâu ấm (`--gold-text` / `--gold-soft`).
     - `COMPLETED` (Hoàn tất / Đã xếp hạng): Xanh lá OCOP (`--accent` / `--accent-soft`).

3. **Các lỗi thị giác (Anti-patterns) cần loại bỏ hoàn toàn**:
   - **Bỏ viền lệch 1 cạnh trên thẻ bo góc** (`border-left: 3px/4px solid` trên `.dashboard-stat-*`, `.form-alert` và `border-top: 3px solid` trên `.hero-aside`, `.step-item`). Thay bằng viền mảnh `1px solid var(--border)` kết hợp chấm tròn trạng thái 6px hoặc nền nhấn nhẹ.
   - **Bỏ các dòng `.eyebrow` chữ in hoa monospace lặp lại ở đầu mỗi section** trên trang công khai và **bỏ ký tự mũi tên cứng `→`** ở cuối các liên kết.
   - **Bỏ lồng thẻ trong thẻ** (Card-in-card) và tránh biến các vùng phân tích thành những bảng chữ khô khan không có thanh tỷ lệ trực quan.

---

## Phần 2. Tóm tắt các vấn đề cần giải quyết trong bản thiết kế mới

### 2.1. Trang chủ Admin (`/admin` — `AdminDashboardPage.tsx`)
1. **Thứ tự ưu tiên thông tin bị dàn trải**: Hiện tại người dùng phải cuộn qua Header → Bộ lọc → Card "Kỳ đang xem" → Cảnh báo chất lượng dữ liệu → 4 thẻ KPI vận hành → mới tới *Hồ sơ cần xử lý tiếp* và *Tiến độ giám khảo*.
2. **4 vùng phân tích (`data.charts`) thiếu trực quan hóa**:
   - *Xu hướng đăng ký và hoàn tất theo tháng (12 tháng)* đang hiển thị dạng bảng chữ đơn thuần, khó nhận biết tháng cao điểm.
   - *Hồ sơ theo danh mục sản phẩm* đang tái sử dụng `.record-row` của danh sách sản phẩm và chỉ hiện con số trần, thiếu thanh tỷ lệ so sánh giữa các danh mục.
   - *Tiến độ của hồ sơ đăng ký trong kỳ (Cohort progress)* đang dùng `<dl>` 2 cột rời rạc thay vì một thanh tiến trình tổng hợp (Chờ chấm → Đang chấm → Hoàn tất).
   - *Cơ cấu mức sao theo điểm (1–5 sao)* là bảng 3 cột, thiếu thanh phần trăm trực quan cho từng mức sao.
3. **Lưới "Tổng số hồ sơ hiện tại theo trạng thái" bị lẻ nhịp 4+2**: Có 6 trạng thái nhưng chia 4 cột (`repeat(4, 1fr)`), làm 2 trạng thái cuối bị rớt dòng lẻ loi và chưa bấm vào để lọc danh sách hồ sơ được.
4. **Bộ lọc chưa đồng bộ với trang Sản phẩm**: Thiếu huy hiệu đếm số bộ lọc đang áp dụng (`admin-filter-count`) trên nút *"Bộ lọc khác"* và thiếu dải chip *"Đang lọc: ..."* khi đóng vùng lọc nâng cao.

### 2.2. Trang chủ Công khai (`/` — `HomePage.tsx`)
1. **Dấu hiệu giao diện mẫu (Template Chrome)**: 5/5 khối trên trang đều mở đầu bằng `.eyebrow` in hoa monospace màu xanh và kết thúc bằng link có dấu `→`.
2. **Hero section chưa tôn vinh sản phẩm và quy chuẩn OCOP**: Khối bên phải Hero (`.hero-aside`) chỉ là một hộp chữ giới thiệu tài khoản đơn điệu với viền đầu 3px.
3. **Section Quy trình (3 bước) và Section Tiêu chí (5 mức sao) bị tách rời**: Cả hai đều là thông tin hướng dẫn cốt lõi nhưng đang tách làm 2 section riêng với kiểu lưới 3 cột mẫu (`01`, `02`, `03`).

### 2.3. Trang chủ Giám khảo (`/judge`) & Trang chủ Chủ thể (`/my/products`)
1. **Mất mô tả trang (`description`)**: Do `PageHeader` trong `PageLayout.tsx` đang ẩn prop `description`, người dùng vào trang chỉ thấy tiêu đề cụt ngủn.
2. **Thiếu thanh tóm tắt nhanh đầu trang**:
   - Giám khảo vào `/judge` cần thấy ngay số lượng *Phiếu đang mở (cần chấm)* so với *Phiếu đã nộp* trước khi lọc bảng.
   - Chủ thể vào `/my/products` cần thấy rõ trạng thái hồ sơ của mình (nhặc biệt khi có hồ sơ *Bị trả lại* cần chỉnh sửa nộp lại).

---

## Phần 3. Các Prompt dùng trực tiếp cho Open Design

Bạn có thể sao chép từng prompt dưới đây đưa vào **Open Design** để sinh thiết kế cho từng màn hình.

---

### Prompt 1 — Thiết kế lại Trang chủ Quản trị (Tổng quan OCOP `/admin`)

```markdown
Thiết kế lại màn hình Tổng quan OCOP (`/admin`) cho cán bộ quản lý và xem dữ liệu trong hệ thống "OCOP Đánh Giá".

### 1. Bối cảnh & Mục tiêu sử dụng
Cán bộ vào `/admin` hằng ngày để nắm bắt ngay:
1. Đang xem kỳ báo cáo nào và số liệu chốt lúc nào.
2. Có bao nhiêu hồ sơ đang tồn đọng / thiếu phân công tiêu chí cần xử lý ngay.
3. Tiến độ chấm của từng giám khảo đến đâu.
4. Xu hướng đăng ký – hoàn tất, cơ cấu danh mục và phân bố sao trong kỳ biến động ra sao so với kỳ trước.

### 2. Khung bố cục & Mật độ (Operate Mode — Modern-Minimal)
- Desktop (1440px): Sidebar trái cố định rộng 248px (nền xanh đậm `oklch(0.244 0.036 153)`, chữ sáng), có thể thu gọn còn 72px. Topbar cao 56px hiển thị tên cán bộ, email, link "Trang công khai" và nút "Đăng xuất". Vùng nội dung chính lề 24px, nền sáng `oklch(0.982 0.006 151)`.
- Kích thước control chuẩn desktop: Input, Combobox, Button cao 36px (mobile cao 44px), chữ `Be Vietnam Pro` 14px, bo góc 8px, panel viền mảnh `1px solid oklch(0.909 0.015 151)`, không đổ bóng dày, không dùng viền lệch 3px ở cạnh trái/trên của thẻ.
- Tiêu đề H1: "Tổng quan OCOP" (28px desktop / 24px mobile, bold) kèm dòng mô tả ngắn bên dưới. Góc phải Header có 2 nút phụ: "Báo cáo thống kê" và "Tải lại".

### 3. Cấu trúc 5 tầng thông tin từ trên xuống dưới

**Tầng 1 — Thanh Bộ lọc Kỳ báo cáo & Ngữ cảnh mốc chốt (Gọn trong 1 Panel)**:
- Hàng chính: Ô "Năm báo cáo" (112px), Combobox "Tháng" (144px, mặc định "Cả năm"), nút chính "Áp dụng", nút phụ "Bộ lọc khác" (kèm badge đếm số bộ lọc nâng cao đang bật) và nút "Xóa bộ lọc" (khi có lọc).
- Hàng nâng cao (đóng/mở): Danh mục sản phẩm, Tỉnh/Thành phố, Địa bàn hành chính (xã/phường), Loại đăng ký (Lần đầu / Nâng hạng / Đánh giá lại), Năm đánh giá hồ sơ.
- Khi đóng vùng nâng cao mà có điều kiện lọc, hiển thị dải chip "Đang lọc: ..." ngay dưới hàng nút.
- Tích hợp dòng trạng thái kỳ báo cáo vào chân panel lọc (không tách thành một Card rời): *"Kỳ đang xem: Năm 2026 · Mốc chốt số liệu: 09/11/2026 08:30 · Kỳ hiện tại chưa kết thúc (so sánh cùng khoảng thời gian kỳ trước)"*.
- Nếu có cảnh báo chất lượng dữ liệu (`unmappedLocalityCount`, `missingCompletedAtCount`, `missingStatusHistoryCount`), hiển thị một banner cảnh báo nền vàng nhạt (`--gold-soft`) gọn ngay dưới bộ lọc.

**Tầng 2 — 4 Thẻ Chỉ tiêu Vận hành ưu tiên (`operationalKpis`) + Dải 6 Trạng thái hồ sơ hiện tại**:
- 4 thẻ KPI vận hành trên 1 hàng (`repeat(4, 1fr)`):
  1. Hồ sơ đăng ký trong kỳ
  2. Hồ sơ hoàn tất trong kỳ
  3. Hồ sơ tồn đọng đang mở tại mốc chốt
  4. Hồ sơ chưa phân công đủ tiêu chí tại mốc chốt
  - Mỗi thẻ gồm: Tên chỉ tiêu (13px muted), Giá trị số lớn (`Be Vietnam Pro` 28–32px bold, `tabular-nums`, không dùng font monospace), Căn cứ tính (`basisLabel`), Chênh lệch so với kỳ trước (badge hoặc dòng chữ màu ngữ nghĩa), và link drill-down ("Xem hồ sơ đăng ký trong kỳ"...) ở đáy thẻ.
- Ngay bên dưới hoặc gắn kết thành dải trạng thái toàn hệ thống ("Tổng số hồ sơ hiện tại theo 6 trạng thái"):
  - Chia lưới 6 ô cân đối trên desktop (`repeat(6, 1fr)`), 3×2 trên tablet, 2×3 trên mobile.
  - 6 trạng thái với sắc độ riêng biệt: `Bản nháp` (Xám), `Chờ duyệt` (Xanh dương), `Đã trả lại` (Cam cảnh báo), `Đã duyệt` (Xanh ngọc), `Đang chấm` (Vàng nâu), `Hoàn tất` (Xanh lá OCOP). Mỗi ô là một thẻ bấm được để lọc trực tiếp sang `/admin/products?status=...`.

**Tầng 3 — Bàn làm việc Điều phối (Lưới 2 cột cân xứng 50/50)**:
- **Cột trái — Card "Hồ sơ cần xử lý tiếp" (`needsAttention`)**:
  - Header: Tiêu đề + mô tả "Hồ sơ đang chờ hoặc đang chấm, sắp theo ngày nộp lâu nhất" + link "Mở hồ sơ chờ duyệt".
  - Danh sách từng hồ sơ: Tên sản phẩm (bold), Badge Danh mục + Badge Trạng thái, cảnh báo cụ thể bằng màu ngữ nghĩa ("Thiếu phân công phủ tiêu chí" hoặc "X phiếu chưa hoàn tất"), số phiếu đã nộp `submitted / assigned` và nút phụ "Mở hồ sơ".
- **Cột phải — Card "Tiến độ giám khảo" (`judges`)**:
  - Bảng dữ liệu gọn: Cột `Giám khảo` (row header), `Đã nộp` (`submitted / assigned`, căn phải, `tabular-nums`), `Chưa hoàn tất` (căn phải), và cột `Tiến độ` (thanh progress bar ngang + số `%` nằm trên cùng một hàng gọn gàng).

**Tầng 4 — Khu vực Phân tích kết quả trong kỳ (`analyticalKpis` + `4 vùng phân tích`)**:
- Hàng 4 thẻ KPI chất lượng (`analyticalKpis`: Hồ sơ đạt từ 3 sao, Hồ sơ không đạt, Tỷ lệ đạt, Hồ sơ đạt mức 5 sao).
- Lưới 2×2 cho **4 vùng phân tích** (kết hợp số liệu bảng + thanh tỷ lệ trực quan bằng CSS thuần, giữ nguyên các link bấm sang `/admin/products`):
  1. **Xu hướng đăng ký và hoàn tất theo tháng (Tháng 1 – Tháng 12)**: Bảng 12 tháng có kèm thanh bar ngang đôi (Đăng ký mới vs Hoàn tất chấm) trong mỗi dòng để nhìn ngay tháng cao điểm, số lượng vẫn là link drill-down.
  2. **Hồ sơ theo danh mục sản phẩm**: Có nút chuyển chế độ "Theo số đăng ký" / "Theo số hoàn tất". Mỗi danh mục hiển thị tên danh mục (link), thanh bar tỷ lệ ngang và số lượng hồ sơ (`tabular-nums`).
  3. **Tiến độ của hồ sơ đăng ký trong kỳ (Cohort Progress)**: Hiển thị tổng số đăng ký trong kỳ kèm một **thanh tiến trình phân đoạn (Stacked Bar)** chia tỷ lệ trực quan cho: *Đã nộp chờ chấm* → *Đang chấm* → *Hoàn tất* (và *Thiếu lịch sử trạng thái* nếu có), bên dưới là các ô số liệu đối chiếu.
  4. **Cơ cấu mức sao theo điểm (1–5 sao)**: Bảng 5 mức sao từ 5 sao xuống 1 sao, có cột thanh tỷ trọng `%` trực quan, số lượng hồ sơ (link drill-down) và chú thích pháp lý rõ ràng.

**Tầng 5 — Bảng đối chiếu chỉ tiêu với kỳ trước (`comparisonTable`)**:
- Bảng 5 cột: `Chỉ tiêu KPI`, `Căn cứ`, `Kỳ này` (bold, căn phải), `Kỳ trước` (căn phải), `Chênh lệch` (hiển thị mức tăng/giảm tuyệt đối và `%`), kèm link "Xem báo cáo chi tiết" dẫn sang `/admin/reports`.

### 4. Các trạng thái cần cung cấp trong bản thiết kế
- Desktop (1440px), Tablet (768px) và Mobile (375px — menu mở qua Dialog, bảng cuộn ngang cục bộ có gợi ý).
- Trạng thái Loading (Skeleton khớp bố cục), Empty state (khi kỳ chưa có hồ sơ hoặc chưa có giám khảo) và Error state (có nút "Thử lại").
```

---

### Prompt 2 — Thiết kế lại Trang chủ Công khai (`/` — `HomePage.tsx`)

```markdown
Thiết kế lại Trang chủ Công khai (`/`) của hệ thống "OCOP Đánh Giá" — cổng tra cứu sản phẩm OCOP và đăng ký hồ sơ trực tuyến.

### 1. Mục tiêu & Tinh thần thiết kế (Persuade + Read Mode — Editorial Civic)
- Tạo bản sắc riêng cho chương trình OCOP Việt Nam: trang trọng, minh bạch, gắn với nông sản và sản phẩm địa phương nhưng hiện đại, dễ tra cứu.
- Loại bỏ hoàn toàn các dấu hiệu giao diện mẫu AI:
  - Không dùng dòng `.eyebrow` chữ in hoa monospace ở đầu mọi section.
  - Không dùng viền dày 3px trên đỉnh thẻ bo góc (`border-top: 3px solid`).
  - Không thêm mũi tên `→` vào cuối các liên kết.
- Kết hợp hài hòa font trưng bày `Lora` (chữ đứng, 700) cho tiêu đề lớn và `Be Vietnam Pro` cho nội dung, số liệu.

### 2. Cấu trúc các khu vực trên trang

**1. Header công khai (`SiteHeader`)**:
- Trái: Biểu trưng ngôi sao OCOP + tên "OCOP Đánh Giá" và dòng phụ "Hệ thống đăng ký, chấm điểm và xếp hạng sản phẩm OCOP".
- Giữa: Điều hướng "Trang chủ", "Tra cứu", "Quy trình & Tiêu chí".
- Phải: Khi chưa đăng nhập hiện nút "Đăng nhập" và CTA "Tạo tài khoản"; khi đã đăng nhập hiện tên người dùng và menu tài khoản.

**2. Hero Section (Cổng vào 2 vai trò: Người tra cứu & Chủ thể đăng ký)**:
- Bố cục bất đối xứng (7 cột trái / 5 cột phải trên desktop):
  - **Cột trái**: Tiêu đề `Lora` lớn: *"Tra cứu và theo dõi hồ sơ sản phẩm OCOP"*, đoạn dẫn ngắn gọn, cùng thanh công cụ hành động kép: nút chính dẫn tới Khu vực làm việc / Đăng ký tài khoản và nút phụ "Tra cứu toàn bộ sản phẩm".
  - **Cột phải (Thẻ Hồ sơ Chủ thể)**: Thiết kế như một phiếu tóm tắt quy trình Mẫu 01 thực tế (thay vì hộp chữ chung chung): liệt kê rõ 3 trạng thái chủ thể được theo dõi trực tuyến (*Lưu nháp & minh chứng* → *Nộp hội đồng đánh giá* → *Nhận kết quả tổng hợp*) và nút mở khu vực hồ sơ.

**3. Khu vực Sản phẩm Công khai Nổi bật (`#public-products`)**:
- Header khu vực: Tiêu đề "Sản phẩm công khai" bên trái; bộ lọc Combobox "Danh mục sản phẩm" (280px) bên phải.
- Lưới 6 sản phẩm (3 cột trên desktop, 2 cột trên tablet, 1 cột trên mobile):
  - Khung ảnh tỷ lệ `4:3` nền `--surface-soft` (nếu chưa có ảnh hiện nhãn lịch sự "Chưa có ảnh công khai").
  - Hàng badge: Badge Danh mục sản phẩm + Badge Trạng thái công khai (`Đã tiếp nhận`, `Đã duyệt`, `Đang đánh giá`, `Đã xếp hạng`) có chấm màu ngữ nghĩa.
  - Tên sản phẩm (`Lora` 18px bold, tối đa 2 dòng) + mô tả ngắn (tối đa 2 dòng).
  - Chân thẻ: Nếu đã công bố kết quả thì hiển thị nổi bật **`XX.X điểm · X sao`** (`tabular-nums`, màu vàng sao `--gold-text`); nếu đang xử lý thì hiển thị trạng thái. Bên phải là liên kết "Xem chi tiết".
- Đầy đủ 4 trạng thái dữ liệu: Đang tải (6 skeleton card), Lỗi kết nối máy chủ (state panel màu cảnh báo có nút "Thử lại"), Danh mục đang chọn chưa có sản phẩm (nút "Xem tất cả danh mục"), và Hệ thống chưa có sản phẩm công khai.

**4. Khu vực Quy trình & Thang điểm OCOP hợp nhất (`#workflow` & `#criteria`)**:
- Thay vì tách thành 2 section rời rạc với 3 hộp chữ mẫu, thiết kế thành một **Bản đồ Quy trình & Thang phân hạng OCOP theo Quyết định 26/2026/QĐ-TTg**:
  - Phần trên: Luồng 3 bước liên hoàn (*01. Gửi hồ sơ & minh chứng Mẫu 01* → *02. Hội đồng chấm điểm theo bộ tiêu chí ngành hàng* → *03. Tổng hợp điểm & xếp hạng*).
  - Phần dưới: Dải 5 bậc sao trên thang 100 điểm (**5 sao**: 90–100 điểm · **4 sao**: 70–89 điểm · **3 sao**: 50–69 điểm · **2 sao**: 30–49 điểm · **1 sao**: Dưới 30 điểm) trình bày dạng thước đo phân tầng trực quan, kèm chú thích bộ tiêu chí áp dụng theo từng nhóm sản phẩm.

**5. Footer công khai (`SiteFooter`)**:
- Nền xanh rừng đậm, bố cục 3 cột gọn gàng: Thông tin hệ thống, Điều hướng nhanh, và Căn cứ pháp lý (liên kết Quyết định 26/2026/QĐ-TTg).
```

---

### Prompt 3 — Thiết kế lại Trang chủ Giám khảo (`/judge`) & Trang chủ Chủ thể (`/my/products`)

```markdown
Thiết kế chuẩn hóa hai giao diện trang chủ tác vụ trong khu vực làm việc (`AppLayout`):
1. **Trang chủ Giám khảo — Hàng chờ chấm (`/judge`)**
2. **Trang chủ Chủ thể — Hồ sơ của tôi (`/my/products`)**

### 1. Quy tắc khung chung (`PageContainer` & `PageHeader`)
- Dùng chung khung Sidebar + Topbar của khu vực làm việc (`[data-admin-ui='true']`).
- **Khôi phục dòng mô tả trang (`description`)** ngay dưới tiêu đề H1 trong `PageHeader`:
  - Tại `/judge`: H1 *"Hàng chờ chấm"* — Mô tả: *"Danh sách hồ sơ sản phẩm được phân công chấm điểm cho hội đồng."*
  - Tại `/my/products`: H1 *"Hồ sơ của tôi"* — Mô tả: *"Theo dõi hồ sơ sản phẩm, tiến độ chấm điểm và mức sao đạt được."*

### 2. Màn hình 1: Hàng chờ chấm của Giám khảo (`/judge`)
- **Dải lọc trạng thái nhanh + Bộ lọc tìm kiếm**:
  - Cho phép lọc nhanh theo trạng thái phiếu chấm: *Tất cả* · *Phiếu chấm đang mở* · *Đã nộp phiếu* · *Đã gỡ khỏi hồ sơ*.
  - Hàng lọc chi tiết: Ô tìm kiếm tên sản phẩm hoặc mã hồ sơ (320px), Combobox Danh mục sản phẩm (260px), Combobox Trạng thái phiếu chấm (176px), nút "Áp dụng" và "Xóa bộ lọc".
- **Bảng hàng chờ chấm (`DataTable`)**:
  - Các cột:
    1. `Hồ sơ sản phẩm` (`scope="row"`): Tên sản phẩm (bold), mã hồ sơ (`JetBrains Mono` 12px muted), mô tả rút gọn 1–2 dòng.
    2. `Danh mục sản phẩm`: Badge phụ.
    3. `Trạng thái hồ sơ`: Badge có chấm màu ngữ nghĩa.
    4. `Trạng thái phiếu chấm`: Pill trạng thái có icon (`Phiếu chấm đang mở` màu vàng ấm nổi bật để nhắc việc; `Đã nộp phiếu` màu xanh lá; `Đã gỡ khỏi hồ sơ (chỉ xem)` màu xám).
    5. `Điểm phiếu`: Căn phải, `tabular-nums` (`XX.X điểm` hoặc `—`).
    6. `Đính kèm`: Pill hiển thị icon kẹp giấy + số tệp minh chứng.
    7. `Thao tác`: Nút chính **"Chấm điểm"** (nền xanh `--accent`) cho phiếu đang mở; nút phụ **"Xem phiếu đã nộp"** hoặc **"Xem phiếu lịch sử"** cho phiếu chỉ đọc.
  - Chân bảng phân trang có đầy đủ nhãn trợ năng (`aria-label="Trang trước"`, `"Trang sau"`, chọn số dòng mỗi trang).

### 3. Màn hình 2: Hồ sơ của tôi cho Chủ thể (`/my/products`)
- **Header**: Nút CTA chính góc phải **"+ Tạo hồ sơ"** dẫn tới `/my/products/new`.
- **Thanh tab lọc nhanh theo 6 trạng thái hồ sơ (`status-tabs`)**:
  - `Tất cả hồ sơ` · `Bản nháp` · `Chờ duyệt` · `Bị trả lại` · `Đã duyệt` · `Đang đánh giá` · `Đã hoàn tất`.
- **Bộ lọc**: Tìm kiếm tên/mã hồ sơ, Danh mục sản phẩm, nút "Bộ lọc khác" (có badge đếm số bộ lọc nâng cao: Loại đăng ký, Năm đánh giá, Mức sao, Khoảng ngày) và dải chip "Đang lọc" khi thu gọn.
- **Bảng danh sách hồ sơ của chủ thể**:
  - Cột `Sản phẩm / Mã hồ sơ` (kèm ảnh thumbnail 48×48px bấm xem phóng to được), `Địa bàn / Cập nhật`, `Trạng thái` (6 màu phân biệt rõ, đặc biệt nhấn mạnh trạng thái `Bị trả lại`), `Kết quả` (hiển thị điểm & mức sao khi đã công bố, hoặc "Chờ công bố kết quả" / "Chưa có kết quả"), và cột `Thao tác` (Xem hồ sơ, Sửa bản nháp / Chỉnh sửa hồ sơ bị trả lại, Nộp hồ sơ / Nộp lại, Xóa bản nháp).
```

---

## Phần 4. Checklist nghiệm thu thiết kế từ Open Design trước khi đưa vào code

- [ ] **Không sinh số liệu ảo**: Các con số trong thiết kế chỉ đóng vai trò minh họa đúng cấu trúc trường dữ liệu hiện có của API (`/api/admin/reports/dashboard`, `/api/products`, `/api/judge/products`, `/api/my/products`).
- [ ] **Đúng hệ thống Font**: Không còn số KPI nào dùng `JetBrains Mono` cỡ lớn; toàn bộ số liệu bảng và KPI dùng `Be Vietnam Pro` + `tabular-nums`.
- [ ] **Đủ 6 màu trạng thái hồ sơ**: `DRAFT`, `SUBMITTED`, `RETURNED`, `APPROVED`, `SCORING`, `COMPLETED` có nhãn tiếng Việt và sắc độ tách biệt, luôn có chữ đi kèm màu.
- [ ] **4 vùng phân tích trên `/admin` có thanh tỷ lệ trực quan**: Dễ quét bằng mắt trong 3 giây mà vẫn giữ được liên kết bấm sang danh sách hồ sơ.
- [ ] **Responsive đủ 4 mốc**: 375px (mobile), 768px (tablet), 1024px (laptop), 1440px (desktop) — không tràn ngang toàn trang, các nút bấm trên mobile đạt tối thiểu 44×44px.
