# H4 B1 — Product group/category API and seed preservation

Date: 2026-10-23 (Asia/Saigon).

## Scope and result

Implemented Task B1 only on reviewed A3 head `4c30ad623f7a5e58f2ea9364068e419aa2bfd12e` in `C:/Users/lllll/.codex/worktrees/h4-admin-modules/chamdiemocop`. B2 locality APIs and C web work are not included.

- Added migration `0012_catalog_metadata` and Prisma metadata: nullable `ProductGroup.description` and `ProductCategory.order` defaulting to zero. No existing migration was renumbered and no catalog identifiers/names were backfilled.
- Added VIEW list/detail endpoints and MANAGE create/update endpoints for product groups and categories, with allowlisted DTOs, paging/filter validation, stable response types, and transactional audit records. There are no delete operations and no criteria-set create/edit API. New categories always start inactive.
- Group code and category/group relation snapshots used by older clients are kept in sync on group rename/category move. Moves are rejected when any category Product is outside DRAFT. These updates do not rewrite Product or evaluation snapshots.
- Added one `assertCriteriaSetReady` validator and reused it for category activation, ProductRepository category checks, and public `/categories` filtering. Activation/registration choices require the category's own active set, at least one criterion, non-empty subcriteria/options, and exactly 100 total criterion max points. The public `/categories` data shape remains unchanged.
- Seed obtains locks in group-then-category order, re-reads category relations under those locks, preserves admin-managed group/category metadata and extra categories, creates missing official defaults, and retains the pre-existing guard against changing scoring data referenced by evaluations. Official category IDs and the official 26 criteria sets remain as the seed source; no production sample catalog data was added.
- Added database regressions for permissions, inactive creation, invalid/missing criteria activation, public choice filtering, submitted move blocking, rename/retirement history preservation, audit rollback, and seed metadata/extra-category preservation. These require the isolated PostgreSQL harness and are marked unrun below.

## TDD and checks

The ProductRepository readiness regression was first run against the old implementation and failed as expected: an active criteria set totaling 99 was accepted. After implementation, the focused shared-validator/ProductRepository tests passed.

| Check | Result |
|---|---|
| Prisma Client generation | Passed. `DATABASE_URL` was set only in the command process to a placeholder localhost URL so the Prisma config could load; the command did not connect to PostgreSQL. |
| `pnpm --filter @ocop/api prisma validate` | Passed. |
| `pnpm --filter @ocop/api test --runInBand` | Passed: 14 suites, 80 tests. |
| `pnpm --filter @ocop/api build` | Passed. Scoped worktree write approval was needed for `apps/be/dist`. |
| `pnpm --filter @ocop/api typecheck` | Passed after the API build produced existing OpenAPI test type imports under `dist`; scoped worktree write approval was needed for TypeScript incremental metadata. |
| Prettier check of changed B1 TypeScript files | Passed. |
| `git diff --check` | Passed. Git emitted only the usual Windows LF/CRLF normalization notices. |
| `pnpm --filter @ocop/api test:db --runTestsByPath test/admin-catalogs.db-spec.ts test/seed.db-spec.ts` | Not run. The authorized `/ocop` target on port 15432 rejects its configured credentials and port 5432 has no listener. No credential retry, `.env` change, database creation, or public-schema migration/seed/write was attempted. |

The isolated DB cases compile as part of the passing API typecheck, but transaction locking, route behavior, audit rollback, public choice filtering against PostgreSQL, and seed preservation remain unverified until the isolated-DB harness can connect.

## Migration and handoff

`0012_catalog_metadata` was the next unused migration index in this worktree. The task plan explicitly forbids renumbering applied migrations or arbitrary catalog backfills; neither was performed. Task 0, A1, A2, and A3 source reports were present and reviewed. The shared verification report records this B1 result alongside the earlier A3 evidence. Parent review remains pending.
