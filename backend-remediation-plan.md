# Kế hoạch sửa lỗi & chuẩn hóa Backend (`@ocop/api`)

## Goal
Khắc phục các vấn đề bảo mật, phân lớp, cấu hình TypeScript/ESLint và đồng bộ tài liệu/test DB dùng trực tiếp `DATABASE_URL` cho `apps/be`.

## Tasks
- [x] **Task 1 (DB Test & Docs):** Bỏ `TEST_DATABASE_URL`, dùng trực tiếp `DATABASE_URL` (cô lập bằng schema `ocop_test_<uuid>`) trong `apps/be/test/support/db-app.ts`, `apps/be/test/backend.db-spec.ts` và cập nhật `apps/be/README.md`, `apps/be/docs/backend-architecture.md`, `apps/be/docs/operations.md` (kèm 2 quy tắc nghiệp vụ đã chốt) → Verify: `pnpm --filter @ocop/api test:db -- test/backend.db-spec.ts -t "test database safety"` pass.
- [x] **Task 2 (Giới hạn Upload - H1):** Thêm `MAX_ATTACHMENTS_PER_PRODUCT = 20` vào `apps/be/src/constants/products.ts`, chặn vượt ngưỡng trong `ProductsRepository.addAttachment` và thêm `@Throttle({ default: { limit: 20, ttl: 60_000 } })` tại `MyProductsController.upload` → Verify: Unit test upload vượt 20 file trả `409 Conflict`.
- [x] **Task 3 (Error Filter & Request ID - M2, M4):** Chuẩn hóa `requestMeta` + header `X-Request-Id` dùng chung cho `AdminController` và `ApiExceptionFilter`; map lỗi Prisma `P2000` (400), `P2002` (409), `P2025` (404) tại `apps/be/src/filters/api-exception.filter.ts` → Verify: `pnpm --filter @ocop/api test -- api-exception.filter.spec.ts` pass.
- [ ] **Task 4 (Auth & OTP Hardening - M3, M5):** Thêm cooldown 60s theo `(email, purpose)` trong `AuthRepository.saveOtp`; cho phép `AuthService.register` gửi lại OTP khi tài khoản `REGISTRANT` đã tạo nhưng chưa verify → Verify: `pnpm --filter @ocop/api test -- auth.service.spec.ts` pass.
- [ ] **Task 5 (Swagger, DI & Dọn code thừa - M6, L1, L4, L6–L9, L15):** Bỏ CDN `customJs`/`customCssUrl` ở `src/config/app.ts`, inject `Reflector` vào `ApiResponseInterceptor`, xoá `@AdminOnly` và dependency `lodash`, tái sử dụng type từ `@ocop/shared` trong `src/types/api.ts` → Verify: `pnpm --filter @ocop/api test -- --runInBand` pass.
- [ ] **Task 6 (Tách Pure Domain Logic khỏi Repository - H2):** Tách hàm kiểm tra form nộp sản phẩm và hàm kiểm tra độ phủ/diff phân công sang `apps/be/src/utils/` để repository chỉ giữ transaction/lock và gọi hàm thuần → Verify: Unit test cho hàm thuần và `admin.repository.spec.ts` pass.
- [ ] **Task 7 (Strict TypeScript & ESLint - H3, M1):** Bật `"strict": true` trong `apps/be/tsconfig.json`, sửa lỗi null/type, chạy `eslint --fix` và thêm script `"lint:check": "eslint \"src/**/*.ts\""` vào `apps/be/package.json` → Verify: `pnpm --filter @ocop/api typecheck` và `pnpm --filter @ocop/api run lint:check` trả `0` lỗi.
- [ ] **Task 8 (Verification cuối):** Chạy toàn bộ kiểm tra tĩnh, build, unit test và integration test DB → Verify: `pnpm --filter @ocop/api typecheck && pnpm --filter @ocop/api run lint:check && pnpm --filter @ocop/api build && pnpm --filter @ocop/api test -- --runInBand && pnpm --filter @ocop/api test:db` đều pass.

## Done When
- [ ] `typecheck`, `lint:check` (0 error, 0 warning), `build`, `test`, `test:db` (dùng trực tiếp `DATABASE_URL`) đều xanh.
- [ ] Không còn phụ thuộc `TEST_DATABASE_URL` trong code và tài liệu.
- [ ] Upload có trần số file, Prisma error được map chuẩn HTTP, `tsconfig.json` bật `strict`.

## Notes
- Giữ nguyên 2 hành vi nghiệp vụ đã xác nhận: (1) sản phẩm `SUBMITTED`/`SCORING` hiển thị công khai dù chưa có điểm, (2) nộp hồ sơ không bắt buộc có file ảnh/minh chứng.
- Không tách `AppModule` thành nhiều feature module ở đợt này (YAGNI).
