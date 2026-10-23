# H4 A3 — Admin users and organization units UI

Date: 2026-10-23 (Asia/Saigon).

## Scope and result

Implemented A3 on the reviewed A2 head `ff227bb61ddeabe5c236bf0062f42d34ee17763c` in the managed worktree `C:/Users/lllll/.codex/worktrees/h4-admin-modules/chamdiemocop`. The independent-review fix adds a narrow backend compatibility change so access-only requests can omit status while retaining existing explicit-status behavior. No shared package source was changed.

- Added `adminUsersApi` endpoint wrappers and query hooks for users, units, detail, and reusable verified/active registrant-owner lookup. Query keys retain the complete user/unit filters and owner search parameters. Mutations disable retry and invalidate users, units, judge, assignment, and dashboard data as appropriate.
- Added the MANAGE-guarded `/admin/users` route, Users/Units tabs, paged/searchable filters, create/edit forms, unit create/edit forms, and route-tree registration. The legacy `/admin/judges` path now requires MANAGE and replaces navigation with `/admin/users?permission=SCORE`; assignment candidate lookup continues using the judge API.
- Added the MANAGE-only sidebar link and dashboard links. The UI keeps email/verified/permission controls unavailable to registrants, retains submitted values after API validation/conflict errors, blocks duplicate submits, and keeps password data out of query cache. MANAGE selection includes VIEW without adding SCORE. Inactive assigned units remain visible but disabled; a null unit displays “Chưa gán đơn vị”.
- Self access/unit/status/reset changes that revoke the current user's token clear the local session and navigate to login after the mutation succeeds. Profile-only changes refresh `/auth/me` and keep the session.
- Access and status now have independent form state. The access payload contains only permissions, unit, and reason; a toggled status checkbox cannot lock or reactivate the account through the access endpoint. The separate status endpoint remains guarded by the lock confirmation.
- `UpdateStaffAccessDto.isActive` is optional; when omitted, `applyStaffAccess` uses the `isActive` value read under the existing transaction/lock. Explicit values retain prior semantics. DTO validation accepts omission and rejects explicit null.
- Added form behavior coverage for MANAGE→VIEW, preserving VIEW+SCORE without inferring SCORE, omitting status even when status form state is toggled, and not revoking the current session for an effective no-op access update.
- Added an API DB regression that exercises access-only updates against both inactive and active users. It was not executed because the authorized local PostgreSQL target has the authentication failure recorded in A2; no DB retry was made.

## TDD and checks

The planned form test was run red first: it failed because `admin-user-form` had not yet been implemented. After adding the helper and using it in create/access payloads, the focused test passed.

| Check | Result |
|---|---|
| `pnpm --filter @ocop/api exec node --import tsx --test ../web/test/admin-users.test.ts` | Passed: 3 tests. Node's child process was denied in the default sandbox on the final attempt; the same scoped command passed when rerun with the required process access. |
| `pnpm --filter @ocop/web typecheck` | Passed, `tsc --noEmit`, exit 0. |
| `pnpm --filter @ocop/api typecheck` | Passed, `tsc --noEmit`, exit 0; rerun with scoped access after the sandbox denied writing `apps/be/dist/tsconfig.tsbuildinfo`. |
| `pnpm --filter @ocop/api test --runInBand` | Passed: 13 suites, 70 tests. |
| `pnpm --filter @ocop/web exec node test/api-boundary.check.mjs` | Passed: `PASS API boundaries`. |
| `pnpm --filter @ocop/web build` | Passed; 2,375 modules transformed and production bundle emitted. The default sandbox attempt failed before source compilation due process `EPERM`/Tailwind native binding access; the scoped rerun passed. |
| `git diff --check` | Working and staged diff checks pass before commit. |

## Environment limits

The new DB regression and browser acceptance were not run for A3. A2 recorded that the authorized local PostgreSQL `/ocop` target on port 15432 rejected password authentication before test schema creation. Per the task instruction, credentials and `.env` were not changed and the DB was not retried. Browser flows requiring that fixture/database therefore remain unverified. The referenced Task 0 report `.superpowers/sdd/2026-10-22-h4-admin-modules/task-0-report.md` is absent from this worktree; this report does not infer additional environment setup evidence from it.

This report records A3 completion and the narrow API compatibility fix checks; it is not a claim that the full H4 browser/DB acceptance is complete.
