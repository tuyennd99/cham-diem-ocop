# OCOP API

NestJS API for OCOP registration, evaluation, assignment, and public product pages. The root [README](../../README.md) covers workspace setup and database operations.

The API runs at `http://localhost:3030/api`; Swagger is at `/docs`. Copy `.env.example` to `.env` and set PostgreSQL, a 32-byte JWT secret, SMTP credentials, CORS origins, and persistent `STORAGE_PATH`. Uploads are private by default and limited to 10 MiB per image or PDF.

The initial OCOP migration replaces the former task/report domain; use a dedicated OCOP database and back up any data that must be retained before applying the migration chain. Migration `0010_backend_stabilization` is an additive forward migration for the OCOP schema. The seed requires all 26 official scoring bundles and does not create demo users or products. To create the first administrator, set `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters and at most 72 UTF-8 bytes) in `.env` for the first seed, then remove both values.

Use `pnpm --filter @ocop/api dev` for development. Build with `pnpm --filter @ocop/api build`; `pnpm --filter @ocop/api start:prod` starts `dist/src/main.js`. Use root `pnpm dev` to run the web and API together. PostgreSQL integration tests run directly via local `DATABASE_URL` and isolate each run in a temporary schema; see [operations.md](docs/operations.md).

## Authentication rollout and live verification

Google configuration is optional. Create a Google OAuth **Web application** client, configure consent/test users, and register exact Authorized JavaScript origins: `http://localhost:5173` locally and each actual HTTPS production frontend origin. Scheme, hostname and port must match; do not add URL paths or assume `127.0.0.1` equals `localhost`. Configure the same origins in `CORS_ORIGINS`. `GOOGLE_CLIENT_ID` on the API and build-time `VITE_GOOGLE_CLIENT_ID` on the web **must be identical**; use the public client ID, never a client secret. Empty IDs disable Google while preserving password login. Restart API and rebuild web after configuration changes. Production uses HTTPS.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` from the provider's instructions. The current mail transport uses implicit TLS for port 465 and the provider's STARTTLS settings on port 587. Confirm permitted ports, SMTP authentication/app-password requirements and sender authorization with the provider; these settings are not universal. Keep real passwords out of examples, source control and logs. The development `smtp.example.com` placeholder skips delivery, so it cannot validate OTP receipt.

Deployment is an operator action; this task does not authorize or execute production migrations:

1. Inventory **all users with `verified=false`**, including locked accounts, their roles and Google identity state. Review owned/created products, judge assignments, evaluations/scores, OTPs and audit history with administrators. Migration [`0015_pending_auth`](prisma/migrations/0015_pending_auth/migration.sql) includes a read-only starting query for legacy REGISTRANT accounts; extend the inventory for other roles and relations. Do not delete, bulk activate or automatically convert old accounts.
2. Back up the database and persistent `STORAGE_PATH`, verify restoration, and rehearse the committed migration chain against a restored copy. Check row counts, relations, pending-registration behavior and existing password login before rollout. `0015_pending_auth` and `0016_google_identity` are additive; keep migration history intact. Do not rerun the initial destructive domain migration on an existing populated database.
3. After approval of that rehearsal, the operator applies outstanding migrations using `pnpm --filter @ocop/api prisma:migrate:deploy`, then deploys API and web together. The changed verify/resend contracts make a mixed old-web/new-API deployment unsafe. Keep the backup and a tested restore procedure available; rolling back application files alone does not undo schema/data changes.
4. Route existing unverified users to the web's explicit legacy recovery screen. It sends `{ email, code }` to `POST /api/auth/legacy-registration/verify` and `{ email }` to `POST /api/auth/legacy-registration/resend`. Only active eligible accounts can activate; locked accounts require administrator review. Retain these transition endpoints until the inventory is resolved and administrators approve retirement.

For new email/Google registration, keep the opaque `registrationToken` from the initial response. `POST /api/auth/registration-status` and `/api/auth/resend-otp` take `{ registrationToken }`; `/api/auth/verify-otp` takes `{ registrationToken, code }`. Google link verification/resend use `/api/auth/google/link/verify` and `/api/auth/google/link/resend` with those token bodies. Google requests require JSON and an allowed `Origin`. Tokens, credentials and codes must stay out of URLs/logs. Reset remains `POST /api/auth/reset-password` with `{ email, code, newPassword }`; successful reset revokes earlier access tokens.

Monitor mail failures (5xx/request IDs), OTP mismatches/expiry and exhausted attempts, resend throttling (429), and Google configuration/origin failures. Pending sessions last 15 minutes; OTPs last at most five minutes, allow five incorrect attempts, and resends have a 60-second cooldown plus endpoint rate limits. Use server timing fields in the UI. Failed requests must not be described as successful delivery; help users check spam, wait for the resend time, restart expired registrations, or contact administrators for locked accounts. Do not log codes, password hashes, Google credentials or full pending tokens while investigating.

Operators must clean expired pending sessions **at least daily**, and check the expired-row count before and after cleanup. Alert/investigate if the count keeps growing or the daily cleanup fails. Run the following against the intended application schema during the normal maintenance procedure; record counts and duration, never snapshot contents:

```sql
SELECT COUNT(*) AS expired_pending_sessions FROM "pending_auth" WHERE "expiresAt" <= NOW();
DELETE FROM "pending_auth" WHERE "expiresAt" <= NOW();
SELECT COUNT(*) AS expired_pending_sessions FROM "pending_auth" WHERE "expiresAt" <= NOW();
```

This deletes **only expired pending sessions**, including abandoned registration snapshots containing email, name, phone and password hashes. It does not touch users, user relations, future-expiry sessions or live credentials. The API rejects expired sessions even before cleanup. Resending does not reset failed attempts; the fifth wrong code locks that session, requiring a new registration or a fresh Google login/link flow. This is an operator procedure, with no application scheduler added or production cleanup executed by this change.

Before calling a release live-validated, an operator with authorized test Google accounts and mailboxes must run these checks on the configured deployment:

- Register by email, receive the actual OTP, verify, sign in and call `/api/auth/me`; repeat verification must fail. Wrong/expired codes and abandoned/failed registration must create no user.
- Register a new Google account, confirm profile, receive mailbox OTP, verify, and sign in again. Confirm profile identity cannot be overridden and no second account is created.
- Sign in with Google for an existing third-party-email account, receive the link OTP, complete linking, then sign in again to the same user and permissions. Check an existing authoritative Gmail/Workspace identity too.
- Try a locked account, duplicate email/Google registration and forgotten password; confirm no bypass or duplicate user. Receive reset mail, set the new password, and confirm a pre-reset token is rejected.
- Confirm actual inbox delivery (including sender and expiry text), script loading, Google popup completion/cancel/retry, and deployed CSP/COOP compatibility in supported browsers. Review Google GIS guidance against the actual serving headers; do not weaken policy speculatively.

Automated checks (from repository root):

```sh
pnpm --filter @ocop/api test:db
pnpm --filter @ocop/api test -- --runInBand
pnpm typecheck
pnpm build
node apps/web/test/api-integration.check.mjs
node apps/web/test/router.check.mjs
```

Supply `DATABASE_URL` only for the local test process. The database harness creates/drops random isolated schemas and may read public seed rows; never point it at a production database. The OpenAPI regression reads built API output, so rebuild the API before running it from a clean checkout. Tests use actual local PostgreSQL with Google identity and mail boundaries mocked; they do not establish real Google login, SMTP delivery or deployed browser-header compatibility. Missing operator credentials leave those release checks outstanding.
