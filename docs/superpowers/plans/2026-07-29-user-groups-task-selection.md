# User Groups for Task Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable user groups that snapshot selected groups and collaborator organizations on tasks while preserving manual organization editing.

**Architecture:** Add `UserGroup`, `UserGroupMember`, and `TaskUserGroup` in Prisma. System administration owns group CRUD, while the task module exposes a filtered group lookup and persists group IDs independently from the existing collaborator organizations. The frontend expands current group lookups into the task form, but the submitted collaborator list remains authoritative.

**Tech Stack:** PostgreSQL, Prisma 7, NestJS 11, Jest/Supertest, React 19, TanStack Query/Router, React Hook Form, Zod, Vitest.

## Global Constraints

- Do not assign tasks directly to users.
- Do not change report, notification, or task access rules based on organizations.
- Do not store provenance from an organization back to a specific group.
- Do not automatically remove collaborator organizations when groups or memberships change.
- Only active, non-deleted users in active executing organizations contribute to task lookup `organizationIds`.
- Keep `collaboratorOrganizationIds` as the authoritative task assignment snapshot.
- Use existing dependencies and existing CRUD/combobox components; add no package.
- Backend and frontend are separate Git repositories under `be/` and `fe/`; commit each repository independently.

---

## File Map

### Backend

- Modify `be/prisma/schema.prisma`: define the three new relational models.
- Create `be/prisma/migrations/0003_user_groups/migration.sql`: create tables, indexes, and foreign keys.
- Modify `be/src/dtos/system.dto.ts`: validate user-group create/update payloads.
- Modify `be/src/controllers/system.controller.ts`: expose protected system CRUD routes.
- Modify `be/src/services/system.service.ts`: normalize, validate, and coordinate user-group CRUD.
- Modify `be/src/repositories/system.repository.ts`: persist groups/members and audit mutations.
- Modify `be/src/dtos/tasks.dto.ts`: accept `userGroupIds`.
- Modify `be/src/controllers/tasks.controller.ts`: expose the task lookup route.
- Modify `be/src/services/tasks.service.ts`: validate group IDs without expanding collaborators.
- Modify `be/src/repositories/tasks.repository.ts`: return filtered lookups and persist task-group snapshots.
- Modify `be/test/system.e2e-spec.ts`: verify HTTP DTO boundaries and permission metadata.
- Modify `be/src/services/tasks.service.spec.ts`: verify group validation and snapshot semantics.
- Modify `be/test/tasks.e2e-spec.ts`: verify task lookup routing and DTO validation.
- Modify `be/test/full-app.db-spec.ts`: exercise actual group CRUD, lookup filtering, and task persistence against PostgreSQL.

### Frontend

- Modify `fe/src/types/system.ts`: add `UserGroup` and `UserGroupLookup`.
- Modify `fe/src/types/task.ts`: add task/input group fields.
- Modify `fe/src/api/system.ts`: add group CRUD and task lookup API adapters.
- Modify `fe/src/api/index.ts`: export the new APIs.
- Modify `fe/src/constants/consts.ts`: add one query key.
- Modify `fe/src/pages/system/system-crud-types.ts`: include the new page kind and entity.
- Modify `fe/src/pages/system/system-crud-form.ts`: add defaults and Zod validation.
- Create `fe/src/pages/system/components/user-group-form.tsx`: edit group name, description, and members.
- Modify `fe/src/pages/system/system-crud.tsx`: wire list, save, delete, table cells, and editor.
- Create `fe/src/pages/system/user-groups/index.tsx`: route wrapper.
- Modify `fe/src/router/index.tsx`: register `/system/user_group`.
- Modify `fe/src/config/menu-nav.tsx`: add the administration menu item.
- Modify `fe/src/pages/system/system-crud-form.test.ts`: test schema/default/form rendering.
- Modify `fe/src/pages/tasks/task-form.tsx`: store groups and implement additive expansion.
- Modify `fe/src/pages/tasks/new.tsx`: load and pass group lookups.
- Modify `fe/src/pages/tasks/edit.tsx`: load lookups without auto-expanding saved groups.
- Modify `fe/src/pages/tasks/task-form.test.ts`: test mapping and pure merge behavior.
- Modify `fe/src/api/tasks.test.ts`: verify group IDs survive task API mapping.

---

### Task 0: Restore Frontend Baseline Checks

**Files:**

- Modify: `fe/src/components/multi-combobox.test.tsx`
- Modify: `fe/vite.config.ts`

**Interfaces:**

- This task changes no product API. It restores a reliable test/build baseline
  before implementing user groups.

- [ ] **Step 1: Reproduce and identify each failure**

Run:

```powershell
cd fe
pnpm test -- src/components/multi-combobox.test.tsx
pnpm build
```

Record the exact failure from the rendered markup test and the unused
`mode` parameter reported by TypeScript. Inspect the test fixture, component,
and Vite config before changing code.

- [ ] **Step 2: Write or correct the failing behavioral test**

The component test must assert only the labels rendered as visible badges, not
the entire static markup which can contain hidden fixture text. Use a literal
expected count (`+1`) and the badge content rather than source text.

- [ ] **Step 3: Apply the smallest fixes**

Keep the component behavior unchanged. Correct only the test assertion so it
queries the visible badge labels, and remove the unused `mode` parameter from
the Vite config callback (or replace the callback with the static config
object if it reads no environment mode).

- [ ] **Step 4: Verify the restored baseline**

Run:

```powershell
cd fe
pnpm test
pnpm build
```

Expected: all frontend tests pass and the TypeScript/Vite build exits 0.

- [ ] **Step 5: Commit the baseline repair**

```powershell
cd fe
git add src/components/multi-combobox.test.tsx vite.config.ts
git commit -m "fix: restore frontend test baseline"
```

---

### Task 1: Backend User-Group Schema and Administration CRUD

**Files:**

- Modify: `be/prisma/schema.prisma`
- Create: `be/prisma/migrations/0003_user_groups/migration.sql`
- Modify: `be/src/dtos/system.dto.ts`
- Modify: `be/src/controllers/system.controller.ts`
- Modify: `be/src/services/system.service.ts`
- Modify: `be/src/repositories/system.repository.ts`
- Modify: `be/test/system.e2e-spec.ts`

**Interfaces:**

- Produces DTOs:

```ts
export class CreateUserGroupDto {
  name!: string;
  description?: string;
  userIds!: number[];
}

export class UpdateUserGroupDto extends PartialType(CreateUserGroupDto) {}
```

- Produces API value:

```ts
type UserGroupView = {
  id: number;
  name: string;
  description: string | null;
  userIds: number[];
  users: Array<{
    id: number;
    username: string;
    fullName: string;
    status: UserStatus;
    organization: { id: number; code: string; name: string };
  }>;
  createdAt: Date;
  updatedAt: Date;
};
```

- Routes require `users.manage`: `GET/POST /system/user-groups`, `GET/PATCH/DELETE /system/user-groups/:id`.

- [ ] **Step 1: Add failing HTTP and service tests**

Add cases to `be/test/system.e2e-spec.ts` that:

```ts
it('rejects duplicate user-group members at the HTTP boundary', async () => {
  await request(server)
    .post('/api/v1/system/user-groups')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Tổ A', userIds: [2, 2] })
    .expect(400);
  expect(systemService.createUserGroup).not.toHaveBeenCalled();
});
```

Extend the controller mock with `listUserGroups`, `getUserGroup`,
`createUserGroup`, `updateUserGroup`, and `deleteUserGroup`, then add all five
handlers to the permission metadata table with `users.manage`.

Add service-level cases in the same test file:

```ts
it('normalizes a user group and rejects a missing member', async () => {
  const repository = {
    findUserGroupByName: jest.fn().mockResolvedValue(null),
    findUsersByIds: jest.fn().mockResolvedValue([{ id: 2 }]),
    createUserGroup: jest.fn(),
  };
  const service = new SystemService(repository as unknown as SystemRepository);

  await expect(
    service.createUserGroup(
      { name: '  Tổ A  ', description: '  Liên đơn vị  ', userIds: [2, 3] },
      1,
      {},
    ),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(repository.createUserGroup).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
cd be
pnpm exec jest --config ./test/jest-e2e.json system.e2e-spec.ts --runInBand
```

Expected: FAIL because the DTOs, controller handlers, and service methods do
not exist.

- [ ] **Step 3: Add Prisma models and migration**

Add relations to `User` and `Task`, then define:

```prisma
model UserGroup {
  id          Int               @id @default(autoincrement())
  name        String            @unique @db.VarChar(255)
  description String?
  createdAt   DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime          @updatedAt @db.Timestamptz(3)
  members     UserGroupMember[]
  tasks       TaskUserGroup[]

  @@map("user_groups")
}

model UserGroupMember {
  userGroupId Int
  userId      Int
  userGroup   UserGroup @relation(fields: [userGroupId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userGroupId, userId])
  @@index([userId])
  @@map("user_group_members")
}

model TaskUserGroup {
  taskId      Int
  userGroupId Int
  task        Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userGroup   UserGroup @relation(fields: [userGroupId], references: [id], onDelete: Restrict)

  @@id([taskId, userGroupId])
  @@index([userGroupId])
  @@map("task_user_groups")
}
```

Create `0003_user_groups/migration.sql`:

```sql
CREATE TABLE "user_groups" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_group_members" (
  "userGroupId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  CONSTRAINT "user_group_members_pkey" PRIMARY KEY ("userGroupId", "userId")
);

CREATE TABLE "task_user_groups" (
  "taskId" INTEGER NOT NULL,
  "userGroupId" INTEGER NOT NULL,
  CONSTRAINT "task_user_groups_pkey" PRIMARY KEY ("taskId", "userGroupId")
);

CREATE UNIQUE INDEX "user_groups_name_key" ON "user_groups"("name");
CREATE INDEX "user_group_members_userId_idx" ON "user_group_members"("userId");
CREATE INDEX "task_user_groups_userGroupId_idx" ON "task_user_groups"("userGroupId");

ALTER TABLE "user_group_members"
  ADD CONSTRAINT "user_group_members_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "user_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_group_members"
  ADD CONSTRAINT "user_group_members_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_user_groups"
  ADD CONSTRAINT "task_user_groups_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_user_groups"
  ADD CONSTRAINT "task_user_groups_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "user_groups"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

Run:

```powershell
cd be
pnpm prisma validate
pnpm prisma generate
```

Expected: both commands exit 0.

- [ ] **Step 4: Implement DTO, repository, service, and controller**

Validate `name` with `@MinLength(1)`/`@MaxLength(255)`, `description` with
`@MaxLength(5000)`, and `userIds` with `@IsArray()`, `@ArrayUnique()`, and
`@IsInt({ each: true })`.

In `SystemRepository`, add:

```ts
listUserGroups(): Promise<UserGroupView[]>;
findUserGroupById(id: number): Promise<UserGroupView | null>;
findUserGroupByName(name: string): Promise<{ id: number } | null>;
findUsersByIds(ids: number[]): Promise<Array<{ id: number }>>;
createUserGroup(
  data: { name: string; description?: string; userIds: number[] },
  actorId: number,
  meta: RequestMeta,
): Promise<UserGroupView>;
updateUserGroup(
  id: number,
  data: { name?: string; description?: string; userIds?: number[] },
  actorId: number,
  meta: RequestMeta,
): Promise<UserGroupView>;
deleteUserGroup(id: number, actorId: number, meta: RequestMeta): Promise<void>;
```

Use nested `members.create` on create and `members: { deleteMany: {}, create:
... }` on member replacement. Select only public user fields. Write audit
actions `SYSTEM_USER_GROUP_CREATED`, `SYSTEM_USER_GROUP_UPDATED`, and
`SYSTEM_USER_GROUP_DELETED`. Before deletion, count `taskUserGroup` rows and
throw `ConflictException('User group is assigned to tasks')` when nonzero.

In `SystemService`, trim `name` and `description`, reject a duplicate name,
verify `findUsersByIds(userIds).length === userIds.length`, and translate
repository constraint errors through the existing `translate()` helper.

- [ ] **Step 5: Run backend checks**

Run:

```powershell
cd be
pnpm exec jest --config ./test/jest-e2e.json system.e2e-spec.ts --runInBand
pnpm build
```

Expected: tests PASS and build exits 0.

- [ ] **Step 6: Commit the backend CRUD**

```powershell
cd be
git add prisma/schema.prisma prisma/migrations/0003_user_groups/migration.sql src/dtos/system.dto.ts src/controllers/system.controller.ts src/services/system.service.ts src/repositories/system.repository.ts test/system.e2e-spec.ts
git commit -m "feat: add user group administration"
```

---

### Task 2: Backend Task Lookup and Group Snapshot Persistence

**Files:**

- Modify: `be/src/dtos/tasks.dto.ts`
- Modify: `be/src/controllers/tasks.controller.ts`
- Modify: `be/src/services/tasks.service.ts`
- Modify: `be/src/repositories/tasks.repository.ts`
- Modify: `be/src/services/tasks.service.spec.ts`
- Modify: `be/test/tasks.e2e-spec.ts`
- Modify: `be/test/full-app.db-spec.ts`

**Interfaces:**

- Consumes Prisma models from Task 1.
- Extends `TaskWrite` and `TaskView`, while keeping the HTTP field optional for
  backward compatibility:

```ts
userGroupIds: number[];
userGroups: Array<{ id: number; name: string }>;

// CreateTaskDto
userGroupIds?: number[];
```

- Produces lookup:

```ts
type UserGroupLookup = {
  id: number;
  name: string;
  organizationIds: number[];
};
```

- Produces `GET /tasks/lookups/user-groups`, authorized by the same
`tasks.read` assertion as existing task lookups.

- [ ] **Step 1: Add failing task service and controller tests**

In `repositoryMock()`, add:

```ts
findUserGroupsByIds: jest.fn().mockImplementation((ids: number[]) =>
  Promise.resolve(ids.map((id) => ({ id }))),
),
listUserGroupLookups: jest.fn().mockResolvedValue([
  { id: 5, name: 'Tổ A', organizationIds: [30] },
]),
```

Add tests:

```ts
it('rejects a task that references a missing user group', async () => {
  const repository = repositoryMock();
  repository.findUserGroupsByIds.mockResolvedValue([]);
  const service = new TasksService(repository as unknown as TasksRepository);

  await expect(
    service.create(
      {
        code: 'NV-008',
        name: 'Nhiệm vụ',
        type: 'DOT_XUAT',
        programId: 1,
        assigningOrganizationId: 10,
        leadOrganizationId: 20,
        collaboratorOrganizationIds: [30],
        userGroupIds: [999],
        dueAt: '2026-08-01T00:00:00.000Z',
      },
      thuongTruc,
    ),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('returns group lookups without changing collaborators', async () => {
  const repository = repositoryMock();
  const service = new TasksService(repository as unknown as TasksRepository);
  await expect(service.listUserGroupLookups(thuongTruc)).resolves.toEqual([
    { id: 5, name: 'Tổ A', organizationIds: [30] },
  ]);
});
```

In `be/test/tasks.e2e-spec.ts`, extend the service mock and assert
`GET /api/v1/tasks/lookups/user-groups` delegates to
`listUserGroupLookups(principal)`. Add an HTTP boundary case showing duplicate
`userGroupIds: [5, 5]` returns 400.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```powershell
cd be
pnpm test -- tasks.service.spec.ts --runInBand
pnpm exec jest --config ./test/jest-e2e.json tasks.e2e-spec.ts --runInBand
```

Expected: FAIL because task DTOs, repository fields, and lookup handler do not
exist.

- [ ] **Step 3: Implement task DTO and service validation**

Add to `CreateTaskDto`:

```ts
@ApiPropertyOptional({ type: [Number], default: [] })
@IsOptional()
@IsArray()
@ArrayUnique()
@IsInt({ each: true })
@Min(1, { each: true })
userGroupIds?: number[];
```

Add `userGroupIds` to `TaskWrite`. In `normalize()`, use
`input.userGroupIds ?? []`.
In `validate()`, query `findUserGroupsByIds()` and throw
`BadRequestException('Task user groups must exist')` when the returned count
differs. Do not derive or mutate `collaboratorOrganizationIds`.

On update, merge `input.userGroupIds ?? current.userGroupIds`. Include
`input.userGroupIds !== undefined` in the service's assignment authorization
check so it still requires `tasks.assign`, and include it in change extraction.
Do not classify a group-only change as an effective organization assignment
change inside `TasksRepository`, so it does not trigger the reporting-started
lock or assignment notifications.

- [ ] **Step 4: Implement repository lookup and persistence**

Extend `taskInclude`:

```ts
userGroups: {
  include: { userGroup: { select: { id: true, name: true } } },
},
```

Implement lookup with one Prisma query:

```ts
listUserGroupLookups() {
  return this.prisma.userGroup.findMany({
    select: {
      id: true,
      name: true,
      members: {
        where: {
          user: {
            deletedAt: null,
            status: UserStatus.ACTIVE,
            organization: {
              status: 'ACTIVE',
              isExecutingUnit: true,
            },
          },
        },
        select: { user: { select: { organizationId: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });
}
```

Map every row to a sorted unique `organizationIds` array.

On create, add:

```ts
userGroups: {
  create: input.userGroupIds.map((userGroupId) => ({ userGroupId })),
},
```

On update, when `input.userGroupIds !== undefined`, replace `taskUserGroup`
rows in the same transaction, then remove `userGroupIds` from `taskData`
before `transaction.task.update()`.

Map `userGroupIds`, `userGroups`, and audit `userGroupIds` in `toTask()` and
`taskAudit()`.

- [ ] **Step 5: Add a real database regression flow**

In `be/test/full-app.db-spec.ts`, add `users.manage` to the staff test group's
permissions and keep the created collaborator user ID. Before creating the
task:

1. Create one active group through `POST /system/user-groups`.
2. Lock a second user in another executing organization and include both users.
3. Assert `GET /tasks/lookups/user-groups` contains only the active
   collaborator organization ID.
4. Add `userGroupIds: [createdGroup.id]` to `taskInput`.
5. Assert the create response and subsequent `GET /tasks/:id` retain the same
   `userGroupIds` and unchanged `collaboratorOrganizationIds`.
6. Assert deleting the referenced group returns 409.

- [ ] **Step 6: Run backend verification**

Run:

```powershell
cd be
pnpm test -- tasks.service.spec.ts --runInBand
pnpm exec jest --config ./test/jest-e2e.json tasks.e2e-spec.ts --runInBand
pnpm build
```

If the local test database is available, also run:

```powershell
cd be
pnpm test:db -- full-app.db-spec.ts
```

Expected: focused tests PASS, build exits 0, and the database test PASSes when
its documented PostgreSQL test service is running.

- [ ] **Step 7: Commit backend task support**

```powershell
cd be
git add src/dtos/tasks.dto.ts src/controllers/tasks.controller.ts src/services/tasks.service.ts src/repositories/tasks.repository.ts src/services/tasks.service.spec.ts test/tasks.e2e-spec.ts test/full-app.db-spec.ts
git commit -m "feat: snapshot user groups on tasks"
```

---

### Task 3: Frontend User-Group Administration

**Files:**

- Modify: `fe/src/types/system.ts`
- Modify: `fe/src/api/system.ts`
- Modify: `fe/src/api/index.ts`
- Modify: `fe/src/constants/consts.ts`
- Modify: `fe/src/pages/system/system-crud-types.ts`
- Modify: `fe/src/pages/system/system-crud-form.ts`
- Create: `fe/src/pages/system/components/user-group-form.tsx`
- Modify: `fe/src/pages/system/system-crud.tsx`
- Create: `fe/src/pages/system/user-groups/index.tsx`
- Modify: `fe/src/router/index.tsx`
- Modify: `fe/src/config/menu-nav.tsx`
- Modify: `fe/src/pages/system/system-crud-form.test.ts`

**Interfaces:**

- Consumes backend CRUD from Task 1.
- Produces:

```ts
export type UserGroup = {
  id: number;
  name: string;
  description?: string | null;
  userIds: number[];
};

export const USER_GROUPS_KEY = ['system', 'user-groups'] as const;
export const userGroupsApi: {
  list(): Promise<UserGroup[]>;
  create(input: EntityInput<UserGroup>): Promise<UserGroup>;
  update(id: number, input: Partial<UserGroup>): Promise<UserGroup>;
  remove(id: number): Promise<void>;
};
```

- [ ] **Step 1: Add failing form contract tests**

Extend `fe/src/pages/system/system-crud-form.test.ts`:

```ts
it('defaults and validates a user group', () => {
  expect(defaultItem('user-groups')).toEqual({
    id: 0,
    name: '',
    description: '',
    userIds: [],
  });
  expect(
    userGroupSchema.safeParse({
      ...defaultItem('user-groups'),
      name: ' ',
    }).success,
  ).toBe(false);
});

it('renders user group fields and locked member state', () => {
  const html = renderToStaticMarkup(
    createElement(UserGroupForm, {
      defaultValues: { id: 0, name: '', description: '', userIds: [2] },
      onSubmit: submit,
      users: [
        {
          ...defaultItem('users', 1),
          id: 2,
          username: 'locked',
          fullName: 'Người dùng khóa',
          tenDonVi: 'Đơn vị A',
          status: 'LOCKED',
        },
      ],
    }),
  );
  expect(html).toContain('Tên nhóm');
  expect(html).toContain('Người dùng khóa');
  expect(html).toContain('Đã khóa');
});
```

- [ ] **Step 2: Run the focused frontend test and verify failure**

Run:

```powershell
cd fe
pnpm test -- src/pages/system/system-crud-form.test.ts
```

Expected: FAIL because `UserGroup`, `userGroupSchema`, and `UserGroupForm` do
not exist.

- [ ] **Step 3: Add frontend types and API adapter**

Add `UserGroup` and:

```ts
export type UserGroupLookup = {
  id: number;
  name: string;
  organizationIds: number[];
};
```

Map backend group responses without transforming field names:

```ts
export const userGroupsApi = crudApi<UserGroup, UserGroupResponse, object>(
  '/system/user-groups',
  (item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    userIds: item.userIds,
  }),
  (item) => ({
    name: item.name,
    description: item.description || undefined,
    userIds: item.userIds,
  }),
);
```

Export the API and add `USER_GROUPS_KEY`.

- [ ] **Step 4: Implement the administration form and page wiring**

Extend:

```ts
export type PageKind =
  | 'departments'
  | 'roles'
  | 'task-categories'
  | 'users'
  | 'user-groups';

export type AnyItem =
  | Department
  | RoleGroup
  | TaskCategory
  | ManagedUser
  | UserGroup;
```

Add:

```ts
export const userGroupSchema = z.object({
  id: z.number(),
  name: required('Tên nhóm là bắt buộc'),
  description: z.string().nullable().optional(),
  userIds: z.array(z.number()),
});
```

`UserGroupForm` uses the existing `Checkbox`, `Field`, `Input`, and `Textarea`
components. Render every `ManagedUser`; show `fullName`, `tenDonVi`, and an
“Đã khóa” badge without disabling the checkbox.

Extend `SystemCrudPage` branches for list/save/remove, query
`usersApi.list()` for form choices, and render columns `Tên nhóm`, `Mô tả`,
`Số thành viên`. Remove no existing CRUD behavior.

Add the wrapper:

```tsx
export default function UserGroupsPage() {
  return <SystemCrudPage kind='user-groups' />;
}
```

Register route `system/user_group` and menu label “Nhóm người dùng”.

- [ ] **Step 5: Run frontend checks**

Run:

```powershell
cd fe
pnpm test -- src/pages/system/system-crud-form.test.ts
pnpm build
```

Expected: focused test PASS and build exits 0.

- [ ] **Step 6: Commit frontend administration**

```powershell
cd fe
git add src/types/system.ts src/api/system.ts src/api/index.ts src/constants/consts.ts src/pages/system/system-crud-types.ts src/pages/system/system-crud-form.ts src/pages/system/components/user-group-form.tsx src/pages/system/system-crud.tsx src/pages/system/user-groups/index.tsx src/router/index.tsx src/config/menu-nav.tsx src/pages/system/system-crud-form.test.ts
git commit -m "feat: add user group administration"
```

---

### Task 4: Frontend Task Group Selection and Additive Refresh

**Files:**

- Modify: `fe/src/types/task.ts`
- Modify: `fe/src/api/system.ts`
- Modify: `fe/src/api/index.ts`
- Modify: `fe/src/pages/tasks/task-form.tsx`
- Modify: `fe/src/pages/tasks/new.tsx`
- Modify: `fe/src/pages/tasks/edit.tsx`
- Modify: `fe/src/pages/tasks/task-form.test.ts`
- Modify: `fe/src/api/tasks.test.ts`

**Interfaces:**

- Consumes `UserGroupLookup` and task payload support from Task 2.
- Extends `TaskInput` and `TaskFormState` with a required array. Add the field
  as optional on the compatibility-heavy `Task` view:

```ts
// TaskInput and TaskFormState
userGroupIds: number[];

// Task
userGroupIds?: number[];
```

- Produces the pure helper:

```ts
export function mergeGroupOrganizations(
  collaboratorOrganizationIds: number[],
  selectedGroupIds: number[],
  groups: UserGroupLookup[],
  leadOrganizationId: number,
): number[];
```

- Produces API:

```ts
export const taskUserGroupsApi = {
  list(): Promise<UserGroupLookup[]>;
};
```

- [ ] **Step 1: Add failing mapping and merge tests**

Extend `base` in `task-form.test.ts` with `userGroupIds: [5]`, then assert
`formToTaskInput(base).userGroupIds` equals `[5]`.

Add:

```ts
it('adds current group organizations without removing old manual choices', () => {
  expect(
    mergeGroupOrganizations(
      [30, 99],
      [5, 6],
      [
        { id: 5, name: 'Tổ A', organizationIds: [20, 30, 40] },
        { id: 6, name: 'Tổ B', organizationIds: [40, 50] },
      ],
      20,
    ),
  ).toEqual([30, 40, 50, 99]);
});

it('does not expand saved groups while mapping an existing task', () => {
  const form = taskToForm({
    ...backendCompatibleTask,
    userGroupIds: [5],
    collaboratorOrganizationIds: [99],
  });
  expect(form.userGroupIds).toEqual([5]);
  expect(form.collaboratorOrganizationIds).toEqual([99]);
});
```

In `fe/src/api/tasks.test.ts`, add `userGroupIds: [5]` to the backend fixture
and assert list/get/create/update mappings preserve it.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```powershell
cd fe
pnpm test -- src/pages/tasks/task-form.test.ts src/api/tasks.test.ts
```

Expected: FAIL because group fields, lookup API, and merge helper do not exist.

- [ ] **Step 3: Implement types, lookup API, and form mapping**

Add:

```ts
export const taskUserGroupsApi = {
  async list(): Promise<UserGroupLookup[]> {
    const response = await baseRequest.get<
      ApiEnvelope<UserGroupLookup[]> | UserGroupLookup[]
    >('/tasks/lookups/user-groups');
    return data(response.data);
  },
};
```

Set `emptyTaskForm.userGroupIds` to `[]`. `taskToForm()` copies
`task.userGroupIds ?? []`; it must not call the merge helper. `formToTaskInput()`
copies both `userGroupIds` and `collaboratorOrganizationIds`.

Implement the helper with native `Set` and a numeric sort:

```ts
export function mergeGroupOrganizations(
  current: number[],
  selectedGroupIds: number[],
  groups: UserGroupLookup[],
  leadOrganizationId: number,
) {
  return [
    ...new Set([
      ...current,
      ...groups
        .filter(({ id }) => selectedGroupIds.includes(id))
        .flatMap(({ organizationIds }) => organizationIds),
    ]),
  ]
    .filter((id) => id !== leadOrganizationId)
    .sort((left, right) => left - right);
}
```

- [ ] **Step 4: Wire task pages and UI behavior**

In both `new.tsx` and `edit.tsx`, fetch `taskUserGroupsApi.list()` with
`USER_GROUPS_KEY` and pass `userGroups={query.data ?? []}` to `TaskForm`.

In `TaskForm`:

1. Add a multiple group combobox using the existing chip combobox components.
2. On selection change, set the new `userGroupIds` and immediately call
   `mergeGroupOrganizations()` with the new IDs.
3. Keep the collaborator combobox fully editable.
4. Add a button labeled “Bổ sung đơn vị mới từ nhóm” that calls the same helper
   with all currently selected group IDs.
5. Disable the button when no group is selected.
6. When a selected group has `organizationIds.length === 0`, render:
   “Nhóm không có thành viên hoạt động thuộc đơn vị thực hiện”.
7. When `leadOrganizationId` changes, remove that ID from collaborators using
   the existing `setForm` call.
8. Removing a group chip changes only `userGroupIds`; it does not remove any
   collaborator organization.

- [ ] **Step 5: Run frontend verification**

Run:

```powershell
cd fe
pnpm test -- src/pages/tasks/task-form.test.ts src/api/tasks.test.ts
pnpm test
pnpm build
```

Expected: focused and full frontend tests PASS; build exits 0.

- [ ] **Step 6: Commit frontend task selection**

```powershell
cd fe
git add src/types/task.ts src/api/system.ts src/api/index.ts src/pages/tasks/task-form.tsx src/pages/tasks/new.tsx src/pages/tasks/edit.tsx src/pages/tasks/task-form.test.ts src/api/tasks.test.ts
git commit -m "feat: select user groups on tasks"
```

---

## Final Verification

- [ ] Run backend unit/e2e/build checks:

```powershell
cd be
pnpm test -- --runInBand
pnpm exec jest --config ./test/jest-e2e.json --runInBand
pnpm build
pnpm prisma validate
```

- [ ] Run the PostgreSQL suite when the local test database is available:

```powershell
cd be
pnpm test:db
```

- [ ] Run frontend checks:

```powershell
cd fe
pnpm test
pnpm lint
pnpm build
```

- [ ] Confirm both repositories are clean:

```powershell
git -C be status --short
git -C fe status --short
```

Expected: all available checks PASS and both commands print no uncommitted
files.
