# Thiết kế cache ảnh sản phẩm

Ngày: 26/10/2026, Asia/Saigon.

Trạng thái: thiết kế đã hoàn thiện theo các quyết định Q1–Q5 được người dùng xác nhận. Chưa triển khai ứng dụng.

## Mục tiêu

Giảm việc tải lại nội dung cùng một ảnh khi người dùng chuyển trang hoặc mở lại sản phẩm. Tận dụng TanStack Query và HTTP cache hiện có trên nền tảng, không thêm thư viện nếu chưa có nhu cầu vượt khả năng của chúng.

Không cam kết “tải đúng một lần vĩnh viễn”. Việc tải lại phụ thuộc thời hạn dùng lại, bộ nhớ còn giữ ảnh, thay đổi phiên và thao tác tải lại trang của người dùng.

## Các quyết định đã chốt

| Mã | Nội dung | Trạng thái |
| --- | --- | --- |
| Q1 | Bao gồm ảnh công khai và ảnh riêng tư trong admin, chủ hồ sơ, trang in | Người dùng đã chọn cả hai |
| Q2 | Ảnh riêng tư chỉ giữ trong bộ nhớ của ứng dụng; không lưu qua F5/đóng mở trình duyệt | Người dùng đã chọn bộ nhớ |
| Q3 | Dùng lại ảnh tối đa 5 phút trước khi kiểm tra lại quyền trong lần mở tiếp theo | Người dùng đã đồng ý |
| Q4 | Chỉ cache ảnh hiển thị; nút tải tệp vẫn gọi API trực tiếp | Người dùng đã đồng ý |
| Q5 | Khi mở ảnh hết hạn, chờ kiểm tra lại; nếu thất bại thì hiện lỗi và không hiện ảnh cũ | Người dùng đã đồng ý |

Phạm vi hiển thị gồm trang công khai, thumbnail riêng tư trong admin/chủ hồ sơ và trang in đang dùng component chung. Nút tải tệp và PDF minh chứng giữ luồng gọi API trực tiếp. Thiết kế không yêu cầu lưu ảnh riêng tư qua F5 hoặc hỗ trợ offline.

## Chính sách cache

| Nội dung | Nơi lưu | Thời gian được dùng lại | Khi hết thời gian |
| --- | --- | --- | --- |
| Ảnh công khai | HTTP cache của trình duyệt | 300 giây từ response theo tuổi HTTP cache | Lần dùng tiếp theo phải hỏi server; không cho dùng stale khi không kiểm tra được |
| Blob ảnh riêng tư | Query cache trong bộ nhớ ứng dụng | `staleTime: 300_000`, tính từ lần query thành công | Lần mở tiếp theo phải kiểm tra lại; chờ thành công mới hiện, thất bại thì hiện lỗi |
| Query ảnh riêng tư không còn component sử dụng | Query cache trong bộ nhớ ứng dụng | `gcTime: 300_000` sau khi không còn observer | Dọn query và giải phóng tham chiếu tới Blob |

Năm phút là khoảng dùng lại trước lần kiểm tra tiếp theo, không phải lịch tự động xóa mọi ảnh đang hiển thị. Không thêm polling hay cơ chế thu hồi trực tiếp từ server. Query đang được dùng có thể sống lâu hơn `gcTime`; tham số này không phải hạn mức dung lượng RAM.

## Hiện trạng đã kiểm tra

- Trang chủ, danh sách và chi tiết công khai dùng `<img src>` qua `publicAttachmentUrl`, với URL chứa product ID và attachment ID.
- `ProductsController.image` trả ảnh công khai qua `asDownload` với disposition `inline`. Helper chỉ đặt kiểu nội dung, kích thước và disposition; chưa thấy chính sách `Cache-Control` trong backend source. Chưa kiểm tra header do môi trường triển khai hoặc proxy bổ sung.
- `PrivateAttachmentThumbnail` gọi API lấy Blob trong `useEffect` mỗi lần mount. Component tự tạo và thu hồi object URL; chưa dùng query cache.
- Thumbnail riêng tư được dùng trong danh sách admin, chi tiết admin và phiếu in. Liên kết tải tệp dùng chung API lấy Blob nhưng cần phân biệt ảnh với tài liệu minh chứng.
- Query client hiện có `staleTime: 30_000`, tắt refetch khi focus và xóa query cache khi tài khoản, token hoặc quyền nhân viên trong phiên thay đổi.
- Backend kiểm tra quyền ở các endpoint riêng tư. Endpoint ảnh công khai chỉ cho attachment `IMAGE` của sản phẩm ở trạng thái `SUBMITTED`, `SCORING`, `COMPLETED`.
- Mỗi tệp có thể tới 10 MiB. Giữ nhiều Blob có thể chiếm đáng kể bộ nhớ; thời gian dọn query inactive không phải giới hạn tổng dung lượng.

Nguồn mã: [URL ảnh](../../../apps/web/src/constants/api.ts), [thumbnail riêng tư](../../../apps/web/src/pages/registrant/AttachmentLink.tsx), [query client](../../../apps/web/src/lib/query-client.ts), [controller công khai](../../../apps/be/src/controllers/products.controller.ts), [đọc tệp và quyền](../../../apps/be/src/services/products.service.ts), [trả tệp](../../../apps/be/src/utils/private-storage.ts).

## Thiết kế

### Ảnh công khai

Giữ nguyên URL và `<img src>`. Endpoint ảnh công khai thành công trả `Cache-Control: private, max-age=300, must-revalidate`. `private` chọn cache trình duyệt cho đợt này; không mở thêm shared cache/CDN. Response lỗi không được nhận chính sách lưu thành công này.

Response còn fresh có thể được dùng lại mà không gọi backend, nên backend không kiểm tra lại trạng thái sản phẩm trong khoảng đó. Hết 300 giây, lần dùng tiếp theo phải kiểm tra lại; `must-revalidate` không cho dùng stale khi kiểm tra thất bại. Không dùng `immutable`, cache một năm hoặc `stale-while-revalidate`.

Không thay đổi mặc định của helper trả cả tệp riêng tư thành cache công khai. Chưa thêm ETag/Last-Modified trong đợt này: nếu server chưa có validator, lần tải sau khi hết hạn có thể nhận lại toàn bộ nội dung; không hứa có `304`.

Ảnh mới phải có định danh/URL mới. Đối với URL cũ đã được cache, xóa ảnh ở server không thể tự xóa ngay bản trình duyệt đang giữ.

### Ảnh riêng tư

Đưa việc lấy Blob vào query cache sẵn có. Các component cùng phạm vi truy cập dùng chung dữ liệu và request đang chạy; mỗi component vẫn quản lý object URL của mình. F5 hoặc đóng ứng dụng làm mất query cache này; không thêm persistence, IndexedDB, Cache Storage hoặc service worker.

Key phải phân biệt phạm vi truy cập, loại đường dẫn admin/chủ hồ sơ, product ID và attachment ID; không đưa access token trực tiếp vào key. Không dùng chung cache ảnh riêng tư với endpoint công khai. Tái sử dụng việc xóa cache khi đổi phiên; kiểm chứng cả request đang chạy lúc đổi tài khoản.

`queryClient.clear()` hiện đã hủy công việc ở tầng query; không cần thêm lời gọi hủy toàn bộ trùng lặp. Tuy nhiên, `requestBlob` chưa nhận `AbortSignal`, nên luồng HTTP hiện tại chưa dừng tải theo signal đó. Khi triển khai query ảnh, truyền signal qua các hàm API hiện có và xóa trạng thái ảnh đang render khi phạm vi phiên thay đổi.

Endpoint tệp riêng tư trả `Cache-Control: no-store` để tránh một lớp HTTP cache lưu bền ngoài chính sách này. Query cache vẫn chủ động giữ Blob theo chính sách ứng dụng; `no-store` không tự xóa Blob hay object URL đã tạo. Header mới cũng không tự xóa những bản HTTP cache đã tồn tại trước khi triển khai.

Đặt `staleTime: 300_000`, `gcTime: 300_000` riêng cho query ảnh. Giữ retry hiện có: 4xx không retry; lỗi mạng/5xx retry tối đa một lần. Không tăng thời gian cache toàn bộ query client chỉ để phục vụ ảnh.

Mốc hết hạn tính từ lần lấy Blob thành công, không gia hạn chỉ vì mở lại component. Khi mở ảnh đã stale, chưa render Blob cũ; chờ request kiểm tra lại thành công rồi mới hiện. Chỉ cấu hình `staleTime` là chưa đủ, vì React Query có thể cung cấp dữ liệu stale trong lúc refetch nền.

### Thu hồi dữ liệu và vòng đời

- Đăng xuất hoặc đổi phạm vi phiên: không để dữ liệu và response của phiên cũ xuất hiện trong phiên mới.
- Xóa ảnh thành công trong ứng dụng: hủy/xóa đúng query ảnh liên quan và cập nhật dữ liệu sản phẩm cùng dữ liệu in; không tiếp tục hiện Blob cũ hoặc để request đang chạy đưa ảnh đã xóa trở lại giao diện.
- Thay ảnh: dùng ID mới; không đổi nội dung nhưng giữ cùng ID trong thiết kế cache này.
- Thu hồi quyền từ nơi khác: lần mở tiếp theo chỉ dùng cache nếu chưa đủ 5 phút từ lần lấy thành công. Ảnh đang hiển thị không tự biến mất chỉ vì hết `staleTime`.
- Unmount hoặc đổi Blob: thu hồi object URL. Không lưu object URL vào query cache rồi để một component thu hồi URL mà component khác đang dùng.
- Lỗi tải hoặc bị từ chối quyền: giữ thông báo lỗi có thể đọc được. Khi kiểm tra lại thất bại không tiếp tục hiện ảnh cũ; 401 vẫn theo xử lý phiên hiện có, 403/404 loại dữ liệu ảnh không còn quyền/không còn tồn tại. Lỗi mạng/5xx sau retry có nút thử lại; không coi lỗi là một ảnh cache thành công.

Luồng nghiệp vụ hiện có chỉ cho upload/xóa attachment của hồ sơ `DRAFT`. Chưa thấy chức năng xóa ảnh đã công khai qua các mutation này. Chính sách kiểm tra lại sau 5 phút vẫn áp dụng cho endpoint công khai; thiết kế không bổ sung chức năng thu hồi ảnh hoặc đổi trạng thái sản phẩm mới.

## Điểm tích hợp khi triển khai

| Điểm có sẵn | Thay đổi dự kiến |
| --- | --- |
| `apps/web/src/constants/query-key.ts` | Bổ sung key cho nội dung ảnh, theo cách đặt key hiện có |
| `apps/web/src/pages/registrant/AttachmentLink.tsx` | Đưa thumbnail qua query; giữ xử lý object URL cục bộ |
| `apps/web/src/api/base-request.ts`, `api/my-products.ts`, `api/admin-products.ts` | Truyền signal cho request ảnh; không áp dụng cache Blob cho mọi request tệp một cách mặc định |
| `apps/web/src/queries/admin-products.ts` | Xóa cache ảnh khi xóa attachment; cập nhật metadata sản phẩm và dữ liệu in liên quan |
| `apps/web/src/pages/registrant/MyProductDetailPage.tsx`, `MyProductsPage.tsx` | Xóa cache ảnh liên quan khi chủ hồ sơ xóa attachment hoặc cả bản nháp |
| `apps/web/src/components/print/OcopPrintSheets.tsx` | Tái sử dụng thumbnail chung; kiểm chứng metadata in được cập nhật sau upload/xóa |
| `apps/be/src/controllers/products.controller.ts` và các controller attachment riêng tư | Đặt chính sách HTTP khác nhau cho ảnh công khai và tệp riêng tư; giữ kiểm tra quyền backend |

Các mutation hiện tại chủ yếu invalidate dữ liệu sản phẩm, chưa có cache byte ảnh và chưa cập nhật đầy đủ dữ liệu in khi attachment thay đổi. Upload tạo attachment ID mới, nên không cần xóa hàng loạt nội dung ảnh cũ chỉ vì thêm ảnh.

Chỉ thumbnail/ảnh hiển thị riêng tư dùng query cache. `AttachmentLink` và luồng mở/tải tệp của giám khảo vẫn gọi API trực tiếp; không bổ sung cache PDF minh chứng chỉ vì dùng chung `requestBlob`. Header `no-store` cho tệp riêng tư vẫn bảo vệ các endpoint này.

Không sửa schema, lưu trữ file, nội dung ảnh, API URL hoặc điều kiện cấp quyền hiện có. Không thêm thumbnail do server sinh, nén ảnh, prefetch hàng loạt hoặc giới hạn RAM bằng một cache tùy biến.

## Tiêu chí nghiệm thu khi triển khai

1. Mở cùng ảnh ở hai vị trí đồng thời: không tạo hai request Blob độc lập trong cùng phạm vi cache.
2. Chuyển trang rồi quay lại trong thời hạn cho phép: dùng lại ảnh; phân biệt số request với số byte ảnh tải qua mạng.
3. Tại mốc 299 giây từ lần query thành công: mở lại dùng cache. Từ mốc 300 giây: mở lại phải kiểm tra lại; không hiện Blob stale trong khi chờ. Kiểm tra thêm lỗi mạng, 401/403/404 và thao tác thử lại ở mốc này.
4. Đăng xuất/đổi tài khoản khi request đang chạy: response cũ không làm lộ ảnh trong phiên mới.
5. Xóa hoặc thay ảnh: giao diện không tiếp tục dùng cache cũ do thao tác của chính phiên đó.
6. F5 hoặc đóng/mở ứng dụng: ảnh riêng tư phải được tải lại; HTTP cache công khai có thể còn. Không hứa hỗ trợ offline; cache riêng tư còn fresh trong tab đang mở vẫn có thể được dùng lại.
7. Mở nhiều trang ảnh rồi rời đi: query inactive được dọn và object URL được thu hồi.
8. Ảnh riêng tư không được áp dụng nhầm chính sách cache công khai; kiểm tra cả trường hợp 401/403/404 và lỗi mạng.
9. Public: response thành công có header đã chốt; trong thời hạn kiểm tra số byte nhận qua mạng, sau thời hạn kiểm tra request mới và trường hợp bị thu hồi. Không bắt buộc `304` khi chưa có validator.
10. Private: hai mode admin/chủ hồ sơ không dùng chung cache; quyền khác nhau hoặc phiên khác nhau không dùng nhầm Blob. Link tải ảnh/tệp vẫn gọi API trực tiếp mỗi lần bấm, kể cả thumbnail đang có cache.

Kiểm thử nhỏ cần bổ sung khi triển khai: dùng QueryClient hiện có kiểm tra gộp request, mốc hết hạn và dọn cache sau xóa/đổi phiên; mở rộng kiểm tra API để xác nhận signal và header. Tái sử dụng `apps/web/test/session-contract.test.ts`, `apps/web/test/api-integration.check.mjs` và ma trận quyền tại `apps/be/test/admin-product-files.db-spec.ts`. Kiểm tra trình duyệt cho remount, URL cleanup và trang in; không tạo một hệ thống kiểm thử mới.

Chưa thực hiện các kiểm chứng ứng dụng này; đây là điều kiện nghiệm thu cho đợt triển khai riêng. Tài liệu hiện tại chỉ chốt thiết kế, không xác nhận hành vi ứng dụng đã thay đổi.

## Căn cứ kỹ thuật

- [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html): HTTP cache, freshness, cache riêng và cache chia sẻ.
- [TanStack Query: Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults): độ fresh và thời gian dọn query inactive.
- [TanStack Query: Query Functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions): giá trị trả về của query được lưu trong cache.
- [Nghiên cứu tại dự án](../../research/2026-10-26-image-caching.md): bằng chứng và các phương án đã đối chiếu.

Chưa tạo ADR vì chưa có quyết định khó đảo ngược. Chưa tạo glossary riêng cho các thuật ngữ kỹ thuật chung như Blob, TTL và HTTP cache; các thuật ngữ này được giải thích ngay trong thiết kế khi cần.
