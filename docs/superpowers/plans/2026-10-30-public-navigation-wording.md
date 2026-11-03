# Điều hướng đăng ký và cách gọi người đăng ký — Kế hoạch triển khai

> **Dành cho người thực hiện:** Dùng superpowers:executing-plans hoặc superpowers:subagent-driven-development để thực hiện từng nhiệm vụ sau khi phạm vi được phê duyệt.

**Mục tiêu:** Bỏ nút tạo tài khoản trên header và dùng cách gọi dễ hiểu trong giao diện, đồng thời giữ nguyên chức năng đăng ký và biểu mẫu chính thức.

**Cách thực hiện:** Sửa các nhãn trong giao diện hiện có theo nghĩa của từng trường. Giữ các đường dẫn, phân quyền và dữ liệu; kiểm tra các trạng thái đã đăng nhập, chưa đăng nhập và menu di động.

**Công nghệ:** React, TypeScript, TanStack Router, Vite.

**Đặc tả:** `docs/superpowers/specs/2026-10-30-public-navigation-wording.md` (phạm vi được người dùng xác nhận).

## Ràng buộc chung

- Chỉ bỏ nút tạo tài khoản khỏi header khi chưa đăng nhập; giữ các hành động dành cho phiên đã đăng nhập.
- Rà soát nội dung hiển thị thông thường có từ “chủ thể”; thay theo ngữ cảnh, không thay máy móc.
- Giữ nguyên thuật ngữ trong biểu mẫu OCOP chính thức và nội dung pháp lý trích dẫn.
- Giữ đường dẫn đăng ký, xác thực email và quyền tài khoản hiện có; không đổi API hay cơ sở dữ liệu.
- Không ghi đè các thay đổi sẵn có của người dùng; không dùng GitHub CLI.

## Phân chia tệp

- `apps/web/src/layouts/PublicLayout.tsx`: header máy tính và menu di động.
- `apps/web/src/pages/public/HomePage.tsx`, `PublicCatalogPage.tsx`: nội dung và đường dẫn đăng ký công khai.
- `apps/web/src/pages/auth/RegisterPage.tsx`, `LoginPage.tsx`, `VerifyOtpPage.tsx`: lời hướng dẫn tài khoản.
- `apps/web/src/layouts/AppLayout.tsx`, `apps/web/src/components/app-sidebar.tsx`, `user-info.tsx`, `apps/web/src/pages/account/AccountPage.tsx`, `apps/web/src/pages/registrant/MyProductsPage.tsx`, `MyProductDetailPage.tsx`: tên vai trò và khu vực làm việc.
- `apps/web/src/pages/admin/AdminUsersPage.tsx`, `UserEditorDialog.tsx`, `AdminProductsPage.tsx`, `AdminProductDetailPage.tsx`, `AdminReportsPage.tsx`, `apps/web/src/components/products/ProductDraftEditor.tsx`, `apps/web/src/queries/admin-products.ts`: nội dung quản trị tài khoản và hồ sơ.
- `apps/web/src/pages/judge/JudgeEvaluationPage.tsx`, `apps/web/src/lib/utils.ts`: nhãn thông tin đơn vị sản xuất hiển thị trong hồ sơ.
- `apps/web/src/components/print/OcopPrintSheets.tsx`: giữ nguyên biểu mẫu in chính thức.

### Task 1: Header và các đường dẫn đăng ký công khai

**Tệp:** `apps/web/src/layouts/PublicLayout.tsx`, `apps/web/src/pages/public/HomePage.tsx`, `apps/web/src/pages/public/PublicCatalogPage.tsx`.

**Đầu vào:** `useSession()` và `homeFor(...)` hiện có. **Đầu ra:** header không hiện nút đăng ký với khách; đường dẫn ngoài header vẫn dẫn tới `/register`.

- [x] Đọc lại diff của các tệp trước khi sửa. Trong `PublicLayout.tsx`, chỉ render `mobile-cta` và `header-cta` khi `signedIn`; giữ link, nội dung và `onClick` hiện có của nhánh đã đăng nhập. Giữ nút “Đăng nhập” trên cả hai bố cục.
- [x] Trong hai trang công khai, thay nhãn `Tạo tài khoản chủ thể` bằng `Tạo tài khoản`; giữ nguyên các biểu thức `to` và điều kiện hiển thị. Trên trang chủ, thay `Dành cho chủ thể OCOP` / `DÀNH CHO CHỦ THỂ` bằng `Dành cho người đăng ký OCOP` / `DÀNH CHO NGƯỜI ĐĂNG KÝ`; thay câu có `chủ thể và giám khảo` bằng `người đăng ký và giám khảo`, và `Chủ thể đăng ký nhập` bằng `Người đăng ký nhập`.
- [x] Kiểm tra khách trên desktop và điện thoại: thấy Đăng nhập, không có nút đăng ký trong header hoặc menu; trang chủ vẫn có nút Tạo tài khoản dẫn tới `/register`.
- [ ] Đăng nhập tài khoản mẫu và kiểm tra header vẫn mở khu vực làm việc theo vai trò (chưa xác minh do API cục bộ trả lỗi 500).

### Task 2: Nhãn tài khoản và thông tin hồ sơ

**Tệp:** Các tệp giao diện tài khoản, hồ sơ, quản trị, giám khảo và tiện ích được liệt kê ở phần phân chia tệp.

**Đầu vào:** Vai trò `REGISTRANT`, thông tin tài khoản và `entityName` hiện có. **Đầu ra:** lời hướng dẫn phân biệt người sở hữu tài khoản với đơn vị sản xuất; không đổi giá trị hay cấu trúc dữ liệu.

- [x] Với nhãn chỉ tài khoản `REGISTRANT`, thay `Chủ thể OCOP`, `Chủ thể sản xuất`, `Tài khoản chủ thể`, `Chủ thể đăng ký hồ sơ` và `Tài khoản chủ thể độc lập` bằng các cách gọi tương ứng `Người đăng ký`, `Tài khoản người đăng ký`, `Người đăng ký hồ sơ` và `Tài khoản người đăng ký độc lập`. Trong trang đăng nhập dùng `Người đăng ký (hợp tác xã, hộ kinh doanh, doanh nghiệp)`; trong trang đăng ký đổi `Tên chủ thể` thành `Tên người đăng ký hoặc đơn vị`.
- [x] Với hướng dẫn thao tác theo tài khoản, dùng `người đăng ký`: ví dụ `Chọn chủ thể đăng ký trước khi lưu` thành `Chọn người đăng ký trước khi lưu`, `Nộp hồ sơ thay chủ thể` thành `Nộp hồ sơ thay người đăng ký`, `Tìm chủ thể đã xác minh` thành `Tìm người đăng ký đã xác minh`. Áp dụng cùng nghĩa cho ô tìm kiếm, nhãn, placeholder, thông báo lỗi, trạng thái rỗng và nhãn truy cập tương ứng.
- [x] Với nhãn dữ liệu `entityName` và thông tin đơn vị sản xuất, dùng `Tên đơn vị sản xuất` hoặc `Thông tin đơn vị sản xuất`; không gọi dữ liệu đơn vị là tên tài khoản. Giữ các nhãn trong biểu mẫu in chính thức và nội dung trích dẫn pháp lý. Không đổi mã vai trò, tên trường, route hoặc điều kiện quyền.
- [x] Rà soát mọi kết quả `rg -n -i 'chủ thể' apps/web/src`: cả 8 kết quả còn lại đều nằm trong biểu mẫu in chính thức `OcopPrintSheets.tsx`.
- [x] Kiểm tra trang đăng ký, đăng nhập và xác thực OTP trên trình duyệt; các nhãn đã đổi hiển thị đúng.
- [ ] Kiểm tra trang tài khoản, hồ sơ, quản trị và giám khảo sau khi đăng nhập (chưa xác minh do API cục bộ trả lỗi 500 khi đăng nhập).

### Task 3: Kiểm tra cuối

**Tệp:** Không tạo tệp kiểm thử mới cho các thay đổi văn bản và thứ tự hiển thị đơn giản.

**Đầu vào:** Các thay đổi của hai nhiệm vụ trước. **Đầu ra:** kết quả kiểm tra hành vi và kiểu dữ liệu.

- [x] Chạy `pnpm --filter @ocop/web typecheck`; thành công (`tsc --noEmit`).
- [x] Chạy `pnpm --filter @ocop/web exec node test/router.check.mjs`; thành công, 35 URL và route `/register` hiện diện.
- [x] Xem diff và chạy `git diff --check`; không sửa biểu mẫu in, giữ nguyên thay đổi sidebar có sẵn của người dùng. Khách và các trang xác thực đã kiểm tra trên trình duyệt; các màn hình cần đăng nhập chưa thể kiểm tra do API cục bộ trả lỗi 500 (đã ghi nhận).
