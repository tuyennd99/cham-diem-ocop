# Task 1 ? Backend WebSocket notifications

## Scope

- Socket.IO endpoint moved to `/api/socket.io`.
- JWT verification moved into Socket.IO middleware. Rejected handshakes return
  `error.data.code = "UNAUTHORIZED"`; authenticated sockets join their organization room.
- Report notifications now use canonical frontend types and Task navigation targets while
  retaining report-version IDs in event keys.
- Deadline notifications now navigate to their Task.
- Organization rooms are emitted to only when at least one notification row is created.
- Legacy report notification rows are normalized by an unapplied Prisma migration.
- Production WebSocket upgrade requirements are documented.

## TDD evidence

### RED

Command:

```text
pnpm test -- --runInBand gateways/notifications.gateway.spec.ts services/notifications.service.spec.ts services/reports.service.spec.ts
```

Observed before implementation: exit 1; 3 suites failed, 5 tests failed, 12 passed.
The failures were the intended regressions:

1. `gateway.afterInit is not a function` for both authentication middleware checks.
2. Report submit emitted `BAO_CAO_GUI`, `ReportVersion`, ID `101` instead of
   `REPORT_SUBMITTED`, `Task`, ID `5`.
3. A zero-row notification still emitted to organization room `12`.
4. Deadline notification emitted `ReportingPeriod`, ID `10` instead of `Task`, ID `1`.

### GREEN

Fresh command after implementation and formatting:

```text
pnpm test -- --runInBand gateways/notifications.gateway.spec.ts services/notifications.service.spec.ts services/reports.service.spec.ts
```

Observed: exit 0; 3 suites passed, 17/17 tests passed, 0 snapshots.

Selected changed-file lint:

```text
.\node_modules\.bin\eslint.CMD src/gateways/notifications.gateway.ts src/gateways/notifications.gateway.spec.ts src/services/notifications.service.ts src/services/notifications.service.spec.ts src/services/reports.service.ts src/services/reports.service.spec.ts
```

Observed: exit 0, no findings.

Build:

```text
pnpm build
```

Observed: exit 0 (`nest build`).

`git diff --check` also exited 0. The migration file was inspected only and was not
applied to any database, as required.

## Files

- `src/gateways/notifications.gateway.ts`
- `src/gateways/notifications.gateway.spec.ts`
- `src/services/notifications.service.ts`
- `src/services/notifications.service.spec.ts`
- `src/services/reports.service.ts`
- `src/services/reports.service.spec.ts`
- `prisma/migrations/0005_normalize_report_notifications/migration.sql`
- `docs/operations.md`

## Concern

Production reverse proxy configuration is not stored in this repository. Deployment must
implement the documented HTTP/1.1 WebSocket upgrade forwarding for `/api/socket.io`.
