# H6 statistical reports and analytics dashboard verification

Date: 2026-10-24
Repository / Branch: `D:\project\chamdiemocop` (`main`)
Plan: `docs/superpowers/plans/2026-10-24-h6-reports-and-dashboard.md`

## Scope completed

1. **Statistical Reports (`/admin/reports` — Module 6)**:
   - Shared `Asia/Ho_Chi_Minh` (`+07:00`) half-open period engine `[from, toExclusive)` with `asOf = min(toExclusive, generatedAt)` and partial-period prior comparison.
   - Two distinct time-basis reports (`GET /api/admin/reports/registrations` by `submittedAt` with status at `asOf` from `ProductStatusEvent`; `GET /api/admin/reports/results` by `completedAt`).
   - Groupings (`month`, `year`, `locality`, `group`, `category`), `dataQuality` + `historyAvailableFrom` disclosure, drill-down links to `/admin/products`, and A4 landscape print view.
2. **Analytics Dashboard (`/admin` — Module 7)**:
   - 8 KPIs (2×4 grid) with explicit basis labels (`Trong kỳ` vs `Tại mốc chốt`), prior-period deltas, and drill-down links; historical periods without assignment history return `INSUFFICIENT_HISTORY` (`"Chưa đủ dữ liệu"`) for KPI 8 instead of fabricating `0`.
   - 4 chart/data regions (12-month registration vs completion series, product groups with expandable leaf categories, cohort progress at `asOf`, and 1–5 star distribution).
   - Period comparison table + preserved Judge Progress and Needs Attention tables.

## Verification results

| Check | Command | Result |
|---|---|---|
| API Unit Tests (`reporting.spec.ts` + full suite) | `pnpm --filter @ocop/api test --runInBand` | **PASS** (20 suites, 114 tests) |
| Web Node Tests (`admin-reports-dashboard.test.ts` + full suite) | `pnpm --filter @ocop/api exec node --import tsx --test ../web/test/*.test.ts` | **PASS** (27 tests) |
| Web Boundary & Contract Checks | `api-boundary.check.mjs`, `api-integration.check.mjs`, `proxy.check.mjs` | **PASS** |
| API & Web Typecheck | `pnpm --filter @ocop/api typecheck && pnpm --filter @ocop/web typecheck` | **PASS** |
| API & Web Production Build | `pnpm --filter @ocop/api build && pnpm --filter @ocop/web run build --configLoader native` | **PASS** |
| Isolated PostgreSQL DB Specs (`REP-01..05`, `DASH-01..02`) | `pnpm --filter @ocop/api test:db --runTestsByPath test/openapi.db-spec.ts test/admin-reports-dashboard.db-spec.ts` | **PASS** (2 suites, 2 tests) |
| Git Whitespace Check | `git diff --check` | **PASS** |
