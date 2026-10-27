# Cache ảnh frontend

Ngày khảo sát: 2026-10-26, Asia/Saigon. Phạm vi: đọc mã nguồn và tài liệu chính thức; chưa đo request hoặc header trên môi trường triển khai.

## Kết luận cho dự án

Có thể tránh tải lại ảnh khi chuyển trang. Đề xuất nhỏ nhất: dùng HTTP cache cho ảnh công khai; dùng TanStack Query đang có để giữ Blob ảnh riêng tư trong phiên. Chưa cần thư viện mới hoặc service worker. Đây là đề xuất, chưa thay đổi hành vi ứng dụng.

## Luồng hiện tại — bằng chứng từ mã nguồn

- Ảnh công khai dùng `<img src>` với URL theo product ID và attachment ID qua `publicAttachmentUrl`. Endpoint trả ảnh inline bằng `asDownload`. Helper này chỉ đặt type, length, disposition; không tìm thấy cấu hình `Cache-Control` trong backend source. Điều này không chứng minh proxy hoặc server triển khai không bổ sung header. Nguồn: [constants/api.ts](../../apps/web/src/constants/api.ts), [products.controller.ts](../../apps/be/src/controllers/products.controller.ts), [private-storage.ts](../../apps/be/src/utils/private-storage.ts).
- `PrivateAttachmentThumbnail` gọi API lấy Blob trong `useEffect` mỗi lần mount, tạo object URL và thu hồi URL khi cleanup. Nó chưa dùng query cache. Nguồn: [AttachmentLink.tsx](../../apps/web/src/pages/registrant/AttachmentLink.tsx).
- Query client hiện có `staleTime: 30000`, tắt refetch khi focus và xóa cache khi phạm vi phiên thay đổi. Có thể tái sử dụng cơ chế này cho Blob. Nguồn: [query-client.ts](../../apps/web/src/lib/query-client.ts).
- `getPublicAttachment` kiểm tra trạng thái sản phẩm mỗi request. Cache dài sẽ trì hoãn việc áp dụng thay đổi quyền hiển thị cho bản đã cache; đây là suy luận từ luồng kiểm tra và cơ chế HTTP cache. Nguồn: [products.service.ts](../../apps/be/src/services/products.service.ts), [RFC 9111 §4.2](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.2).

## Cơ chế và giới hạn

1. **HTTP cache:** response còn fresh có thể được dùng lại mà không hỏi server. Backend hoặc nơi phục vụ ảnh quyết định TTL bằng `Cache-Control`. `private` cho phép cache trình duyệt, cấm shared cache; không tự bảo đảm quyền truy cập. Không thể hứa tải đúng một lần vĩnh viễn: cache có thể bị loại bỏ. Nguồn: [RFC 9111 §4.2, §5.2.2.7, §5.3](https://www.rfc-editor.org/rfc/rfc9111.html).
2. **Ảnh không đổi theo URL:** `immutable` tránh revalidation khi còn fresh; force reload có thể bỏ qua. Chỉ dùng TTL dài khi mỗi phiên bản ảnh có URL riêng và chấp nhận thời gian giữ bản cũ. Nguồn: [RFC 8246 §2–3](https://www.rfc-editor.org/rfc/rfc8246.html), [MDN: cache busting](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching#cache_busting).
3. **TanStack Query:** cache giá trị `queryFn` trả về. Suy ra: JSON chứa URL không tự cache byte ảnh; muốn giữ ảnh riêng tư trong query cache, `queryFn` phải trả Blob. `staleTime` điều khiển độ fresh; `gcTime` điều khiển thời gian giữ query inactive. `Infinity` không tự lưu qua reload; persistence cần cơ chế riêng. Nguồn: [Query Functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient).
4. **Cache Storage:** lưu Request/Response lâu hơn phiên, dùng được cả ngoài service worker. Ứng dụng phải quản lý cập nhật và xóa; API không tuân theo HTTP cache header và vẫn có thể bị trình duyệt xóa. Nguồn: [MDN: Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache). Chỉ cân nhắc khi cần offline hoặc chủ động lưu qua reload.

## Đề xuất triển khai nếu được chọn

- Ảnh công khai: giữ URL ổn định; thêm HTTP TTL ngắn theo thời gian chấp nhận hiển thị ảnh đã thu hồi. Nếu cần kiểm tra quyền mỗi lần, dùng revalidation; có validator phù hợp thì `304` không tải lại body. Nguồn: [MDN: validation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching#validation).
- Ảnh riêng tư: chuyển luồng lấy Blob sang `useQuery`, dùng key theo phạm vi truy cập, sản phẩm và attachment. Đặt `staleTime` theo thời gian chấp nhận quyền cũ và `gcTime` hữu hạn để giới hạn giữ ảnh inactive. Tiếp tục tạo/thu hồi object URL theo vòng đời component; tái sử dụng việc xóa cache khi đổi phiên. Đây là thiết kế đề xuất dựa trên các nguồn và luồng hiện có ở trên.
- Kiểm chứng: so sánh số request và byte truyền khi mở lại cùng ảnh, reload, đổi ảnh và đổi phiên. Chưa thực hiện kiểm chứng trình duyệt hoặc kiểm tra header môi trường triển khai.
