# H5 scoring forms and 4 A4 print layouts verification

Date: 2026-10-24
Branch / Worktree: `codex/h4-admin-modules` (`C:\Users\lllll\.codex\worktrees\h4-admin-modules\chamdiemocop`)
Plan: `docs/superpowers/plans/2026-10-24-h5-scoring-forms-and-print.md`

## Scope completed

1. **Product Catalog & Localities UI (`/admin/product-groups` — H4-B3 handoff)**:
   - Tree navigation across product groups, server-paginated category table, read-only criteria preview, and **In mẫu trắng** link.
   - `CategoryEditorDialog` and `LocalitiesPanel` with audit reason and active/effective-range controls for `MANAGE` users; read-only for `VIEW`.
2. **Scoring Forms Administration (`/admin/scoring-forms`)**:
   - **Bộ phiếu (26 mẫu)** tab (`GET /api/admin/criteria-sets`, `GET /api/admin/criteria-sets/:id`): searches and previews all 26 official criteria sets (`maxScore = 100`), restricts `SCORE`-only accounts to their assigned sets, and links to blank A4 print preview and `/admin/assignments`.
   - **Phiếu chấm thực tế** tab (`GET /api/admin/evaluations`): filters by keyword, product, group, judge, and status; displays judge unit at submission, partial vs full assignment scope, and links to individual and summary A4 print views.
3. **5 Protected Print-Data Endpoints & 4 A4 Print Layouts (`@media print`)**:
   - Blank Criteria Form (`GET /api/admin/criteria-sets/:id/print-data` → `/print/criteria-sets/:id`)
   - Individual Evaluation Sheet (`GET /api/admin/evaluations/:id/print-data` & `GET /api/judge/products/:id/evaluation/print-data` → `/print/evaluations/:id` & `/print/judge/products/:id`)
   - Product Results Summary (`GET /api/admin/products/:id/results/print-data` & `GET /api/my/products/:id/results/print-data` → `/print/products/:id/results`)
   - Product Registration Mẫu số 01 (`GET /api/admin/products/:id/registration-print-data` & `GET /api/my/products/:id/registration-print-data` → `/print/products/:id/registration`)

## Verification results

| Check | Command | Result |
|---|---|---|
| API Unit Tests | `pnpm --filter @ocop/api test --runInBand` | **PASS** (19 suites, 111 tests) |
| Web Node Tests | `pnpm --filter @ocop/api exec node --import tsx --test ../web/test/*.test.ts` | **PASS** (25 tests) |
| Web Boundary & Contract Checks | `api-boundary.check.mjs`, `api-integration.check.mjs`, `proxy.check.mjs` | **PASS** |
| API & Web Typecheck | `pnpm --filter @ocop/api typecheck && pnpm --filter @ocop/web typecheck` | **PASS** |
| API & Web Production Build | `pnpm --filter @ocop/api build && pnpm --filter @ocop/web run build --configLoader native` | **PASS** |
| Isolated PostgreSQL DB Specs (`FORM-01..02`, `PRINT-01..03`, `FILE-01`) | `pnpm --filter @ocop/api test:db --runTestsByPath test/openapi.db-spec.ts test/admin-scoring-print.db-spec.ts` | **PASS** (2 suites, 3 tests) |
| Git Whitespace Check | `git diff --check` | **PASS** |
