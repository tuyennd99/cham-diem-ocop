# OCOP monorepo

The workspace contains the NestJS API (`apps/be`), the existing React/Vite web app (`apps/web`), and shared TypeScript contracts (`packages/shared`). It uses pnpm workspaces and Node.js 24.

## Run locally

```sh
pnpm install
pnpm dev
```

The web app is available at `http://localhost:5173`; the API is `http://localhost:3030/api`. Copy `apps/be/.env.example` to `apps/be/.env`, then set `DATABASE_URL`, `JWT_SECRET` (at least 32 bytes), SMTP credentials, allowed CORS origins, and `STORAGE_PATH`. Registration and password reset need a working SMTP account.

Run a single app with `pnpm --filter @ocop/web dev` or `pnpm --filter @ocop/api dev`. Root `pnpm build` and `pnpm typecheck` cover both workspace apps.

## Database setup

The API migration replaces the former task/report domain and drops those tables and their data, as approved for this project. Do not apply it to a database that contains data you need. For a new OCOP database:

```sh
pnpm --filter @ocop/api prisma generate
pnpm --filter @ocop/api prisma:migrate:deploy
pnpm --filter @ocop/api seed
```

The seed loads six broad categories, 26 product types, and the matching official score bundles. It stops before writing if any scoring bundle is missing or does not total 100. It does not create sample accounts or products. To bootstrap the first administrator, set `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters and at most 72 UTF-8 bytes) in `apps/be/.env` before seeding, then remove both values. The password is hashed with bcrypt.

Product image and evidence files are stored on disk under `STORAGE_PATH`; mount it on persistent storage and include it in backups. Public pages can read approved product images; evidence PDFs and other files require an authorized account.

## Source history

The original API and web Git histories are retained as ancestors of the monorepo import and under `refs/archive/api/*` and `refs/archive/web/*`. Local Git metadata is also preserved in `.git/legacy-repos/` and is not transferred by a normal clone. The OCOP design spec is [2026-10-12-ocop-scoring-system-design.md](2026-10-12-ocop-scoring-system-design.md).

The current FE/BE API integration specification is [docs/superpowers/specs/2026-10-15-fe-be-api-integration.md](docs/superpowers/specs/2026-10-15-fe-be-api-integration.md).

The specification for the seven admin modules is [docs/superpowers/specs/2026-10-17-admin-modules-spec.md](docs/superpowers/specs/2026-10-17-admin-modules-spec.md).

The frontend uses a shared Axios transport and OCOP domain request functions in `apps/web/src/api/`; shared endpoints and values live in `apps/web/src/constants/`. Pages and query hooks consume domain functions instead of issuing HTTP requests directly. See the [frontend API and constants convention](apps/web/README.md#frontend-api-and-constants-convention).
