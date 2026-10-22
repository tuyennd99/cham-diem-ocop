# FE–BE API integration verification

Run date: 2026-10-22 (Asia/Saigon). The working tree already contained changes before this verification; they were retained, and nothing was staged or committed.

## Environment

- Node `v24.18.0` and pnpm `11.17.0` meet the repository requirements.
- The configured local OCOP development database is reachable. DB integration tests used random isolated schemas in that database because `TEST_DATABASE_URL` is not configured; they did not write to `public`.
- SMTP is not configured. DB tests mock mail delivery, so live OTP email flows were not exercised.
- No environment values were copied into this report.
- `pnpm --filter @ocop/api prisma generate` passed.

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
| Database integration suites | PASS | `pnpm --filter @ocop/api test:db`: 6 suites, 36 tests passed, including auth, backend, evaluation, assignment, seed, and OpenAPI. Isolated schemas were removed after the run. |
| Git whitespace check | PASS | `git diff --check`: 0 errors. |

The aggregate `pnpm typecheck` and `pnpm build` commands previously hit `spawn EPERM` when pnpm launched workspace package processes. The package checks above ran separately and passed. The default Vite config bundler also hit this process restriction; the supported native config loader completed the web build and proxy check.

## Runtime acceptance

| Case group | Result | Evidence / limit |
|---|---|---|
| Public home/category data and admin sign-in/overview | PASS | Browser smoke loaded the public home with 26 category options, signed into a temporary admin in the isolated schema, and loaded the admin overview and empty product queue. |
| Registrant editor, registration, and upload flows | BLOCKED | No product or registrant records were seeded for this browser smoke; these flows were not exercised. |
| OTP registration and password reset | BLOCKED | SMTP is not configured; only mocked-mail DB tests ran. |
| Admin assignment, judge scoring, and result publication | BLOCKED | The browser smoke schema had no product or judge records; these flows were not exercised. |
| Reverse proxy, persistent upload storage, and deployment behavior | BLOCKED | No preview/deployment environment was provided. |

The temporary browser-smoke schema and DB-test schemas were dropped. A post-run check found the `public` reference counts unchanged: 26 categories, 26 criteria sets, 291 criteria, 787 subcriteria, and 2,553 score options. Public operational tables remained empty.

Hạng mục 2 is complete against its stated acceptance criteria: all 6 DB suites passed and the browser smoke passed for the public home/category view and admin sign-in/overview. The untested runtime groups above remain blocked and are not claimed as accepted.
