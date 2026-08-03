# Remove RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove permission groups and permission checks while keeping one system admin (`User.id === 1`) and enforcing business access from each user's organization relationship to a task.

**Architecture:** Authentication remains unchanged at the protocol level, but every HTTP request and WebSocket handshake reloads the current account state from PostgreSQL. Admin is derived from user ID 1; normal users receive all business capabilities, while repositories and services enforce assigning/lead/collaborator scope. RBAC API/UI/runtime code is deleted before a forward migration drops its four tables.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Jest 30, React 19, TanStack Router/Query, Zustand, Vitest 4, TypeScript 5.9

## Global Constraints

- Preserve unrelated dirty-worktree changes in both `be` and `fe`; inspect current diffs before every edit and stage only files owned by the current task.
- `User.id === 1` is the only admin rule. Do not derive admin from username, organization, token claims, or database role rows.
- Keep JWT verification, refresh rotation, CSRF, throttling, password change, account locking, soft deletion, audit logging, and historical user foreign keys.
- Every normal user can use business features, but can only see tasks where their organization is assigning, lead, or collaborator.
- Only assigning organizations manage task lifecycle and review consolidated reports; lead organizations author consolidated reports and review progress; collaborator organizations author progress reports.
- Backend is authoritative. Frontend visibility rules mirror backend rules but never replace them.
- Return `401` for invalid/expired authentication, `403` for inactive accounts/system access/workflow-role violations, and `404` for tasks outside organization scope.
- Add no authorization framework or dependency.
- Deploy code that no longer reads RBAC tables before running the destructive migration. Take a restorable backup immediately before migration.
- Follow red-green TDD for every behavior change and commit each task independently.
- Treat Tasks 4-6 as one coordinated backend/frontend release slice; review each commit separately but do not deploy an intermediate contract state.

---

## File Map

### Backend authentication and system boundary

- `src/decorators/admin-only.decorator.ts`: class/method metadata for admin-only endpoints.
- `src/guards/account.guard.ts`: reload active user state, derive admin, and enforce `@AdminOnly()`.
- `src/guards/jwt-auth.guard.ts`: validate tokens without requiring a permission array.
- `src/repositories/auth.repository.ts`: load auth users without RBAC joins; derive admin from ID.
- `src/services/auth.service.ts`, `src/types/auth.ts`: remove permissions from token/profile contracts.
- `src/gateways/notifications.gateway.ts`: reload account state during socket handshake.
- `src/app.module.ts`: register `AccountGuard` instead of `PermissionGuard`.

### Backend business scope

- `src/repositories/tasks.repository.ts`: include assigning organization in task scope.
- `src/services/tasks.service.ts`: remove capability checks; restrict lifecycle mutations to assigning organization/admin.
- `src/services/reporting-periods.service.ts`: use task scope and assigning-organization lifecycle rule.
- `src/repositories/dashboard.repository.ts`, `src/services/dashboard.service.ts`: aggregate only related tasks, except admin.
- `src/utils/task-access.ts`: shared in-memory task participant check for reports/files.
- `src/services/reports.service.ts`, `src/repositories/reports.repository.ts`: enforce report owner/reviewer relations and scoped history.
- `src/services/files.service.ts`: enforce report/task relation for file access.
- Business controllers: remove permission metadata because authenticated capability is universal.

### Backend RBAC removal

- `src/controllers/system.controller.ts`, `src/controllers/audit-logs.controller.ts`: admin-only boundary.
- `src/dtos/system.dto.ts`: user writes no longer accept permission groups.
- `src/services/system.service.ts`, `src/repositories/system.repository.ts`: remove permission-group CRUD and membership joins.
- Delete `src/decorators/permissions.decorator.ts`, `src/guards/permission.guard.ts`, `src/constants/permission.ts`, and `src/utils/principal.ts` after callers migrate.
- `prisma/schema.prisma`, `prisma/migrations/0007_remove_rbac/migration.sql`: remove the four RBAC models/tables.
- `prisma/seed/seed.ts`, `prisma/seed/admin.ts`: seed users/organizations/programs without recreating RBAC or resetting an existing admin password.

### Frontend

- `src/types/auth.ts`, `src/api/auth.ts`: principal contains `isAdmin`, not permissions.
- `src/router/index.tsx`, `src/config/menu-nav.tsx`, `src/components/app-sidebar.tsx`: all business routes for authenticated users; `/system/*` only for admin.
- `src/types/system.ts`, `src/api/system.ts`, `src/pages/system/*`: remove role/permission management and group selection from users.
- Delete `src/constants/permission.ts`, `src/lib/permissions.ts`, `src/hooks/use-can.ts`, role page/form, and their obsolete tests.
- `src/lib/task-responsibility.ts`, `src/lib/task-actions.ts`, `src/pages/tasks/*`: render actions from task relationship.
- `src/api/tasks.ts`: allow admin to choose a collaborator organization when editing a progress report on its behalf.

---

### Task 1: Add current-account enforcement and derive admin from ID

**Files:**
- Create: `be/src/decorators/admin-only.decorator.ts`
- Create: `be/src/guards/account.guard.ts`
- Create: `be/src/guards/account.guard.spec.ts`
- Modify: `be/src/repositories/auth.repository.ts`
- Modify: `be/src/repositories/system.repository.ts`
- Modify: `be/src/guards/permission.guard.ts`
- Modify: `be/src/guards/permission.guard.spec.ts`
- Modify: `be/src/gateways/notifications.gateway.ts`
- Modify: `be/src/gateways/notifications.gateway.spec.ts`
- Modify: `be/src/app.module.ts`


**Interfaces:**
- Produces: `ADMIN_ONLY_KEY = 'admin_only'` and `AdminOnly(): CustomDecorator`.
- Produces: refreshed request principal with current `organizationId` and `isAdmin = (sub === 1)`.
- Consumes: `AuthRepository.findUserById(id): Promise<AuthUser | null>`.
- Guarantees: inactive/deleted users are rejected on every HTTP request and WebSocket handshake.
- Compatibility: keep permission loading and `PermissionGuard` temporarily so this task compiles and behaves correctly until Tasks 2-4 remove every permission consumer.

- [ ] **Step 1: Write failing account-guard tests**

Create `account.guard.spec.ts` with a minimal HTTP context helper and these cases:

```ts
it('reloads organization and derives admin only from user id 1', async () => {
  repository.findUserById.mockResolvedValue({
    ...activeUser,
    id: 1,
    organizationId: 22,
  });
  const principal = { sub: 1, username: 'admin', organizationId: 99, isAdmin: false };

  await guard.canActivate(contextWith(principal));

  expect(principal).toMatchObject({ organizationId: 22, isAdmin: true });
});

it.each([null, { ...activeUser, status: 'LOCKED' }])(
  'rejects a missing or inactive current account',
  async (user) => {
    repository.findUserById.mockResolvedValue(user);
    await expect(guard.canActivate(contextWith(normalPrincipal))).rejects.toMatchObject({
      status: 403,
    });
  },
);

it('rejects a normal user on an admin-only controller', async () => {
  reflector.getAllAndOverride.mockReturnValue(true);
  repository.findUserById.mockResolvedValue(activeUser);
  await expect(guard.canActivate(contextWith(normalPrincipal))).rejects.toMatchObject({
    status: 403,
  });
});
```

- [ ] **Step 2: Update permission and socket tests, then verify RED**

In `permission.guard.spec.ts`, assert admin is derived from user ID 1 rather than an `ADMIN` group. In `notifications.gateway.spec.ts`, assert a locked user fails the handshake and a valid user joins the current DB organization room.

Run:

```powershell
pnpm test -- --runInBand guards/account.guard.spec.ts guards/permission.guard.spec.ts gateways/notifications.gateway.spec.ts
```

Expected: FAIL because `AccountGuard` and `AdminOnly` do not exist, admin still depends on group code, and sockets trust token `organizationId`.

- [ ] **Step 3: Implement admin metadata and account guard**

Create the decorator:

```ts
import { SetMetadata } from '@nestjs/common';

export const ADMIN_ONLY_KEY = 'admin_only';
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);
```

Implement the guard around the existing auth repository:

```ts
@Injectable()
export class AccountGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly repository: AuthRepository,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();
    if (!request.user) return true;
    const user = await this.repository.findUserById(request.user.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is inactive');
    }
    request.user.organizationId = user.organizationId;
    request.user.isAdmin = user.id === 1;
    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (adminOnly && !request.user.isAdmin) {
      throw new ForbiddenException('System administration requires admin');
    }
    return true;
  }
}
```

Register `AccountGuard` after `JwtAuthGuard` and before `PermissionGuard`. Do not delete `PermissionGuard` yet; Tasks 2-4 remove its consumers before Task 4 deletes it.

- [ ] **Step 4: Derive admin from user ID while retaining temporary permission compatibility**

Keep the permission union temporarily, but change both auth and effective-principal mapping to:

```ts
isAdmin: user.id === 1,
```

In `SystemRepository.listEffectivePermissionsWith`, use `isAdmin: userId === 1`; remove only the group-code admin decision. `PermissionGuard` may still refresh the permission array, but it must never restore group-derived admin status.

- [ ] **Step 5: Make WebSocket authentication reload account state**

Inject `AuthRepository`, verify JWT, require an integer `sub`, then load the user:

```ts
const payload = await this.jwtService.verifyAsync<{ sub?: number }>(token, verifyOptions);
if (!Number.isInteger(payload.sub)) throw new Error('missing sub');
const user = await this.authRepository.findUserById(payload.sub!);
if (!user || user.status !== UserStatus.ACTIVE) throw new Error('inactive account');
(client.data as NotificationSocketData).organizationId = user.organizationId;
```

Keep the existing `UNAUTHORIZED` socket error and room name `org:${organizationId}`.

- [ ] **Step 6: Run focused verification**

```powershell
pnpm test -- --runInBand guards/account.guard.spec.ts guards/permission.guard.spec.ts gateways/notifications.gateway.spec.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: tests PASS; typecheck passes while temporary permission compatibility remains.

- [ ] **Step 7: Commit account enforcement**

```powershell
git add src/app.module.ts src/decorators/admin-only.decorator.ts src/guards/account.guard.ts src/guards/account.guard.spec.ts src/guards/permission.guard.ts src/guards/permission.guard.spec.ts src/repositories/auth.repository.ts src/repositories/system.repository.ts src/gateways/notifications.gateway.ts src/gateways/notifications.gateway.spec.ts
git commit -m "refactor(auth): reload account state per request"
```

---

### Task 2: Enforce task visibility and lifecycle from organization relationships

**Files:**
- Modify: `be/src/repositories/tasks.repository.ts`
- Modify: `be/src/repositories/dashboard.repository.ts`
- Modify: `be/src/services/tasks.service.ts`
- Modify: `be/src/services/tasks.service.spec.ts`
- Modify: `be/src/services/reporting-periods.service.ts`
- Modify: `be/src/services/reporting-periods.service.spec.ts`
- Modify: `be/src/services/dashboard.service.ts`
- Modify: `be/src/services/dashboard.service.spec.ts`
- Modify: `be/src/controllers/tasks.controller.ts`
- Modify: `be/src/controllers/dashboard.controller.ts`

**Interfaces:**
- Produces repository scope: admin sees all; normal user sees assigning/lead/collaborator tasks.
- Produces lifecycle rule: only admin or assigning organization may update/delete/close/complete/cancel.
- Removes permission checks from task, reporting-period, and dashboard flows.

- [ ] **Step 1: Add failing task-scope tests**

Add repository/service assertions for assigning organization visibility and lifecycle denial:

```ts
it('includes the assigning organization in normal task scope', async () => {
  await repository.list({ page: 1, limit: 20, organizationId: 10, globalScope: false });
  expect(prisma.task.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([{ assigningOrganizationId: 10 }]),
      }),
    }),
  );
});

it('rejects task lifecycle mutation from a related non-assigning organization', async () => {
  repository.findById.mockResolvedValue({ ...task, assigningOrganizationId: 10 });
  await expect(service.remove(1, { ...principal, organizationId: 20 })).rejects.toMatchObject({
    status: 403,
  });
});
```

Cover update, remove, close, complete, and reporting-period cancel with table-driven tests.

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm test -- --runInBand services/tasks.service.spec.ts services/reporting-periods.service.spec.ts services/dashboard.service.spec.ts
```

Expected: FAIL because assigning organizations are omitted from repository/dashboard scope and related lead/collaborator users can reach lifecycle mutations.

- [ ] **Step 3: Fix repository scope once**

Use this task predicate in both task and dashboard repositories:

```ts
OR: [
  { assigningOrganizationId: organizationId },
  { leadOrganizationId: organizationId },
  { collaborators: { some: { organizationId } } },
],
```

Use `principal.isAdmin === true` as the only `globalScope` value. Remove all permission-derived scope calculations.

- [ ] **Step 4: Restrict lifecycle services to assigning organization**

Remove every `assertPermission` call. After loading the scoped task, call the existing assignment check for lifecycle methods:

```ts
const task = await this.requireTask(id, principal);
this.assertAssigningOrganization(task.assigningOrganizationId, principal);
```

Apply it to update, remove, close, complete, and reporting-period cancel. Keep create behavior:

```ts
this.assertAssigningOrganization(input.assigningOrganizationId, principal);
```

Admin bypass remains inside `assertAssigningOrganization`. Keep task state, task type, organization validation, conflict checks, audit, and notifications unchanged.

- [ ] **Step 5: Remove permission decorators from task/dashboard controllers**

Delete `@Permissions(...)`, `@AnyPermissions(...)`, and related imports. All methods remain authenticated through `JwtAuthGuard` plus `AccountGuard`.

- [ ] **Step 6: Run focused tests and E2E**

```powershell
pnpm test -- --runInBand services/tasks.service.spec.ts services/reporting-periods.service.spec.ts services/dashboard.service.spec.ts
pnpm test:e2e -- --runInBand tasks.e2e-spec.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: assigning/lead/collaborator visibility PASS; lifecycle access is assigning/admin only; unrelated task access returns `404`.

- [ ] **Step 7: Commit task relationship rules**

```powershell
git add src/repositories/tasks.repository.ts src/repositories/dashboard.repository.ts src/services/tasks.service.ts src/services/tasks.service.spec.ts src/services/reporting-periods.service.ts src/services/reporting-periods.service.spec.ts src/services/dashboard.service.ts src/services/dashboard.service.spec.ts src/controllers/tasks.controller.ts src/controllers/dashboard.controller.ts test/tasks.e2e-spec.ts
git commit -m "refactor(tasks): authorize by organization relationship"
```

---

### Task 3: Enforce report and file workflow from task relationships

**Files:**
- Create: `be/src/utils/task-access.ts`
- Create: `be/src/utils/task-access.spec.ts`
- Modify: `be/src/dtos/reports.dto.ts`
- Modify: `be/src/services/reports.service.ts`
- Modify: `be/src/services/reports.service.spec.ts`
- Modify: `be/src/repositories/reports.repository.ts`
- Modify: `be/src/services/files.service.ts`
- Modify: `be/src/services/files.service.spec.ts`
- Modify: `be/src/controllers/progress-reports.controller.ts`
- Modify: `be/src/controllers/consolidated-reports.controller.ts`
- Modify: `be/src/controllers/report-history.controller.ts`
- Delete: `be/src/utils/principal.ts`

**Interfaces:**
- Produces: `canAccessTask(principal, task): boolean`.
- Produces: `ReportsService.openProgress(periodId, principal, ownerOrganizationId?): Promise<ReportWorkspaceView>`.
- Normal progress owner is always the current user's organization; admin must explicitly choose a collaborator organization.
- Reviewer rule: lead reviews progress; assigning organization reviews consolidated; admin bypasses both.

- [ ] **Step 1: Write failing task-access and report-role tests**

```ts
describe('canAccessTask', () => {
  const task = {
    assigningOrganizationId: 10,
    leadOrganizationId: 20,
    collaboratorOrganizationIds: [30],
  };

  it.each([10, 20, 30])('allows participating organization %s', (organizationId) => {
    expect(canAccessTask({ organizationId, isAdmin: false }, task)).toBe(true);
  });

  it('rejects an unrelated organization and allows admin', () => {
    expect(canAccessTask({ organizationId: 40, isAdmin: false }, task)).toBe(false);
    expect(canAccessTask({ organizationId: 40, isAdmin: true }, task)).toBe(true);
  });
});
```

Add report tests proving: collaborator authors progress, lead reviews progress, lead authors consolidated, assigning organization reviews consolidated, unrelated user gets `403`, and admin can open progress for a selected collaborator.

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm test -- --runInBand utils/task-access.spec.ts services/reports.service.spec.ts services/files.service.spec.ts
```

Expected: FAIL because permission checks remain, consolidated review lacks assigning-organization enforcement, and admin cannot select a progress owner.

- [ ] **Step 3: Add shared task participant predicate**

```ts
type Principal = { organizationId: number; isAdmin?: boolean };
type TaskOrganizations = {
  assigningOrganizationId: number;
  leadOrganizationId: number;
  collaboratorOrganizationIds: number[];
};

export const canAccessTask = (principal: Principal, task: TaskOrganizations) =>
  principal.isAdmin === true ||
  task.assigningOrganizationId === principal.organizationId ||
  task.leadOrganizationId === principal.organizationId ||
  task.collaboratorOrganizationIds.includes(principal.organizationId);
```

Use this helper for report reads, history/file scope, and period workspace listing. Return `404` only where a task/workspace existence would otherwise leak; keep `403` for a known workspace with an invalid workflow role.

- [ ] **Step 4: Replace report permission checks with owner/reviewer rules**

Define an optional query DTO:

```ts
const openProgressQuery = z.strictObject({
  ownerOrganizationId: z.coerce.number().int().optional(),
});
export class OpenProgressQueryDto extends createZodDto(openProgressQuery) {}
```

Resolve progress owner:

```ts
const ownerOrganizationId = principal.isAdmin
  ? requestedOwnerOrganizationId
  : principal.organizationId;
if (!ownerOrganizationId || !period.task.collaboratorOrganizationIds.includes(ownerOrganizationId)) {
  throw new ForbiddenException(ErrorCode.ONLY_AN_ASSIGNED_COLLABORATOR_MAY_REPORT);
}
```

Replace reviewer logic:

```ts
if (principal.isAdmin) return;
const task = workspace.reportingPeriod.task;
const reviewerOrganizationId =
  workspace.kind === ReportKind.PROGRESS
    ? task.leadOrganizationId
    : task.assigningOrganizationId;
if (reviewerOrganizationId !== principal.organizationId) {
  throw new ForbiddenException(ErrorCode.INVALID_TASK_RESPONSIBILITY);
}
```

Keep report state transitions, optimistic concurrency, audit metadata, and notifications unchanged.

- [ ] **Step 5: Scope report history and files to all task participants**

In `ReportsRepository.listHistory`, scope through the task rather than workspace owner alone:

```ts
reportingPeriod: {
  task: {
    OR: [
      { assigningOrganizationId: filters.organizationId },
      { leadOrganizationId: filters.organizationId },
      { collaborators: { some: { organizationId: filters.organizationId } } },
    ],
  },
},
```

Use `canAccessTask` in `FilesService.assertReadScope`. For draft mutation, keep owner-role checks; admin bypasses them.

- [ ] **Step 6: Remove report permission metadata and helper**

Delete `@Permissions(...)` from progress, consolidated, and report-history controllers. Pass `OpenProgressQueryDto.ownerOrganizationId` into `openProgress`. Remove permission imports/calls from report and file services, then delete `src/utils/principal.ts` after `rg "utils/principal" src` returns no callers.

- [ ] **Step 7: Run focused and integration tests**

```powershell
pnpm test -- --runInBand utils/task-access.spec.ts services/reports.service.spec.ts services/files.service.spec.ts
pnpm test:e2e -- --runInBand tasks.e2e-spec.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: all workflow roles PASS; assigning organization can review consolidated reports; outsider report/file/history access is denied.

- [ ] **Step 8: Commit report relationship rules**

```powershell
git add src/utils/task-access.ts src/utils/task-access.spec.ts src/dtos/reports.dto.ts src/services/reports.service.ts src/services/reports.service.spec.ts src/repositories/reports.repository.ts src/services/files.service.ts src/services/files.service.spec.ts src/controllers/progress-reports.controller.ts src/controllers/consolidated-reports.controller.ts src/controllers/report-history.controller.ts src/utils/principal.ts
git commit -m "refactor(reports): enforce task relationship workflow"
```

---

### Task 4: Make system administration admin-only and delete backend RBAC APIs

**Files:**
- Modify: `be/src/app.module.ts`
- Modify: `be/src/guards/jwt-auth.guard.ts`
- Modify: `be/src/guards/jwt-auth.guard.spec.ts`
- Modify: `be/src/repositories/auth.repository.ts`
- Modify: `be/src/services/auth.service.ts`
- Modify: `be/src/services/auth.service.spec.ts`
- Modify: `be/src/types/auth.ts`
- Modify: `be/src/controllers/system.controller.ts`
- Modify: `be/src/controllers/audit-logs.controller.ts`
- Modify: `be/src/dtos/system.dto.ts`
- Modify: `be/src/services/system.service.ts`
- Modify: `be/src/services/system.service.spec.ts`
- Modify: `be/src/repositories/system.repository.ts`
- Modify: `be/src/repositories/system.repository.spec.ts`
- Modify: `be/test/system.e2e-spec.ts`
- Delete: `be/src/decorators/permissions.decorator.ts`
- Delete: `be/src/guards/permission.guard.ts`
- Delete: `be/src/guards/permission.guard.spec.ts`
- Delete: `be/src/constants/permission.ts`

**Interfaces:**
- `CreateUserDto` and `UpdateUserDto` contain no `permissionGroupIds`.
- `SystemController` and `AuditLogsController` use class-level `@AdminOnly()`.
- Removed endpoints: `/system/permission-groups`, `/system/permission-groups/:id`, `/system/permissions`.
- Final backend principal contains no permission array; `PermissionGuard` is removed from `AppModule`.

- [ ] **Step 1: Rewrite system tests to admin-only behavior**

Replace permission metadata tests with HTTP behavior:

```ts
it.each(['/api/v1/system/users', '/api/v1/system/organizations', '/api/v1/system/programs'])(
  'rejects a normal user at %s',
  async (url) => {
    authRepository.findUserById.mockResolvedValue({ ...activeUser, id: 2 });
    await request(server).get(url).set('Authorization', bearerToken).expect(403);
  },
);

it('allows admin id 1 to list users', async () => {
  authRepository.findUserById.mockResolvedValue({ ...activeUser, id: 1 });
  await request(server).get('/api/v1/system/users').set('Authorization', bearerToken).expect(200);
});

it.each(['/api/v1/system/permission-groups', '/api/v1/system/permissions'])(
  'removes RBAC endpoint %s',
  (url) => request(server).get(url).set('Authorization', bearerToken).expect(404),
);
```

Update service tests so user creation accepts organization/profile fields only, while delete/lock protection for user ID 1 remains.

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm test -- --runInBand services/system.service.spec.ts repositories/system.repository.spec.ts
pnpm test:e2e -- --runInBand system.e2e-spec.ts
```

Expected: FAIL because system methods still use permission metadata/membership and RBAC endpoints still exist.

- [ ] **Step 3: Simplify user DTO, service, and repository**

Remove `permissionGroupIds` from user schemas and delete permission-group DTOs. Change repository user writes to plain audited transactions:

```ts
interface CreateUserData {
  username: string;
  fullName: string;
  position?: string;
  rank?: string;
  phone?: string;
  passwordHash: string;
  organizationId: number;
}
```

Remove permission-group selects from `userPublicSelect`, grant validators, effective-permission loaders, membership writes, and `permissionGroupIds` from user audit payloads. Keep session revocation and admin ID 1 lock/delete protections.

- [ ] **Step 4: Delete RBAC controller/service/repository surface**

Add `@AdminOnly()` above `@Controller('system')` and `@Controller('audit-logs')`. Remove all method-level permission decorators. Delete permission-group controller methods and matching service/repository methods/types/imports.

After all controller imports are gone, delete `permissions.decorator.ts` and `constants/permission.ts`.

- [ ] **Step 5: Remove the final backend permission principal and guard**

Remove RBAC joins from `AuthRepository`, remove `permissions` from `AuthUser` and `AccessTokenPayload`, and build token/profile data as:

```ts
const payload: AccessTokenPayload = {
  sub: user.id,
  username: user.username,
  organizationId: user.organizationId,
  isAdmin: user.id === 1,
};
```

Update `JwtAuthGuard.isAccessTokenPayload` to validate `sub`, `username`, `organizationId`, `iat`, and `exp`; do not require `permissions`. Remove `PermissionGuard` from `AppModule`, delete its source/test, and update auth/JWT tests to assert tokens and profiles have no permission list.

- [ ] **Step 6: Verify no backend runtime RBAC references remain**

```powershell
rg -n "PermissionGroup|UserPermissionGroup|permissionGroup|permissions\.includes|@Permissions|@AnyPermissions|PERMISSIONS_KEY|MAP_PERMISSIONS" src
```

Expected: no runtime matches. Prisma/seed matches remain until Task 7.

- [ ] **Step 7: Run focused tests and typecheck**

```powershell
pnpm test -- --runInBand services/system.service.spec.ts repositories/system.repository.spec.ts guards/account.guard.spec.ts guards/jwt-auth.guard.spec.ts services/auth.service.spec.ts
pnpm test:e2e -- --runInBand system.e2e-spec.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: admin-only tests PASS; removed endpoints return `404`; user CRUD has no group fields.

- [ ] **Step 8: Commit backend RBAC surface removal**

```powershell
git add src/app.module.ts src/guards/jwt-auth.guard.ts src/guards/jwt-auth.guard.spec.ts src/repositories/auth.repository.ts src/services/auth.service.ts src/services/auth.service.spec.ts src/types/auth.ts src/controllers/system.controller.ts src/controllers/audit-logs.controller.ts src/dtos/system.dto.ts src/services/system.service.ts src/services/system.service.spec.ts src/repositories/system.repository.ts src/repositories/system.repository.spec.ts test/system.e2e-spec.ts src/decorators/permissions.decorator.ts src/guards/permission.guard.ts src/guards/permission.guard.spec.ts src/constants/permission.ts
git commit -m "refactor(system): remove backend RBAC surface"
```

---

### Task 5: Remove frontend RBAC contracts, routes, and system UI

**Files:**
- Modify: `fe/src/types/auth.ts`
- Modify: `fe/src/api/auth.ts`
- Modify: `fe/src/api/auth.test.ts`
- Modify: `fe/src/types/navigation.ts`
- Modify: `fe/src/config/menu-nav.tsx`
- Modify: `fe/src/config/menu-nav.test.ts`
- Modify: `fe/src/router/index.tsx`
- Modify: `fe/src/components/app-sidebar.tsx`
- Modify: `fe/src/store/app-store.ts`
- Modify: `fe/src/context/app-context.tsx`
- Modify: `fe/src/types/system.ts`
- Modify: `fe/src/api/system.ts`
- Modify: `fe/src/api/system.test.ts`
- Modify: `fe/src/constants/query-key.ts`
- Modify: `fe/src/pages/system/system-crud.tsx`
- Modify: `fe/src/pages/system/system-crud-types.ts`
- Modify: `fe/src/pages/system/system-crud-form.ts`
- Modify: `fe/src/pages/system/system-crud-form.test.ts`
- Modify: `fe/src/pages/system/components/user-form.tsx`
- Delete: `fe/src/pages/system/components/role-form.tsx`
- Delete: `fe/src/pages/system/roles/index.tsx`


**Interfaces:**
- Frontend `User` removes fixed role fields now and temporarily keeps optional `permissions` only until Task 6 migrates the remaining business pages.
- All authenticated users can reach business routes.
- The `/system` parent redirects non-admin users to `/tasks`; the `role` child no longer exists.
- Managed users have no permission-group fields.

- [ ] **Step 1: Write failing auth/navigation/system tests**

Update auth API expectation:

```ts
expect(await authApi.getProfile()).toEqual({
  id: 2,
  username: 'unit-user',
  fullName: 'Unit User',
  organizationId: 10,
  organization: { id: 10, code: 'UNIT', name: 'Unit' },
  donViId: 10,
  tenDonVi: 'Unit',
  isAdmin: false,
});
```

Update menu/system tests:

```ts
expect(mainNavItems.map((item) => item.href)).toEqual([
  '/dashboard',
  '/tasks',
  '/statistics',
  '/tasks/report-history',
]);
expect(adminGroup.items.map((item) => item.href)).toEqual([
  '/system/user',
  '/system/dept',
  '/system/task_cat',
]);
expect(defaultItem('users', 9)).not.toHaveProperty('permissionGroupIds');
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm test -- src/api/auth.test.ts src/config/menu-nav.test.ts src/api/system.test.ts src/pages/system/system-crud-form.test.ts
```

Expected: FAIL because auth, navigation, user forms, and system API still expose RBAC.

- [ ] **Step 3: Simplify auth and navigation**

Use this minimal principal shape:

```ts
export type User = {
  id: number;
  username: string;
  fullName: string;
  isAdmin: boolean;
  organizationId: number;
  organization: { id: number; code: string; name: string };
  donViId: number;
  tenDonVi: string;
  chucVu?: string;
  capBac?: string;
  soDienThoai?: string;
  permissions?: string[]; // temporary until Task 6
};
```

Remove `requiredPermission` from `NavItem`. Export plain business/system arrays. In the sidebar, always show “Giao việc mới”; show the system group only when `user?.isAdmin === true`.

Remove business-route permission redirects. Add one guard at `systemRouteBase`:

```ts
beforeLoad: () => {
  if (getCurrentUser()?.isAdmin !== true) {
    throw redirect({ to: '/tasks', replace: true });
  }
},
```

- [ ] **Step 4: Remove system role/group UI and API**

Delete `RoleGroup`, `Permission`, `PAGE_KIND.ROLES`, role schemas/defaults/editor/columns, role queries, role form/page, `roleGroupsApi`, and `permissionsApi`. Remove `permissionGroupIds` and `danhMucIds` from `ManagedUser`, validation, mapping, and write payloads.

Use the user write payload:

```ts
const userWrite = (item: Partial<ManagedUser>, includePassword: boolean) => ({
  username: item.username,
  fullName: item.fullName,
  position: item.chucVu || undefined,
  rank: item.capBac || undefined,
  phone: item.soDienThoai || undefined,
  organizationId: item.donViId,
  ...(includePassword ? { password: item.password } : {}),
});
```

Remove query keys used only by permission groups.

- [ ] **Step 5: Migrate system/global state but retain business permission helpers temporarily**

Replace global-scope helpers with:

```ts
const canSeeAllUnits = (user: User | null) => user?.isAdmin === true;
```

Remove permission-helper imports from router, navigation, sidebar, store, context, auth, and system pages. Keep the helper/constant/hook files and optional `User.permissions` property because task/statistics pages still compile against them; Task 6 owns their final deletion.

- [ ] **Step 6: Run frontend focused tests and typecheck**

```powershell
pnpm test -- src/api/auth.test.ts src/config/menu-nav.test.ts src/api/system.test.ts src/pages/system/system-crud-form.test.ts
pnpm exec tsc -b
```

Expected: tests and typecheck PASS; remaining permission imports exist only in business pages assigned to Task 6.

- [ ] **Step 7: Commit frontend system cleanup**

```powershell
git add src/types/auth.ts src/api/auth.ts src/api/auth.test.ts src/types/navigation.ts src/config/menu-nav.tsx src/config/menu-nav.test.ts src/router/index.tsx src/components/app-sidebar.tsx src/store/app-store.ts src/context/app-context.tsx src/types/system.ts src/api/system.ts src/api/system.test.ts src/constants/query-key.ts src/pages/system
git commit -m "refactor(system): remove frontend RBAC surface"
```

---

### Task 6: Render frontend business actions from task responsibility

**Files:**
- Modify: `fe/src/types/auth.ts`
- Modify: `fe/src/api/auth.ts`
- Modify: `fe/src/api/auth.test.ts`
- Modify: `fe/src/constants/responsibility.ts`
- Modify: `fe/src/lib/task-responsibility.ts`
- Modify: `fe/src/lib/task-actions.ts`
- Modify: `fe/src/lib/task-actions.test.ts`
- Modify: `fe/src/api/tasks.ts`
- Modify: `fe/src/api/tasks.test.ts`
- Modify: `fe/src/pages/tasks/index.tsx`
- Modify: `fe/src/pages/tasks/detail.tsx`
- Modify: `fe/src/pages/tasks/task-form.tsx`
- Modify: `fe/src/pages/tasks/data-table-demo.tsx`
- Modify: `fe/src/pages/statistics/index.tsx`
- Delete after last caller migrates: `fe/src/constants/permission.ts`
- Delete after last caller migrates: `fe/src/lib/permissions.ts`
- Delete after last caller migrates: `fe/src/lib/permissions.test.ts`
- Delete after last caller migrates: `fe/src/hooks/use-can.ts`

**Interfaces:**
- Produces responsibility union `ADMIN | ASSIGNEE | LEAD | COLLABORATOR`.
- Produces `canManageTask(task, user)` and `canCompleteTask(task, user)` from responsibility/state.
- Produces `reportsApi.openProgress(periodId, ownerOrganizationId?)` for admin acting on behalf of one collaborator.

- [ ] **Step 1: Write failing responsibility and action tests**

```ts
it.each([
  [{ ...user, isAdmin: true }, RESPONSIBILITY.ADMIN],
  [{ ...user, organizationId: 10, donViId: 10 }, RESPONSIBILITY.ASSIGNEE],
  [{ ...user, organizationId: 20, donViId: 20 }, RESPONSIBILITY.LEAD],
  [{ ...user, organizationId: 30, donViId: 30 }, RESPONSIBILITY.COLLABORATOR],
])('derives task responsibility from organization', (principal, expected) => {
  expect(taskResponsibility(task, principal)).toBe(expected);
});

it('allows lifecycle actions only for admin or assigning organization', () => {
  expect(canManageTask(task, assigningUser)).toBe(true);
  expect(canManageTask(task, leadUser)).toBe(false);
  expect(canManageTask(task, collaboratorUser)).toBe(false);
  expect(canManageTask(task, adminUser)).toBe(true);
});
```

In `api/tasks.test.ts`, assert admin progress selection becomes a query parameter:

```ts
await reportsApi.openProgress(9, 30);
expect(request.get).toHaveBeenCalledWith('/progress-reports/periods/9', {
  params: { ownerOrganizationId: 30 },
});
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm test -- src/lib/task-actions.test.ts src/api/tasks.test.ts
```

Expected: FAIL because assigning/admin responsibility and progress-owner query are missing.

- [ ] **Step 3: Implement responsibility helpers**

```ts
export function taskResponsibility(task: Task, user: User | null | undefined) {
  if (!user) return null;
  if (user.isAdmin) return RESPONSIBILITY.ADMIN;
  if (task.assigningOrganizationId === user.organizationId) return RESPONSIBILITY.ASSIGNEE;
  if (task.coQuanChuTriId === user.organizationId) return RESPONSIBILITY.LEAD;
  if (task.coQuanThucHienIds.includes(user.organizationId)) return RESPONSIBILITY.COLLABORATOR;
  return null;
}

export const canManageTask = (task: Task, user: User | null | undefined) => {
  const responsibility = taskResponsibility(task, user);
  return responsibility === RESPONSIBILITY.ADMIN || responsibility === RESPONSIBILITY.ASSIGNEE;
};
```

Keep `canCompleteTask` type/state checks and call `canManageTask` instead of reading permissions.

- [ ] **Step 4: Replace permission-gated business UI**

- All authenticated users see dashboard, statistics, task list, report history, and create-task UI.
- Task list/detail edit/delete/close/complete controls require `canManageTask`.
- Collaborator sees progress editor.
- Lead sees progress review list and consolidated editor.
- Assigning organization sees consolidated review list.
- Admin sees every lifecycle/review control and both report editors.

For admin progress editing, add a collaborator selector backed by `task.collaboratorOrganizations`. Store the selected ID and call:

```ts
reportsApi.openProgress(selectedPeriod.id, selectedCollaboratorOrganizationId)
```

Default to the first collaborator for each loaded task. Non-admin collaborators call the same API without the optional ID.

- [ ] **Step 5: Remove final permission helpers**

Remove `useCan`/`PERMISSIONS` from task, statistics, and demo pages. Remove `permissions` from frontend `User`, `BackendUser`, auth API tests, and stored profile mapping. Delete the permission constant/helper/hook files only after:

```powershell
rg -n "PERMISSIONS|hasPermission|hasEveryPermission|useCan|permissions" src --glob '!assets/**'
```

Expected: no authorization-related match.

- [ ] **Step 6: Run focused tests and build**

```powershell
pnpm test -- src/lib/task-actions.test.ts src/api/tasks.test.ts src/pages/tasks/task-form.test.ts
pnpm exec tsc -b
pnpm build
```

Expected: tests/build PASS; all business pages compile without permission data.

- [ ] **Step 7: Commit responsibility-driven UI**

```powershell
git add src/types/auth.ts src/api/auth.ts src/api/auth.test.ts src/constants/responsibility.ts src/lib/task-responsibility.ts src/lib/task-actions.ts src/lib/task-actions.test.ts src/api/tasks.ts src/api/tasks.test.ts src/pages/tasks src/pages/statistics/index.tsx src/constants/permission.ts src/lib/permissions.ts src/lib/permissions.test.ts src/hooks/use-can.ts
git commit -m "refactor(tasks): render actions from responsibility"
```

---

### Task 7: Remove RBAC schema and make seed safe

**Files:**
- Modify: `be/prisma/schema.prisma`
- Create: `be/prisma/migrations/0007_remove_rbac/migration.sql`
- Modify: `be/prisma/seed/seed.ts`
- Modify: `be/prisma/seed/admin.ts`
- Modify: `be/test/seed.db-spec.ts`
- Create: `be/test/rbac-removal.db-spec.ts`
- Modify: `be/docs/operations.md`
- Delete: `be/src/constants/role.ts`

**Interfaces:**
- Prisma `User` has no `permissionGroups` relation.
- Seed creates/reactivates admin ID 1 but never changes the password hash of an existing admin.
- Production seed requires `SEED_ADMIN_PASSWORD` only when admin must be created.
- `seedDefaultAdmin` accepts `passwordHash?: string`; the create branch rejects a missing hash, while the update branch never reads or writes it.

- [ ] **Step 1: Add failing seed and schema-removal DB tests**

In `seed.db-spec.ts`:

```ts
it('does not reset an existing admin password', async () => {
  await prisma.user.update({ where: { id: 1 }, data: { passwordHash: 'existing-hash' } });
  await seedDefaultAdmin(prisma, { passwordHash: 'new-hash', organizationId });
  await expect(prisma.user.findUnique({ where: { id: 1 } })).resolves.toMatchObject({
    passwordHash: 'existing-hash',
  });
});
```

Create `rbac-removal.db-spec.ts`:

```ts
it('has removed every RBAC table while preserving users', async () => {
  const rows = await prisma.$queryRaw<Array<{ name: string | null }>>`
    SELECT to_regclass('public.permissions')::text AS name
    UNION ALL SELECT to_regclass('public.permission_groups')::text
    UNION ALL SELECT to_regclass('public.permission_group_permissions')::text
    UNION ALL SELECT to_regclass('public.user_permission_groups')::text
  `;
  expect(rows.map((row) => row.name)).toEqual([null, null, null, null]);
  await expect(prisma.user.count()).resolves.toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run DB tests and verify RED**

```powershell
pnpm test:db:setup
pnpm test:db -- seed.db-spec.ts rbac-removal.db-spec.ts
```

Expected: FAIL because seed resets the password and RBAC tables/models still exist.

- [ ] **Step 3: Remove Prisma models and add forward migration**

Delete the four RBAC models and `User.permissionGroups` from `schema.prisma`. Create migration SQL:

```sql
DROP TABLE "user_permission_groups";
DROP TABLE "permission_group_permissions";
DROP TABLE "permission_groups";
DROP TABLE "permissions";
```

Do not edit migration `0001_initial`; environments may already have applied it.

- [ ] **Step 4: Simplify seed without resetting existing password**

Remove permission catalog/group/member seeding. In `seedDefaultAdminInTransaction`, split create and update so `passwordHash` appears only in create data:

```ts
if (!namedAdmin && !input.passwordHash) {
  throw new Error('SEED_ADMIN_PASSWORD is required to create admin');
}

const admin = namedAdmin
  ? await prisma.user.update({
      where: { id: 1 },
      data: {
        organizationId: input.organizationId,
        status: 'ACTIVE',
        lockedAt: null,
        lockedUntil: null,
        lockReason: null,
        deletedAt: null,
      },
    })
  : await prisma.user.create({
      data: {
        id: 1,
        username: 'admin',
        fullName: 'Quản trị viên',
        passwordHash: input.passwordHash!,
        organizationId: input.organizationId,
      },
    });
```

Keep the user-table lock, ID collision checks, and sequence synchronization. In `seed.ts`, reject missing `SEED_ADMIN_PASSWORD` in production when admin does not exist; development/test may retain `DEFAULT_SEED_PASSWORD`.

- [ ] **Step 5: Document backup and rollout commands**

Add to `docs/operations.md`:

```powershell
pg_dump --format=custom --file=pre-rbac-removal.dump $env:DATABASE_URL
pnpm prisma:migrate:deploy
pnpm prisma:seed
```

Document verification with `to_regclass`, admin login, user count, task count, and rollback from the custom-format dump. State that code without RBAC reads must be deployed before migration.

- [ ] **Step 6: Regenerate Prisma client and run DB verification**

```powershell
pnpm prisma generate
pnpm test:db -- seed.db-spec.ts rbac-removal.db-spec.ts
pnpm test:db:teardown
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: tests PASS; generated client exposes no permission models.

- [ ] **Step 7: Commit schema and seed removal**

```powershell
git add prisma/schema.prisma prisma/migrations/0007_remove_rbac/migration.sql prisma/seed/seed.ts prisma/seed/admin.ts test/seed.db-spec.ts test/rbac-removal.db-spec.ts docs/operations.md src/constants/role.ts
git commit -m "refactor(db): remove RBAC schema"
```

---

### Task 8: Prove the complete access model and update architecture docs

**Files:**
- Modify: `be/test/auth.e2e-spec.ts`
- Modify: `be/test/system.e2e-spec.ts`
- Modify: `be/test/tasks.e2e-spec.ts`
- Modify: `be/test/full-app.db-spec.ts`
- Modify: `be/docs/backend-architecture.md`

**Interfaces:**
- Consumes all previous task contracts.
- Produces one DB-backed proof for admin, assigning, lead, collaborator, outsider, and locked user.

- [ ] **Step 1: Add the cross-role DB-backed scenario**

Create users in five organizations and one task with assigning/lead/collaborator relations. Assert:

```ts
await expectTaskVisible(adminClient, task.id);
await expectTaskVisible(assigningClient, task.id);
await expectTaskVisible(leadClient, task.id);
await expectTaskVisible(collaboratorClient, task.id);
await expectTaskHidden(outsiderClient, task.id); // GET returns 404
```

Then execute the workflow:

```ts
await assigningClient.patch(`/tasks/${task.id}`).send({ name: 'Updated' }).expect(200);
await collaboratorClient.get(`/progress-reports/periods/${period.id}`).expect(200);
await leadClient.post(`/progress-reports/${progress.id}/approve`).expect(200);
await leadClient.get(`/consolidated-reports/periods/${period.id}`).expect(200);
await assigningClient.post(`/consolidated-reports/${consolidated.id}/approve`).expect(200);
await outsiderClient.get(`/report-history?taskCode=${task.code}`).expect(200).expect(noRows);
```

Lock the collaborator, reuse its still-valid access token, and assert HTTP plus WebSocket access is rejected immediately.

- [ ] **Step 2: Prove admin system/global behavior**

Assert admin can call user/organization/program APIs and mutate a task outside its organization. Assert a normal user receives `403` for `/system/users` and `/audit-logs`. Assert removed permission endpoints return `404`.

- [ ] **Step 3: Update architecture documentation**

Document these exact rules:

- admin is `User.id === 1` and is not stored as a role;
- authenticated account state is reloaded for HTTP and WebSocket;
- assigning/lead/collaborator task relations determine visibility;
- workflow action ownership follows the three organization roles;
- permission groups, permission codes, and their API/UI/schema no longer exist.

- [ ] **Step 4: Run full backend verification**

```powershell
pnpm test
pnpm test:e2e -- --runInBand
pnpm test:db:setup
pnpm test:db -- --runInBand
pnpm test:db:teardown
pnpm lint
pnpm build
rg -n "PermissionGroup|UserPermissionGroup|permission_groups|user_permission_groups|permissions\.includes|@Permissions|@AnyPermissions" src prisma/schema.prisma prisma/seed
```

Expected: all available suites, lint, and build PASS; final search returns no runtime/schema/seed RBAC reference. Historical migration SQL may still contain the old table names.

- [ ] **Step 5: Run full frontend verification**

From `D:\congan-task\fe`:

```powershell
pnpm test
pnpm lint
pnpm build
rg -n "permissionGroup|roleGroups|PERMISSIONS|hasPermission|hasEveryPermission|useCan|/system/role" src
```

Expected: tests/lint/build PASS; final search returns no RBAC UI/runtime reference.

- [ ] **Step 6: Commit integration proof and docs**

From `D:\congan-task\be`:

```powershell
git add test/auth.e2e-spec.ts test/system.e2e-spec.ts test/tasks.e2e-spec.ts test/full-app.db-spec.ts docs/backend-architecture.md
git commit -m "test(auth): prove organization-scoped access"
```

---

## Final Review Checklist

- [ ] `Permission`, `PermissionGroup`, and both join models/tables are gone from current schema/runtime.
- [ ] Auth tokens/profiles contain no permission list.
- [ ] Every HTTP request and WebSocket handshake rejects locked/deleted users immediately.
- [ ] Only user ID 1 can access `/system/*` and `/audit-logs`.
- [ ] Admin can see/manage every task and select a collaborator when acting on a progress report.
- [ ] Assigning, lead, and collaborator organizations all see the related task.
- [ ] Only assigning organization/admin changes task lifecycle and reviews consolidated reports.
- [ ] Only lead/admin authors consolidated reports and reviews progress.
- [ ] Only collaborator/admin authors progress reports.
- [ ] Unrelated organizations cannot list/read/mutate task, report, history, or file data.
- [ ] Existing users and historical task/report/file/audit foreign keys remain intact.
- [ ] Seed is idempotent, reserves ID 1, and does not reset an existing admin password.
- [ ] Backup, code-first rollout, migration, smoke test, and rollback steps are documented.
- [ ] Unrelated dirty-worktree changes remain untouched.
