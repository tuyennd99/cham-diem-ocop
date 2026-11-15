# Đặc tả: SEO sản phẩm OCOP với TanStack Start

## Problem Statement

Người tìm kiếm cần tìm thấy danh sách sản phẩm OCOP và từng sản phẩm đã được Chủ trì duyệt trên Google. Website hiện trả HTML ban đầu với nội dung chung; danh sách và chi tiết sản phẩm được tải sau khi JavaScript chạy. Phân trang danh sách dùng trạng thái trong trình duyệt, nên công cụ tìm kiếm khó theo các trang tiếp theo. API công khai hiện cũng bao gồm hồ sơ đã nộp nhưng chưa duyệt.

Chỉ sản phẩm đã được duyệt mới được đưa vào phạm vi lập chỉ mục. Việc được duyệt hồ sơ không đồng nghĩa kết quả chấm điểm đã được công bố.

## Solution

Tích hợp TanStack Start vào ứng dụng frontend hiện tại, tận dụng Vite và hệ thống route TanStack đang có; giữ backend NestJS. Không tạo frontend riêng hoặc dùng Next.js. Dựng HTML trên máy chủ cho trang chủ, danh sách và chi tiết sản phẩm; ban đầu giữ các luồng đăng nhập, Người dùng, Giám khảo và Quản trị chạy phía trình duyệt. Trang có thể lập chỉ mục có nội dung, metadata, URL chuẩn và liên kết phân trang ngay trong HTML ban đầu. Sitemap chỉ chứa URL sản phẩm đủ điều kiện.

Áp dụng một quy tắc đủ điều kiện dùng chung cho danh sách công khai có thể lập chỉ mục, chi tiết sản phẩm và sitemap. Các hồ sơ chưa đủ điều kiện không xuất hiện trong nội dung HTML có thể lập chỉ mục; trang chi tiết hiện đang công khai của hồ sơ đã nộp nhưng chưa duyệt vẫn truy cập trực tiếp được, song trả `noindex`. Không thay đổi quyền truy cập hoặc nghiệp vụ chấm điểm chỉ để làm SEO.

## User Stories

1. Là người tìm kiếm, tôi muốn tìm thấy danh sách sản phẩm OCOP, để duyệt các sản phẩm đã được duyệt.
2. Là người tìm kiếm, tôi muốn tìm thấy trang chi tiết của từng sản phẩm đã được duyệt, để xem thông tin công khai.
3. Là người tìm kiếm, tôi muốn đọc tên, mô tả, nhóm sản phẩm và ảnh công khai, để biết sản phẩm phù hợp với nhu cầu của mình.
4. Là người tìm kiếm, tôi muốn các trang danh sách tiếp theo có URL riêng, để có thể xem và chia sẻ từng trang.
5. Là người tìm kiếm, tôi muốn tiêu đề và mô tả phản ánh đúng sản phẩm, để nhận biết kết quả phù hợp.
6. Là người tìm kiếm, tôi muốn liên kết sản phẩm tiếp tục hoạt động sau chuyển đổi frontend, để không mất đường dẫn đã lưu.
7. Là Người dùng, tôi muốn sản phẩm của mình chỉ có thể được lập chỉ mục sau khi được Chủ trì duyệt, để hồ sơ chưa được duyệt không xuất hiện trên Google.
8. Là Người dùng, tôi muốn sản phẩm tiếp tục có thể lập chỉ mục khi đã duyệt và chuyển sang chấm điểm hoặc hoàn tất, để trang không biến mất chỉ vì tiến trình đánh giá tiếp tục.
9. Là Người dùng, tôi muốn trang của sản phẩm không còn đủ điều kiện ngừng được đề xuất lập chỉ mục, để thông tin cũ không tiếp tục được khuyến khích hiển thị.
10. Là Người dùng, tôi muốn hồ sơ đã nộp chưa duyệt vẫn dùng được theo quyền truy cập hiện tại, để SEO không làm thay đổi quy trình đăng ký.
11. Là Chủ trì, tôi muốn thông tin công khai tuân theo trạng thái duyệt thực tế, để sản phẩm chưa duyệt không được đưa vào nội dung có thể lập chỉ mục.
12. Là Chủ trì, tôi muốn điểm và xếp sao chỉ xuất hiện theo quy tắc công bố kết quả hiện có, để không lộ kết quả chưa công bố.
13. Là Giám khảo, tôi muốn tiếp tục đăng nhập và chấm điểm như trước, để việc bổ sung SEO không cản trở công việc.
14. Là Quản trị, tôi muốn các luồng quản trị và phân quyền vẫn hoạt động, để không phải thay đổi cách vận hành hệ thống.
15. Là Quản trị, tôi muốn sitemap chỉ chứa sản phẩm đủ điều kiện, để cung cấp danh sách URL đáng tin cậy cho công cụ tìm kiếm.
16. Là Quản trị, tôi muốn thay đổi trạng thái duyệt được phản ánh trong HTML và sitemap, để không tiếp tục quảng bá nội dung không đủ điều kiện.
17. Là người chia sẻ, tôi muốn liên kết sản phẩm đủ điều kiện có thông tin xem trước phù hợp, để người nhận nhận biết sản phẩm.
18. Là người vận hành, tôi muốn lỗi API hoặc môi trường triển khai được nhận biết rõ, để không nhầm lỗi tạm thời với sản phẩm không tồn tại.
19. Là người vận hành, tôi muốn xác minh HTML ban đầu, sitemap, phân trang và trạng thái HTTP, để kiểm tra trước khi đưa thay đổi vào sử dụng.
20. Là người vận hành, tôi muốn các request SSR không dùng chung cache riêng tư giữa người dùng, để tránh lộ dữ liệu.

## Implementation Decisions

### Điều kiện được lập chỉ mục

- Chỉ hồ sơ có `approvedAt` khác null **và** trạng thái hiện tại là `APPROVED`, `SCORING` hoặc `COMPLETED` mới đủ điều kiện. Điều kiện là giao của bằng chứng duyệt và trạng thái hiện tại, không dựa vào trạng thái đơn lẻ: luồng chấm điểm hiện có thể đưa hồ sơ từ `SUBMITTED` sang `SCORING` mà không ghi nhận duyệt.
- `DRAFT`, `SUBMITTED`, `RETURNED`, hồ sơ không tồn tại và hồ sơ thiếu `approvedAt` không đủ điều kiện, kể cả khi một số hồ sơ cũ có trạng thái chấm điểm hoặc hoàn tất. Không tự suy luận hoặc tự bổ sung lịch sử duyệt cho dữ liệu cũ; xử lý dữ liệu lịch sử bằng một quyết định riêng dựa trên bằng chứng nghiệp vụ.
- Điều kiện này không yêu cầu `publicationState` là `PUBLISHED`: duyệt hồ sơ và công bố kết quả là hai việc khác nhau. Chỉ hiển thị điểm, xếp sao và các trường kết quả theo quy tắc công bố kết quả hiện hành; không tạo đánh giá khách hàng từ điểm OCOP.
- Backend là nguồn xác định điều kiện; cung cấp cách lấy danh sách sản phẩm đủ điều kiện và tín hiệu an toàn cho chi tiết. Dùng cùng một quy tắc cho trang chủ, danh sách, các biến thể lọc/tìm kiếm, chi tiết và sitemap. Không đưa hồ sơ chưa đủ điều kiện vào HTML của trang có thể lập chỉ mục, kể cả tên trong danh sách hoặc liên kết sản phẩm.
- Giữ hợp đồng API công khai hiện có cho các luồng khác. Nếu cần bộ lọc hoặc điểm truy cập chỉ phục vụ SEO, bổ sung theo hướng tương thích ngược; không thay đổi quyền truy cập dữ liệu riêng tư. Người dùng thông thường và bot nhận cùng nội dung cho cùng URL, không tách nội dung theo user-agent.
- Chi tiết hồ sơ `SUBMITTED` hiện truy cập công khai vẫn trả nội dung theo chính sách hiện tại nhưng có `noindex` trong HTML/HTTP và không nằm trong sitemap. Hồ sơ không còn công khai hoặc không tồn tại trả `404`. Nội dung từng được Google lập chỉ mục có thể tồn tại đến lần thu thập lại; `noindex` không thay thế xác thực hay cam kết xóa tức thì.

### Dựng trang và dữ liệu

- Dùng TanStack Start trong cùng ứng dụng frontend hiện tại, tiếp tục sử dụng Vite, TanStack Router và backend NestJS; không xây dựng frontend thứ hai. Route công khai và các route cha cần thiết được SSR; các route xác thực và khu vực công việc dùng chế độ phía trình duyệt ban đầu. Không đặt cấu hình tắt SSR ở route cha làm vô hiệu hóa SSR của route công khai.
- Tái sử dụng API NestJS, component React và quy tắc công bố hiện có. Route loader tải dữ liệu cần cho trang chủ, danh sách và chi tiết trước khi trả HTML; chuyển dữ liệu ban đầu sang client để tránh sai lệch hydration và tải lại không cần thiết.
- Mỗi request SSR có router và QueryClient riêng. Không dùng session hay cache riêng tư cấp tiến trình. Những thành phần phụ thuộc `window`, `localStorage` hoặc session trong header phải có trạng thái server/client tương thích; không đưa token, session hoặc dữ liệu người dùng khác vào HTML công khai.
- Request từ server tới backend phải dùng địa chỉ tuyệt đối phù hợp môi trường và chỉ gọi API công khai; không giả định đường dẫn tương đối của trình duyệt hoạt động trong runtime server. Tái sử dụng việc chuẩn hóa lỗi và hợp đồng API khi phù hợp.
- API mất kết nối hoặc trả lỗi tạm thời không được chuyển thành `404`, trang trống thành công hoặc sitemap rỗng thành công. Trang trả trạng thái lỗi server phù hợp; sitemap thất bại rõ ràng và có thể thử lại.

### SEO và URL

- Giữ đường dẫn sản phẩm hiện tại theo ID. Trang chủ, danh sách và trang chi tiết đủ điều kiện có title, meta description và canonical tuyệt đối phù hợp. Chi tiết sản phẩm dùng tên, mô tả và ảnh công khai thực tế; có fallback an toàn khi thiếu mô tả hoặc ảnh. Escape dữ liệu khi đưa vào HTML và XML.
- Cung cấp Open Graph cho trang chi tiết đủ điều kiện bằng thông tin công khai; ảnh có URL tuyệt đối và truy cập công khai. Không hứa bot mạng xã hội tuân theo `noindex`.
- Danh sách có URL riêng cho từng trang, liên kết HTML tuần tự và canonical tương ứng cho mỗi trang. Trang đầu dùng một URL nhất quán; không canonical mọi trang phân trang về trang đầu. Tìm kiếm và lọc vẫn hoạt động, nhưng biến thể tìm kiếm/lọc không cần lập chỉ mục trong phạm vi này.
- Sitemap có trang chủ, danh sách và đầy đủ URL sản phẩm đủ điều kiện; không đưa URL hồ sơ đã nộp chưa duyệt, trang riêng tư hoặc biến thể tìm kiếm. Cơ chế lấy dữ liệu phải đi qua tất cả các trang dữ liệu, tránh chỉ lấy trang đầu hoặc tạo URL trùng. Sitemap phản ánh sản phẩm mới được duyệt và loại URL không còn đủ điều kiện.
- Cung cấp `robots.txt` dẫn tới sitemap, không chặn crawler đọc các trang cần nhận `noindex`; chỉ thị này không phải cơ chế bảo vệ dữ liệu. Các trang yêu cầu đăng nhập vẫn được bảo vệ bằng xác thực và phân quyền ở backend.
- Để đảm bảo thay đổi duyệt và công bố phản ánh ngay ở nguồn, khởi đầu không cache chung HTML chi tiết, danh sách hoặc sitemap; chỉ thêm cache khi có cơ chế vô hiệu hóa tin cậy và kiểm thử trạng thái. Ảnh công khai có thể dùng chính sách cache hiện tại nếu không làm lộ nội dung đã bị thu hồi.

### Phát hành

- Trước khi triển khai, kiểm tra môi trường có runtime hỗ trợ TanStack Start SSR, cấu hình hostname công khai, kết nối backend và reverse proxy. Nếu chỉ có hosting tĩnh, phải chuẩn bị runtime SSR trước khi phát hành; không âm thầm thay SSR bằng SPA shell.
- Phát hành theo thứ tự: chuyển nền và kiểm tra các route hiện tại; bật SSR cho công khai; thêm quy tắc duyệt, sitemap và metadata; kiểm tra trên môi trường chạy thật; sau đó gửi sitemap tới Search Console bởi người có quyền. Duy trì đường quay lại bản frontend trước nếu kiểm thử thất bại.

## Testing Decisions

- Kiểm thử hành vi qua HTTP của frontend và API là seam chính: kiểm tra status, headers, HTML ban đầu, canonical, metadata, liên kết và sitemap; tránh kiểm thử chi tiết nội bộ của component.
- Dùng dữ liệu kiểm thử có hồ sơ chưa duyệt, đã duyệt, đang chấm sau duyệt, đã hoàn tất sau duyệt, hồ sơ đang chấm nhưng thiếu dấu vết duyệt, hồ sơ trả lại và ID không tồn tại. Kiểm tra cùng một quy tắc trên trang chủ, mọi trang danh sách, chi tiết và sitemap.
- Kiểm tra `SUBMITTED` truy cập trực tiếp trả `noindex`, không có trong HTML các trang có thể index hoặc sitemap; không biến nó thành `404` nếu vẫn thuộc phạm vi xem công khai hiện tại. Kiểm tra trạng thái duyệt thay đổi được phản ánh ngay trong danh sách, chi tiết và sitemap.
- Kiểm tra dữ liệu nhiều hơn một trang: URL trang 2, liên kết HTML thật, canonical riêng, đầy đủ ID đủ điều kiện, không trùng và không rò ID chưa duyệt. Test mô tả chứa ký tự đặc biệt, sản phẩm thiếu ảnh và thiếu mô tả.
- Kiểm tra kết quả chưa công bố không xuất hiện trong HTML, metadata hoặc dữ liệu cấu trúc; kết quả đã công bố tuân theo API hiện có. Kiểm tra hai request/phiên đồng thời không lẫn session hoặc cache; đăng nhập, đăng xuất, guard và các luồng quản trị/chấm điểm hiện tại không hồi quy.
- Kiểm tra API lỗi, dữ liệu không tồn tại, refresh trực tiếp URL, hydration, điều hướng và nút quay lại. Dùng các kiểm thử API cơ sở dữ liệu, route và tích hợp frontend hiện có làm tiền lệ; không kết luận Search Console hay crawler thực tế đã kiểm chứng chỉ dựa vào test nội bộ.
- Trên môi trường triển khai, xem HTML gốc, kiểm tra URL bằng Search Console, xem trước chia sẻ, kiểm tra sitemap và theo dõi index sau phát hành. Không cam kết thời điểm Google lập chỉ mục hoặc thứ hạng.

## Out of Scope

- Chuyển sang Next.js; thay NestJS hoặc viết lại toàn bộ frontend.
- Thay đổi quy trình duyệt, chấm điểm, công bố kết quả hoặc quyền xem hồ sơ hiện tại.
- Tự sửa dữ liệu duyệt lịch sử, thêm slug hoặc thay URL sản phẩm hiện tại.
- Tự tạo đánh giá khách hàng, giá bán, dữ liệu cấu trúc chưa có căn cứ, bài viết SEO hoặc công cụ phân tích mới.
- Mặc định dùng cache, dịch vụ prerender theo user-agent hoặc phụ thuộc hạ tầng mới ngoài runtime SSR cần thiết.

## Further Notes

- Đặc tả này là thiết kế để xem xét; chưa có thay đổi triển khai hoặc phát hành. Không bắt đầu triển khai trước khi người dùng duyệt thiết kế.
- Điều kiện đã duyệt ở trên là cách ánh xạ thận trọng từ yêu cầu nghiệp vụ sang dữ liệu hiện có. Hồ sơ cũ thiếu `approvedAt` bị loại khỏi chỉ mục cho tới khi có bằng chứng và quyết định xử lý riêng.
- Tham khảo: [TanStack Start: selective SSR](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr), [TanStack Router: Query SSR](https://tanstack.com/router/latest/docs/integrations/query), [Google: JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [Google: phân trang](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading), [Google: noindex](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
