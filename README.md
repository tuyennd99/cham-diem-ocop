# Công an Task API

Backend NestJS/PostgreSQL cho hệ thống giao nhiệm vụ và theo dõi báo cáo.

## Yêu cầu

- Node.js 24
- pnpm
- PostgreSQL 18

## Chạy local

```powershell
Copy-Item .env.example .env
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy
$env:SEED_ADMIN_PASSWORD = '<mật-khẩu-tạm-mạnh>'
pnpm prisma db seed
pnpm start:dev
```

Prisma 7 tạo client vào `src/generated/prisma` (thư mục này không commit).
Chạy lại `pnpm prisma generate` sau khi cài dependency hoặc đổi schema.
Seed chỉ chạy khi gọi rõ `pnpm prisma db seed`.

Backend mặc định chạy tại `http://localhost:3030/api/v1`. Frontend nhánh `dev`
chạy cổng `3000`.

`DATABASE_URL` phải dùng tài khoản PostgreSQL riêng của ứng dụng. Không dùng
superuser trong production. Sau lần đăng nhập đầu tiên, đổi ngay mật khẩu tài
khoản seed `admin`.

## Kiểm thử

Cluster test tách riêng nằm trong `BE/.postgres-test` và chỉ nghe
`127.0.0.1:5433`; script không thay đổi PostgreSQL service cổng `5432`.

```powershell
pnpm test:db:setup
$env:TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:5433/congan_task_test?schema=public'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:SEED_ADMIN_PASSWORD = 'Test-only-password-123!'
pnpm prisma migrate deploy
pnpm prisma db seed
pnpm test
pnpm test:e2e
pnpm test:db
pnpm test:db:teardown
```

Nếu phần mềm đồng bộ/antivirus khóa file database trong workspace, có thể đặt
`PG_TEST_DATA_DIR` tới một thư mục tạm riêng trước khi chạy cả setup và teardown,
ví dụ `C:\tmp\congan-pg-test`.

Quality gate đầy đủ:

```powershell
pnpm prisma validate
pnpm prisma generate
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:db
pnpm build
```

## Production

- Chỉ public HTTPS cổng `443` qua reverse proxy; không public `3030` hoặc
  PostgreSQL `5432`.
- Đặt `JWT_SECRET` và `CSRF_SECRET` khác nhau, ngẫu nhiên, tối thiểu 32 byte.
- Đặt `STORAGE_PATH` trên persistent volume riêng; không static-serve thư mục
  này.
- Backup database và file private theo cùng một mốc khôi phục; định kỳ kiểm tra
  restore.
- Đồng bộ NTP, cấu hình timezone máy chủ và cập nhật hệ điều hành/Node/PostgreSQL
  theo quy trình vận hành.

Xem thêm [hướng dẫn vận hành](docs/operations.md).
