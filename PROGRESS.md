# Progress

## 2026-11-20: Verify workspace and publish to main

Scope: commit the current OCOP API, web, tests and project documentation to
`origin/main`. Local configuration and scratch files are excluded.

- Fixed the red organization-units pagination baseline without changing the DB test.
  A JavaScript-safe offset above the DB limit returns an empty page and the filtered
  total. Unsafe offsets still return 400. All four focused pagination cases passed.
- With user approval, updated one detail-page SSR assertion to check the actual
  `/products` link, arrow SVG and label. The dedicated check and all nine web scripts passed.
- `pnpm typecheck`, `pnpm build`, backend lint, web formatting and staged diff checks passed.
- Backend unit tests: 28 suites, 227 passed. Web unit tests: 13 suites, 87 passed.
- `pnpm --filter @ocop/api test:db`: 18 suites, 177 passed in 1927.99 s.
- Built API smoke check: liveness and readiness both returned HTTP 200. Swagger pages
  returned 404 in production mode. The built web server passed its startup check.
- Independent review covered session cache isolation, auth, migration 0022, transaction
  lock ordering and the pagination fix. No push blockers were found.

Outside this verification: production deployment and applying migration `0022` to
production. The pre-existing Google profile completion flow after unmount remains
outside this change.

## 2026-11-20: Chuyển trang tra cứu sang lưới sản phẩm

Objective: replace the `/products` single-column result list with a responsive marketplace-style product grid.

Scope: product card layout, image sizing, card information hierarchy, and loading skeleton layout. Keep existing filters, image preview, product detail links, ratings, pagination, and empty/error states working.

Excluded: API/data changes, detail-page changes, and unrelated routes. Completion requires web/API type checks, formatting/diff checks, and desktop plus narrow viewport visual review.

Status: complete.

Verified:
- Direct TypeScript checks passed in `apps/web` and `apps/be`.
- Prettier check passed for the catalog page and stylesheet; `git diff --check` passed.
- agent-desktop review at 1467px and 546px browser widths confirmed four-column desktop cards, a single-column narrow layout, and preserved product imagery/fallbacks and card details.

Not verified:
- Automated UI tests were not run.

## 2026-11-20: Follow-up visual corrections for public product pages

Objective: complete the approved `/products` image fallback and card hierarchy work, fix search control alignment, and improve the public product detail header.

Scope: public catalog fallback for missing/failed images; compact card layout, readable secondary facts, and a single title link; 36px desktop lookup controls with 44px touch targets; larger back icon and public record code/date on detail pages.

Excluded: API/data model changes and changes to unrelated routes. Completion requires web and API TypeScript checks plus desktop and narrow viewport visual review.

Status: complete.

Verified:
- `node node_modules/typescript/bin/tsc --noEmit` passed in `apps/web` and `apps/be`.
- Prettier check passed for the two public product pages and `styles.css`; `git diff --check` passed.
- agent-desktop review at desktop and narrow widths confirmed aligned lookup controls, touch-sized fields/buttons, image fallbacks, grouped product facts, and no horizontal scrolling.

Not verified:
- The repository `pnpm typecheck` wrapper failed with `Error: spawn EPERM` when pnpm tried to launch child processes; the same web/API TypeScript checks passed by invoking each installed compiler directly.
- Automated UI tests were not run.

## 2026-11-20: Tickets #58, #52, #53, #54, #55, #56, #57

Scope: Implemented Tickets #58 -> #52 -> #53 -> #54 -> #55 -> #56 -> #57 sequentially in minimal diffs while preserving existing workspace changes (no git commits, pushes, GitHub comments, or issue closures performed).

### Per-ticket summary & touched files

1. **#58 — Cache tệp riêng tư**
   - Files: `apps/web/src/lib/session-contract.ts` (`getSessionScope`), `apps/web/src/lib/query-client.ts`, `apps/web/src/lib/private-attachment-cache.ts`, `apps/web/src/pages/registrant/AttachmentLink.tsx`, `apps/web/src/components/image-preview-dialog.tsx`, `apps/web/src/pages/judge/JudgeEvaluationPage.tsx`, `apps/web/test/private-attachment-cache.test.ts`.
   - Independent review (`c3122a9c-3011-448a-8dbd-5fa2a294d2b2`): PASS; added `!sessionScope` unauthenticated-unmount guard and rotated-token cache invalidation assertion afterward, then re-verified.
2. **#52 — Sắp xếp danh sách quản trị**
   - Files: `apps/be/src/prisma/order-by.ts` (`resolveOrderBy`, `OrderByBuilder`), `apps/be/src/repositories/admin-users.repository.ts`, `apps/be/src/repositories/admin-catalogs.repository.ts`, `apps/be/src/repositories/admin-sorting.spec.ts`, `apps/be/test/admin-users.db-spec.ts`, `apps/be/test/admin-catalogs.db-spec.ts`.
   - Verified default order, lone `sortDirection` preservation, tie-breakers across two pages, and shared `listLocalities` across `/admin/localities` and `/localities`.
3. **#53 — Làm phẳng xử lý backend**
   - Files: `apps/be/src/filters/api-exception.filter.ts` (`PRISMA_ERROR_RESPONSES`, `extractHttpExceptionMessage`, `resolveErrorResponse`), `apps/be/src/utils/product-files.ts` (`matchesDetectedMime`), `apps/be/src/utils/reporting.ts` (`resolveProductStatusAtAsOf`, `WAITING_REPORT_STATUSES`, `OPEN_BACKLOG_STATUSES`), `apps/be/src/utils/product-files.spec.ts`, `apps/be/src/utils/reporting.spec.ts`.
4. **#54 — Refactor frontend**
   - Files: `apps/web/src/lib/session-contract.ts` (`LEGACY_ROLE_PERMISSIONS`, `resolveStaffPermissions`), `apps/web/src/lib/private-attachment-cache.ts` (`async/await`), `apps/web/src/api/base-request.ts` (`async/await` Blob error parse), `apps/web/src/components/google-sign-in.tsx` (`async/await` + stale/duplicate callback guard), `apps/web/src/queries/admin-users.ts` (`async/await`), `apps/web/src/lib/judge-criteria-groups.ts` (`groupJudgeCriteria`), `apps/web/src/pages/judge/JudgeEvaluationPage.tsx`, `apps/web/src/pages/admin/AdminProductDetailPage.tsx` (`ADMIN_MODAL_DIALOG_CONFIG`, `getOwnerPendingResultMessage`), `apps/web/test/session-contract.test.ts`, `apps/web/test/judge-criteria-groups.test.ts`.
5. **#55 — Sắp xếp các danh sách nghiệp vụ**
   - Files: `apps/be/src/repositories/products.repository.ts`, `apps/be/src/repositories/admin/admin-products.repository.ts`, `apps/be/src/repositories/admin/admin-scoring.repository.ts` (also fixed pre-existing broken SQL join `criteria_sets` / `criteria.setId` in `sortBy=scope`), `apps/be/src/repositories/evaluations.repository.ts` (`JUDGE_QUEUE_SQL_ORDER_BY` + `JUDGE_QUEUE_PRISMA_ORDER_BY`), `apps/be/src/repositories/business-sorting.spec.ts`, `apps/be/test/admin-products.db-spec.ts`, `apps/be/test/admin-scoring-print.db-spec.ts`, `apps/be/test/evaluation.db-spec.ts`.
6. **#56 — Đổi `.then()` sang `async/await`**
   - Files: `apps/be/src/repositories/products.repository.ts` (`listCategories`, `findPublicById`, `findMine`), `apps/be/src/repositories/admin/admin-products.repository.ts` (`findAdminAttachments`, `productResults`), `apps/be/src/repositories/products.repository.spec.ts`.
7. **#57 — Refactor transaction**
   - Files: `apps/be/src/repositories/products.repository.ts` (`lockAndLoadSubmitProduct`, `writeManagerProductAudit`), `apps/be/src/repositories/evaluations.repository.ts` (`lockAndLoadAssignedEvaluationContext`, `assertEditableEvaluationVersion`, `assertDraftScoresInScope`), `apps/be/src/repositories/admin/admin-assignments.repository.ts` (`assertNoSubmittedScopeChange`, `recomputeAffectedOpenProducts`), `apps/be/src/repositories/admin-catalogs.repository.ts` (`assertCategoryReadyForActivation`, `resolveCategoryAgencySync`, `replaceCategoryAgencies`), `apps/be/src/repositories/admin/admin-analytics.repository.ts` (`buildReportingProductWhere`, `isCategoryCoveredNow`).
   - Independent review (`d300a173-a596-46fd-84e9-394aec936866`): PASS with 0 findings; verified lock ordering, transaction scope, `RepeatableRead` isolation, same `tx` usage, Multer storage contract, `lint:check`, `typecheck`, `build`, 28/28 unit suites (227 passed), and `assignment.db-spec.ts` + `evaluation.db-spec.ts` (19/19 passed).

### Verified after final edits

- Web (`@ocop/web`, after final FE edit in #54):
  - `pnpm --filter @ocop/web format:check`: PASS (`All matched files use Prettier code style!`).
  - `pnpm --filter @ocop/web typecheck` & `pnpm --filter @ocop/web build`: PASS (client + SSR Vite build).
  - `node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test apps/web/test/*.test.ts scripts/dev-cloud.test.mjs`: 13 suites, 87 passed, 0 failed.
  - All 9 check scripts under `apps/web/test/*.check.mjs`: 9/9 PASS.
- Backend (`@ocop/api`, after final BE edit in #57):
  - `pnpm --filter @ocop/api run lint:check`: PASS (0 errors, 0 warnings).
  - `pnpm --filter @ocop/api typecheck`: PASS.
  - `pnpm --filter @ocop/api build`: PASS.
  - `pnpm --filter @ocop/api test -- --runInBand`: 28 suites, 227 passed.
  - `pnpm --filter @ocop/api test:db`: 17 suites passed, 1 failed (`176 passed, 1 failed, 177 total`, `1917.952 s`).

### Pre-existing baseline failure / Out-of-scope note

- `apps/be/test/admin-users.db-spec.ts:239` (`H4 organization units › accepts a safe offset at the page number boundary`) fails with HTTP `400` instead of `200` on `?page=9007199254740991&limit=1` because the pre-existing uncommitted `computePaginationSkip` guard in `apps/be/src/dtos/common.dto.ts` intentionally rejects `skip > 2_147_483_647` (`MAX_DB_INT4`) with `400`. Left untouched per test-modification rules (awaiting user confirmation to update that test's expectation).

## 2026-11-20: Codebase optimization and remediation (Gói 0 -> Gói C)

Scope: Executed `docs/superpowers/specs/2026-11-18-codebase-optimization-and-remediation-spec.md` across Gói 0, Gói A, Gói B, and Gói C (backend query/locking/validation hardening, strict TypeScript + ESLint 0-warning cleanup, optimistic evaluation versioning, `GET /api/my/products` pagination, FE `useAppForm` + `sessionStorage` draft recovery + focus/density normalization, and post-review fixes). User-approved resolutions applied for `MAX_FILE_BYTES = 10 MiB` (`apps/be/src/utils/private-storage.ts`, `apps/be/src/utils/product-files.ts`), empty-evaluation submit guard (`Score at least one assigned subcriterion before submitting`), and keeping partial subcriterion submission allowed (`evaluations.repository.spec.ts:180`, `assignment.db-spec.ts:816`).

### Verified after final edits

- `pnpm --filter @ocop/api format` + `pnpm --filter @ocop/api run lint:check`: 0 errors, 0 warnings.
- `pnpm --filter @ocop/api typecheck` (`strict: true`): exited 0.
- `pnpm --filter @ocop/api build` (`nest build --tsc`): exited 0.
- `pnpm --filter @ocop/api test -- --runInBand`: 26 suites, 217 passed (includes `computePaginationSkip` INT4 overflow unit test in `apps/be/src/dtos/update-validation.spec.ts`).
- `pnpm --filter @ocop/web format:check`: `All matched files use Prettier code style!`
- `pnpm --filter @ocop/web typecheck` & `pnpm --filter @ocop/web build` (`vite build` + `vite build --ssr`): exited 0.
- `node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test apps/web/test/*.test.ts scripts/dev-cloud.test.mjs`: 11 suites, 82 passed, 0 failed.
- All 9 FE check scripts under `apps/web/test/*.check.mjs` (`api-boundary`, `api-integration`, `built-server`, `catalog-ssr`, `home-ssr`, `product-detail-ssr`, `proxy`, `router`, `seo-integration`): 9/9 PASS.
- Production BE smoke probe (`NODE_ENV=production PORT=31309 node dist/src/main.js` from `apps/be`): `/api/system/health/live` -> HTTP 200, `/api/system/health/ready` -> HTTP 200, `/docs` -> 404, `/docs-json` -> 404 (process stopped cleanly).

### Verified prior to the 4 post-review fixes (`computePaginationSkip` & `JudgeEvaluationPage.tsx`)

- Full `pnpm --filter @ocop/api test:db -- --runInBand`: 18 suites, 172 passed (`1911.919 s`).
- Independent code & security review (`1ae74964-0590-48bf-b2f7-27bee61b2689`): passed lint/typecheck/216 unit tests and surfaced 4 issues (`JudgeEvaluationPage` background refetch sync, removed-criteria pruning on `sessionStorage` draft restore, empty-note `isDirty` reset, and PostgreSQL `INT4` `skip`/`OFFSET` overflow across remaining paginated endpoints), all 4 fixed afterward.
- Live desktop UI checks via `agent-desktop` (`w-7284546`, `w-3347276`): verified `2px` combobox focus ring & menu on `/judge`, density sizing (`45px` interactive controls on `/my/products` vs `36-37px` on `/judge`), and `sessionStorage` draft persistence across browser reload on `/judge/products/seed-product-08`.

### Not verified / Notes

- `test:db` and the live Chrome UI inspection were not re-run after the final `computePaginationSkip` helper extraction and the 3 `JudgeEvaluationPage.tsx` state-sync/pruning fixes.
- Local dev DB migration `0022_query_optimization_indexes` has not yet been applied to `chamdiemocop_dev` (dev runtime / schema deploy should run `prisma migrate deploy`).

## 2026-11-15: Commit and push current workspace

Scope: commit all project changes and push the current `main` branch to
`origin/main`. Exclude `.scratch/`, which contains temporary browser profiles
and local verification artifacts. No production deployment or production
database migration is included.

Completion criteria: successful build, type checks, runnable startup checks,
relevant automated checks, independent review of sensitive changes, and remote
confirmation of the resulting commit. Record checks that remain incomplete.

### Baseline fixes

- Fixed the built SSR server's default client directory and prevented static
  access to its server bundle. Added `built-server.check.mjs`; it reproduced
  the original asset 404 before the fix and passes after the fix.
- Ran the existing web formatter to resolve the failing formatting baseline.
- With explicit user approval, updated stale session-role fixtures, file count
  and size expectations, auth export expectations, homepage login expectations,
  and the route count for `/my/settings`. Corrected the inactive SCORE assertion.
- Removed extra trailing blank lines reported by `git diff --check`.

### Verified

- `pnpm typecheck`: both workspace apps completed successfully.
- `pnpm build`: both workspace apps completed successfully, including web SSR.
- `pnpm --filter @ocop/web format:check`: `All matched files use Prettier code style!`
- `pnpm --filter @ocop/api test --runInBand`: independent reviewer ran it after
  the fixes; `26 suites, 200 tests passed`.
- `node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test apps/web/test/*.test.ts scripts/dev-cloud.test.mjs`:
  `77 tests passed, 0 failed`.
- `node apps/web/test/api-boundary.check.mjs`, `api-integration.check.mjs`,
  `router.check.mjs`, `proxy.check.mjs`, `home-ssr.check.mjs`,
  `catalog-ssr.check.mjs`, `product-detail-ssr.check.mjs`, and
  `seo-integration.check.mjs` (all under `apps/web/test/`): PASS.
- `node apps/web/test/built-server.check.mjs`: PASS. Independent reviewer also
  confirmed JS/CSS HTTP 200 and blocked `/server/*` variants.
- `pnpm --filter @ocop/api test:db --runTestsByPath test/product-code.db-spec.ts --testNamePattern 'migrates legacy products' --verbose`:
  `1 passed, 1 skipped` (the other test was outside the selected name).
- `pnpm --filter @ocop/api test:db --runTestsByPath test/registration-units.db-spec.ts --verbose`:
  `2 passed` in 46.162 seconds, using an isolated schema.
- `pnpm --filter @ocop/api start:prod` with `PORT=31303`: application started;
  `GET /api/system/health/live` returned HTTP 200 with `data.status: ok`.
  Stopped the temporary startup process afterward.
- Independent review covered authentication/OTP, permissions, migrations
  0019–0021, public result filtering, and SSR. Confirmed SSR blocker was fixed.

### Not verified

- Full `pnpm --filter @ocop/api test:db` run was interrupted after several
  minutes without a completed suite report. The focused DB checks above passed;
  the entire database suite still needs a completed run.
- Production migration, live Google/SMTP, and desktop/mobile visual checks
  were not performed. No release-readiness claim is made.

Next step: complete the full database suite before a production release.
