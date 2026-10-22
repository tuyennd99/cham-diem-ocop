# H3 Progress Ledger

## Preflight rulings

- Ruling: Use VIEW's documented deployment-wide read scope; organization unit remains accountability metadata. Cost if wrong: read-query scope and exposure review must be redone.
- Ruling: Keep OrganizationUnit and Locality catalogs empty until official codes/names arrive. Cost if wrong: deployment needs a data-loading step before operators can assign units or localities.
- Ruling: H3 adds only the staff-access mutation needed to verify revocation/final-admin safety; full user CRUD remains H4. Cost if wrong: H4 may need to extend or reshape this API contract.
- Ruling: Leave legacy completedAt, locality, and unknowable event timestamps null; never infer them from updatedAt/address. Cost if wrong: historical reporting will show incomplete-data counts until verified source data is supplied.

## Task status

- Task 1: complete (commits `ee022d5..59518d3`, review clean after fix round 1).
  - Full isolated DB suite now passes: 8 suites, 45 tests; migration, seed, catalog preservation, and representative record lifecycle checks all ran.
  - Prisma format/generate/validate, BE build/typecheck, and diff check passed per earlier task checks.
- Task 2: implementation committed as `ff30e64` (base `76ba51b`); independent scoped review found no actionable findings.
  - BE unit verification: 57 tests passed across 11 suites; typecheck and diff check passed.
  - Full isolated DB suite passed, including USR-01..04, stale token rejection, audit/token-version updates, and simultaneous final-MANAGE protection.
- Task 3: implementation committed as `5574df1`; scoped review follow-up fixes the existing-draft editor losing a retired category. Active `/categories` choices remain active-only; only an existing draft gets its retired category appended as a disabled option with a warning. The BE detail response returns classification labels for the retired option. The focused editor-category check passed 3/3; web and BE typechecks and diff check passed. No schema or migration edits.
  - Ruling: defer verified locality selection/submit validation and atomic locality-at-submit capture to H4; H3 leaves these optional fields null and never infers from address. The official catalog is empty and selection UI is outside the H3 plan. Cost if wrong: new H3 submissions lack locality reporting data until H4 supplies the verified selection/snapshot flow.
- Task 4: implementation, focused checks, independent review, and local commit are included in this changeset. Client sessions persist shared `Role`, effective `StaffPermission[]`, organization-unit ID and summary from login; `/auth/me` refreshes only the session that initiated the request. Legacy ADMIN/JUDGE/VIEWER sessions normalize to MANAGE+VIEW/SCORE/VIEW. Registrant routes remain role-guarded; admin read routes use VIEW, `/admin/judges` uses MANAGE, and `/judge` uses SCORE. `/admin/assignments` is read-only for VIEW and does not call the MANAGE-only judges API. VIEW-only dashboard hides manager quick links and judge progress. Focused client checks: 7 passed; BE unit tests: 13 suites / 64 tests passed; web typecheck and build passed with a temporary source mapping for `@ocop/shared`; BE typecheck/build passed; full isolated DB suite: 8 suites / 45 tests passed; diff check passed. Independent review found no remaining P1/P2 findings.
