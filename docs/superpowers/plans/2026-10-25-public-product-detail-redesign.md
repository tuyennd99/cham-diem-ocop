# Public Product Detail UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa bố cục, ảnh, trạng thái và các trường hợp loading/lỗi của `/products/$id` bằng dữ liệu hiện có.

**Architecture:** Chỉ sửa component public detail và CSS có scope riêng. Dùng Query hook, URL ảnh, formatter và UI controls có sẵn; không thay đổi contract hoặc đường ghi dữ liệu.

**Tech Stack:** React, TypeScript, TanStack Query/Router, CSS và UI components hiện có.

**Spec:** `docs/superpowers/specs/2026-10-25-public-product-detail-design.md`.

## Global Constraints

- Phạm vi đã được người dùng thu hẹp: **chỉnh bố cục, chỉ sửa UI**. Kế hoạch này thay thế toàn bộ task backend/form nhập trong bản trước.
- Chỉ thay đổi hai file triển khai: `apps/web/src/pages/public/PublicProductDetailPage.tsx` và phần CSS tương ứng trong `apps/web/src/styles.css`.
- Không thêm publicLocation/visitDetails, API, migration, shared types, form nhập hoặc thao tác admin. Không thay đổi header/footer, trang catalog, trang in hoặc quyền truy cập.
- Không thêm dependency, ảnh tự tạo, slider hoặc modal gallery.
- Giữ màu/font/token hiện tại; container tối đa 1440px. Không sửa global `.route-main` hoặc `.route-container` để ảnh hưởng trang khác.
- Dữ liệu hiển thị lấy từ response hiện có; không suy diễn địa điểm/chi tiết tham quan hoặc đưa thông tin đăng ký ra public.
- Workspace đang có nhiều thay đổi, nhất là styles.css. Giữ nguyên phần sửa của người khác và không format toàn repo.
- Trước UI edit, đọc `impeccable/reference/craft-floor.md`; không chạy lại `impeccable context` trong phiên này.
- Đây là kế hoạch; các bước và kiểm tra dưới đây chưa được thực hiện.

## Review Focus

- Ảnh đơn không bị thu thành một trong ba cột; ảnh dọc/ngang giữ nguyên nội dung — Task 1/3.
- Không ảnh không để lại cột trống; ảnh lỗi không làm mất mô tả — Task 1/3.
- Tên dài 255 ký tự và mô tả nhiều dòng không gây tràn trang ở 320px — Task 1/3.
- Điểm/sao null không thành chuỗi “null”; SUBMITTED/SCORING không thể hiện như đã được công nhận — Task 2/3.
- Initial loading không hiện empty state; refresh lỗi vẫn giữ nội dung cache — Task 2/3.

---

### Task 1: Bố cục và gallery có nội dung thực

**Files:**
- Modify: `apps/web/src/pages/public/PublicProductDetailPage.tsx`.
- Modify: `apps/web/src/styles.css` — các selector mới dưới scope `.public-product-page`.

**Interfaces:** Giữ `PublicProductDetailPage({ id }: { id: string })`, `usePublicProduct<PublicProduct>(id)`, dữ liệu PublicProduct và `publicAttachmentUrl` hiện có. Không thêm component/helper dùng chung chỉ cho đợt này.

- [ ] Thêm class `public-product-page` trên main của mọi trạng thái. Chuyển nội dung thành article không có wrapper `.route-panel`; scoped container căn trái.
- [ ] Dựng header gồm link quay lại, status, h1 và `category.name`. Áp h1 40/30px, line-height 1.25; main padding 24/48px, dưới 768px là 20/32px. Gutter giữ theo container.
- [ ] Khi có ảnh: vùng chính hai cột 5:7 từ 1024px, gap 32px; bên trái ảnh đầu, bên phải “Giới thiệu” và vùng kết quả. Dưới 1024px xếp một cột, giữ DOM theo spec. Vùng ảnh một cột max-width 640px, căn trái.
- [ ] Ảnh đầu khung 4:3 contain và tải eager; phần còn lại lazy-load trong section “Hình ảnh khác” dưới vùng chính, grid 3/2/1 cột theo các mốc 1024/480px. Không hiện section này khi chỉ có một ảnh.
- [ ] Không attachment: chuyển một cột nội dung, hiển thị thông báo thiếu ảnh gọn. Lỗi từng img dùng fallback tại chỗ và giữ thông tin khác. Giữ URL/thứ tự/attachment thật; không tự thay ảnh “OCOP Viet Nam”.
- [ ] Description chỉ có section khi có nội dung; giữ xuống dòng, tối đa 70ch, chữ 16px line-height 1.6, wrap chuỗi dài. Không thêm section địa điểm/tham quan hoặc hàng dữ liệu giả.
- [ ] Kiểm tra browser nhanh ở 1440px và 390px: header/cột thẳng hàng, ảnh đơn dùng đủ vùng media, không khung trắng bao khoảng trống, không tràn ngang.

### Task 2: Trạng thái và phản hồi tải dữ liệu

**Files:** Hai file của Task 1.

**Interfaces:** Dùng `isPending`, `isFetching`, `data`, `error`, `refetch` từ hook Query hiện có; `ApiError.status` để nhận 404. Dùng `formatExactScore` và `formatStarRatingLabel` từ `src/lib/print-format.ts`. Button/Link hiện có.

- [ ] Thêm bản đồ copy riêng trong component cho ba status đúng spec. Detail dùng nhãn COMPLETED “Đã hoàn tất đánh giá”; không sửa `constants/product-status.ts` hoặc copy ở Home/Catalog.
- [ ] Vùng kết quả chỉ hiện điểm/sao khi COMPLETED; xử lý thiếu điểm và thiếu sao độc lập theo formatter hiện có. Kèm câu phân biệt điểm hệ thống với quyết định công nhận. Không thay đổi dữ liệu/calculation.
- [ ] Initial loading dựng skeleton tương ứng header + media/content, có role/status hoặc aria-busy thích hợp. Không dùng nhánh thiếu ảnh/kết quả để biểu diễn loading.
- [ ] Khi 404 và chưa có data, hiển thị thông báo riêng cùng link về danh sách. Lỗi mạng khi chưa có data có nút “Thử lại” gọi refetch, disable trong lúc đang tải.
- [ ] Khi đã có cache và refetch lỗi, render nội dung kèm thông báo cập nhật thất bại; không để nhánh error đứng trước data làm mất nội dung.
- [ ] Giữ một h1, section headings đúng thứ tự; label/fallback đọc được, focus rõ, trạng thái thử lại có phản hồi và không tạo thông báo lặp thừa.
- [ ] Kiểm tra loading → success/empty media, network error → retry, unknown id → 404, refresh lỗi với cache; đối chiếu cả ba status và score/star null.

### Task 3: Kiểm tra và bàn giao UI

**Files:** Có thể tạo `docs/verification/2026-10-25-public-product-detail.md` để ghi bằng chứng lúc triển khai; không sửa fixture/seed/backend để hoàn thành đợt UI.

- [ ] Chạy `pnpm --filter @ocop/web typecheck` và `pnpm --filter @ocop/web build`; kỳ vọng exit 0. Kiểm tra format riêng file TSX/CSS đã sửa, không format cả workspace.
- [ ] Browser ở 320/390/768/1440/1920px: tên 255 ký tự, description rỗng/dài/xuống dòng, ảnh đơn dọc/ngang, nhiều ảnh, 0 ảnh và ảnh lỗi. Xác nhận không cuộn ngang toàn trang và 1920px dùng đúng cap 1440px.
- [ ] Kiểm tra trạng thái Task 2 ở desktop và mobile. Dùng dữ liệu/mock trong phiên kiểm tra nếu công cụ hỗ trợ; không sửa API/seed. Trạng thái chưa dựng được phải ghi rõ chưa kiểm chứng.
- [ ] Dùng bàn phím đi qua link/nút, kiểm tra focus, thứ tự đọc, vùng bấm cảm ứng và ảnh/fallback có tên truy cập được.
- [ ] Chạy detector component/layout trên page và CSS; đồng thời đối chiếu rendered result, vì detector 0 findings không chứng minh bố cục tốt.
- [ ] Kiểm tra Home/Catalog/Auth/Admin vẫn giữ bố cục hiện tại sau thay đổi CSS; không chạy test DB vì không thay dữ liệu/API.
- [ ] Lưu ảnh desktop/mobile và kết quả checks vào verification doc. Ghi giới hạn: UI không bổ sung địa điểm/tham quan còn thiếu và không biến ảnh thương hiệu thành ảnh điểm đến thật.

## Trình tự

Task 1 → Task 2 → Task 3. Hai task đầu cùng hai file, nên triển khai trực tiếp sẽ gọn hơn chia nhiều agent. Lượt chỉnh kế hoạch hiện tại chỉ sửa tài liệu; triển khai UI là bước tiếp theo.

