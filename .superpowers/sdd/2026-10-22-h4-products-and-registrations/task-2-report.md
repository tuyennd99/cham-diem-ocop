# H4-C2: Admin product search, detail, and private files

Date: 2026-10-23 (Asia/Saigon).

## Scope and result

Implemented Task C2 only in the managed H4 worktree, on the approved C1 baseline. C3 screens and browser acceptance remain outside this task.

- Added admin product list filters for text, group/category, registrant, locality, status, registration type, assessment year, date range, stars, and sort. The count and page rows use the same ProductWhereInput within a RepeatableRead transaction. Paging has a stable ID tie-breaker and nullable score/date values sort last. Date ranges are half-open.
- Added a stable allowlisted list/detail response. VIEW cannot see drafts; list includes only IMAGE attachment metadata and never embeds evaluation rows. Detail includes attachment metadata, status history, creator, registrant, and the C1 registration snapshot. Form data is projected through an allowlist.
- Added private admin attachment metadata and binary read routes plus MANAGE-only upload/delete. VIEW can read submitted evidence; drafts, image binaries for VIEW, mismatched product/attachment IDs, and unauthorized callers are hidden or rejected. Public image/evidence behavior remains unchanged.
- Reused private storage, MIME/extension/magic-byte, path, and 10 MiB checks. Product-row locks serialize attachment changes with submission and preserve the 20-file cap. Failed uploads clean up stored files; cleanup errors are logged without replacing the original request error. MANAGE file changes write metadata-only audits.
- Added shared and web response types; removed the old evaluation-count field from the admin product list UI.
- Added database regressions for filters/count/paging/privacy and file permissions, validation, cleanup, cap, and upload/submit races. Updated staff access regression and the isolated OpenAPI contract.

## Verification

| Check | Result |
|---|---|
| API unit tests | Passed: 17 suites, 104 tests. |
| API typecheck | Passed. |
| API build | Passed; generated output remained under this worktree. |
| OpenAPI contract | Passed: 1 suite, 1 test. It instantiates mocked controllers and does not connect to PostgreSQL. |
| Web typecheck | Passed. |
| Web production build | Passed. |
| Prisma schema validation | Passed with a process-local placeholder DATABASE_URL; no database connection. |
| Targeted Prettier | Passed for clean-baseline C2 controller/DTO/spec files and the changed web files. Legacy API source/spec files that remain unformatted were already not Prettier-clean at C1 HEAD; they were not mass-reformatted. |
| git diff --check | Passed; Git emitted only normal LF/CRLF normalization notices. |
| PostgreSQL regression specs | Added and typechecked, not run under the C2 execution constraint. No DB authentication attempt, environment edit, database/schema creation, or public-schema write was made. |

The database behavior, including attachment serialization and filter semantics against PostgreSQL, remains unverified until the isolated DB regressions can be run. See the central H4 verification report for the accumulated workstream record.

## Independent review follow-up: multipart validation cleanup

Fixed the C2 P2 orphan-file case. In the installed Nest request pipeline, guards run before interceptors; the route interceptor array is nested in order; `FileInterceptor` awaits Multer's disk write before calling `next.handle()`; and the terminal handler applies parameter pipes before invoking the controller. Therefore a missing or invalid multipart `reason` fails validation after the file exists but before `ProductsService` can clean it up.

Added an outer `CleanupRejectedUploadInterceptor` around `FileInterceptor`. On a downstream error it removes only a UUID-keyed file whose resolved path exactly matches the configured private-storage root, logs cleanup failures, and rethrows the original validation/service error. The existing `ValidationPipe` remains responsible for required reason validation, transformation, whitelist, and unknown-field rejection. The service's rejection cleanup remains safe because missing files are ignored.

Added a DB regression for a valid file with a missing reason, an empty reason, and an unknown multipart field. Each case asserts HTTP 400, no Attachment/audit writes, and an empty upload directory. Also added focused interceptor unit coverage for cleanup/error identity and path mismatch protection.

| Follow-up check | Result |
|---|---|
| Focused interceptor unit test | Passed: 1 suite, 2 tests. |
| Isolated OpenAPI contract | Passed: 1 suite, 1 test; uses mocked providers and does not connect to PostgreSQL. |
| API typecheck | Passed. |
| API build | Passed. |
| Prettier | Passed for the new interceptor, its unit spec, controller, and DB regression. The pre-existing `private-storage.ts` contains legacy formatting outside this change; the added helper is formatted. |
| `git diff --check` | Passed; Git emitted only normal LF/CRLF normalization notices. |
| Multipart DB regression | Added but not run, per the no-DB-execution constraint. |

No database tests, authentication retries, environment edits, database/schema creation, or public-schema writes were performed.
