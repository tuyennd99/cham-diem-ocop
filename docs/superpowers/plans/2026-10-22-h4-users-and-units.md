# H4-A — Users and Organization Units Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** MANAGE quản lý và tra cứu người dùng/đơn vị, cấp quyền kết hợp, khóa/reset có audit; các endpoint giám khảo tiếp tục dùng một cơ chế bảo vệ.

**Architecture:** Thêm controller/service/repository cho miền người dùng và đơn vị theo cấu trúc hiện tại, đăng ký trong các barrel của AppModule. Tách đúng phần transaction staff-access/audit đang cần dùng lại; không thêm hệ thống phân quyền mới hoặc feature module.

**Tech Stack:** NestJS, Prisma/PostgreSQL, class-validator, bcryptjs, Axios, TanStack Query/Router, React; Jest và node:test.

**Spec:** docs/superpowers/specs/2026-10-17-admin-modules-spec.md mục 3, 4, 12–14; kế hoạch tổng 2026-10-22-h4-admin-modules.md. Baseline phải hoàn thành Task 0 của kế hoạch tổng.

## Global Constraints

- “Tài khoản nội bộ active phải có ít nhất một quyền.”
- “Không cho khóa hoặc bỏ quyền của người quản trị active, verified cuối cùng; kiểm tra trong transaction để chịu được hai yêu cầu đồng thời.”
- “Mọi lần đổi quyền, đơn vị, trạng thái và reset mật khẩu ghi actor, đối tượng, thời gian, thay đổi và lý do.”
- “Audit reset mật khẩu không chứa mật khẩu mới/cũ hoặc hash.”
- “Ngừng sử dụng đơn vị chỉ ngăn lựa chọn mới, không tự khóa toàn bộ tài khoản hay thay số liệu lịch sử.”
- Áp dụng toàn bộ Global Constraints và quy tắc H4 ở kế hoạch tổng; không seed đơn vị giả, không đổi verified/role/email qua form sửa.

## File map và contract

**Create:**

- apps/be/src/controllers/admin-users.controller.ts — /admin/users và /admin/organization-units, MANAGE.
- apps/be/src/services/admin-users.service.ts — chuẩn hóa, hash mật khẩu và chuyển DTO.
- apps/be/src/repositories/admin-users.repository.ts — truy vấn user/unit, mutation/audit transaction.
- apps/be/src/dtos/admin-users.dto.ts — query và input allowlist.
- apps/be/src/utils/audit-log.ts — writeAudit(tx, input), chuyển nguyên logic hiện tại.
- apps/be/src/utils/staff-access.ts — kernel transaction đang có, không viết lại quy tắc.
- apps/be/test/support/admin-fixture.ts — dữ liệu test và bearer HTTP trong schema cô lập.
- apps/be/test/admin-users.db-spec.ts.
- apps/web/src/api/admin-users.ts; apps/web/src/queries/admin-users.ts.
- apps/web/src/pages/admin/AdminUsersPage.tsx; apps/web/src/pages/admin/UserEditorDialog.tsx; apps/web/src/pages/admin/OrganizationUnitsPanel.tsx.
- apps/web/src/routes/_app.admin.users.tsx.
- apps/web/src/lib/admin-user-form.ts; apps/web/test/admin-users.test.ts.

**Modify:**

- packages/shared/src/index.ts — kiểu User/Unit và input/query dùng chung; web types/auth hiện có tiếp tục tham chiếu Role/StaffPermission.
- apps/be/src/controllers/index.ts; apps/be/src/services/index.ts; apps/be/src/repositories/index.ts — đăng ký ba class mới.
- apps/be/src/repositories/admin.repository.ts; apps/be/src/services/admin.service.ts; apps/be/src/dtos/admin.dto.ts — legacy adapter và tái sử dụng kernel.
- apps/be/src/utils/staff-permissions.ts — thêm staffRole(permissions), tái sử dụng effectiveStaffPermissions.
- apps/be/test/staff-access.db-spec.ts; apps/be/test/auth.db-spec.ts; apps/be/test/backend.db-spec.ts; apps/be/test/openapi.db-spec.ts — unit/reason mới cho legacy create/reset và regression.
- apps/web/src/api/index.ts; apps/web/src/constants/api.ts; apps/web/src/constants/query-key.ts; apps/web/src/types/admin.ts.
- apps/web/src/layouts/AppLayout.tsx; apps/web/src/routes/_app.admin.judges.tsx; apps/web/src/pages/admin/AdminDashboardPage.tsx — menu/redirect, bỏ link quản lý giám khảo riêng; giữ assignments dùng GET /admin/judges.
- routeTree.gen.ts chỉ do router plugin sinh.

**Produces for B/C:**

~~~ts
export interface AdminUserRecord {
  id: string; email: string; fullName: string; phone: string | null;
  role: Role; staffPermissions: StaffPermission[];
  organizationUnitId: string | null; organizationUnit: OrganizationUnitSummary | null;
  verified: boolean; isActive: boolean; createdAt: string;
}
export interface AdminUserQuery {
  page?: number; limit?: number; q?: string; permission?: StaffPermission;
  organizationUnitId?: string; isActive?: boolean; verified?: boolean;
  kind?: 'STAFF' | 'REGISTRANT';
}
export interface OrganizationUnitRecord extends OrganizationUnitSummary {
  description: string | null; order: number; isActive: boolean;
  createdAt: string; updatedAt: string;
}
~~~

| Endpoint | Input/output và quy tắc |
|---|---|
| GET /admin/users | AdminUserQuery; ApiResult<AdminUserRecord[]> có meta. q tìm fullName/email/phone không phân biệt hoa thường; mọi filter dùng AND; ORDER BY createdAt DESC, id DESC. |
| GET /admin/users/:id | AdminUserRecord; không có password/tokenVersion/OTP/audit binary. |
| POST /admin/users | email, fullName, phone?, password, organizationUnitId, staffPermissions, reason; staff active verified, unit active bắt buộc; trả AdminUserRecord. |
| PUT /admin/users/:id | fullName?, phone?, reason; email/role/verified/permissions/unit/status không nằm trong DTO này. |
| PUT /admin/users/:id/staff-access | Giữ endpoint H3 và input UpdateStaffAccessDto; chỉ staff, dùng kernel chung; không route trùng ở controller mới. |
| PUT /admin/users/:id/status | {isActive:boolean,reason:string}; dùng quyền/đơn vị hiện tại đọc bên trong cùng transaction; không ghi đè quyền vừa bị sửa bởi request khác. |
| POST /admin/users/:id/reset-password | {password:string,reason:string}; tokenVersion tăng; không trả password/hash; verified không đổi. |
| GET /admin/organization-units | q?, isActive?, page=1, limit=20 (max100); order ASC, id ASC; MANAGE cả đọc và ghi. |
| POST /admin/organization-units | code(max50), name(max255), description?, order>=0, isActive, reason. |
| PUT /admin/organization-units/:id | name?, description?, order?, isActive?, reason; code/id bất biến. |

reason trim dài 1..255, phone max30, email chuẩn hóa max320; tên không rỗng sau trim. Parse query boolean bằng whitelist 'true'/'false', không dùng Boolean('false'). Không hard-delete user/unit. Không thay đổi nơi cấp quyền của public register.

permission=VIEW lọc quyền hiệu lực (VIEW hoặc MANAGE), không chỉ raw array VIEW; kind=STAFF dùng role khác REGISTRANT. Email chuẩn hóa trước IsEmail; create kiểm email hiện có không phân biệt hoa thường, vẫn bắt P2002 để chặn race hai request email chuẩn hóa giống nhau. Không tự sửa email tài khoản cũ hoặc dựng migration dữ liệu người dùng.

### Task A1: Đơn vị, audit helper và fixture kiểm thử

**Files:** Các file admin-users BE mới, barrel, shared types, audit-log.ts, admin-fixture.ts và admin-users.db-spec.ts.
**Consumes:** Prisma OrganizationUnit/User/AuditLog của H3, @Permissions, RequestMeta, apiRequest/withTestApp.
**Produces:** Organization-unit API, writeAudit(tx, input), adminFixture và draftPayload cho B/C.

- [ ] **Step 1 — Tạo fixture nhỏ, có cleanup do withTestApp quản lý.** Mã dưới nằm trong test/support/admin-fixture.ts; chỉ dùng domain .invalid và mã TEST-.

~~~ts
import { JwtService } from '@nestjs/jwt';
import { Role, StaffPermission } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { JWT_ISSUER, JWT_AUDIENCE } from '../../src/constants/auth';
import { PrismaService } from '../../src/prisma/prisma.service';
import { apiRequest } from './db-app';

export async function adminFixture(app: INestApplication, prisma: PrismaService, baseUrl: string) {
  const unit = await prisma.organizationUnit.create({
    data: { code: 'TEST-U-' + randomUUID(), name: 'Test unit' },
  });
  const locality = await prisma.locality.create({
    data: { code: 'TEST-L-' + randomUUID(), name: 'Test locality',
      provinceName: 'Test province', type: 'COMMUNE' },
  });
  const password = await bcrypt.hash('StaffPassword1!', 4);
  const make = (role: Role, staffPermissions: StaffPermission[]) => prisma.user.create({
    data: { email: randomUUID() + '@example.invalid', password, fullName: 'Test user',
      verified: true, isActive: true, role, staffPermissions,
      organizationUnitId: role === Role.REGISTRANT ? null : unit.id },
  });
  const [manager, viewer, scorer, owner, otherOwner] = await Promise.all([
    make(Role.ADMIN, ['MANAGE', 'VIEW']), make(Role.VIEWER, ['VIEW']),
    make(Role.JUDGE, ['SCORE']), make(Role.REGISTRANT, []), make(Role.REGISTRANT, []),
  ]);
  const users = { manager, viewer, scorer, owner, otherOwner };
  const tokens = {} as Record<keyof typeof users, string>;
  for (const name of Object.keys(users) as (keyof typeof users)[]) {
    const u = users[name];
    tokens[name] = await app.get(JwtService).signAsync({
      sub: u.id, email: u.email, role: u.role, tokenVersion: u.tokenVersion,
    }, { secret: process.env.JWT_SECRET, issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: 3600 });
  }
  const headers = (as: keyof typeof users) => ({
    authorization: 'Bearer ' + tokens[as], 'content-type': 'application/json',
  });
  const call = (as: keyof typeof users, path: string, method = 'GET', body?: unknown) =>
    apiRequest<any>(baseUrl, path, {
      method, headers: headers(as), ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { ...users, unit, locality, call, headers };
}
export function draftPayload(categoryId: string, localityId?: string) {
  return { name: 'Test product', categoryId, localityId, formData: {
    entityName: 'Test entity', representativeName: 'Test representative',
    representativeTitle: 'Director', contactAddress: 'Test address', provinceName: 'Test province',
    email: 'contact@example.invalid', registrationType: 'FIRST', sampleQuantity: 1,
    assessmentYear: 2026, declarationAccepted: true,
  } };
}
~~~

- [ ] **Step 2 — Viết ca đỏ trong admin-users.db-spec.ts**, import withTestApp và adminFixture theo đường dẫn thật.

~~~ts
it('keeps existing users when a unit is retired and denies VIEW its API', async () => {
  await withTestApp(async ({ app, prisma, baseUrl }) => {
    const f = await adminFixture(app, prisma, baseUrl);
    expect((await f.call('viewer', '/admin/organization-units')).status).toBe(403);
    const result = await f.call('manager', '/admin/organization-units/' + f.unit.id, 'PUT',
      { isActive: false, reason: 'Unit retired' });
    expect(result.status).toBe(200);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: f.scorer.id } }))
      .toMatchObject({ organizationUnitId: f.unit.id, isActive: true });
    expect(await prisma.auditLog.count({
      where: { entityId: f.unit.id, actorId: f.manager.id },
    })).toBe(1);
  });
});
~~~

Thêm các ca cùng suite: code trùng 409; mã rỗng/name trắng/order âm/boolean query sai 400; PUT code 400; q + inactive + trang 1/2 ổn định; không có mật khẩu/OTP trong response/audit; audit lỗi rollback unit.

- [ ] **Step 3 — Chạy đỏ.**

~~~powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/admin-users.db-spec.ts
~~~

Kỳ vọng ca endpoint mới nhận 404, không phải lỗi kết nối/seed.

- [ ] **Step 4 — Triển khai DTO/controller/service/repository và tái sử dụng audit.** Chuyển thân AdminRepository.audit sang writeAudit(tx, input) với cùng allowlist; gọi lại từ code cũ và mới. Unit update khóa row rồi đọc before/update/audit trong một transaction; bất kỳ lỗi audit đều rollback.

~~~ts
return this.prisma.$transaction(async (tx) => {
  await tx.$queryRaw(Prisma.sql
    `SELECT "id" FROM ${databaseObject('organization_units')} WHERE "id" = ${id} FOR UPDATE`);
  const before = await tx.organizationUnit.findUnique({ where: { id } });
  if (!before) throw new NotFoundException('Organization unit not found');
  const after = await tx.organizationUnit.update({ where: { id }, data: changes });
  await writeAudit(tx, { actorId, action: 'organization_unit.update',
    entityType: 'OrganizationUnit', entityId: id, beforeData: before, afterData: after, reason, ...meta });
  return after;
});
~~~

- [ ] **Step 5 — Chạy xanh và commit.**

~~~powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/admin-users.db-spec.ts test/staff-access.db-spec.ts
pnpm --filter @ocop/api typecheck
git diff --check
git add apps/be/src apps/be/test/admin-users.db-spec.ts apps/be/test/support/admin-fixture.ts packages/shared/src/index.ts
git commit -m "feat(admin): manage organization units with audit"
~~~

### Task A2: API người dùng và một kernel bảo vệ staff dùng chung

**Files:** admin-users BE files, utils/staff-access.ts, staff-permissions.ts, AdminRepository/AdminService legacy adapters, dtos/admin.dto.ts; admin-users.db-spec.ts và staff-access/auth/backend/openapi specs.
**Consumes:** A1 units/audit, H3 UpdateStaffAccessDto và lock order.
**Produces:** Toàn bộ user endpoints ở bảng contract; lookup cho C bằng GET /admin/users?kind=REGISTRANT&isActive=true&verified=true&q=... .

- [ ] **Step 1 — Viết ca đỏ cho tạo VIEW+SCORE, sanitize và đơn vị bắt buộc.**

~~~ts
it('creates verified combined staff only in an active unit', async () => {
  await withTestApp(async ({ app, prisma, baseUrl }) => {
    const f = await adminFixture(app, prisma, baseUrl);
    const input = { email: ' NewStaff@Example.invalid ', fullName: 'New staff',
      password: 'StaffPassword1!', organizationUnitId: f.unit.id,
      staffPermissions: ['VIEW', 'SCORE'], reason: 'Staff onboarding' };
    expect((await f.call('viewer', '/admin/users', 'POST', input)).status).toBe(403);
    const created = await f.call('manager', '/admin/users', 'POST', input);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      email: 'newstaff@example.invalid', role: 'JUDGE', verified: true,
      staffPermissions: ['VIEW', 'SCORE'], organizationUnitId: f.unit.id,
    });
    expect(created.body.data).not.toHaveProperty('password');
    const audits = await prisma.auditLog.findMany({ where: { entityId: created.body.data.id } });
    expect(JSON.stringify(audits)).not.toContain(input.password);
    expect((await f.call('manager', '/admin/users', 'POST', {
      ...input, email: 'unitless@example.invalid', organizationUnitId: null,
    })).status).toBe(400);
  });
});
~~~

Thêm test: MANAGE tự bao VIEW không SCORE; active không quyền bị400; mã/email trùng409; password staff11 ký tự hoặc >72 byte400; REGISTRANT reset giữ sàn8 và verified cũ; lọc/paging20 max100; quyền/status thay tăng tokenVersion và token cũ401; no-op access không tăng; reset audit không hash/password. Chạy đồng thời status và staff-access để không mất thay đổi quyền; final-manager, open-score assignment và audit rollback giữ nguyên H3.

- [ ] **Step 2 — Chạy đỏ với suite A mới và chạy H3 làm đối chứng.**

~~~powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/admin-users.db-spec.ts test/staff-access.db-spec.ts
~~~

- [ ] **Step 3 — Chuyển nguyên kernel H3, không nhân đôi transaction.**

~~~ts
// utils/staff-access.ts: gọi bên trong transaction.
export function lockStaffMutation(tx: Prisma.TransactionClient): Promise<unknown>;
export function applyStaffAccess(
  tx: Prisma.TransactionClient, id: string, input: UpdateStaffAccessDto,
  actorId: string, meta: RequestMeta,
): Promise<StaffAccessRecord | null>;
~~~

Đây là chữ ký cần triển khai, không phải declaration để ship: lockStaffMutation giữ thứ tự category ID rồi user ID của H3; applyStaffAccess chứa kiểm MANAGE hiện tại, quyền hiệu lực, final-manager, SCORE đang có hồ sơ mở, unit, role projection, tokenVersion/audit. StaffAccessRecord là Pick<User,'id'|'role'|'staffPermissions'|'organizationUnitId'|'isActive'|'verified'>, User lấy từ @prisma/client; không password.

Khi tạo staff hoặc chọn đơn vị mới, khóa row đơn vị và kiểm active trong cùng transaction để serialize với nghỉ dùng đơn vị. Khi sửa staff cũ, chấp nhận unit inactive nếu ID không đổi; null chỉ được giữ cho bản ghi legacy vốn null, không cho xóa đơn vị đã gán. Áp dụng cùng quy tắc vào endpoint staff-access và legacy create, không tạo đường bypass qua adapter.

AdminRepository.updateStaffAccess mở transaction → lockStaffMutation → applyStaffAccess. Status staff đọc giá trị hiện tại sau lock rồi gọi applyStaffAccess trong transaction đó; không lấy quyền từ request hoặc kết quả GET trước đó. Profile và reset khóa target, lưu/audit atomic; hash ở service trước transaction bằng PASSWORD_ROUNDS. Tra cứu dùng select allowlist và một count/query cùng snapshot DB.

~~~ts
// Khung status staff; nhánh REGISTRANT chỉ đổi isActive/tokenVersion và audit.
await lockStaffMutation(tx);
const current = await tx.user.findUniqueOrThrow({ where: { id } });
return applyStaffAccess(tx, id, {
  staffPermissions: current.staffPermissions,
  organizationUnitId: current.organizationUnitId,
  isActive: input.isActive,
  reason: input.reason,
}, actorId, meta);
~~~

Không gọi updateStaffAccess bằng một transaction riêng từ bên trong transaction khác. Khi reset chỉ cập nhật password/tokenVersion, không trả row chứa hash. Legacy createJudge thêm unit active và SCORE cố định; legacy profile/reset/deactivate dùng cùng kiểm tra/audit. DTO mới và legacy writes cần reason trim; ghi rõ tightening unit/reason trong OpenAPI và docs, cập nhật fixtures cũ tương ứng.

- [ ] **Step 4 — Chạy xanh, kiểm OpenAPI và commit.**

~~~powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/admin-users.db-spec.ts test/staff-access.db-spec.ts test/auth.db-spec.ts test/backend.db-spec.ts test/openapi.db-spec.ts
pnpm --filter @ocop/api test --runInBand
pnpm --filter @ocop/api typecheck
git diff --check
git add apps/be/src apps/be/test packages/shared/src/index.ts
git commit -m "feat(admin): add user management through shared access rules"
~~~

### Task A3: Người dùng, tab Đơn vị và chuyển hướng giám khảo

**Files:** Web files trong file map; cập nhật apps/web/README.md và docs/verification/2026-10-22-h4-admin-modules.md.
**Consumes:** User/unit endpoints và shared types của A1/A2; requirePermission/hasStaffPermission từ H3.
**Produces:** /admin/users cho MANAGE và reusable lookup owner trong admin-users API/query cho C.

- [ ] **Step 1 — Viết kiểm tra hành vi form.** admin-user-form.ts xuất staffPermissionsForForm(input), dùng cho payload create/access; giữ kiểm password qua validatePasswordBytes hiện có.

~~~ts
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { staffPermissionsForForm } from '../src/lib/admin-user-form';

it('MANAGE includes VIEW but never adds SCORE', () => {
  assert.deepEqual(staffPermissionsForForm(['MANAGE']), ['MANAGE', 'VIEW']);
  assert.deepEqual(staffPermissionsForForm(['VIEW', 'SCORE']), ['VIEW', 'SCORE']);
});
~~~

- [ ] **Step 2 — Chạy đỏ.**

~~~powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/admin-users.test.ts
~~~

- [ ] **Step 3 — Triển khai qua API/query hooks và UI đang có.** Export adminUsersApi.list/detail/create/update/status/resetPassword/access/units/createUnit/updateUnit; endpoint builders ở constants/api.ts, query keys chứa toàn bộ filter. Hook useAdminUsers(query), useOrganizationUnits(query), useAdminUserMutations() dùng mutation retry:false và invalidate users/unit, judges, assignments/dashboard khi cần.

~~~tsx
export const Route = createFileRoute('/_app/admin/users')({
  validateSearch: (search: Record<string, unknown>) => ({
    permission: ['MANAGE', 'VIEW', 'SCORE'].includes(String(search.permission))
      ? search.permission as StaffPermission : undefined,
  }),
  beforeLoad: requirePermission('MANAGE'),
  component: AdminUsersPage,
});
// Trong beforeLoad của route /_app/admin/judges sau requirePermission('MANAGE'):
throw redirect({ to: '/admin/users', search: { permission: 'SCORE' }, replace: true });
~~~

AdminUsersPage có tab Người dùng/Đơn vị, tìm kiếm submit rõ ràng, reset page1 khi filter đổi, state loading/empty/error và nút tải lại. Dialog tạo staff và các form riêng profile/access/reset/status, giữ input khi lỗi400/409, busy chống submit kép, xác nhận khóa/reset, không cache giá trị mật khẩu. Checkbox MANAGE hiển thị VIEW được bao hàm; SCORE độc lập. Staff cũ null unit hiển thị Chưa gán đơn vị; unit cũ inactive giữ disabled option, không tự chọn unit mới.

Bộ lọc đầy đủ theo contract. REGISTRANT không có checkbox quyền, nút chuyển loại hoặc đổi verified/email. VIEW/SCORE không có menu hay gọi user/unit endpoints. Sidebar MANAGE hiển thị Người dùng; assignments vẫn lấy SCORE candidates từ /admin/judges, không tải toàn bộ /admin/users vào editor phân công.

Sau mutation quyền/đơn vị/status/reset của chính người đang đăng nhập làm tăng tokenVersion, UI xóa session hiện tại và về login; không chờ một loạt refetch401. Profile-only không thu hồi session, invalidate /auth/me để cập nhật tên/điện thoại.

- [ ] **Step 4 — Xác minh và commit.** Chạy focused test, web typecheck/build, API-boundary. Trong browser fixture: MANAGE tạo unit → tạo VIEW+SCORE → lọc được; khóa/reset thu hồi phiên; đổi unit inactive không đổi snapshot cũ; VIEW vào /admin/users bị403/redirect, không phát sinh request user list; lỗi409 giữ form. Ghi kết quả và giới hạn trong verification report.

~~~powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/admin-users.test.ts
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
pnpm --filter @ocop/web build
git diff --check
git add apps/web docs/verification/2026-10-22-h4-admin-modules.md
git commit -m "feat(web): add users and organization unit administration"
~~~

## Self-review và bàn giao

USR-01..04/ORG-01 được đối chiếu ở A2 và browser A3. Không dựng user CRUD bên cạnh một bộ luật staff-access khác; không hard-delete hoặc tự xác thực chủ thể. B và C chỉ dùng kiểu/lookup/helper được khai báo ở đây; không truy cập hash hoặc tokenVersion từ response.
