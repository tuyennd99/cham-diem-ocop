# Dynamic Permission Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every non-ADMIN permission group fully dynamic so equal permissions produce equal API access and UI, while protecting the default admin and preventing privilege escalation.

**Architecture:** Keep the existing many-to-many PermissionGroup/Permission schema. Replace `isStaff` and fixed role-code branches with action permissions plus `tasks.read.all` and `dashboard.read.all`; keep `ADMIN` as the only protected system-group exception. Backend remains authoritative for capability, resource scope, protected-admin rules, and grant-subset checks; frontend renders navigation and actions from the effective permission list.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Jest 30, React 19, TanStack Router/Query, Zustand, React Hook Form, Vitest 4, TypeScript 5.9

## Global Constraints

- Preserve unrelated dirty-worktree changes in both `be` and `fe`; stage only files owned by the current task.
- Outside `ADMIN`, authorization must not inspect PermissionGroup code, name, or ID.
- Equal permissions plus equal organization/resource relationship must produce equal access.
- `ADMIN` remains the only permission-bypass group and is immutable.
- User `id=1` must remain active and assigned to `ADMIN`; its group membership cannot be changed.
- Non-admin actors cannot create, modify, or assign a permission union larger than their own effective permission set.
- Resource ownership and organization checks remain enforced.
- Add no authorization framework or dependency.
- Follow red-green TDD for every behavior change.

---

## File Map

### Backend

- `prisma/seed/seed.ts`: seed permission catalog/default groups and call deterministic admin seeding.
- `prisma/seed/admin.ts`: create/validate admin ID 1 and synchronize the PostgreSQL sequence.
- `src/constants/role.ts`: retain only the protected `ADMIN_GROUP_CODE`.
- `src/types/auth.ts`: remove `isStaff` from authenticated principals.
- `src/repositories/auth.repository.ts`: calculate permissions and `isAdmin`, not `isStaff`.
- `src/repositories/system.repository.ts`: load effective permissions and group permission details used by grant validation.
- `src/guards/permission.guard.ts`: refresh only organization, permissions, and `isAdmin`.
- `src/services/tasks.service.ts`: authorize task actions by permission and `tasks.read.all`.
- `src/services/reporting-periods.service.ts`: authorize cancel/list by permission and scope.
- `src/services/reports.service.ts`: authorize report workflows by permission/resource relation.
- `src/services/files.service.ts`: authorize file reads with `tasks.read.all`.
- `src/services/dashboard.service.ts`: use `dashboard.read.all`.
- `src/services/system.service.ts`: protect ADMIN/default admin and enforce grant-subset rules.
- `src/controllers/tasks.controller.ts`: declare static task permissions.
- Existing `*.spec.ts` files: replace fixed-role expectations with permission-equivalence expectations.
- `src/services/system.service.spec.ts`: test protected admin and privilege escalation.
- `test/seed.db-spec.ts`: verify admin ID and sequence on PostgreSQL.
- `test/full-app.db-spec.ts`: verify two differently named groups with equal permissions behave equally.

### Frontend

- `src/lib/permissions.ts`: shared `hasPermission`/`hasEveryPermission` predicates.
- `src/types/auth.ts`, `src/api/auth.ts`: remove fixed Role and `isStaff`.
- `src/types/system.ts`, `src/api/system.ts`: remove legacy four-role fields from ManagedUser.
- `src/constants/role.ts`: delete after remaining consumers move to permission helpers.
- `src/store/app-store.ts`, `src/context/app-context.tsx`: remove viewer/staff heuristics.
- `src/types/navigation.ts`, `src/config/menu-nav.tsx`: attach required permissions to navigation.
- `src/router/index.tsx`, `src/components/app-sidebar.tsx`: gate routes/menu by permission.
- `src/lib/task-actions.ts`, `src/lib/task-role.ts`, `src/types/task.ts`: use capability and resource role, not fixed user role.
- `src/pages/tasks/index.tsx`, `src/pages/tasks/detail.tsx`: render task/report actions from permissions.
- `src/pages/system/system-crud-form.ts`, `src/pages/system/components/user-form.tsx`, `src/pages/system/system-crud.tsx`: dynamic groups and user-ID-1 UI protection.
- Vitest files beside the affected modules: behavior-level regression coverage.

---

### Task 1: Replace the fixed staff principal with permission scopes

**Files:**
- Modify: `be/src/constants/role.ts`
- Modify: `be/src/types/auth.ts`
- Modify: `be/src/repositories/auth.repository.ts`
- Modify: `be/src/repositories/system.repository.ts`
- Modify: `be/src/guards/permission.guard.ts`
- Modify: `be/src/services/auth.service.ts`
- Modify: `be/prisma/seed/seed.ts`
- Test: `be/src/guards/permission.guard.spec.ts`
- Test: `be/src/services/auth.service.spec.ts`

**Interfaces:**
- Produces: `ADMIN_GROUP_CODE = 'ADMIN'`.
- Produces: effective principal `{ sub, organizationId, permissions, isAdmin }`.
- Produces seed permission codes `tasks.read.all` and `dashboard.read.all`.
- Removes: `isStaff` from backend auth types and newly issued JWT/profile data.

- [ ] **Step 1: Write failing principal tests**

Update `permission.guard.spec.ts` so the refreshed request has no `isStaff`, and add an assertion that arbitrary group-derived permissions survive unchanged:

```ts
it('refreshes permissions without a fixed staff role', async () => {
  const repository = {
    listEffectivePermissions: jest.fn().mockResolvedValue({
      status: 'ACTIVE',
      isAdmin: false,
      organizationId: 22,
      permissions: ['tasks.read', 'tasks.read.all'],
    }),
  };
  const guard = new PermissionGuard(
    { getAllAndOverride: jest.fn().mockReturnValue(['tasks.read']) } as never,
    repository as never,
  );
  const user = { sub: 7, organizationId: 10, permissions: [] as string[] };

  await guard.canActivate(contextWith(user));

  expect(user).toEqual({
    sub: 7,
    organizationId: 22,
    permissions: ['tasks.read', 'tasks.read.all'],
    isAdmin: false,
  });
});
```

Update the AuthService token expectation:

```ts
expect(jwtService.signAsync).toHaveBeenCalledWith(
  expect.not.objectContaining({ isStaff: expect.anything() }),
  expect.any(Object),
);
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
pnpm test -- --runInBand guards/permission.guard.spec.ts services/auth.service.spec.ts
```

Expected: FAIL because principal/token still contains `isStaff`.

- [ ] **Step 3: Implement the minimal principal change**

Reduce `be/src/constants/role.ts` to:

```ts
export const ADMIN_GROUP_CODE = 'ADMIN';
```

In both repositories, keep the permission union and calculate only:

```ts
isAdmin: groupCodes.includes(ADMIN_GROUP_CODE),
```

Delete `isStaff` from `AuthUser`, `AccessTokenPayload`, JWT payload construction, profile mapping, and PermissionGuard request mutation.

Add seed catalog entries:

```ts
['tasks.read.all', 'Xem nhiệm vụ và báo cáo toàn hệ thống'],
['dashboard.read.all', 'Xem dashboard và thống kê toàn hệ thống'],
```

Add both codes to the default `THUONG_TRUC` group. Keep `ADMIN` mapped to every permission.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```powershell
pnpm test -- --runInBand guards/permission.guard.spec.ts services/auth.service.spec.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: focused tests PASS; typecheck has no `isStaff` or role-constant errors.

- [ ] **Step 5: Commit backend principal change**

```powershell
git add prisma/seed/seed.ts src/constants/role.ts src/types/auth.ts src/repositories/auth.repository.ts src/repositories/system.repository.ts src/guards/permission.guard.ts src/guards/permission.guard.spec.ts src/services/auth.service.ts src/services/auth.service.spec.ts
git commit -m "refactor: derive principals from permissions"
```

---

### Task 2: Make task lifecycle authorization permission-driven

**Files:**
- Modify: `be/src/services/tasks.service.ts`
- Modify: `be/src/services/reporting-periods.service.ts`
- Modify: `be/src/controllers/tasks.controller.ts`
- Test: `be/src/services/tasks.service.spec.ts`
- Test: `be/src/services/reporting-periods.service.spec.ts`
- Test: `be/test/tasks.e2e-spec.ts`

**Interfaces:**
- Consumes: principal without `isStaff`.
- Consumes: `tasks.read.all`.
- Produces: task action behavior determined by `tasks.*` permissions plus organization/resource checks.

- [ ] **Step 1: Replace fixed-role tests with permission-equivalence tests**

Replace tests that expect custom groups to fail:

```ts
it('lets any principal with task permissions manage tasks in scope', async () => {
  const custom = {
    ...staffPrincipal,
    isAdmin: false,
    permissions: [
      'tasks.read',
      'tasks.read.all',
      'tasks.create',
      'tasks.update',
      'tasks.delete',
      'tasks.assign',
      'tasks.close',
    ],
  };

  await expect(service.create(validCreateInput, custom)).resolves.toMatchObject({ id: 1 });
  await expect(service.update(1, { name: 'Đổi tên' }, custom)).resolves.toBeDefined();
  await expect(service.remove(1, custom)).resolves.toBeDefined();
});
```

For reporting periods:

```ts
it('lets tasks.close cancel an in-scope reporting period', async () => {
  await expect(
    service.cancel(9, 'Không còn áp dụng', {
      ...principal,
      isAdmin: false,
      permissions: ['tasks.read', 'tasks.close'],
    }),
  ).resolves.toMatchObject({ id: 9, status: 'CANCELED' });
});
```

Add a scope assertion:

```ts
expect(repository.list).toHaveBeenCalledWith(
  expect.objectContaining({ globalScope: true }),
);
```

when permissions contain `tasks.read.all`.

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm test -- --runInBand services/tasks.service.spec.ts services/reporting-periods.service.spec.ts
```

Expected: FAIL on `assertStaffAssignment` and old global-scope checks.

- [ ] **Step 3: Implement permission-only task checks**

Delete `assertStaffAssignment`. Use:

```ts
private hasGlobalScope(principal: AccessTokenPayload) {
  return Boolean(
    principal.isAdmin || principal.permissions.includes('tasks.read.all'),
  );
}
```

Keep action checks and resource checks:

```ts
this.assertPermission(principal, 'tasks.create');
this.assertPermission(principal, 'tasks.assign');
this.assertAssigningOrganization(input.assigningOrganizationId, principal);
```

For update/delete/close/cancel, remove only the Admin/Thường trực gate. Keep `tasks.update`,
`tasks.delete`, `tasks.close`, task visibility, assigning-organization checks, and state checks.

Add controller metadata:

```ts
@Post()
@Permissions('tasks.create', 'tasks.assign')

@Delete(':id')
@Permissions('tasks.delete')

@Post(':id/close')
@Permissions('tasks.close')
```

Use matching decorators for list/get/update/complete/reporting-period methods.

- [ ] **Step 4: Run unit and E2E tests**

```powershell
pnpm test -- --runInBand services/tasks.service.spec.ts services/reporting-periods.service.spec.ts
pnpm test:e2e -- --runInBand tasks.e2e-spec.ts
```

Expected: PASS; no test mentions `isStaff` or requires a `THUONG_TRUC` code.

- [ ] **Step 5: Commit task authorization**

```powershell
git add src/services/tasks.service.ts src/services/tasks.service.spec.ts src/services/reporting-periods.service.ts src/services/reporting-periods.service.spec.ts src/controllers/tasks.controller.ts test/tasks.e2e-spec.ts
git commit -m "refactor: authorize task lifecycle by permission"
```

---

### Task 3: Make report, file, and dashboard scope permission-driven

**Files:**
- Modify: `be/src/services/reports.service.ts`
- Modify: `be/src/services/files.service.ts`
- Modify: `be/src/services/dashboard.service.ts`
- Test: `be/src/services/reports.service.spec.ts`
- Test: `be/src/services/files.service.spec.ts`
- Test: `be/src/services/dashboard.service.spec.ts`

**Interfaces:**
- Consumes: `tasks.read.all` for task/report/file global visibility.
- Consumes: `dashboard.read.all` for global aggregate visibility.
- Produces: `consolidated.review` behavior independent of group code.

- [ ] **Step 1: Write failing scope and review tests**

```ts
it('lets a custom group with consolidated.review review globally', async () => {
  const reviewer = {
    ...standingOffice,
    isAdmin: false,
    permissions: ['tasks.read', 'tasks.read.all', 'consolidated.review'],
  };

  await expect(
    service.review(consolidatedWorkspace.id, 'CONSOLIDATED', true, undefined, reviewer),
  ).resolves.toBeDefined();
});
```

```ts
it('uses dashboard.read.all for global dashboard scope', async () => {
  await service.summary(
    {},
    { ...principal, permissions: ['dashboard.read', 'dashboard.read.all'] },
    now,
  );

  expect(repository.loadSummaryRows).toHaveBeenCalledWith(
    expect.objectContaining({ globalScope: true }),
  );
});
```

Add a file test where `tasks.read.all` permits a cross-organization download and the same principal
without it receives `ForbiddenException`.

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm test -- --runInBand services/reports.service.spec.ts services/files.service.spec.ts services/dashboard.service.spec.ts
```

Expected: FAIL because services still check `isStaff`.

- [ ] **Step 3: Replace fixed scope branches**

Use these exact predicates:

```ts
const globalTaskScope =
  principal.isAdmin === true ||
  principal.permissions.includes('tasks.read.all');

const globalDashboardScope =
  principal.isAdmin === true ||
  principal.permissions.includes('dashboard.read.all');
```

Remove the Admin/Thường trực-only condition from consolidated review; retain
`consolidated.review`, workspace kind/status, and submission-state checks.

For report workspace listing and private downloads, treat `tasks.read.all` as global visibility.
Without it, retain lead/collaborator/owner organization checks.

- [ ] **Step 4: Run focused tests**

```powershell
pnpm test -- --runInBand services/reports.service.spec.ts services/files.service.spec.ts services/dashboard.service.spec.ts
```

Expected: PASS with custom-group principals and scope boundaries covered.

- [ ] **Step 5: Commit data-scope changes**

```powershell
git add src/services/reports.service.ts src/services/reports.service.spec.ts src/services/files.service.ts src/services/files.service.spec.ts src/services/dashboard.service.ts src/services/dashboard.service.spec.ts
git commit -m "refactor: express global scope as permissions"
```

---

### Task 4: Protect ADMIN and prevent privilege escalation

**Files:**
- Modify: `be/src/repositories/system.repository.ts`
- Modify: `be/src/services/system.service.ts`
- Create: `be/src/services/system.service.spec.ts`
- Test: `be/test/system.e2e-spec.ts`

**Interfaces:**
- Produces: `SYSTEM_GROUP_PROTECTED`, `DEFAULT_ADMIN_PROTECTED`, `PRIVILEGE_ESCALATION`.
- Produces repository group shape `{ id, code, permissions: Array<{ code }> }`.
- Consumes: actor ID already passed to system-service mutations.

- [ ] **Step 1: Write failing service tests**

Create `system.service.spec.ts` with a small repository double and these behaviors:

```ts
it('rejects permission changes to ADMIN', async () => {
  repository.findPermissionGroupById.mockResolvedValue({
    id: 1,
    code: 'ADMIN',
    permissions: [],
  });

  await expect(
    service.updatePermissionGroup(1, { permissionIds: [2] }, 1, {}),
  ).rejects.toMatchObject({
    response: { errorCode: 'SYSTEM_GROUP_PROTECTED' },
  });
});

it('rejects changing permission groups for user 1', async () => {
  repository.findUserById.mockResolvedValue({ id: 1 });

  await expect(
    service.updateUser(1, { permissionGroupIds: [2] }, 1, {}),
  ).rejects.toMatchObject({
    response: { errorCode: 'DEFAULT_ADMIN_PROTECTED' },
  });
});

it('rejects a permission union larger than the actor permissions', async () => {
  repository.listEffectivePermissions.mockResolvedValue({
    status: 'ACTIVE',
    isAdmin: false,
    organizationId: 10,
    permissions: ['users.manage'],
  });
  repository.findPermissionGroupsByIds.mockResolvedValue([
    {
      id: 7,
      code: 'EDITOR',
      permissions: [{ permission: { code: 'tasks.update' } }],
    },
  ]);

  await expect(
    service.updateUser(9, { permissionGroupIds: [7] }, 8, {}),
  ).rejects.toMatchObject({
    response: { errorCode: 'PRIVILEGE_ESCALATION' },
  });
});
```

Also cover delete/lock user 1, delete ADMIN, non-admin assignment of ADMIN, and an allowed subset.

- [ ] **Step 2: Run test and verify RED**

```powershell
pnpm test -- --runInBand services/system.service.spec.ts
```

Expected: FAIL because protected-resource and grant-subset checks do not exist.

- [ ] **Step 3: Load permission-group details**

Change `findPermissionGroupsByIds` to select:

```ts
select: {
  id: true,
  code: true,
  permissions: {
    select: { permission: { select: { code: true } } },
  },
},
```

Change `findPermissionsByIds` to select `{ id: true, code: true }`.

- [ ] **Step 4: Implement backend protections**

Add one exception helper:

```ts
private forbidden(errorCode: string, message: string) {
  return new ForbiddenException({ errorCode, message });
}
```

Before mutations:

```ts
if (id === 1 && input.permissionGroupIds !== undefined) {
  throw this.forbidden(
    'DEFAULT_ADMIN_PROTECTED',
    'Default admin permission groups cannot be changed',
  );
}
```

Use the same error for deleting or locking ID 1. Resolve the target group before update/delete and
reject code `ADMIN`.

Make `requirePermissionGroups` and `requirePermissions` return their resolved rows after validating
the IDs. Implement one subset validator so mutations reuse those rows instead of querying twice:

```ts
private async assertCanGrant(
  actorId: number,
  permissionCodes: string[],
  includesAdmin = false,
) {
  const actor = await this.repository.listEffectivePermissions(actorId);
  if (!actor) throw this.forbidden('PRIVILEGE_ESCALATION', 'Actor is unavailable');
  if (actor.isAdmin) return;
  if (
    includesAdmin ||
    permissionCodes.some((code) => !actor.permissions.includes(code))
  ) {
    throw this.forbidden(
      'PRIVILEGE_ESCALATION',
      'Cannot grant permissions you do not have',
    );
  }
}
```

For user assignment, flatten the resolved groups' permission codes and pass whether any resolved
group code is `ADMIN`. For permission-group create/update, pass the resolved permission codes. Call
the helper only when the mutation supplies the corresponding ID list.

- [ ] **Step 5: Run service and system E2E tests**

```powershell
pnpm test -- --runInBand services/system.service.spec.ts
pnpm test:e2e -- --runInBand system.e2e-spec.ts
```

Expected: PASS for protected admin, subset grants, and existing system CRUD.

- [ ] **Step 6: Commit authorization administration**

```powershell
git add src/repositories/system.repository.ts src/services/system.service.ts src/services/system.service.spec.ts test/system.e2e-spec.ts
git commit -m "fix: prevent permission privilege escalation"
```

---

### Task 5: Seed default admin as ID 1 without breaking the sequence

**Files:**
- Create: `be/prisma/seed/admin.ts`
- Modify: `be/prisma/seed/seed.ts`
- Create: `be/test/seed.db-spec.ts`

**Interfaces:**
- Produces: `seedDefaultAdmin(prisma, input): Promise<User>`.
- Guarantees: new admin ID 1; conflict fails without rewriting existing primary keys.

- [ ] **Step 1: Write the PostgreSQL integration tests**

In `seed.db-spec.ts`, use the existing test Prisma adapter and transaction cleanup:

```ts
it('creates admin as id 1 and advances the users sequence', async () => {
  const admin = await seedDefaultAdmin(prisma, {
    passwordHash: 'hash',
    organizationId: organization.id,
  });
  const next = await prisma.user.create({
    data: {
      username: 'next-user',
      fullName: 'Next user',
      passwordHash: 'hash',
      organizationId: organization.id,
    },
  });

  expect(admin.id).toBe(1);
  expect(next.id).toBeGreaterThan(1);
});

it('fails when id 1 belongs to another username', async () => {
  await prisma.user.create({
    data: {
      id: 1,
      username: 'occupied',
      fullName: 'Occupied',
      passwordHash: 'hash',
      organizationId: organization.id,
    },
  });

  await expect(
    seedDefaultAdmin(prisma, {
      passwordHash: 'hash',
      organizationId: organization.id,
    }),
  ).rejects.toThrow('User id 1 is reserved for admin');
});

it('reactivates an existing default admin', async () => {
  await prisma.user.update({
    where: { id: 1 },
    data: { status: 'LOCKED', lockedAt: new Date(), deletedAt: new Date() },
  });

  const admin = await seedDefaultAdmin(prisma, {
    passwordHash: 'hash',
    organizationId: organization.id,
  });

  expect(admin).toMatchObject({
    id: 1,
    status: 'ACTIVE',
    lockedAt: null,
    lockedUntil: null,
    deletedAt: null,
  });
});
```

- [ ] **Step 2: Run DB tests and verify RED**

```powershell
pnpm test:db:setup
pnpm test:db -- seed.db-spec.ts
```

Expected: FAIL because `seedDefaultAdmin` does not exist.

- [ ] **Step 3: Implement deterministic admin seeding**

Create `admin.ts`:

```ts
import { Prisma, type PrismaClient } from '@prisma/client';

export async function seedDefaultAdmin(
  prisma: PrismaClient,
  input: { passwordHash: string; organizationId: number },
) {
  const [idOne, namedAdmin] = await Promise.all([
    prisma.user.findUnique({ where: { id: 1 } }),
    prisma.user.findUnique({ where: { username: 'admin' } }),
  ]);
  if (idOne && idOne.username !== 'admin') {
    throw new Error('User id 1 is reserved for admin');
  }
  if (namedAdmin && namedAdmin.id !== 1) {
    throw new Error('Admin must use user id 1');
  }
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      fullName: 'Quản trị viên mẫu',
      passwordHash: input.passwordHash,
      organizationId: input.organizationId,
      status: 'ACTIVE',
      lockedAt: null,
      lockedUntil: null,
      lockReason: null,
      deletedAt: null,
    },
    create: {
      id: 1,
      username: 'admin',
      fullName: 'Quản trị viên mẫu',
      passwordHash: input.passwordHash,
      organizationId: input.organizationId,
    },
  });
  await prisma.$queryRaw(
    Prisma.sql`SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users))`,
  );
  return admin;
}
```

Call this function from `seed.ts`, then keep the existing ADMIN membership upsert.

- [ ] **Step 4: Run DB test and clean up**

```powershell
pnpm test:db -- seed.db-spec.ts
pnpm test:db:teardown
```

Expected: PASS; teardown completes even if a test failed.

- [ ] **Step 5: Commit seed protection**

```powershell
git add prisma/seed/admin.ts prisma/seed/seed.ts test/seed.db-spec.ts
git commit -m "fix: reserve user id one for admin"
```

---

### Task 6: Replace frontend fixed roles with effective permissions

**Files:**
- Create: `fe/src/lib/permissions.ts`
- Create: `fe/src/lib/permissions.test.ts`
- Create: `fe/src/api/auth.test.ts`
- Modify: `fe/src/types/auth.ts`
- Modify: `fe/src/api/auth.ts`

**Interfaces:**
- Produces: `hasPermission(user, code): boolean`.
- Produces: `hasEveryPermission(user, codes): boolean`.
- Stops deriving fixed roles from the profile payload.
- Temporarily keeps optional legacy User fields for existing consumers; Task 9 removes them after
  every caller has migrated.

- [ ] **Step 1: Write failing permission-helper tests**

```ts
describe('permission helpers', () => {
  const customUser = {
    id: 7,
    username: 'custom',
    fullName: 'Custom',
    isAdmin: false,
    permissions: ['tasks.read', 'tasks.create'],
  };

  it('uses permissions without a role name', () => {
    expect(hasPermission(customUser, 'tasks.read')).toBe(true);
    expect(hasEveryPermission(customUser, ['tasks.read', 'tasks.create'])).toBe(true);
    expect(hasPermission(customUser, 'tasks.delete')).toBe(false);
  });

  it('lets ADMIN bypass permissions', () => {
    expect(hasPermission({ ...customUser, isAdmin: true, permissions: [] }, 'users.manage')).toBe(true);
  });
});
```

In `auth.test.ts`, mock `/auth/profile` with no `isStaff` and assert:

```ts
const profile = await authApi.getProfile();
expect(profile).toMatchObject({
  permissions: ['tasks.read.all'],
  isAdmin: false,
});
expect(profile).not.toHaveProperty('role');
expect(profile).not.toHaveProperty('isStaff');
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm test -- src/lib/permissions.test.ts src/api/auth.test.ts
```

Expected: FAIL because helpers do not exist and auth still maps fixed roles.

- [ ] **Step 3: Implement permission helpers and simplify auth**

```ts
export type PermissionPrincipal =
  | { isAdmin?: boolean; permissions?: string[] }
  | null
  | undefined;

export const hasPermission = (
  user: PermissionPrincipal,
  code: string,
): boolean =>
  user?.isAdmin === true || user?.permissions?.includes(code) === true;

export const hasEveryPermission = (
  user: PermissionPrincipal,
  codes: readonly string[],
): boolean =>
  user?.isAdmin === true ||
  codes.every((code) => user?.permissions?.includes(code) === true);
```

Stop synthesizing `role`, `isStaff`, and legacy `pXem/pThem/pSua/pXoa` values in the auth API.
Map the backend payload directly, adding only existing Vietnamese organization aliases still consumed
by pages. Keep the old User fields optional until Task 9 so this commit remains type-safe while
navigation and task consumers migrate.

- [ ] **Step 4: Run focused tests and typecheck**

```powershell
pnpm test -- src/lib/permissions.test.ts src/api/auth.test.ts
pnpm exec tsc -b
```

Expected: tests and typecheck PASS.

- [ ] **Step 5: Commit frontend principal change**

```powershell
git add src/lib/permissions.ts src/lib/permissions.test.ts src/api/auth.ts src/api/auth.test.ts src/types/auth.ts
git commit -m "refactor: model frontend access as permissions"
```

---

### Task 7: Gate frontend navigation by permission

**Files:**
- Modify: `fe/src/types/navigation.ts`
- Modify: `fe/src/config/menu-nav.tsx`
- Create: `fe/src/config/menu-nav.test.ts`
- Modify: `fe/src/router/index.tsx`
- Modify: `fe/src/components/app-sidebar.tsx`

**Interfaces:**
- Consumes: `hasPermission` and `hasEveryPermission`.
- Produces: `NavItem.requiredPermission?: string`.
- Produces: `visibleNavItems(items, user): NavItem[]`.

- [ ] **Step 1: Write failing navigation tests**

```ts
it('shows custom-group navigation from permissions', () => {
  const user = {
    isAdmin: false,
    permissions: ['tasks.read', 'users.manage'],
  };

  expect(visibleNavItems(mainNavItems, user).map((item) => item.href)).toContain('/tasks');
  expect(visibleNavItems(adminGroup.items, user).map((item) => item.href)).toEqual([
    '/system/user',
  ]);
});
```

Add cases for dashboard, report history, and an empty management group.

- [ ] **Step 2: Run test and verify RED**

```powershell
pnpm test -- src/config/menu-nav.test.ts
```

Expected: FAIL because nav items have no permission metadata/filter.

- [ ] **Step 3: Add permission metadata and filtering**

Extend NavItem:

```ts
requiredPermission?: string;
```

Annotate every actual route:

```ts
{ title: 'Tổng quan', href: '/dashboard', requiredPermission: 'dashboard.read' }
{ title: 'Theo dõi tiến độ công việc', href: '/tasks', requiredPermission: 'tasks.read' }
{ title: 'Thống kê báo cáo', href: '/statistics', requiredPermission: 'dashboard.read' }
{ title: 'Lịch sử báo cáo', href: '/tasks/report-history', requiredPermission: 'report_history.read' }
{ title: 'Người dùng', href: '/system/user', requiredPermission: 'users.manage' }
{ title: 'Phân quyền', href: '/system/role', requiredPermission: 'permission_groups.manage' }
{ title: 'Đơn vị', href: '/system/dept', requiredPermission: 'organizations.manage' }
{ title: 'Danh mục nhiệm vụ', href: '/system/task_cat', requiredPermission: 'programs.manage' }
```

Implement:

```ts
export const visibleNavItems = (
  items: NavItem[],
  user: PermissionPrincipal,
) => items.filter(
  (item) => !item.requiredPermission || hasPermission(user, item.requiredPermission),
);
```

In the sidebar, show “Giao việc mới” only with both `tasks.create` and `tasks.assign`. Filter each
admin item instead of checking `isAdmin`.

In the router, replace `adminRoute` with a protected `/system` parent and add the matching permission
guard to each child. Replace task new/edit `isStaff` branches with
`hasEveryPermission`/`hasPermission`. In the sidebar, read the authenticated user from `useAuth()`;
do not derive a role.

- [ ] **Step 4: Run navigation tests and typecheck**

```powershell
pnpm test -- src/config/menu-nav.test.ts
pnpm exec tsc -b
```

Expected: navigation test PASS; no router/sidebar dependency on fixed roles.

- [ ] **Step 5: Commit permission-driven navigation**

```powershell
git add src/types/navigation.ts src/config/menu-nav.tsx src/config/menu-nav.test.ts src/router/index.tsx src/components/app-sidebar.tsx
git commit -m "refactor: gate navigation by permission"
```

---

### Task 8: Gate task and report UI actions by capability

**Files:**
- Modify: `fe/src/lib/task-actions.ts`
- Modify: `fe/src/lib/task-actions.test.ts`
- Modify: `fe/src/lib/task-role.ts`
- Modify: `fe/src/types/task.ts`
- Modify: `fe/src/pages/tasks/index.tsx`
- Modify: `fe/src/pages/tasks/detail.tsx`

**Interfaces:**
- Consumes: permission helpers.
- Produces: `canCreateTask`, `canUpdateTask`, `canDeleteTask`, `canCloseTask`, `canCompleteTask`.
- Produces report buttons from `progress.*` and `consolidated.*` permissions.
- Keeps: task-resource role `'ADMIN' | 'CHU_TRI' | 'PHOI_HOP'`.

- [ ] **Step 1: Write failing action tests**

```ts
it('does not require a fixed staff role for task actions', () => {
  const custom = {
    id: 9,
    username: 'custom',
    fullName: 'Custom',
    isAdmin: false,
    permissions: [
      'tasks.create',
      'tasks.assign',
      'tasks.update',
      'tasks.delete',
      'tasks.close',
    ],
  };

  expect(canCreateTask(custom)).toBe(true);
  expect(canUpdateTask(custom)).toBe(true);
  expect(canDeleteTask(custom)).toBe(true);
  expect(canCloseTask(custom)).toBe(true);
});
```

Retain `canCompleteTask` tests for assigning-organization scope.

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm test -- src/lib/task-actions.test.ts
```

Expected: FAIL because action helpers are missing/fixed-role pages still own the logic.

- [ ] **Step 3: Implement and consume action helpers**

```ts
export const canCreateTask = (user: User | null | undefined) =>
  hasEveryPermission(user, ['tasks.create', 'tasks.assign']);
export const canUpdateTask = (user: User | null | undefined) =>
  hasPermission(user, 'tasks.update');
export const canDeleteTask = (user: User | null | undefined) =>
  hasPermission(user, 'tasks.delete');
export const canCloseTask = (user: User | null | undefined) =>
  hasPermission(user, 'tasks.close');
```

Use these helpers in task list/detail and router. Render consolidated review from
`consolidated.review`, then let backend enforce workspace state/resource scope.

Gate report actions directly:

```ts
hasPermission(user, 'progress.edit')
hasPermission(user, 'progress.submit')
hasPermission(user, 'progress.review')
hasPermission(user, 'consolidated.edit')
hasPermission(user, 'consolidated.submit')
hasPermission(user, 'consolidated.review')
```

Keep the existing task-resource and report-state conditions alongside these permissions.

Keep `rowRole` resource-derived:

```ts
if (user.isAdmin) return 'ADMIN';
if (task.coQuanChuTriId === user.donViId) return 'CHU_TRI';
if (task.coQuanThucHienIds.includes(Number(user.donViId))) return 'PHOI_HOP';
```

Change `RowRole` to the literal union. Task 9 deletes the four-role constants after the remaining
application-level consumers migrate.

- [ ] **Step 4: Run task tests and typecheck**

```powershell
pnpm test -- src/lib/task-actions.test.ts src/pages/tasks/task-form.test.ts
pnpm exec tsc -b
```

Expected: PASS; `rg "THUONG_TRUC|DON_VI|VIEWER|isStaff" src` finds no authorization logic.

- [ ] **Step 5: Commit task UI changes**

```powershell
git add src/lib/task-actions.ts src/lib/task-actions.test.ts src/lib/task-role.ts src/types/task.ts src/pages/tasks/index.tsx src/pages/tasks/detail.tsx
git commit -m "refactor: render task actions from permissions"
```

---

### Task 9: Simplify managed users and protect admin ID 1 in the UI

**Files:**
- Delete: `fe/src/constants/role.ts`
- Modify: `fe/src/types/auth.ts`
- Modify: `fe/src/types/system.ts`
- Modify: `fe/src/api/system.ts`
- Modify: `fe/src/api/system.test.ts`
- Modify: `fe/src/store/app-store.ts`
- Modify: `fe/src/context/app-context.tsx`
- Modify: `fe/src/pages/system/system-crud-form.ts`
- Modify: `fe/src/pages/system/components/user-form.tsx`
- Modify: `fe/src/pages/system/system-crud.tsx`
- Modify: `fe/src/pages/system/system-crud-form.test.ts`

**Interfaces:**
- Produces frontend User with `permissions` and `isAdmin`, without `role`/`isStaff`.
- Produces ManagedUser without `role`, `isAdmin`, `maQuyen`, or legacy CRUD flags.
- Guarantees PATCH `/system/users/1` omits `permissionGroupIds`.
- Guarantees user ID 1 group controls and destructive actions are disabled/hidden.

- [ ] **Step 1: Write failing API and form tests**

```ts
it('never sends permission groups when updating default admin', async () => {
  request.patch.mockResolvedValue({ data: { statusCode: 200, data: backendAdmin } });

  await usersApi.update(1, {
    ...mappedAdmin,
    fullName: 'Admin mới',
    permissionGroupIds: [2],
  });

  expect(request.patch).toHaveBeenCalledWith(
    '/system/users/1',
    expect.not.objectContaining({ permissionGroupIds: expect.anything() }),
  );
});
```

Render UserForm with `id: 1` and assert every role-group checkbox is disabled:

```ts
expect(html.match(/id="role-group-\d+"[^>]*disabled=""/g)).toHaveLength(roleGroups.length);
```

Add a SystemCrud action test or extracted `canMutateUser` test asserting lock/delete are false for ID
1 and true for ID 2.

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm test -- src/api/system.test.ts src/pages/system/system-crud-form.test.ts
```

Expected: FAIL because admin updates include permission groups and checkboxes/actions remain enabled.

- [ ] **Step 3: Remove legacy managed-user role fields**

Keep only fields consumed by forms/API:

```ts
export type ManagedUser = {
  id: number;
  username: string;
  password: string;
  fullName: string;
  donViId: number | null;
  tenDonVi: string | null;
  chucVu: string;
  capBac: string;
  soDienThoai: string;
  permissionGroupIds: number[];
  status?: 'ACTIVE' | 'LOCKED';
};
```

Delete fallback group resolution by `maQuyen`/`role`. Always use selected IDs for ordinary users.
Make `userWrite` accept `permissionGroupIds?: number[]` and omit the property when undefined.

Remove the remaining optional `role`/`isStaff` fields from authenticated User. Replace the
store/global-unit heuristic with:

```ts
const canUseGlobalUnit = (user: User | null) =>
  hasPermission(user, 'tasks.read.all') ||
  hasPermission(user, 'dashboard.read.all');
```

Remove unused application-wide `isReadOnly`, migrate AppContext callers to action-level permissions,
and delete `src/constants/role.ts` after `rg "constants/role" src` returns no imports.

For update:

```ts
const groupIds = id === 1 ? undefined : input.permissionGroupIds;
```

Disable group checkboxes with `disabled={defaultValues.id === 1}`. In SystemCrud, hide lock/delete
buttons for ID 1; keep edit and password reset.

- [ ] **Step 4: Run system UI tests and typecheck**

```powershell
pnpm test -- src/api/system.test.ts src/pages/system/system-crud-form.test.ts
pnpm exec tsc -b
```

Expected: PASS; no ManagedUser fixed-role fields remain.

- [ ] **Step 5: Commit managed-user cleanup**

```powershell
git add src/constants/role.ts src/types/auth.ts src/types/system.ts src/api/system.ts src/api/system.test.ts src/store/app-store.ts src/context/app-context.tsx src/pages/system/system-crud-form.ts src/pages/system/components/user-form.tsx src/pages/system/system-crud.tsx src/pages/system/system-crud-form.test.ts
git commit -m "fix: protect default admin role in frontend"
```

---

### Task 10: Prove permission-group replacement end to end

**Files:**
- Modify: `be/test/full-app.db-spec.ts`
- Modify: `be/docs/backend-architecture.md`
- Modify: `be/docs/operations.md`

**Interfaces:**
- Consumes all previous backend behavior.
- Produces a DB-backed regression proving group identity is irrelevant.

- [ ] **Step 1: Add the DB-backed equivalence scenario**

Create two groups with different codes and the same permission list:

```ts
const permissionCodes = [
  'tasks.read',
  'tasks.read.all',
  'tasks.create',
  'tasks.assign',
  'tasks.update',
  'tasks.delete',
  'tasks.close',
  'consolidated.review',
];
const groupA = await ensureGroup(prisma, 'CUSTOM_A', permissionCodes);
const groupB = await ensureGroup(prisma, 'CUSTOM_B', permissionCodes);
```

Assign A, log in, create/read/update a task and review a consolidated report. Remove A from the user,
delete A, assign B, log in again, and repeat the same HTTP assertions. Assert both runs return the
same status codes and data scope.

- [ ] **Step 2: Run the DB-backed integration proof**

```powershell
pnpm test:db:setup
pnpm test:db -- full-app.db-spec.ts
```

Expected: PASS. The preceding unit/E2E tests supplied the RED phase for each behavior; this scenario
is the final cross-layer equivalence proof.

- [ ] **Step 3: Update architecture and operations docs**

Document:

```md
- PermissionGroup code has no authorization meaning except protected `ADMIN`.
- `tasks.read.all` grants global task/report/file scope.
- `dashboard.read.all` grants global dashboard/statistics scope.
- Equal permission sets produce equal access.
- User ID 1 and group ADMIN are protected.
- Non-admin grants are limited to the actor's effective permission set.
```

Remove claims that only `THUONG_TRUC` can perform actions now represented by permissions.

- [ ] **Step 4: Run full backend verification**

```powershell
pnpm test
pnpm test:e2e -- --runInBand
pnpm test:db -- --runInBand
pnpm lint
pnpm build
pnpm test:db:teardown
```

Expected: all available suites PASS; teardown runs. If PostgreSQL is unavailable, record the exact
DB-test blocker and still require unit, E2E, lint, and build to pass.

- [ ] **Step 5: Run full frontend verification**

From `D:\congan-task\fe`:

```powershell
pnpm test
pnpm lint
pnpm build
rg -n "THUONG_TRUC|DON_VI|VIEWER|isStaff|roleFromUser" src
```

Expected: tests/lint/build PASS; search returns no authorization logic using removed fixed roles.

- [ ] **Step 6: Commit integration proof and docs**

From `D:\congan-task\be`:

```powershell
git add test/full-app.db-spec.ts docs/backend-architecture.md docs/operations.md
git commit -m "test: prove dynamic permission group equivalence"
```

---

## Final Review Checklist

- [ ] Every fixed-role rejection test was replaced with a permission-equivalence test.
- [ ] `ADMIN` is the only group code read by authorization code.
- [ ] No backend or frontend principal contains `isStaff`.
- [ ] `tasks.read.all` controls global task/report/file scope.
- [ ] `dashboard.read.all` controls global dashboard/statistics scope.
- [ ] Action permission and resource relation checks both remain in place.
- [ ] User ID 1 cannot lose ADMIN, be locked, or be deleted.
- [ ] ADMIN group cannot be edited or deleted.
- [ ] Non-admin grant operations enforce permission-subset rules.
- [ ] Frontend menu, routes, and buttons use effective permissions.
- [ ] Two differently named groups with equal permissions pass the same DB-backed scenario.
- [ ] Backend and frontend dirty-worktree changes unrelated to this plan remain untouched.
