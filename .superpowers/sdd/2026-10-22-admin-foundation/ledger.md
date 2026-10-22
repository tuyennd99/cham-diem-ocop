# H3 Progress Ledger

## Preflight rulings

- Ruling: Use VIEW's documented deployment-wide read scope; organization unit remains accountability metadata. Cost if wrong: read-query scope and exposure review must be redone.
- Ruling: Keep OrganizationUnit and Locality catalogs empty until official codes/names arrive. Cost if wrong: deployment needs a data-loading step before operators can assign units or localities.
- Ruling: H3 adds only the staff-access mutation needed to verify revocation/final-admin safety; full user CRUD remains H4. Cost if wrong: H4 may need to extend or reshape this API contract.
- Ruling: Leave legacy completedAt, locality, and unknowable event timestamps null; never infer them from updatedAt/address. Cost if wrong: historical reporting will show incomplete-data counts until verified source data is supplied.

## Task status

- Task 1: complete (commits `ee022d5..59518d3`, review clean after fix round 1).
  - Migration acceptance: 1 passed.
  - CAT-01 seed acceptance: 1 passed, 5 skipped.
  - Representative assignment/evaluation fixture checks: 2 passed, 10 skipped.
  - Prisma format/generate/validate, BE build/typecheck, and diff check passed per implementer report.
  - Full four-suite and unfiltered seed runs were interrupted after long runtimes with no final output; exact generated test schemas were cleaned. No pass is claimed for skipped cases.
- Task 2: implementation committed as `ff30e64` (base `76ba51b`); independent scoped review found no actionable findings.
  - BE unit verification: 57 tests passed across 11 suites.
  - BE typecheck (`--incremental false`): passed; diff check passed.
  - [ ] Focused isolated DB tests and USR-01..04 database acceptance remain pending: no valid local `TEST_DATABASE_URL` is configured. The existing connection refuses 5432 and rejects its credentials at 15432; no acceptance pass is claimed, including concurrent final-MANAGE protection.
- Task 3: implementation from `25619a5` is ready for review; no schema or migration edits. Focused BE tests (10), full BE unit suite (64), BE typecheck with incremental writes disabled, and diff check pass. Isolated DB cases for lifecycle, catalog retirement and snapshot immutability are added but not run: no valid local `TEST_DATABASE_URL` is available, and a dedicated test database has not been authorized/created. No DB acceptance pass is claimed.
  - Ruling: defer verified locality selection/submit validation and atomic locality-at-submit capture to H4; H3 leaves these optional fields null and never infers from address. The official catalog is empty and selection UI is outside the H3 plan. Cost if wrong: new H3 submissions lack locality reporting data until H4 supplies the verified selection/snapshot flow.
