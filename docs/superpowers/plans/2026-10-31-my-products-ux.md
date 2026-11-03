# Cải thiện trang Hồ sơ của tôi — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa 5 vấn đề UI/UX của `/my/products`: bố cục thẻ, nhãn trạng thái, lỗi nộp/xóa, cách giải thích kết quả và khả năng phân biệt thao tác trên màn hình nhỏ/công nghệ hỗ trợ.

**Architecture:** Giữ dữ liệu, route và hành vi nghiệp vụ hiện có. Tạo biến thể CSS chỉ cho danh sách hồ sơ; tái sử dụng nhãn trạng thái và hàm định dạng kết quả của trang chi tiết. Tách lỗi tải danh sách khỏi lỗi thao tác; truyền lỗi thao tác vào hộp thoại xác nhận hiện có bằng một prop tùy chọn.

**Tech Stack:** React, TypeScript, TanStack Query/Router, Radix Dialog, CSS và các lệnh kiểm tra web có sẵn.

**Spec:** `.impeccable/critique/2026-10-31T09-37-01Z__apps-web-src-pages-registrant-myproductspage-tsx.md` — bản đánh giá dựa trên ảnh và mã nguồn; lỗi thao tác và trải nghiệm di động cần xác nhận khi triển khai.

## Global Constraints

- Không đổi API, schema, quyền, route, dữ liệu hồ sơ hoặc quy tắc tính điểm/sao.
- Dùng `REGISTRANT_PRODUCT_STATUS_LABEL`, `formatExactScore` và `formatStarRatingLabel` hiện có; mức 5 sao giữ nhãn đề nghị xem xét như trang chi tiết.
- Giữ xác nhận trước khi nộp hoặc xóa; chỉ thử nộp/xóa thành công với bản nháp thử nghiệm được xác định là có thể xóa.
- Không sửa `.record-row`, `.record-result` hoặc `.record-main` toàn cục theo cách làm đổi các trang công khai, giám khảo và quản trị đang dùng chung.
- Giữ các thay đổi chưa commit của người dùng, đặc biệt `AppLayout.tsx`, `AuthFrame.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `styles.css`, `vite.config.ts` và các tệp chưa theo dõi. Kiểm tra diff trước khi sửa; không stage toàn bộ `styles.css` khi có thay đổi khác.
- Không thêm dependency hoặc thư viện kiểm thử chỉ cho thay đổi này. Các hàm và thành phần đã có đáp ứng nhu cầu; không cần nghiên cứu mã nguồn mở cho chức năng mới.
- Không công bố kết quả đánh giá là quyết định công nhận OCOP chính thức.

## Phân chia tệp và thứ tự

| Tệp | Trách nhiệm |
|---|---|
| `apps/web/src/pages/registrant/MyProductsPage.tsx` | Bố cục danh sách, trạng thái, kết quả, tên truy cập, tách lỗi. |
| `apps/web/src/styles.css` | Chỉ thêm quy tắc có phạm vi `.my-products-row`, kể cả breakpoint điện thoại. |
| `apps/web/src/components/confirm-dialog.tsx` | Nhận `error?: string` và hiển thị lỗi bên trong hộp thoại; những nơi gọi khác không cần truyền prop. |
| `apps/web/src/constants/product-status.ts`, `apps/web/src/lib/print-format.ts` | Chỉ đọc và tái sử dụng; không thay đổi hợp đồng. |
| `apps/web/test/scoring-print.test.ts` | Chạy kiểm tra có sẵn cho định dạng điểm, 0, 5 sao và sao null; không tạo test chỉ so khớp chuỗi mã nguồn. |

Làm tuần tự: Task 1 và Task 2 cùng sửa `MyProductsPage.tsx`; Task 3 kiểm tra kết quả tổng hợp.

### Task 1: Bố cục, trạng thái, kết quả và tên thao tác

**Files:** Modify `apps/web/src/pages/registrant/MyProductsPage.tsx`, `apps/web/src/styles.css`. Read `apps/web/src/constants/product-status.ts`, `apps/web/src/lib/print-format.ts`.

**Interfaces:** Nhận `Product` hiện có với `status`, `finalScore: number | null`, `starRating: number | null`, `name`, `category`, `attachments`; không thay đổi kiểu hay payload. Đầu ra là thẻ dùng class `my-products-row`, nhãn trạng thái tiếng Việt và kết quả cùng quy tắc với `MyProductDetailPage`.

- [x] **Bước 1 — Ghi lại hiện trạng và phạm vi CSS.** Chạy `git diff -- apps/web/src/pages/registrant/MyProductsPage.tsx apps/web/src/styles.css` và `rg -n 'record-row|record-result' apps/web/src/pages`; giữ nguyên các hunk đã có. Xác nhận `.record-row` hiện chia `160px minmax(0, 1fr) 168px` nhưng thẻ của trang chỉ có `record-main` và `record-result`.
- [x] **Bước 2 — Dùng nhãn và định dạng hiện có.** Thêm import vào `MyProductsPage.tsx`:

```tsx
import { REGISTRANT_PRODUCT_STATUS_LABEL } from '../../constants/product-status';
import { formatExactScore, formatStarRatingLabel } from '../../lib/print-format';
```

Thay `{product.status}` bằng `{REGISTRANT_PRODUCT_STATUS_LABEL[product.status]}`. Thay khối kết quả bằng:

```tsx
{product.status === 'COMPLETED' && typeof product.finalScore === 'number' && (
  <div className='my-products-score'>
    <strong>{formatExactScore(product.finalScore)} điểm</strong>
    <span>{formatStarRatingLabel(product.starRating)}</span>
  </div>
)}
```

Quy tắc này khớp trang chi tiết: điểm `0` vẫn hiển thị, sao `null` thành `Chưa xếp sao`, 5 sao dùng nhãn đề nghị xem xét. Không hiển thị kết quả cho bản nháp hoặc hồ sơ đang chấm.

- [x] **Bước 3 — Đặt tên truy cập cho từng hồ sơ.** Đổi `className='record-row'` thành `className='record-row my-products-row'`. Giữ chữ nhìn thấy và route; đặt tên phân biệt cho các link/nút lặp:

```tsx
<Link
  to='/my/products/$id'
  params={{ id: product.id }}
  aria-label={`Mở hồ sơ ${product.name}`}
>
  Mở hồ sơ
</Link>
```

Thêm các thuộc tính sau lần lượt vào link sửa, nút nộp và nút xóa bản nháp; giữ `disabled`, `onClick` và URL như cũ:

```tsx
aria-label={`Sửa bản nháp ${product.name}`}
aria-label={`Nộp hồ sơ ${product.name}`}
aria-label={`Xóa bản nháp ${product.name}`}
```

- [x] **Bước 4 — Sửa bố cục có phạm vi.** Thêm các quy tắc sau vào cuối `styles.css` để chúng đứng sau breakpoint `.record-result` hiện có:

```css
.my-products-row {
  grid-template-columns: minmax(0, 1fr) minmax(160px, 240px);
  align-items: start;
}

.my-products-row .record-main h2 {
  margin: 0 0 6px;
  font-family: var(--font-body);
  font-size: 20px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.my-products-row .record-result {
  min-width: 0;
  align-items: flex-end;
}

.my-products-score {
  display: grid;
  gap: 2px;
  text-align: right;
}

@media (max-width: 620px) {
  .my-products-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .my-products-row .record-result {
    grid-column: auto;
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;
    min-width: 0;
  }

  .my-products-score {
    text-align: left;
  }
}
```

Trên desktop, tên nhận phần rộng linh hoạt, cột kết quả tối đa 240px và nút không kéo hết cột giữa. Trên điện thoại, nội dung và thao tác đi theo một cột; xác nhận nút vẫn chạm được và không tràn.

- [x] **Bước 5 — Kiểm tra kết quả.** Chạy:

```powershell
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/scoring-print.test.ts
```

Yêu cầu cả hai thành công. Trên dữ liệu thử nghiệm, kiểm tra 4 trạng thái, điểm `0`, 3 sao, 5 sao và sao `null` nếu có dữ liệu phù hợp. Dùng tên dài như `Nước mắm truyền thống Cà Mau 40 độ đạm` và hai hồ sơ khác tên để xác nhận liên kết có tên truy cập khác nhau. Không chỉnh dữ liệu thật chỉ để tạo trường hợp thử.

*Kết quả:* Typecheck, test định dạng, điểm 0 và sao null đều đạt. Trang đang mở chỉ có một hồ sơ hoàn tất 3 sao; các trạng thái/bộ điểm khác và link của nhiều hồ sơ chưa có dữ liệu để kiểm tra.

### Task 2: Giữ danh sách và hiển thị lỗi trong hộp thoại

**Files:** Modify `apps/web/src/pages/registrant/MyProductsPage.tsx`, `apps/web/src/components/confirm-dialog.tsx`. Read `apps/web/src/components/alert-error.tsx`, `apps/web/src/components/ui/alert.tsx` và các nơi khác gọi `ConfirmDialog`.

**Interfaces:** `ConfirmDialog` nhận thêm `error?: string`; khi không truyền hoặc chuỗi rỗng, giao diện và API của các nơi gọi khác không đổi. `actionError: string` chỉ dành cho nộp/xóa; `loadError` chỉ dành cho tải danh sách. `executeConfirm()` vẫn gọi chính xác `myProductsApi.submit(product.id)` hoặc `myProductsApi.remove(product.id)` và giữ cập nhật cache hiện tại.

- [ ] **Bước 1 — Tái hiện lỗi có kiểm soát.** Chưa thực hiện: dữ liệu đang mở chỉ có hồ sơ hoàn tất, không có bản nháp thử nghiệm có thể xóa. Không tạo hay sửa dữ liệu chỉ để tái hiện lỗi.
- [x] **Bước 2 — Thêm prop lỗi tùy chọn vào hộp thoại.** Trong `confirm-dialog.tsx`, thêm `import AlertError from '@/components/alert-error';`, thêm `error` vào tham số destructuring và `error?: string` vào kiểu props. Trong `DialogContent`, sau `DialogHeader` và trước `DialogFooter`, thêm:

```tsx
{error && <AlertError title='Không thể thực hiện thao tác' errors={[error]} />}
```

`AlertError` dùng `role='alert'` sẵn. Không đổi prop bắt buộc hoặc nhãn của các hộp thoại khác.

- [x] **Bước 3 — Tách lỗi tải và lỗi thao tác.** Trong `MyProductsPage.tsx`, thay `const error = actionError || errorText(loadError);` bằng `const loadMessage = errorText(loadError);`. Trong `refresh`, chỉ gọi `await refetch()`; không xóa lỗi thao tác ở đó. Đổi banner lỗi trang thành `loadMessage`, với tiêu đề `Không thể tải hồ sơ`; hai điều kiện hiển thị rỗng/danh sách dùng `!loadMessage`, không dùng `actionError`:

```tsx
{loadMessage && (
  <div className='mb-4 space-y-2'>
    <AlertError title='Không thể tải hồ sơ' errors={[loadMessage]} />
    <Button type='button' variant='secondary' disabled={loading || busy} onClick={() => void refresh()}>
      Thử lại
    </Button>
  </div>
)}
{!loading && !loadMessage && !products.length && (
  <div className='empty-state'>
    <h2>Chưa có hồ sơ</h2>
    <p>Tạo bản nháp để bắt đầu đăng ký sản phẩm.</p>
    <Button asChild>
      <Link to='/my/products/new'>Tạo hồ sơ</Link>
    </Button>
  </div>
)}
```

Đổi điều kiện ngay trước `<div className='record-list'>` thành `{!loading && !loadMessage && (` và giữ nguyên nội dung danh sách đã sửa ở Task 1. `catch` tiếp tục gọi `setActionError(messageOf(cause))`; chỉ đóng hộp thoại và cập nhật cache sau request thành công như hiện tại.

- [x] **Bước 4 — Đưa lỗi đúng ngữ cảnh và xóa lỗi cũ khi đóng.** Truyền `error={actionError}` cho `ConfirmDialog`. Thay `onOpenChange` bằng:

```tsx
onOpenChange={(open) => {
  if (!open && !busy) {
    setConfirmState(null);
    setActionError('');
  }
}}
```

Giữ `setActionError('')` ở đầu `executeConfirm()`: lần nhấn xác nhận tiếp theo thử lại đúng nộp/xóa, không chỉ tải lại danh sách. Khi đang `busy`, đóng bằng Hủy, Escape hay nút đóng vẫn không làm mất trạng thái.

- [ ] **Bước 5 — Kiểm tra lỗi và phục hồi.** Chưa xác minh bằng trình duyệt vì không có bản nháp thử nghiệm. Typecheck và build đã kiểm tra kiểu/hợp đồng; các hộp thoại dùng chung khác giữ prop tùy chọn.

### Task 3: Kiểm tra tổng hợp và bàn giao

**Files:** Không tạo tệp kiểm thử tự động mới cho các thay đổi văn bản/bố cục. Sử dụng kiểm tra hiện có và kiểm tra hành vi bằng trình duyệt.

**Interfaces:** Kết quả Task 1 và 2 trên `/my/products`; các trang khác dùng `.record-row` và `ConfirmDialog` giữ nguyên.

- [x] **Bước 1 — Chạy kiểm tra hiện có.** Từ gốc repository:

```powershell
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web build
pnpm --filter @ocop/web exec node test/router.check.mjs
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/scoring-print.test.ts
git diff --check
```

Yêu cầu exit code 0; router vẫn chứa `/my/products`, `/my/products/new`, `/my/products/$id` và `/my/products/$id/edit`. Nếu lệnh thất bại, ghi nguyên nhân và sửa phần thuộc phạm vi trước khi báo hoàn tất.

- [ ] **Bước 2 — Kiểm tra giao diện và bàn phím.** Đã đo bố cục tại 761, 620, 390 và 320 CSS px; trang không tràn ngang và tên liên kết trong cây trợ năng có tên sản phẩm. Chưa kiểm tra Tab/Escape, trình đọc màn hình, trạng thái bản nháp hoặc nhiều hồ sơ vì không có dữ liệu thử phù hợp.
- [ ] **Bước 3 — Kiểm tra trạng thái và các trang dùng chung.** Trên trình duyệt chỉ có một hồ sơ hoàn tất 3 sao; không thể kiểm tra các trạng thái khác, điểm 5 sao hoặc sao null trên UI. Hàm định dạng 0/null, nhãn 5 sao, build và router đã xác minh; CSS mới chỉ có phạm vi `.my-products-row`, nhưng chưa mở riêng danh mục công khai/giám khảo.
- [x] **Bước 4 — Ghi giới hạn thực tế.** Nếu API cục bộ hoặc dữ liệu seed không sẵn sàng, ghi chính xác kịch bản chưa xác minh; không đánh dấu kiểm tra lỗi, trạng thái hay kết quả là đạt chỉ dựa trên đọc mã. Không gửi hoặc xóa hồ sơ thật để hoàn thành kiểm tra.
- [x] **Bước 5 — Rà soát diff.** Chạy `git diff -- apps/web/src/pages/registrant/MyProductsPage.tsx apps/web/src/components/confirm-dialog.tsx apps/web/src/styles.css`, đối chiếu với diff trước Task 1, bảo đảm chỉ thêm sửa đổi thuộc kế hoạch và giữ toàn bộ thay đổi người dùng. Nếu được yêu cầu commit, stage chọn từng hunk thuộc công việc này và kiểm tra `git diff --cached` trước khi commit.

## Tự rà soát kế hoạch

- Vấn đề 1 → Task 1 bước 3–4 và Task 3 bước 2–3.
- Vấn đề 2 → Task 1 bước 2 và Task 3 bước 3.
- Vấn đề 3 → Task 2 bước 1–5 và Task 3 bước 4.
- Vấn đề 4 → Task 1 bước 2, 5 và Task 3 bước 3.
- Vấn đề 5 → Task 1 bước 3–5 và Task 3 bước 2.
- `ConfirmDialog.error?: string` là prop tùy chọn duy nhất thêm vào thành phần chung; `Product` và API giữ nguyên. Không thêm phụ thuộc hay thay đổi các tệp đang dở ngoài các hunk cần thiết.
