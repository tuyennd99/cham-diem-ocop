# FE–BE API integration verification

Run date: 2026-10-17 (Asia/Saigon). The working tree was already dirty on `main` before implementation; existing edits were retained, and nothing was staged or committed.

## Environment

- Node `v24.18.0` and pnpm `11.17.0` meet the repository requirements.
- `DATABASE_URL` and `JWT_SECRET` are configured. SMTP settings and `TEST_DATABASE_URL` are missing. No environment values were copied into this report.
- `pnpm --filter @ocop/api prisma generate` passed.
- `pnpm --filter @ocop/api prisma migrate status` was attempted against the configured local OCOP development database and stopped with `spawn EPERM` while starting Prisma's schema engine. No migration, seed, reset, or test data write ran.

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| Vite proxy config | PASS | `pnpm --filter @ocop/web exec node test/proxy.check.mjs`; default, `.env.local`, and process override passed. |
| API client and file contract | PASS | `pnpm --filter @ocop/web exec node test/api-integration.check.mjs`; file allowlist/size boundaries, password 72-byte UTF-8 boundary, Vietnamese form formatting, envelope, HTTP 201, multipart, binary response, and 401 session behavior passed. |
| Web typecheck | PASS | `pnpm --filter @ocop/web typecheck`. |
| API typecheck | PASS | `pnpm --filter @ocop/api typecheck`. |
| Web production build | PASS | `pnpm --filter @ocop/web run build --configLoader native`. |
| API production build | PASS | `pnpm --filter @ocop/api build`. |
| API unit suite | PASS | `pnpm --filter @ocop/api test --runInBand`: 10 suites, 52 tests passed. |
| OpenAPI contract suite | PASS | `pnpm --filter @ocop/api test:db --runTestsByPath test/openapi.db-spec.ts`: 1 suite, 1 test passed. |
| Auth and scoring unit tests | PASS | Targeted run: 2 suites, 19 tests passed. Includes current-password error message, lazy MailService init, and 89.99-star boundary. |
| Database integration suites | BLOCKED | `TEST_DATABASE_URL` is missing. The test harness was not pointed at `DATABASE_URL`. |

The aggregate `pnpm typecheck` and `pnpm build` commands also hit `spawn EPERM` when pnpm launched workspace package processes. The package checks above ran separately and passed. The default Vite config bundler also hit this process restriction; the supported native config loader completed the web build and proxy check.

## Runtime acceptance

| Case group | Result | Reason |
|---|---|---|
| Registrant editor detail load, replace-form preservation, partial upload recovery, list retry/empty state, and duplicate-mutation blocking | BLOCKED | Requires an authenticated browser session and reachable API/database; no browser smoke was run. |
| OTP registration and password reset | BLOCKED | SMTP host, user, password, and sender are not configured. |
| Public category/product, admin assignment, judge scoring, and result publication | BLOCKED | The database migration status check could not start Prisma's schema engine; no migration or seed was run. |
| Reverse-proxy, persistent upload storage, and deployment behavior | BLOCKED | No preview/deployment environment was provided. |

No DB or browser acceptance is claimed. The code-level checks pass; complete the blocked runtime cases in an isolated, seeded OCOP test environment with working SMTP before calling the full journey accepted.
