# H4 admin modules verification

This report records the H4 A3 web verification and the known A1/A2 handoff limits. It does not certify end-to-end DB or browser acceptance for all H4 work.

## A3 web scope

The MANAGE-only `/admin/users` page now provides user administration and an organization-unit tab. The previous `/admin/judges` URL redirects MANAGE users to the SCORE-filtered user list. Staff assignment candidates continue to come from the judge API. Registrants cannot edit email, verified state, or staff permissions. MANAGE selections include VIEW and do not infer SCORE. Self-mutations that revoke the current token clear the local session; profile-only changes refresh `/auth/me`.

An independent-review fix separates access and status form state: access saves omit `isActive`; status saves keep using the status endpoint and lock confirmation. The API DTO allows status omission while preserving the current locked status read under the access transaction; explicit status values retain existing behavior. Validation keeps explicit null invalid.

Implementation details and the TDD/check record are in [`task-3-report.md`](../../.superpowers/sdd/2026-10-22-h4-users-and-units/task-3-report.md). Prior task reports: [A1](../../.superpowers/sdd/2026-10-22-h4-users-and-units/task-1-report.md) and [A2](../../.superpowers/sdd/2026-10-22-h4-users-and-units/task-2-report.md).

## A3 checks

| Check | Result |
|---|---|
| Focused admin form behavior test | Passed: 3 tests, including status omission when status form state is toggled and no logout for effective no-op access. |
| Web typecheck | Passed. |
| API typecheck | Passed. |
| API unit tests | Passed: 13 suites, 70 tests, including DTO validation for omitted/null status. |
| Web API-boundary check | Passed. |
| Web production build | Passed. |
| DB-backed status-preservation regression/browser acceptance | Regression added but not run; the authorized local DB authentication failure recorded by A2 prevents fixture-backed verification. |

The default sandbox initially denied child processes/native Tailwind binding access for the focused test and build. Both checks passed when rerun with scoped process access. No source compile errors remained.

## Environment and evidence limits

- A2 reports the authorized local PostgreSQL `/ocop` target on port 15432 rejected password authentication before the test harness created a schema. A3 did not retry that target, alter credentials, or change `.env`.
- Browser acceptance requiring a populated API fixture was consequently unavailable. MANAGE access, VIEW/SCORE no-request behavior, conflict-form retention, and token-revocation behavior are implemented but were not demonstrated in a browser during A3.
- The referenced Task 0 report path `.superpowers/sdd/2026-10-22-h4-admin-modules/task-0-report.md` is absent from the worktree. No claims here depend on that missing report.
- See the linked A1/A2 reports for their individual DB, unit, OpenAPI, typecheck, and build evidence. Those results are not recast as A3 browser acceptance.
