# H4 A3 — Admin users and organization units UI

Date: 2026-10-23 (Asia/Saigon).

## Scope and result

Implemented A3 on the reviewed A2 head `ff227bb61ddeabe5c236bf0062f42d34ee17763c` in the managed worktree `C:/Users/lllll/.codex/worktrees/h4-admin-modules/chamdiemocop`. The change is limited to the web app, its focused form behavior test, the web README, and H4 verification records. No API/backend or shared package source was changed.

- Added `adminUsersApi` endpoint wrappers and query hooks for users, units, detail, and reusable verified/active registrant-owner lookup. Query keys retain the complete user/unit filters and owner search parameters. Mutations disable retry and invalidate users, units, judge, assignment, and dashboard data as appropriate.
- Added the MANAGE-guarded `/admin/users` route, Users/Units tabs, paged/searchable filters, create/edit forms, unit create/edit forms, and route-tree registration. The legacy `/admin/judges` path now requires MANAGE and replaces navigation with `/admin/users?permission=SCORE`; assignment candidate lookup continues using the judge API.
- Added the MANAGE-only sidebar link and dashboard links. The UI keeps email/verified/permission controls unavailable to registrants, retains submitted values after API validation/conflict errors, blocks duplicate submits, and keeps password data out of query cache. MANAGE selection includes VIEW without adding SCORE. Inactive assigned units remain visible but disabled; a null unit displays “Chưa gán đơn vị”.
- Self access/unit/status/reset changes that revoke the current user's token clear the local session and navigate to login after the mutation succeeds. Profile-only changes refresh `/auth/me` and keep the session.
- Added `staffPermissionsForForm` behavior coverage for MANAGE→VIEW and preserving explicit VIEW+SCORE without inferring SCORE.

## TDD and checks

The planned form test was run red first: it failed because `admin-user-form` had not yet been implemented. After adding the helper and using it in create/access payloads, the focused test passed.

| Check | Result |
|---|---|
| `pnpm --filter @ocop/api exec node --import tsx --test ../web/test/admin-users.test.ts` | Passed: 1 test. Node's child process was denied in the default sandbox on the final attempt; the same scoped command passed when rerun with the required process access. |
| `pnpm --filter @ocop/web typecheck` | Passed, `tsc --noEmit`, exit 0. |
| `pnpm --filter @ocop/web exec node test/api-boundary.check.mjs` | Passed: `PASS API boundaries`. |
| `pnpm --filter @ocop/web build` | Passed; 2,375 modules transformed and production bundle emitted. The default sandbox attempt failed before source compilation due process `EPERM`/Tailwind native binding access; the scoped rerun passed. |
| `git diff --check` | Passed before staging; staged diff is checked again before commit. |

## Environment limits

No DB-backed behavior suite or browser acceptance run was attempted for A3. A2 recorded that the authorized local PostgreSQL `/ocop` target on port 15432 rejected password authentication before test schema creation. Per the task instruction, credentials and `.env` were not changed and the DB was not retried. Browser flows requiring that fixture/database therefore remain unverified. The referenced Task 0 report `.superpowers/sdd/2026-10-22-h4-admin-modules/task-0-report.md` is absent from this worktree; this report does not infer additional environment setup evidence from it.

This report records A3 completion and its frontend checks only; it is not a claim that the full H4 browser/DB acceptance is complete.
