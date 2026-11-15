# Danh sách kiểm tra phát hành và vận hành SEO (TanStack Start SSR)

Tài liệu này hướng dẫn cấu hình môi trường, khởi chạy runtime SSR, kiểm tra tích hợp sau triển khai và quy trình quay lại bản trước (rollback) cho ứng dụng `@ocop/web` theo [Đặc tả SEO sản phẩm OCOP với TanStack Start (#15)](./2026-11-08-tanstack-start-seo-design.md).

---

## 1. Điều kiện môi trường và Runtime SSR

Ứng dụng `@ocop/web` dựng HTML trên máy chủ (SSR) cho các trang công khai (`/`, `/products`, `/products/:id`) và cung cấp trực tiếp `/sitemap.xml` cùng `/robots.txt`. Các luồng đăng nhập và khu vực công việc của Người dùng, Chủ trì, Giám khảo, Quản trị chạy ở chế độ trình duyệt (`ssr: false`).

### Yêu cầu hạ tầng
- **Runtime**: Node.js `>=24.7 <25` (tối thiểu `>=20.19.0` cho gói `@ocop/web`). Không sử dụng hosting chỉ phục vụ file tĩnh thuần túy (SPA shell) cho môi trường cần lập chỉ mục.
- **Kết nối tới Backend NestJS (`@ocop/api`)**: Tiến trình Node SSR cần kết nối HTTP tới API công khai của backend (`/api/categories`, `/api/products`, `/api/products/:id`).

### Biến môi trường cần cấu hình
| Biến môi trường | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `PUBLIC_ORIGIN` (hoặc `VITE_PUBLIC_ORIGIN`) | Origin công khai tuyệt đối dùng để tạo thẻ `<link rel="canonical">`, `og:url`, `og:image`, `/sitemap.xml` và `/robots.txt`. | `https://ocop.vn` |
| `API_INTERNAL_URL` (hoặc `VITE_API_PROXY` / `VITE_API_URL`) | Địa chỉ tuyệt đối để tiến trình SSR gọi tới backend NestJS ở phía server. | `http://127.0.0.1:3030` |

### Lệnh build và khởi chạy SSR
1. Build bundle client (`dist/`) và bundle server (`dist/server/server.js`):
   ```bash
   pnpm --filter @ocop/web build
   ```
2. Khởi chạy HTTP SSR server (sử dụng `createWebSsrServer` từ `dist/server/server.js`):
   ```bash
   PUBLIC_ORIGIN="https://ocop.vn" \
   API_INTERNAL_URL="http://127.0.0.1:3030" \
   node -e "import('./apps/web/dist/server/server.js').then(({ createWebSsrServer }) => createWebSsrServer().listen(Number(process.env.PORT || 5173)))"
   ```

### Cấu hình Reverse Proxy (Nginx / Caddy / Cloud Load Balancer)
- Chuyển tiếp các đường dẫn `/api/*` tới dịch vụ backend NestJS (`@ocop/api`).
- Chuyển tiếp toàn bộ lưu lượng còn lại (`/`, `/products`, `/products/*`, `/sitemap.xml`, `/robots.txt`, `/assets/*`, `/login`, `/my/*`, `/admin/*`, `/judge/*`) tới cổng của Node SSR server.
- Truyền các header `Host` và `X-Forwarded-Proto` (`https`) để SSR xác định đúng origin khi chưa đặt cứng `PUBLIC_ORIGIN`.
- Không bật bộ nhớ đệm chung (shared proxy cache) cho HTML của `/`, `/products`, `/products/:id` hoặc `/sitemap.xml` (ứng dụng trả `Cache-Control: no-store` để thay đổi trạng thái duyệt và công bố kết quả được phản ánh tức thì).

---

## 2. Danh sách kiểm tra cho người vận hành (Operator Verification Checklist)

Thực hiện các bước kiểm tra dưới đây trên môi trường staging/production trước khi gửi sitemap lên Google Search Console. Không tự động gửi sitemap từ script CI/CD.

### 2.1. Kiểm tra HTML ban đầu qua `curl` (không chạy JavaScript)
- **Trang chủ (`/`)**:
  ```bash
  curl -i https://ocop.vn/
  ```
  - Trạng thái HTTP `200`, header `Cache-Control: no-store`.
  - Có `<title>`, `<meta name="description">`, `<link rel="canonical" href="https://ocop.vn/"/>`.
  - HTML chứa danh sách sản phẩm đã được Chủ trì duyệt (`approvedAt != null` và trạng thái `APPROVED`, `SCORING` hoặc `COMPLETED`), không chứa hồ sơ `DRAFT`, `SUBMITTED`, `RETURNED` hoặc hồ sơ thiếu dấu vết duyệt.

- **Trang danh sách và phân trang (`/products`, `/products?page=2`, `/products?q=...`)**:
  ```bash
  curl -i "https://ocop.vn/products"
  curl -i "https://ocop.vn/products?page=2"
  curl -i "https://ocop.vn/products?q=tra"
  ```
  - Trang 1 có canonical `https://ocop.vn/products` (không gắn `?page=1`), trang 2 có canonical `https://ocop.vn/products?page=2`.
  - HTML chứa liên kết phân trang thật dạng `<a href="/products?page=2">` và `<a href="/products">`.
  - Biến thể tìm kiếm/lọc (`?q=...`, `?categoryId=...`) trả kèm header `X-Robots-Tag: noindex` và `<meta name="robots" content="noindex, follow"/>`.

- **Trang chi tiết sản phẩm (`/products/:id`)**:
  ```bash
  curl -i "https://ocop.vn/products/<ID_SAN_PHAM_DA_DUYET>"
  curl -i "https://ocop.vn/products/<ID_SAN_PHAM_MOI_NOP_SUBMITTED>"
  curl -i "https://ocop.vn/products/<ID_KHONG_TON_TAI>"
  ```
  - Hồ sơ đủ điều kiện SEO: trả `200`, không có `noindex`, có `<title>`, `<meta name="description">`, `<link rel="canonical">`, và đầy đủ thẻ Open Graph (`og:title`, `og:description`, `og:type`, `og:url`, `og:image` tuyệt đối). Điểm số và xếp sao chỉ xuất hiện khi `publicationState === 'PUBLISHED'`.
  - Hồ sơ `SUBMITTED` (hoặc hồ sơ cũ thiếu `approvedAt`): vẫn trả `200` để không phá vỡ quyền xem hiện tại, nhưng bắt buộc có `X-Robots-Tag: noindex` và `<meta name="robots" content="noindex"/>`.
  - Hồ sơ `DRAFT`, `RETURNED` hoặc không tồn tại: trả HTTP `404` kèm `X-Robots-Tag: noindex`.

### 2.2. Kiểm tra `/robots.txt` và `/sitemap.xml`
```bash
curl -i https://ocop.vn/robots.txt
curl -i https://ocop.vn/sitemap.xml
```
- `/robots.txt` trả `200` (`text/plain; charset=utf-8`), có `Allow: /` và `Sitemap: https://ocop.vn/sitemap.xml`; không chặn `/products` để bot đọc được chỉ thị `noindex` trên các hồ sơ chưa duyệt.
- `/sitemap.xml` trả `200` (`application/xml; charset=utf-8`), chứa `https://ocop.vn/`, `https://ocop.vn/products` và toàn bộ URL sản phẩm đủ điều kiện qua mọi trang dữ liệu; không trùng lặp URL, không chứa hồ sơ chưa duyệt hoặc đường dẫn riêng tư (`/admin`, `/my`, `/judge`, `/login`).

### 2.3. Kiểm tra xem trước chia sẻ (Open Graph) và Google Search Console
1. Kiểm tra URL sản phẩm đủ điều kiện bằng công cụ URL Inspection của Google Search Console (xác nhận Googlebot nhận được HTML có nội dung, canonical đúng và cho phép lập chỉ mục).
2. Kiểm tra xem trước khi chia sẻ liên kết sản phẩm để xác nhận tiêu đề, mô tả và ảnh `og:image` hiển thị chính xác.
3. Sau khi toàn bộ mục kiểm tra trên đạt yêu cầu, người có quyền quản trị Search Console gửi đường dẫn `https://ocop.vn/sitemap.xml` trong mục **Sitemaps**.

---

## 3. Phương án quay lại bản trước (Rollback)

Nếu phát hiện lỗi trên môi trường chạy thật sau khi bật runtime SSR:
1. **Chuyển lưu lượng về bản phát hành trước**:
   - Đổi cấu hình Reverse Proxy (Nginx / Load Balancer) trỏ lại về gói tĩnh `dist/` của bản build frontend ổn định liền trước (phục vụ `index.html` như SPA trước đây) hoặc container image của bản phát hành trước.
2. **Tương thích ngược với Backend**:
   - Tham số `approvedOnly` trên `GET /api/products` và trường `approvedAt` trong phản hồi công khai được thiết kế tương thích ngược hoàn toàn, nên việc quay lại bản frontend trước không yêu cầu phải rollback cơ sở dữ liệu hay dịch vụ backend `@ocop/api`.
3. **Kiểm tra sau rollback**:
   - Xác nhận trang chủ, đăng nhập và các luồng nghiệp vụ của Người dùng, Chủ trì, Giám khảo, Quản trị hoạt động bình thường.
