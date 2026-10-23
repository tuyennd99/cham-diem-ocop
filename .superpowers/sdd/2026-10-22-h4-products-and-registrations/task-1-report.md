# H4-C1 — Product mutations and registration snapshots

Date: 2026-10-23 (Asia/Saigon).

## Scope and result

Implemented Task C1 only on reviewed B2 head `dccb779593d1adfa118e4fafdf19cc78a213f697` in `C:/Users/lllll/.codex/worktrees/h4-admin-modules/chamdiemocop`. C2 reads/files and C3 web screens are not included.

- Added nullable `Product.registrationSnapshot` JSONB using migration `0013_registration_snapshot`; no historical snapshot backfill was performed. Exported the shared `RegistrationSnapshotV1` contract and added an allowlisted backend snapshot builder/required-form validator.
- Added optional top-level `localityId` to owner/admin draft inputs and included `localityId` plus the selected locality in owner draft outputs. Empty form data and missing locality remain valid draft values. Submission requires the shared complete-form checks, an active 100-point category/group, and an active locality inside its effective interval.
- Added a trusted internal `OWNER | MANAGER` actor union. Owner writes use the authenticated registrant ID in their database predicates; manager create validates an active, verified REGISTRANT inside the transaction and stores the actual manager as creator. No actor, management flag, or principal is accepted through request DTOs.
- Added MANAGE-only create, update, submit, and draft delete endpoints. Both actor paths share repository mutations, category readiness, form and locality validation. Existing retired locality/category selections remain visible and can be retained on drafts; changing to retired/out-of-effective values and submitting with unavailable selections is rejected.
- Mutations lock sorted group rows, then evaluation category rows, then the verified registrant row when creating on behalf, the Product, and finally a changed/submitted locality. Reads and state checks are repeated after row locks. Product creation inserts without a locality FK before locking and attaching locality to preserve this order. Raw lock SQL uses `databaseObject`; category locks reuse `lockEvaluationCategory`.
- Manager create/update/submit/delete write transactional audits with actual actor, reason, and request metadata. Audit values are allowlisted, including form fields; arbitrary form keys, storage paths, and tokens are omitted. Audit failures roll back mutations. Successful no-op manager draft updates also write an update audit with equal before/after data and do not add a status event. Status events are recorded only for real status transitions and include the manager's reason; retries do not alter `submittedAt` or duplicate events.
- Updated direct submission fixtures with locality IDs and added isolated-schema regressions for manager-to-owner visibility, frozen rename snapshot, empty drafts, locality retirement, unverified/inactive/non-registrant rejection, unauthorized mutation, post-submit guards, audit rollback, audit data filtering, and a successful no-op manager PUT with no extra status event.

## TDD and checks

The isolated database regression file was written before the mutation implementation. It was not executed because the previously authorized `/ocop` database rejected credentials on port 15432 and port 5432 has no listener; the task instruction prohibits another authentication attempt. The tests were typechecked but transaction behavior and their red/green result remain unverified against PostgreSQL.

| Check | Result |
|---|---|
| Prisma Client generation | Passed with a process-local placeholder `DATABASE_URL`; no database connection. |
| Prisma schema validation | Passed with the same process-local placeholder URL. |
| API unit tests | Passed after the no-op manager audit fix: 16 suites, 97 tests. |
| API build | Passed. Compiled output was written only under this worktree's ignored `apps/be/dist`. |
| API typecheck | Passed after the no-op manager audit fix; this also typechecks the new isolated DB specs. |
| OpenAPI spec | Passed: 1 suite, 1 test; it loads the built API and does not connect to PostgreSQL. |
| Web typecheck | Passed for the updated registrant response types. |
| Prettier | Passed for the new controller, DTO, snapshot utility/spec, and C1 database spec. |
| `git diff --check` | Passed; Git reported only its normal Windows LF/CRLF notices. |
| C1 isolated PostgreSQL specs | Added, not run. No credential retry, `.env` edit, database creation, or public-schema write occurred. |

The API build/typecheck needed scoped worktree access for generated output/TypeScript metadata after the default sandbox rejected writes to `apps/be/dist`. This did not touch the main checkout. The DB limitation is inherited from the B2 handoff record; see the central [H4 verification report](../../../docs/verification/2026-10-22-h4-admin-modules.md).
