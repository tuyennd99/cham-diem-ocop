# User Group Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gỡ hoàn toàn tính năng nhóm người dùng mà không thay đổi các đơn vị phối hợp đã lưu trên task hoặc làm mất thay đổi chưa commit không liên quan.

**Architecture:** Thực hiện gỡ tiến bằng các commit mới trên hai nhánh `dev`. Backend bỏ API và quan hệ nhóm trước, sau đó thêm migration tiến để xoá ba bảng; frontend bỏ màn quản trị rồi bỏ nhóm khỏi form task. Các file đang có thay đổi khác phải được chỉnh và stage theo từng hunk.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Jest/Supertest, React 19, TanStack Router/Query, Vitest, TypeScript, pnpm.

## Global Constraints

- Làm trực tiếp trên nhánh `dev` của `be` và `fe`; không tạo worktree.
- Không dùng `git reset`, không viết lại lịch sử và không revert nguyên commit.
- Giữ `be/prisma/migrations/0003_user_groups/migration.sql`.
- Không backup dữ liệu nhóm; migration mới được phép xoá vĩnh viễn dữ liệu nhóm.
- Không sửa hoặc xoá dữ liệu `task_collaborators` và không thay đổi ý nghĩa của `collaboratorOrganizationIds`.
- Giữ mọi thay đổi chưa commit không liên quan, đặc biệt các thay đổi Swagger/response ở backend và form/combobox/DataTable ở frontend.
- Giữ commit sửa frontend baseline và commit sửa CORS/CSRF backend.
- Với file có thay đổi chồng lấn, dùng `git add -p -- <paths>` rồi kiểm tra `git diff --cached`; không stage toàn file.
- Chỉ xoá toàn file khi file đó chỉ phục vụ nhóm người dùng.
- Không thêm dependency hoặc abstraction mới.

---

## File Map

### Backend system administration

- `be/src/dtos/system.dto.ts`: bỏ DTO nhóm, giữ DTO Swagger/Zod khác.
- `be/src/controllers/system.controller.ts`: bỏ năm route quản trị nhóm, giữ decorator Swagger mới.
- `be/src/services/system.service.ts`: bỏ điều phối CRUD nhóm.
- `be/src/repositories/system.repository.ts`: bỏ type, query, transaction và audit nhóm.
- `be/src/repositories/system.repository.spec.ts`: xoá vì chỉ kiểm tra membership nhóm.
- `be/test/system.e2e-spec.ts`: thay kiểm tra CRUD nhóm bằng kiểm tra route đã biến mất.

### Backend task assignment

- `be/src/dtos/tasks.dto.ts`: bỏ `userGroupIds`.
- `be/src/controllers/tasks.controller.ts`: bỏ lookup nhóm.
- `be/src/services/tasks.service.ts`: bỏ lookup, kiểm tra và merge `userGroupIds`.
- `be/src/repositories/tasks.repository.ts`: bỏ type, include, persistence và mapping nhóm.
- `be/src/services/tasks.service.spec.ts`: bỏ fixture/mock/test nhóm.
- `be/test/tasks.e2e-spec.ts`: kiểm tra lookup biến mất và payload cũ bị từ chối.

### Database and real-repository coverage

- `be/prisma/migrations/0004_remove_user_groups/migration.sql`: xoá ba bảng theo thứ tự khoá ngoại.
- `be/prisma/schema.prisma`: bỏ ba model và hai relation.
- `be/test/full-app.db-spec.ts`: bỏ setup/assertion nhóm, giữ kiểm tra đơn vị phối hợp.

### Frontend system administration

- `fe/src/types/system.ts`: bỏ `UserGroup`, tạm giữ `UserGroupLookup` cho task.
- `fe/src/api/system.ts`: bỏ `UserGroupResponse` và `userGroupsApi`, tạm giữ lookup task.
- `fe/src/api/index.ts`: bỏ export `userGroupsApi`.
- `fe/src/api/system.test.ts`: xoá vì chỉ kiểm tra API nhóm.
- `fe/src/config/menu-nav.tsx`: bỏ menu nhóm.
- `fe/src/router/index.tsx`: bỏ route nhóm.
- `fe/src/pages/system/components/user-group-form.tsx`: xoá.
- `fe/src/pages/system/user-groups/index.tsx`: xoá.
- `fe/src/pages/system/system-crud-types.ts`: bỏ `PAGE_KIND.USER_GROUPS` và `UserGroup` khỏi union; giữ `PAGE_KIND` và `CRUD_FORM_ID`.
- `fe/src/pages/system/system-crud-form.ts`: bỏ schema/default nhóm; giữ validate username và refactor `PAGE_KIND`.
- `fe/src/pages/system/system-crud.tsx`: bỏ nhánh CRUD nhóm; giữ footer form và các refactor khác.
- `fe/src/pages/system/system-crud-form.test.ts`: bỏ import/test nhóm; giữ test username và form khác.

### Frontend task form

- `fe/src/types/system.ts`: bỏ `UserGroupLookup`.
- `fe/src/types/task.ts`: bỏ `userGroupIds`.
- `fe/src/constants/consts.ts`: bỏ `USER_GROUPS_KEY`.
- `fe/src/api/system.ts`: bỏ `taskUserGroupsApi`.
- `fe/src/api/index.ts`: bỏ export lookup nhóm.
- `fe/src/api/tasks.test.ts`: bỏ fixture/assertion nhóm.
- `fe/src/pages/tasks/new.tsx`: bỏ query và prop nhóm.
- `fe/src/pages/tasks/edit.tsx`: bỏ query và prop nhóm.
- `fe/src/pages/tasks/task-form.tsx`: bỏ state, mapper, helper và UI nhóm; giữ nguyên bộ chọn đơn vị phối hợp và các thay đổi chưa commit khác.
- `fe/src/pages/tasks/task-form.test.ts`: bỏ test merge nhóm, thêm regression check payload chỉ chứa đơn vị phối hợp.

### Documentation

- Delete `be/docs/superpowers/specs/2026-07-29-user-groups-task-selection-design.md`.
- Delete `be/docs/superpowers/plans/2026-07-29-user-groups-task-selection.md`.
- Keep `be/docs/superpowers/specs/2026-07-29-remove-user-groups-design.md`.
- Keep this plan.

---

### Task 1: Remove backend user-group administration

**Files:**

- Modify: `be/test/system.e2e-spec.ts`
- Modify: `be/src/dtos/system.dto.ts`
- Modify: `be/src/controllers/system.controller.ts`
- Modify: `be/src/services/system.service.ts`
- Modify: `be/src/repositories/system.repository.ts`
- Delete: `be/src/repositories/system.repository.spec.ts`

**Interfaces:**

- Consumes: Existing `/api/v1/system/*` controller and `users.manage` authentication.
- Produces: API quản trị user/đơn vị/chương trình/nhóm quyền giữ nguyên; phần quản trị nhóm bị xoá.

- [ ] **Step 1: Record the dirty-worktree boundary**

Run in `be`:

```powershell
git status --short
git diff --name-only
```

Expected: danh sách hiện tại được giữ làm mốc; không stage hay sửa file nào ở bước này.

- [ ] **Step 2: Remove group-only system tests**

Trong `be/test/system.e2e-spec.ts`, xoá:

```text
năm mock method nhóm
ba validation test nhóm
dòng permission table của nhóm
năm metadata entries của nhóm
```

Xoá `be/src/repositories/system.repository.spec.ts` vì file chỉ kiểm tra membership của tính năng bị gỡ. Không thêm test cho API đã xoá.

- [ ] **Step 3: Remove the system user-group implementation**

Xoá chính xác các phần sau:

```text
src/dtos/system.dto.ts
  CreateUserGroupDto
  UpdateUserGroupDto
  createUserGroupSchema

src/controllers/system.controller.ts
  imports của hai DTO nhóm
  năm handler CRUD user-groups

src/services/system.service.ts
  imports DTO nhóm
  listUserGroups
  getUserGroup
  createUserGroup
  updateUserGroup
  deleteUserGroup

src/repositories/system.repository.ts
  USER_GROUP_INCLUDE
  UserGroupPayload
  UserGroupView
  UserGroupData
  listUserGroups
  findUserGroupById
  findUserGroupByName
  createUserGroup
  updateUserGroup
  deleteUserGroup
  toUserGroup
  transaction.userGroupMember.deleteMany trong deleteUser
```

Không thay đổi các decorator Swagger/response mới trong những file chồng lấn.

- [ ] **Step 4: Run focused backend checks**

Run in `be`:

```powershell
pnpm test:e2e -- --runInBand system.e2e-spec.ts
pnpm build
```

Expected: cả hai lệnh PASS.

- [ ] **Step 5: Stage only removal hunks and commit**

Run in `be`:

```powershell
git add -p -- src/dtos/system.dto.ts src/controllers/system.controller.ts src/services/system.service.ts src/repositories/system.repository.ts test/system.e2e-spec.ts
git add -u -- src/repositories/system.repository.spec.ts
git diff --cached --check
git diff --cached
git commit -m "refactor: remove user group administration"
```

Expected: staged diff không chứa thay đổi Swagger/response không liên quan.

---
### Task 2: Remove user groups from backend task APIs

**Files:**

- Modify: `be/test/tasks.e2e-spec.ts`
- Modify: `be/src/dtos/tasks.dto.ts`
- Modify: `be/src/controllers/tasks.controller.ts`
- Modify: `be/src/services/tasks.service.ts`
- Modify: `be/src/repositories/tasks.repository.ts`
- Modify: `be/src/services/tasks.service.spec.ts`

**Interfaces:**

- Consumes: Existing strict task Zod DTO and `collaboratorOrganizationIds`.
- Produces: Task API chỉ dùng đơn vị phối hợp; phần lookup, lưu và trả nhóm bị xoá.

- [ ] **Step 1: Remove group-only task tests and fixtures**

Trong `be/test/tasks.e2e-spec.ts`, xoá mock lookup nhóm, test duplicate groups và test lookup nhóm.

Trong `be/src/services/tasks.service.spec.ts`:

```text
xoá userGroupIds và userGroups khỏi existingTask
xoá mock findUserGroupsByIds và listUserGroupLookups
xoá test missing group, lookup group và update chỉ bằng group IDs
giữ mọi test quyền phân công và đơn vị phối hợp
```

- [ ] **Step 2: Remove task group DTO, controller and service logic**

Xoá:

```text
src/dtos/tasks.dto.ts
  userGroupIds field

src/controllers/tasks.controller.ts
  handler lookup nhóm

src/services/tasks.service.ts
  listUserGroupLookups
  assignment authorization condition dựa trên group IDs
  current/input merge của group IDs
  findUserGroupsByIds validation
  normalized group IDs default
```

Sau thay đổi, authorization giao đơn vị chỉ phụ thuộc các trường phân công hiện có. Không thay đổi validation bắt buộc ít nhất một `collaboratorOrganizationIds`.

- [ ] **Step 3: Remove repository persistence and mapping**

Trong `be/src/repositories/tasks.repository.ts`, xoá:

```text
UserGroupLookup
group ID fields trong TaskWrite/TaskUpdate
group relation trong Prisma include/select
findUserGroupsByIds
listUserGroupLookups
taskUserGroup create/deleteMany/createMany
việc loại group IDs khỏi taskData
mapping group IDs/group views trong toTask và audit payload
```

Giữ nguyên mọi thao tác `taskCollaborator` và mapping `collaboratorOrganizationIds`.

- [ ] **Step 4: Run focused task checks**

Run in `be`:

```powershell
pnpm test -- --runInBand services/tasks.service.spec.ts
pnpm test:e2e -- --runInBand tasks.e2e-spec.ts
pnpm build
```

Expected: cả ba lệnh PASS.

- [ ] **Step 5: Stage only task-removal hunks and commit**

Run in `be`:

```powershell
git add -p -- src/dtos/tasks.dto.ts src/controllers/tasks.controller.ts src/services/tasks.service.ts src/repositories/tasks.repository.ts src/services/tasks.service.spec.ts test/tasks.e2e-spec.ts
git diff --cached --check
git diff --cached
git commit -m "refactor: remove user groups from tasks"
```

Expected: staged diff không chứa thay đổi response/Swagger ngoài phạm vi.

---
### Task 3: Add the forward drop migration and clean database E2E coverage

**Files:**

- Create: `be/prisma/migrations/0004_remove_user_groups/migration.sql`
- Modify: `be/prisma/schema.prisma`
- Modify: `be/test/full-app.db-spec.ts`

**Interfaces:**

- Consumes: Migration `0003_user_groups` and task collaborator tables.
- Produces: Prisma schema không còn model nhóm; database đã/newly migrated đều bỏ ba bảng nhóm.

- [ ] **Step 1: Simplify the real-repository scenario**

Trong `be/test/full-app.db-spec.ts`:

- Xoá setup/ID/user chỉ phục vụ locked group member.
- Xoá create/get/update/delete group và group lookup.
- Xoá `userGroupIds` khỏi `taskInput`, response types và assertions.
- Xoá task update chỉ thay `userGroupIds`.
- Giữ assertion sau cho create và persisted task:

```ts
expect(task.collaboratorOrganizationIds).toEqual([
  collaboratorOrganizationId,
]);

expect(
  readBody<
    ApiBody<{ collaboratorOrganizationIds: number[] }>
  >(persistedTask).data,
).toEqual(
  expect.objectContaining({
    collaboratorOrganizationIds: [collaboratorOrganizationId],
  }),
);
```

- [ ] **Step 2: Create the forward migration**

Tạo `be/prisma/migrations/0004_remove_user_groups/migration.sql`:

```sql
DROP TABLE "task_user_groups";
DROP TABLE "user_group_members";
DROP TABLE "user_groups";
```

Không dùng `CASCADE`; thứ tự trên đã tháo các khoá ngoại phụ thuộc.

- [ ] **Step 3: Remove group models and relations from Prisma**

Trong `be/prisma/schema.prisma`, xoá:

```text
User.userGroups
Task.userGroups
model UserGroup
model UserGroupMember
model TaskUserGroup
```

Không sửa model `TaskCollaborator`, `Task` collaborator relation hoặc bảng
`task_collaborators`.

- [ ] **Step 4: Validate and generate Prisma**

Run in `be`:

```powershell
pnpm prisma format
pnpm prisma validate
pnpm prisma generate
pnpm build
```

Expected: cả bốn lệnh PASS và Prisma Client không còn delegate nhóm.

- [ ] **Step 5: Run database coverage when available**

Run in `be`:

```powershell
if ($env:TEST_DATABASE_URL) { pnpm test:db } else { Write-Host 'SKIP test:db: TEST_DATABASE_URL is not set' }
```

Expected: PASS khi database kiểm thử sẵn sàng; nếu biến môi trường không có thì
ghi nhận đúng một giới hạn môi trường, không coi là lỗi mã nguồn.

- [ ] **Step 6: Stage database removal and commit**

Run in `be`:

```powershell
git add -- prisma/migrations/0004_remove_user_groups/migration.sql
git add -p -- prisma/schema.prisma test/full-app.db-spec.ts
git diff --cached --check
git diff --cached
git commit -m "refactor: drop user group tables"
```

Expected: migration `0003_user_groups` không bị stage hoặc xoá.

---

### Task 4: Remove frontend user-group administration

**Files:**

- Modify: `fe/src/types/system.ts`
- Modify: `fe/src/api/system.ts`
- Modify: `fe/src/api/index.ts`
- Delete: `fe/src/api/system.test.ts`
- Modify: `fe/src/config/menu-nav.tsx`
- Modify: `fe/src/router/index.tsx`
- Delete: `fe/src/pages/system/components/user-group-form.tsx`
- Delete: `fe/src/pages/system/user-groups/index.tsx`
- Modify: `fe/src/pages/system/system-crud-types.ts`
- Modify: `fe/src/pages/system/system-crud-form.ts`
- Modify: `fe/src/pages/system/system-crud.tsx`
- Modify: `fe/src/pages/system/system-crud-form.test.ts`

**Interfaces:**

- Consumes: Existing generic system CRUD page.
- Produces: Không còn menu, route, form hoặc API quản trị nhóm; CRUD khác giữ nguyên.

- [ ] **Step 1: Record the frontend dirty-worktree boundary**

Run in `fe`:

```powershell
git status --short
git diff --name-only
```

Expected: ghi nhận các thay đổi form/combobox/DataTable hiện có để đối chiếu cuối.

- [ ] **Step 2: Remove group-only API and UI files**

Xoá:

```text
src/types/system.ts
  UserGroup only; keep UserGroupLookup until Task 5

src/api/system.ts
  UserGroup import
  UserGroupResponse
  userGroupsApi

src/api/index.ts
  userGroupsApi export only; keep taskUserGroupsApi until Task 5

src/config/menu-nav.tsx
  menu item title "Nhóm người dùng", href "/system/user_group"

src/router/index.tsx
  route path "user_group"

whole files
  src/api/system.test.ts
  src/pages/system/components/user-group-form.tsx
  src/pages/system/user-groups/index.tsx
```

- [ ] **Step 3: Remove the generic CRUD branch without reverting shared improvements**

Xoá `USER_GROUPS` và `UserGroup` khỏi
type và các nhánh frontend CRUD dùng chung:

```ts
export const PAGE_KIND = {
  DEPARTMENTS: 'departments',
  ROLES: 'roles',
  TASK_CATEGORIES: 'task-categories',
  USERS: 'users',
} as const;

export type AnyItem =
  | Department
  | RoleGroup
  | TaskCategory
  | ManagedUser;
```

Trong `system-crud-form.ts`, xoá `userGroupSchema` và default group. Trong
`system-crud.tsx`, xoá imports/query/API/title/column/cells/editor của nhóm và
`usersQuery`/`users` prop chỉ phục vụ group form.

Giữ `CRUD_FORM_ID`, footer submit button, `PAGE_KIND` cho bốn loại còn lại và
username regex.

- [ ] **Step 4: Remove group-only frontend tests**

Trong `system-crud-form.test.ts`, xoá:

```text
UserGroup import
UserGroupForm import
userGroupSchema import
"defaults and validates a user group" test
"renders user group fields and locked member state" test
```

Giữ các test user/department/role/task category, kể cả test username mới.

- [ ] **Step 5: Run focused frontend checks**

Run in `fe`:

```powershell
pnpm test -- src/pages/system/system-crud-form.test.ts
pnpm build
```

Expected: cả hai lệnh PASS.

- [ ] **Step 6: Stage only administration-removal changes and commit**

Run in `fe`:

```powershell
git add -p -- src/types/system.ts src/api/system.ts src/api/index.ts src/config/menu-nav.tsx src/router/index.tsx src/pages/system/system-crud-types.ts src/pages/system/system-crud-form.ts src/pages/system/system-crud.tsx src/pages/system/system-crud-form.test.ts
git add -u -- src/api/system.test.ts src/pages/system/components/user-group-form.tsx src/pages/system/user-groups/index.tsx
git diff --cached --check
git diff --cached
git commit -m "refactor: remove user group administration"
```

Expected: staged diff giữ nguyên cải tiến generic CRUD và không chứa thay đổi
combobox/DataTable không liên quan.

---

### Task 5: Remove user groups from the frontend task flow

**Files:**

- Modify: `fe/src/types/system.ts`
- Modify: `fe/src/types/task.ts`
- Modify: `fe/src/constants/consts.ts`
- Modify: `fe/src/api/system.ts`
- Modify: `fe/src/api/index.ts`
- Modify: `fe/src/api/tasks.test.ts`
- Modify: `fe/src/pages/tasks/new.tsx`
- Modify: `fe/src/pages/tasks/edit.tsx`
- Modify: `fe/src/pages/tasks/task-form.tsx`
- Modify: `fe/src/pages/tasks/task-form.test.ts`

**Interfaces:**

- Consumes: `collaboratorOrganizationIds` task contract and department lookup.
- Produces: Form create/edit task chỉ chọn và gửi đơn vị phối hợp.

- [ ] **Step 1: Replace group mapping tests with collaborator-only regression**

Trong `task-form.test.ts`, xoá `userGroupIds` khỏi `base`, import
`mergeGroupOrganizations`, test preserved groups, test task-to-form groups và
toàn bộ suite `group organization merge`. Thay test đầu bằng:

```ts
it('keeps collaborator organizations in the task input', () => {
  expect(formToTaskInput(base).collaboratorOrganizationIds).toEqual([30]);
});
```

Ở render test, xoá prop `userGroups: []`.

- [ ] **Step 2: Run the focused mapping test**

Run in `fe`:

```powershell
pnpm test -- src/pages/tasks/task-form.test.ts
```

Expected: PASS; đây là mốc bảo vệ dữ liệu đơn vị phối hợp trước khi xoá logic nhóm.

- [ ] **Step 3: Remove the group contract and lookup client**

Xoá:

```text
src/types/system.ts
  UserGroupLookup

src/types/task.ts
  userGroupIds from TaskInput
  userGroupIds from Task

src/constants/consts.ts
  USER_GROUPS_KEY

src/api/system.ts
  UserGroupLookup import
  taskUserGroupsApi

src/api/index.ts
  taskUserGroupsApi export
```

- [ ] **Step 4: Remove group queries from new/edit pages**

Trong cả `new.tsx` và `edit.tsx`, xoá:

```text
taskUserGroupsApi import
USER_GROUPS_KEY import
userGroupsQuery
userGroups prop passed to TaskForm
```

Giữ nguyên query program và department.

- [ ] **Step 5: Remove group state, helper and UI from TaskForm**

Trong `task-form.tsx`, xoá:

```text
UserGroupLookup import
TaskFormState.userGroupIds
emptyTaskForm.userGroupIds
taskToForm/formToTaskInput mapping userGroupIds
mergeGroupOrganizations helper
userGroups prop
userGroupOptions/getUserGroupLabel
selectedGroupWithoutOrganizations
"Nhóm người dùng" combobox
"Cập nhật lại từ nhóm" button
group warning
```

Giữ nguyên:

```text
collaboratorOrganizationIds state and mapping
collaborator combobox
programOptions
codeError validation
truncate wrapper for collaborator label
Field error/aria-invalid behavior
```

- [ ] **Step 6: Remove group fields from API fixtures**

Trong `api/tasks.test.ts`:

- Xoá `userGroupIds` khỏi `backendTask`, create input và assertions.
- Xoá test “preserves selected user groups while updating a task”.
- Trong test native contract, giữ assertion cho `code`, `type`, `frequency` và
  `collaboratorOrganizationIds`.

Kết quả create tối thiểu:

```ts
expect(request.post).toHaveBeenCalledWith(
  '/tasks',
  expect.objectContaining({
    code: 'NV-007',
    type: 'DINH_KY',
    frequency: 'MONTHLY',
    collaboratorOrganizationIds: [30],
  }),
);
```

- [ ] **Step 7: Run focused frontend checks**

Run in `fe`:

```powershell
pnpm test -- src/pages/tasks/task-form.test.ts src/api/tasks.test.ts
pnpm build
```

Expected: cả hai lệnh PASS.

- [ ] **Step 8: Stage only task-removal hunks and commit**

Run in `fe`:

```powershell
git add -p -- src/types/system.ts src/types/task.ts src/constants/consts.ts src/api/system.ts src/api/index.ts src/api/tasks.test.ts src/pages/tasks/new.tsx src/pages/tasks/edit.tsx src/pages/tasks/task-form.tsx src/pages/tasks/task-form.test.ts
git diff --cached --check
git diff --cached
git commit -m "refactor: remove user groups from tasks"
```

Expected: staged diff không chứa validate code/program/combobox changes không
liên quan.

---

### Task 6: Remove obsolete docs and run the full verification gate

**Files:**

- Delete: `be/docs/superpowers/specs/2026-07-29-user-groups-task-selection-design.md`
- Delete: `be/docs/superpowers/plans/2026-07-29-user-groups-task-selection.md`

**Interfaces:**

- Consumes: Completed backend/frontend removal.
- Produces: Repository source and active docs no longer describe an available user-group feature.

- [ ] **Step 1: Delete obsolete feature documentation**

Xoá đúng hai file cũ:

```text
be/docs/superpowers/specs/2026-07-29-user-groups-task-selection-design.md
be/docs/superpowers/plans/2026-07-29-user-groups-task-selection.md
```

Giữ spec và plan gỡ bỏ.

- [ ] **Step 2: Verify no backend implementation references remain**

Run in `be`:

```powershell
rg -n -S "UserGroup|UserGroupMember|TaskUserGroup|userGroupIds|/system/user-groups|/tasks/lookups/user-groups" prisma/schema.prisma src test
```

Expected: không có output. Không tìm trong `0003_user_groups` hoặc
`0004_remove_user_groups`, vì migration lịch sử/drop phải còn tên bảng.

- [ ] **Step 3: Verify no frontend references remain**

Run in `fe`:

```powershell
rg -n -S "UserGroup|userGroupIds|user-groups|USER_GROUPS_KEY|Nhóm người dùng|Cập nhật lại từ nhóm" src
```

Expected: không có output.

- [ ] **Step 4: Run the complete backend gate**

Run in `be`:

```powershell
pnpm prisma format
pnpm prisma validate
pnpm test -- --runInBand
pnpm test:e2e -- --runInBand
pnpm exec eslint "{src,apps,libs,test}/**/*.ts"
pnpm build
if ($env:TEST_DATABASE_URL) { pnpm test:db } else { Write-Host 'SKIP test:db: TEST_DATABASE_URL is not set' }
```

Expected: mọi lệnh khả dụng PASS. `test:db` chỉ được skip vì thiếu
`TEST_DATABASE_URL`/PostgreSQL và phải được nêu trong bàn giao.

- [ ] **Step 5: Run the complete frontend gate**

Run in `fe`:

```powershell
pnpm test
pnpm lint
pnpm build
```

Expected: mọi lệnh PASS; lint không có error mới.

- [ ] **Step 6: Commit only obsolete-doc deletions**

Run in `be`:

```powershell
git add -u -- docs/superpowers/specs/2026-07-29-user-groups-task-selection-design.md docs/superpowers/plans/2026-07-29-user-groups-task-selection.md
git diff --cached --check
git diff --cached
git commit -m "docs: retire user group feature documentation"
```

- [ ] **Step 7: Confirm unrelated dirty changes were preserved**

Run in both repositories:

```powershell
git status --short
git diff
```

Expected:

- Không có staged changes.
- Các thay đổi chưa commit không liên quan được ghi nhận ở Task 1/Task 4 vẫn còn.
- Hai file frontend chỉ phục vụ nhóm đã bị xoá có chủ đích.
- Không có commit nào chứa `.env`, dependency churn, DataTable, combobox,
  Swagger/response hoặc thay đổi khác ngoài phạm vi gỡ.
