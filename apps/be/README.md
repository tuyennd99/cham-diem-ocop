# OCOP API

NestJS API for OCOP registration, evaluation, assignment, and public product pages. The root [README](../../README.md) covers workspace setup and database operations.

The API runs at `http://localhost:3030/api`; Swagger is at `/docs`. Copy `.env.example` to `.env` and set PostgreSQL, a 32-byte JWT secret, SMTP credentials, CORS origins, and persistent `STORAGE_PATH`. Uploads are private by default and limited to 10 MiB per image or PDF.

The initial OCOP migration replaces the former task/report domain; use a dedicated OCOP database and back up any data that must be retained before applying the migration chain. Migration `0010_backend_stabilization` is an additive forward migration for the OCOP schema. The seed requires all 26 official scoring bundles and does not create demo users or products. To create the first administrator, set `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters and at most 72 UTF-8 bytes) in `.env` for the first seed, then remove both values.

Use `pnpm --filter @ocop/api dev` for development. Build with `pnpm --filter @ocop/api build`; `pnpm --filter @ocop/api start:prod` starts `dist/src/main.js`. Use root `pnpm dev` to run the web and API together. PostgreSQL integration tests run directly via local `DATABASE_URL` and isolate each run in a temporary schema; see [operations.md](docs/operations.md).
