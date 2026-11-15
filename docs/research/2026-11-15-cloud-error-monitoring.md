# Giám sát lỗi cloud và thông báo Telegram

Ngày khảo sát: 2026-11-15, Asia/Saigon. Đây là nghiên cứu dựa trên tài liệu chính thức và mã nguồn trong workspace; chưa kết nối máy chủ, triển khai, cấu hình bot hay gửi thông báo. Trạng thái thực tế trên production chưa được xác minh.

## Kết luận và hướng cân nhắc

Nên tách ba nhu cầu: **kiểm tra dịch vụ còn truy cập được**, **thu thập log máy chủ**, và **ghi nhận lỗi xảy ra trong trình duyệt**. Một màn hình terminal chỉ cho thấy output của tiến trình tương ứng; kiểm tra HTTP thành công cũng không chứng minh mọi chức năng và trình duyệt đều hoạt động. Có thể bắt đầu bằng giám sát HTTP độc lập có Telegram, sau đó bổ sung thu thập lỗi/log theo nơi đang triển khai. AI chỉ cần khi muốn tóm tắt hoặc hỗ trợ điều tra.

| Lựa chọn | Phù hợp và giới hạn | Nguồn |
| --- | --- | --- |
| Uptime Kuma | Tự vận hành; kiểm tra HTTP(S), TCP và một số loại khác, có thông báo Telegram. Phù hợp phát hiện ngừng hoạt động; tự nó không thu thập mọi lỗi JavaScript hoặc log ứng dụng. Cần máy giám sát chạy riêng và được duy trì. | [Kho Uptime Kuma](https://github.com/louislam/uptime-kuma) |
| Grafana + Loki/Alloy | Alloy thu thập log gửi tới Loki; Grafana Alerting đánh giá quy tắc, có gộp cảnh báo và tích hợp Telegram trực tiếp. Phù hợp khi cần theo dõi log terminal có cấu hình thu thập, đổi lại phải vận hành hoặc trả phí dịch vụ tương ứng. | [Alloy và Loki](https://grafana.com/docs/loki/latest/send-data/alloy/), [gom thông báo](https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/group-alert-notifications/), [Telegram](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-telegram/) |
| Sentry | Có SDK cho NestJS và React; gom sự kiện theo stack trace/exception/message và cấu hình cảnh báo. Cần tích hợp và kiểm thử từng nơi phát sinh lỗi. Tài liệu đã xem xác nhận webhook, **chưa xác nhận kênh Telegram trực tiếp**; có thể dùng một dịch vụ trung gian nhận webhook và gọi Telegram Bot API, nếu được triển khai và bảo vệ đúng cách. | [NestJS](https://docs.sentry.io/platforms/javascript/guides/nestjs/), [React](https://docs.sentry.io/platforms/javascript/guides/react/), [gom lỗi](https://docs.sentry.io/concepts/data-management/event-grouping/), [webhook](https://docs.sentry.io/integrations/integration-platform/webhooks/), [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage) |
| Công cụ cloud/PM2 hiện có | Trước tiên kiểm tra chức năng thu log, cảnh báo và chính sách lưu giữ của nơi triển khai thực tế. Nếu dùng PM2, nó quản lý log và có thể tự khởi động lại tiến trình khi thoát; điều này không thay thế kiểm tra từ bên ngoài hay tự bảo đảm cảnh báo Telegram. Chưa biết production có dùng PM2 hay không. | [Log PM2](https://pm2.keymetrics.io/docs/usage/log-management/), [khởi động lại](https://pm2.keymetrics.io/docs/usage/restart-strategies/) |
| Hermes/Codex | Nếu “Hermes” là [NousResearch Hermes Agent](https://github.com/NousResearch/hermes-agent), tài liệu mô tả lịch chạy và gửi kết quả đến Telegram; scheduler mặc định gắn với gateway nên gateway cũng cần được duy trì. Codex có thể chạy một tác vụ phân tích có giới hạn bằng `codex exec`; muốn kiểm tra liên tục cần cơ chế kích hoạt và kênh thông báo phù hợp. Chưa xác nhận Codex có tích hợp Telegram trực tiếp. Cả hai có thể hỗ trợ giải thích sự kiện, nhưng kết luận AI cần người kiểm tra. | [Lịch và Telegram của Hermes](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/guides/automate-with-cron.md), [Codex chạy tác vụ](https://developers.openai.com/blog/codex-as-a-platform) |

## Đối chiếu mã hiện tại

- Backend NestJS có `GET /api/system/health/live` để kiểm tra tiến trình, còn `/api/system/health/ready` thực hiện `SELECT 1` với PostgreSQL. Chúng không kiểm tra đầy đủ nghiệp vụ, SMTP hoặc thao tác trên trình duyệt; cần xác nhận URL và khả năng truy cập trên production. Nguồn: [health.controller.ts](../../apps/be/src/controllers/health.controller.ts), [health.service.ts](../../apps/be/src/services/health.service.ts), [cấu hình tiền tố API](../../apps/be/src/config/app.ts).
- Bộ lọc ngoại lệ toàn cục đang ghi metadata cho lỗi HTTP 5xx, gồm request ID, phương thức, đường dẫn, loại lỗi và có thể có mã lỗi; không ghi nội dung ngoại lệ hay stack trace ở đoạn đó. Vì vậy chỉ đọc log này có thể thiếu thông tin để xác định nguyên nhân. Sentry lưu ý exception đã bị bộ lọc bắt không được thu thập mặc định: nếu chọn Sentry cần tích hợp bộ lọc và kiểm thử có chọn lọc, tránh mặc định gửi dữ liệu nhạy cảm. Nguồn: [api-exception.filter.ts](../../apps/be/src/filters/api-exception.filter.ts), [Sentry: custom global filter](https://docs.sentry.io/platforms/javascript/guides/nestjs/#using-a-custom-global-filter).
- Web hiện có tiến trình SSR phía máy chủ và mã React trong trình duyệt; lỗi của từng nơi cần được thu thập ở nơi tương ứng. Trong handler SSR hiện tại, nhánh `catch` trả lỗi 500 mà không ghi log ở chính nhánh đó. Nguồn: [server.ts](../../apps/web/src/server.ts), [main.tsx](../../apps/web/src/main.tsx), [Sentry React](https://docs.sentry.io/platforms/javascript/guides/react/).

## Ví dụ theo dõi bằng Hermes

Khi đã có nơi lưu log và quyền đọc phù hợp, có thể cấu hình [Hermes chạy theo lịch và gửi kết quả về Telegram](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron/). Gateway phải tiếp tục hoạt động; tác vụ định kỳ dùng AI có thể phát sinh chi phí. Ví dụ yêu cầu cho một tác vụ mỗi 5 phút:

```text
Đọc các lỗi API mới trong 5 phút gần nhất từ nguồn log đã được cấp quyền.
Gộp lỗi trùng, mô tả ảnh hưởng, thông tin liên quan và nguyên nhân có thể;
đề xuất bước kiểm tra tiếp theo. Khi không đủ dữ liệu, hãy nói rõ.
Nếu không có lỗi mới, chỉ trả lời [SILENT].
Chỉ đọc thông tin cần thiết; không sửa ứng dụng, dữ liệu hay máy chủ.
Không đưa token, mật khẩu hoặc thông tin cá nhân vào thông báo.
```

Đây là ví dụ về yêu cầu, chưa phải cấu hình đã chạy. Nguồn log, quyền truy cập, việc xác định lỗi mới qua nhiều lần chạy và quyền đọc mã nguồn cần được thiết lập, kiểm thử theo môi trường thực tế. Hermes cũng hỗ trợ [nhận sự kiện qua webhook](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/webhooks/); cần xác minh phương thức xác thực tương thích khi kết nối dịch vụ cụ thể. Một thông báo độc lập từ hệ thống giám sát vẫn cần thiết nếu gateway, mô hình hoặc chính máy chủ ứng dụng ngừng hoạt động.

## Khi triển khai sau này

- Đặt bộ kiểm tra bên ngoài miền lỗi của ứng dụng nếu có thể; quy định chu kỳ, timeout và số lần lỗi liên tiếp trước khi báo, gửi thêm thông báo phục hồi. Theo dõi cả chính bộ giám sát và khả năng gửi thông báo: một tiến trình dừng, lịch không chạy hoặc Telegram lỗi đều có thể gây khoảng trống. Nên thử toàn bộ đường đi bằng lỗi/gián đoạn có kiểm soát.
- Gom hoặc giới hạn thông báo lặp, nhưng giữ tín hiệu cho lỗi mới hoặc tăng đột biến; lưu thời điểm, dịch vụ và request ID khi an toàn, kèm đường dẫn tới hệ thống điều tra thay vì gửi toàn bộ log. Xem [Grafana grouping](https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/group-alert-notifications/) và [lịch sử gửi thông báo](https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-notification-history/).
- Chỉ cấp quyền đọc cần thiết; giữ token bot trong kho bí mật, không ghi token, OTP, mật khẩu, nội dung request hoặc dữ liệu cá nhân vào thông báo/AI. Nếu dùng webhook Sentry, xác minh chữ ký trên nội dung gốc; coi log và đầu vào bên ngoài là dữ liệu không đáng tin, không để chúng ra lệnh cho agent. Nguồn: [lọc dữ liệu nhạy cảm của Sentry](https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/), [chữ ký webhook Sentry](https://docs.sentry.io/integrations/integration-platform/webhooks/), [an toàn khi dùng shell](https://developers.openai.com/api/docs/guides/tools-shell), [lưu ý bảo mật của dự án](../../apps/be/README.md).

## Cập nhật theo cách triển khai người dùng xác nhận

Người dùng xác nhận máy chủ cloud VNPT chạy Ubuntu và ứng dụng được khởi động trực tiếp bằng `pnpm dev`. Người dùng muốn agent kiểm tra sự kiện nghi là lỗi, thông báo qua Telegram, đồng thời nhận hội thoại và nhiệm vụ trực tiếp qua Telegram. Chưa xác định phiên bản Ubuntu, đường dẫn triển khai và cách duy trì tiến trình khi đóng terminal.

Trong workspace hiện tại, `dev` của web chạy Vite và `dev` của API chạy NestJS ở chế độ watch; đã có script build và chạy bản build cho từng ứng dụng. Khi vận hành cho người dùng thật, nên kiểm tra và chuyển sang các lệnh chạy bản build trước khi thiết lập service lâu dài. Đây là đề xuất vận hành, chưa thay đổi cách khởi động. Nguồn: [package web](../../apps/web/package.json), [package API](../../apps/be/package.json).

Nếu là máy chủ Linux dùng systemd, hướng tối giản là quản lý ứng dụng thành service, thu output bằng journal và cấu hình lưu log trên đĩa với giới hạn dung lượng/thời gian giữ phù hợp. Cấu hình service có thể khởi động lại tiến trình khi lỗi; cần xác nhận môi trường trước khi viết cấu hình. Nguồn: [systemd service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html), [journald storage và retention](https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html).

Sau đó một tác vụ đọc phần log mới, lưu mốc đã đọc và gom lỗi trùng có thể kích hoạt Hermes phân tích rồi gửi Telegram. Chỉ kích hoạt AI khi có sự kiện phù hợp sẽ giảm số lần gọi mô hình so với chạy AI ở mọi lần kiểm tra. Đây là đề xuất thiết kế, chưa có bộ thu log hay tác vụ nào được triển khai. Kiểm tra độc lập bên ngoài vẫn cần cho trường hợp cả máy chủ ngừng hoạt động.

Hermes có [hội thoại hai chiều qua Telegram](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram/). Để người dùng trả lời tiếp một báo cáo tự động mà agent còn ngữ cảnh, cần cấu hình đúng việc đưa báo cáo vào phiên hội thoại: [continuable cron jobs](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron/#continuable-jobs-reply-to-a-cron-delivery) đối với lịch chạy, hoặc `mirror_to_session: true` đối với [webhook](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/webhooks/#replying-to-a-delivery). Đây là tính năng phải bật, không mặc định có trong mọi cảnh báo. Chỉ cho phép Telegram user ID của người quản trị gọi bot; quyền đọc log và mã nguồn, chạy kiểm tra, sửa code hay thao tác máy chủ cần được cấp theo nhiệm vụ. Cảnh báo sự cố nghiêm trọng nên được gửi độc lập, không chờ AI kết luận.

## Chưa biết

Phiên bản Ubuntu, sản phẩm cloud VNPT cụ thể và đường dẫn triển khai; nơi/lượng log, thời gian lưu và quyền đọc; URL thực tế của web/API; ngân sách và mô hình AI sẽ dùng; dữ liệu nào được phép chia sẻ; mức độ khẩn, ngưỡng và người nhận cảnh báo; quyền được phép giao cho agent khi nhận nhiệm vụ. Các lựa chọn trên cần được xác nhận theo các điều kiện này trước khi cài đặt.
