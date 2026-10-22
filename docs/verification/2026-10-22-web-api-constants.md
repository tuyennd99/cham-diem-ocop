# Web API and constants migration verification

Run date: 2026-10-22, 11:41 Asia/Saigon. Automated checks ran against the current working tree.

## Automated checks

| Check | Command | Result | Run time |
|---|---|---|---|
| API boundary | `pnpm --filter @ocop/web exec node test/api-boundary.check.mjs` | PASS — `src` callers do not import the transport or assemble API endpoints; legacy client/sample files are absent. | 11:41 Asia/Saigon |
| API integration contract | `pnpm --filter @ocop/web exec node test/api-integration.check.mjs` | PASS — file validation, JSON envelope/meta, HTTP 201, multipart, Blob/error Blob, password and session rules. | 11:41 Asia/Saigon |
| Development proxy | `pnpm --filter @ocop/web exec node test/proxy.check.mjs` | PASS — default target, env-file value and process override. | 11:41 Asia/Saigon |
| Typecheck | `pnpm --filter @ocop/web typecheck` | PASS. | 11:41 Asia/Saigon |
| Production build | `pnpm --filter @ocop/web run build --configLoader native` | PASS — Vite 8.3.4 built 316 modules. | 11:41 Asia/Saigon |
| Whitespace check | `git diff --check` | PASS — no whitespace errors; Git printed existing LF/CRLF conversion warnings. | 11:43 Asia/Saigon |

The plan's direct command `pnpm --filter @ocop/web exec vite build --configLoader native` failed because `pnpm exec` did not put Vite on PATH (`vite` was not recognized). Running the package build script and invoking Vite through `node node_modules/vite/bin/vite.js` both succeeded.

The SSR integration harness initially failed during dependency resolution. Its setup now uses Vite's `ssr.optimizeDeps.include` for React, React DOM, Zustand, TanStack Query and Axios; the final integration-contract run passes. The earlier harness startup failure is recorded as a runner issue, not counted as a contract result.

## Browser smoke checks

Status: **BLOCKED — not run.** No approved backend/test account and safe test dataset were identified for this run. OTP delivery, product submission and assignment changes can create real side effects, so no email, real submission, database migration or seed was attempted. Automated contract tests do not substitute for these browser checks.

| Flow | Status | Required browser observation |
|---|---|---|
| Catalog/search/pagination and public images | BLOCKED | Encoded query parameters; pagination metadata and page size 20; homepage limit 6. |
| Login, OTP, forgot/reset password | BLOCKED | Correct request payloads/messages; no refresh call; OTP only in an approved test environment. |
| Existing session reload | BLOCKED | Reuses `ocop-session`; creates no sample `auth_*` keys. |
| Wrong current password / expired session | BLOCKED | Wrong-password 401 preserves the session/form; a later session 401 clears state and returns to login. |
| Draft create/edit and two-file upload | BLOCKED | Browser-generated multipart boundary; one `file` per request; partial failure does not duplicate attachments. |
| Private attachment download | BLOCKED | Bearer authorization; successful Blob download; 401/403 body shown as an error, not downloaded as a file. |
| Judge save/submit | BLOCKED | PUT save precedes POST submit; failed save prevents submission; notes and read-only state remain intact. |
| Admin judges/assignments | BLOCKED | Correct CRUD methods; replacement confirmation and cache invalidation remain intact. |

## Scope note

The workspace contained independent uncommitted backend and frontend page-split work. It was preserved. This report covers the web API/constants migration and its automated checks; it does not certify backend integration or browser behavior.
