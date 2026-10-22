# Task 2 report — combined staff permissions and access changes

Status: implementation and unit/type verification complete; isolated database acceptance is blocked by the local database credentials. Do not mark USR-01..04 database acceptance passed until the focused database tests run successfully.

## Scope and contract

- Added shared `Role.VIEWER`, `StaffPermission` and `OrganizationUnitSummary` types.
- Login and `/auth/me` keep the existing envelope, `accessToken`, `expiresIn`, and original user fields; user adds effective `staffPermissions`, nullable `organizationUnitId`, and nullable `organizationUnit: { id, code, name }`.
- JWT claims remain `sub`, `email`, `role`, `tokenVersion`, issuer/audience/timestamps. Permissions and assignments are not trusted from JWT claims. `AccountGuard` reloads account state from DB on every authenticated request, rejects inactive/unverified accounts or stale token versions, and replaces token role/email/permission/unit fields with DB-derived values.
- `MANAGE` adds effective `VIEW`, never `SCORE`. Empty permission arrays do not gain privileges from legacy roles. REGISTRANT always has no effective staff permission, even if its persisted permission array is malformed.
- Reused the existing global `RoleGuard` with `@Permissions(...)` metadata; existing `@Roles(REGISTRANT)` protection remains enforced. Legacy `@AdminOnly` now requires effective MANAGE.

## Endpoint authorization

| Existing/new endpoint | Required permission / scope |
| --- | --- |
| GET `/admin/dashboard` | VIEW; VIEW-only status aggregation excludes DRAFT products |
| GET `/admin/products` and GET `/admin/products/:id/results` | VIEW; VIEW-only excludes DRAFT products and IN_PROGRESS evaluations |
| GET `/admin/assignments` | VIEW, as permitted in the spec table |
| GET/POST/PUT/DELETE `/admin/judges...` and password reset | MANAGE, including user data returned by the legacy adapter |
| PUT `/admin/assignments` | MANAGE; assignees must currently be active, verified, non-REGISTRANT SCORE accounts |
| PUT `/admin/users/:id/staff-access` | MANAGE; actor rechecked inside transaction after access locks |
| `/judge/...`, including binary downloads | SCORE; current active/verified DB account plus current category/criteria assignment |
| `/my/products...` | Existing REGISTRANT-only role and ownership checks |

SCORE eligibility replaces role=JUDGE checks in assignment validation, dashboard progress, outstanding work, queue, evaluation read/write, private-file access, and result recomputation. Combined MANAGE+SCORE users retain both scopes. Judge account creation explicitly persists SCORE. The judge management adapter includes SCORE accounts with role ADMIN, while retaining inactive/verified fields for management. Actual assignments/scoring/progress exclude unavailable users.

The queue now uses one relational query for current assignment and account eligibility, avoiding a separate category-ID snapshot before reading products.

## Staff-access mutation

`PUT /admin/users/:id/staff-access` accepts exactly:

```json
{
  "staffPermissions": ["VIEW", "SCORE"],
  "organizationUnitId": null,
  "isActive": true,
  "reason": "Access review"
}
```

- DTO rejects unknown enum values, duplicate permissions, missing required fields, extra fields such as role, invalid booleans, excessive lengths and blank reasons.
- REGISTRANT targets return not found and cannot be converted to staff by checkbox updates.
- Active staff require at least one permission. MANAGE's implied VIEW is normalized before persistence. Compatibility role is projected in priority MANAGE→ADMIN, SCORE→JUDGE, VIEW→VIEWER; inactive accounts with no remaining permissions retain their old compatibility role.
- New non-null unit selections must reference an active existing unit. Existing migrated null unit values remain valid. An existing inactive unit may remain unchanged, matching the spec's rule that stopping a unit does not lock its users.
- Every actual permission, unit or active-state change increments tokenVersion. No-op updates return current safe access fields without creating a fake change/audit/version bump.
- Withdrawing SCORE or deactivating an assigned scorer blocks while SUBMITTED/SCORING products exist, requiring reassignment first. After open work is gone, assignments are removed using the existing deactivation behavior; submitted evaluations/history remain intact.
- Safe before/after access fields, actor, target, reason and request metadata are audited in the same transaction as the update/version increment. Password/hash/OTP/token fields are excluded.
- The legacy judge deactivation route also increments tokenVersion and uses the same final-MANAGE protection.

## Concurrency and self-review

Access mutations and legacy deactivation first lock category rows in the existing consistent order, sharing the assignment/scoring lock discipline. They then lock non-REGISTRANT user rows in ID order, so concurrent access transactions serialize before reading/counting current managers. A transaction removing active+verified MANAGE must find another active+verified non-REGISTRANT MANAGE account; otherwise it throws Conflict and rolls back. Inactive or unverified managers do not satisfy the safeguard. Transaction locks are released on rollback/commit.

This deliberately uses the existing category-lock boundary plus a staff-user lock scan; a `shortcut:` comment names the staff-volume contention ceiling and dedicated-lock-row upgrade path. No migration or dependency was added.

Reviewed all user writes and role checks, preserving password revocation logic and registrant OTP behavior. Shared source changes are limited to the intended added types. No migration, catalog seed or Task 1 persistence code changed. Assignment/evaluation/backend/auth test fixtures now persist their intended permissions explicitly rather than relying on legacy role names.

Task 3 overlap: `utils/evaluation-result.ts` has only the assignment eligibility predicate change (active + verified + non-REGISTRANT + SCORE), plus corresponding enum imports. Task 3 must extend this function without dropping that predicate.

## Verification evidence

1. RED: `pnpm --filter @ocop/api test --runInBand --runTestsByPath src/guards/permissions.spec.ts` initially failed 3 tests and passed 1. Failures proved permission denial was absent and token permission/unit fields were not replaced by DB fields.
2. GREEN: the same focused guard suite passed after implementation; an additional combined-permission/registrant-only test was added.
3. Final `pnpm --filter @ocop/api typecheck --incremental false`: exit 0.
4. Final `pnpm --filter @ocop/api test --runInBand`: exit 0; 11 suites, 57 tests passed.
5. Final `git diff --check`: exit 0; only existing LF/CRLF working-copy notices on two touched test fixtures.
6. Initial standard typecheck hit sandbox EPERM writing existing `dist/tsconfig.tsbuildinfo`; disabling incremental output allowed the full typecheck without changing compiler configuration.

### Database tests added (not yet accepted)

`test/staff-access.db-spec.ts` uses only `withTestApp`, which validates a local connection and creates/migrates/seeds/drops a random `ocop_test_<UUID>` schema. It does not seed, reset or delete public/main schema data. Four focused cases cover:

- USR-01..03 API read/write matrix, MANAGE without SCORE denial, combined MANAGE+SCORE and VIEW+SCORE access, VIEW draft/evaluation filtering, registrant-only routes, private binary download, DB assignment removal taking immediate effect, combined-role judge list/progress.
- Login/me permission+unit contract, DTO allowlist, REGISTRANT protection, permission/unit/deactivation token revocation, safe before/after audit, and audit-failure rollback of access/version.
- Two simultaneous self-removals from two active verified managers (expected exactly one success and one conflict), final-manager protection through new and legacy routes, and exclusion of inactive/unverified managers from the remaining-manager count.
- Open-assignment protection, assignment eligibility for combined managers, rejection of unavailable/non-SCORE assignees, and legacy-deactivation token revocation.

Attempted `pnpm --filter @ocop/api test:db --runTestsByPath test/staff-access.db-spec.ts --verbose` with the existing local env via DOTENV_CONFIG_PATH. At the configured 5432 port all four cases failed before any DB setup: ECONNREFUSED. Per controller direction, loaded the existing env in-process and changed only DATABASE_URL.port to 15432; all four then failed before schema creation with password authentication failed for the configured app user. No URL/password was printed or persisted, and no data mutation could occur before successful authentication.

Pending controller commands once valid local test credentials are configured:

```powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/staff-access.db-spec.ts --verbose
pnpm --filter @ocop/api test:db --runTestsByPath test/auth.db-spec.ts test/assignment.db-spec.ts test/evaluation.db-spec.ts test/backend.db-spec.ts --verbose
```

Use the existing harness; explicit TEST_DATABASE_URL must target a local *_test database. Keep runtime connection configuration outside committed source. Task 4 owns the final production builds/client checks; no UI/full H4 user CRUD was implemented.

## Specific unresolved issue

The available local PostgreSQL connection at port 15432 rejects the credentials from the existing apps/be/.env; no explicit valid TEST_DATABASE_URL is available to this agent. Database assertions, including the actual two-request PostgreSQL concurrency behavior, remain unverified. Do not substitute a shared/production connection or weaken the concurrency assertion to get a pass.
