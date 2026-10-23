import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { databaseObject } from '../src/prisma/sql';
import { apiRequest, withTestApp } from './support/db-app';
import { adminFixture } from './support/admin-fixture';

const unitsPath = '/admin/organization-units';
const usersPath = '/admin/users';
const unitInput = () => ({
  code: 'TEST-' + randomUUID(),
  name: 'New unit',
  description: 'Unit description',
  order: 0,
  isActive: true,
  reason: 'Unit onboarding',
});

function expectNoSecrets(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(
    /"(?:password|tokenVersion|otp|otpSecret|otpCode)"\s*:|StaffPassword1!|\$2[aby]\$/i,
  );
}

const bcryptCompare = (plain: string, hash: string) =>
  bcrypt.compare(plain, hash);

describe('H4 organization units', () => {
  it('keeps existing users when a unit is retired and denies VIEW its API', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      expect((await f.call('manager', unitsPath)).status).toBe(200);
      for (const as of ['viewer', 'scorer', 'owner'] as const) {
        expect((await f.call(as, unitsPath)).status).toBe(403);
        expect((await f.call(as, unitsPath, 'POST', unitInput())).status).toBe(
          403,
        );
        expect(
          (
            await f.call(as, unitsPath + '/' + f.unit.id, 'PUT', {
              isActive: false,
              reason: 'Unit retired',
            })
          ).status,
        ).toBe(403);
      }
      const before = await prisma.user.findMany({ orderBy: { id: 'asc' } });
      const result = await f.call(
        'manager',
        unitsPath + '/' + f.unit.id,
        'PUT',
        { isActive: false, reason: ' Unit retired ' },
      );
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        id: f.unit.id,
        code: f.unit.code,
        isActive: false,
      });
      expect(await prisma.user.findMany({ orderBy: { id: 'asc' } })).toEqual(
        before,
      );
      const audits = await prisma.auditLog.findMany({
        where: { entityId: f.unit.id },
      });
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        actorId: f.manager.id,
        action: 'organization_unit.update',
        entityType: 'OrganizationUnit',
        reason: 'Unit retired',
        beforeData: { isActive: true },
        afterData: { isActive: false },
      });
      expect(audits[0].createdAt).toBeInstanceOf(Date);
      expectNoSecrets(result.body);
      expectNoSecrets(audits);
    });
  });

  it('creates normalized units with request metadata and rejects duplicate codes', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const input = {
        ...unitInput(),
        name: ' New unit ',
        description: ' Description ',
        reason: ' Onboarding ',
      };
      const result = await apiRequest<any>(baseUrl, unitsPath, {
        method: 'POST',
        headers: {
          ...f.headers('manager'),
          'x-request-id': 'unit-create-test',
          'user-agent': 'Unit test agent',
        },
        body: JSON.stringify({ ...input, code: ' ' + input.code + ' ' }),
      });
      expect(result.status).toBe(201);
      expect(result.body.data).toMatchObject({
        code: input.code,
        name: 'New unit',
        description: 'Description',
        order: 0,
        isActive: true,
      });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: result.body.data.id },
      });
      expect(audit).toMatchObject({
        actorId: f.manager.id,
        action: 'organization_unit.create',
        entityType: 'OrganizationUnit',
        reason: 'Onboarding',
        requestId: 'unit-create-test',
        userAgent: 'Unit test agent',
        afterData: { code: input.code, name: 'New unit' },
      });
      expect(audit.ipAddress).toBeTruthy();
      expect((await f.call('manager', unitsPath, 'POST', input)).status).toBe(
        409,
      );
      expect(
        await prisma.auditLog.count({
          where: { entityId: result.body.data.id },
        }),
      ).toBe(1);
      expectNoSecrets(result.body);
      expectNoSecrets(audit);
    });
  });

  it('rejects invalid create/update fields and immutable identifiers', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      for (const change of [
        { code: '' },
        { code: '   ' },
        { code: 'x'.repeat(51) },
        { name: '   ' },
        { name: 'x'.repeat(256) },
        { order: -1 },
        { order: 0.5 },
        { order: '1' },
        { isActive: 'false' },
        { isActive: null },
        { reason: '   ' },
        { reason: 'x'.repeat(256) },
        { reason: null },
        { password: 'SecretPassword1!' },
      ])
        expect(
          (
            await f.call('manager', unitsPath, 'POST', {
              ...unitInput(),
              ...change,
            })
          ).status,
        ).toBe(400);
      for (const change of [
        { code: 'TEST-CHANGED' },
        { id: f.unit.id },
        { name: '   ' },
        { name: null },
        { order: -1 },
        { order: null },
        { isActive: null },
        { reason: '  ' },
      ])
        expect(
          (
            await f.call('manager', unitsPath + '/' + f.unit.id, 'PUT', {
              reason: 'Update unit',
              ...change,
            })
          ).status,
        ).toBe(400);
      expect(
        (
          await f.call('manager', unitsPath, 'POST', {
            ...unitInput(),
            reason: undefined,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await f.call('manager', unitsPath + '/' + f.unit.id, 'PUT', {
            name: 'Updated',
          })
        ).status,
      ).toBe(400);
      expect(await prisma.organizationUnit.count()).toBe(1);
      expect(await prisma.auditLog.count()).toBe(0);
    });
  });

  it('rejects invalid boolean and pagination queries', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      for (const query of [
        'isActive=0',
        'isActive=TRUE',
        'isActive=',
        'isActive=true&isActive=false',
        'page=0',
        'page=1.5',
        'limit=0',
        'limit=101',
        'limit=invalid',
      ]) {
        expect((await f.call('manager', unitsPath + '?' + query)).status).toBe(
          400,
        );
      }
    });
  });

  it.each([
    'page=1e308',
    'page=9007199254740992&limit=1',
    'page=9007199254740991&limit=100',
  ])('rejects unsafe pagination with 400: %s', async (query) => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      expect((await f.call('manager', unitsPath + '?' + query)).status).toBe(
        400,
      );
    });
  });

  it('accepts a safe offset at the page number boundary', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const result = await f.call(
        'manager',
        unitsPath + '?page=9007199254740991&limit=1',
      );
      expect(result.status).toBe(200);
      expect(result.body.data).toEqual([]);
      expect(result.body.meta).toEqual({
        page: 9007199254740991,
        limit: 1,
        total: 1,
        totalPages: 1,
      });
    });
  });

  it('combines search and inactive filters with stable order/id pagination', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      await prisma.organizationUnit.createMany({
        data: [
          {
            id: 'test-unit-c',
            code: 'TEST-PAGE-C',
            name: 'Needle gamma',
            order: 1,
            isActive: false,
          },
          {
            id: 'test-unit-b',
            code: 'TEST-PAGE-B',
            name: 'Needle beta',
            order: 1,
            isActive: false,
          },
          {
            id: 'test-unit-a',
            code: 'TEST-NEEDLE-A',
            name: 'Alpha',
            order: 0,
            isActive: false,
          },
          {
            id: 'test-unit-active',
            code: 'TEST-PAGE-ACTIVE',
            name: 'Needle active',
            isActive: true,
          },
          {
            id: 'test-unit-other',
            code: 'TEST-PAGE-OTHER',
            name: 'Other',
            isActive: false,
          },
        ],
      });
      const query = unitsPath + '?q=nEeDlE&isActive=false&limit=2&page=';
      const first = await f.call('manager', query + '1');
      const second = await f.call('manager', query + '2');
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.data.map((unit: any) => unit.id)).toEqual([
        'test-unit-a',
        'test-unit-b',
      ]);
      expect(second.body.data.map((unit: any) => unit.id)).toEqual([
        'test-unit-c',
      ]);
      expect(first.body.meta).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
      expect(second.body.meta).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
      expect((await f.call('manager', query + '1')).body).toEqual(first.body);
      const defaults = await f.call('manager', unitsPath);
      expect(defaults.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 6,
        totalPages: 1,
      });
      expect(
        (await f.call('manager', unitsPath + '?isActive=true')).body.meta.total,
      ).toBe(2);
      expectNoSecrets(first.body);
    });
  });

  it('updates mutable unit fields and returns 404 for a missing unit', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const result = await f.call(
        'manager',
        unitsPath + '/' + f.unit.id,
        'PUT',
        {
          name: ' Updated unit ',
          description: null,
          order: 3,
          reason: 'Profile correction',
        },
      );
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        id: f.unit.id,
        code: f.unit.code,
        name: 'Updated unit',
        description: null,
        order: 3,
        isActive: true,
      });
      expect(
        (
          await f.call('manager', unitsPath + '/missing', 'PUT', {
            isActive: false,
            reason: 'Retire missing unit',
          })
        ).status,
      ).toBe(404);
      expect(await prisma.auditLog.count()).toBe(1);
    });
  });

  it('rolls back both creation and update when the audit write fails', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const before = await prisma.organizationUnit.findUniqueOrThrow({
        where: { id: f.unit.id },
      });
      await prisma.$executeRaw(Prisma.sql`ALTER TABLE ${databaseObject('audit_logs')}
        ADD CONSTRAINT test_reject_unit_audit CHECK ("action" NOT LIKE 'organization_unit.%')`);
      try {
        expect(
          (await f.call('manager', unitsPath, 'POST', unitInput())).status,
        ).toBe(500);
        expect(
          (
            await f.call('manager', unitsPath + '/' + f.unit.id, 'PUT', {
              name: 'Should roll back',
              isActive: false,
              reason: 'Unit retirement',
            })
          ).status,
        ).toBe(500);
      } finally {
        await prisma.$executeRaw(
          Prisma.sql`ALTER TABLE ${databaseObject('audit_logs')} DROP CONSTRAINT test_reject_unit_audit`,
        );
      }
      expect(await prisma.organizationUnit.count()).toBe(1);
      expect(
        await prisma.organizationUnit.findUniqueOrThrow({
          where: { id: f.unit.id },
        }),
      ).toEqual(before);
      expect(await prisma.auditLog.count()).toBe(0);
    });
  });
});

describe('H4 users', () => {
  it('creates only verified staff with effective permissions in an active unit', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const input = {
        email: ' NewStaff@Example.invalid ',
        fullName: ' New staff ',
        phone: ' 0900000000 ',
        password: 'StaffPassword1!',
        organizationUnitId: f.unit.id,
        staffPermissions: ['VIEW', 'SCORE'],
        reason: ' Staff onboarding ',
      };
      expect((await f.call('viewer', usersPath, 'POST', input)).status).toBe(
        403,
      );
      const created = await f.call('manager', usersPath, 'POST', input);
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({
        email: 'newstaff@example.invalid',
        fullName: 'New staff',
        phone: '0900000000',
        role: 'JUDGE',
        verified: true,
        isActive: true,
        staffPermissions: ['VIEW', 'SCORE'],
        organizationUnitId: f.unit.id,
        organizationUnit: {
          id: f.unit.id,
          code: f.unit.code,
          name: f.unit.name,
        },
      });
      expectNoSecrets(created.body);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: created.body.data.id },
      });
      expect(user.verified).toBe(true);
      expect(user.isActive).toBe(true);
      expect(await bcryptCompare(input.password, user.password)).toBe(true);
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: user.id },
      });
      expect(audit).toMatchObject({
        actorId: f.manager.id,
        action: 'user.create',
        entityType: 'User',
        reason: 'Staff onboarding',
      });
      expectNoSecrets(audit);

      const managerOnly = await f.call('manager', usersPath, 'POST', {
        ...input,
        email: 'manager-only@example.invalid',
        staffPermissions: ['MANAGE'],
      });
      expect(managerOnly.status).toBe(201);
      expect(managerOnly.body.data).toMatchObject({
        role: 'ADMIN',
        staffPermissions: ['MANAGE', 'VIEW'],
      });
      expect(managerOnly.body.data.staffPermissions).not.toContain('SCORE');

      const inactiveUnit = await prisma.organizationUnit.create({
        data: {
          code: 'TEST-INACTIVE-' + randomUUID(),
          name: 'Inactive unit',
          isActive: false,
        },
      });
      for (const invalid of [
        { staffPermissions: [] },
        { staffPermissions: ['UNKNOWN'] },
        { organizationUnitId: null },
        { organizationUnitId: inactiveUnit.id },
        { organizationUnitId: 'missing-unit' },
        { password: 'Short1!' },
        { password: 'é'.repeat(37) },
      ]) {
        expect(
          (
            await f.call('manager', usersPath, 'POST', {
              ...input,
              ...invalid,
              email: randomUUID() + '@example.invalid',
            })
          ).status,
        ).toBe(400);
      }
      expect(
        (
          await f.call('manager', usersPath, 'POST', {
            ...input,
            email: 'NEWSTAFF@example.invalid',
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await f.call('manager', usersPath, 'POST', {
            ...input,
            email: f.owner.email.toUpperCase(),
          })
        ).status,
      ).toBe(409);
    });
  });

  it('lists by effective permission and role with safe, stable pagination', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const managerOnly = await prisma.user.create({
        data: {
          email: 'manager-only@example.invalid',
          password: 'unused',
          fullName: 'Manager only',
          role: 'ADMIN',
          staffPermissions: ['MANAGE'],
          verified: true,
          organizationUnitId: f.unit.id,
        },
      });
      const staleRegistrant = await prisma.user.create({
        data: {
          email: 'stale-permissions@example.invalid',
          password: 'unused',
          fullName: 'Stale permission registrant',
          role: 'REGISTRANT',
          staffPermissions: ['VIEW', 'MANAGE'],
          verified: true,
          organizationUnitId: f.unit.id,
        },
      });
      const view = await f.call(
        'manager',
        usersPath + '?permission=VIEW&kind=STAFF&limit=2&page=1',
      );
      const viewSecondPage = await f.call(
        'manager',
        usersPath + '?permission=VIEW&kind=STAFF&limit=2&page=2',
      );
      expect(view.status).toBe(200);
      expect(viewSecondPage.status).toBe(200);
      const viewIds = [
        ...view.body.data.map((user: any) => user.id),
        ...viewSecondPage.body.data.map((user: any) => user.id),
      ];
      expect(viewIds).toEqual(
        expect.arrayContaining([managerOnly.id, f.manager.id, f.viewer.id]),
      );
      expect(viewIds).not.toContain(f.scorer.id);
      expect(view.body.meta).toMatchObject({ page: 1, limit: 2, total: 3 });

      for (const permission of ['VIEW', 'MANAGE']) {
        const filtered = await f.call(
          'manager',
          usersPath + `?permission=${permission}&limit=100`,
        );
        expect(filtered.status).toBe(200);
        expect(
          filtered.body.data.map((user: any) => user.id),
        ).not.toContain(staleRegistrant.id);
      }

      const registrants = await f.call(
        'manager',
        usersPath + '?kind=REGISTRANT&isActive=true&verified=true&q=Test%20user',
      );
      expect(registrants.status).toBe(200);
      expect(registrants.body.data.map((user: any) => user.role)).toEqual([
        'REGISTRANT',
        'REGISTRANT',
      ]);
      expect(registrants.body.data.map((user: any) => user.id)).toEqual(
        expect.arrayContaining([f.owner.id, f.otherOwner.id]),
      );

      const detail = await f.call('manager', usersPath + '/' + f.scorer.id);
      expect(detail.status).toBe(200);
      expect(detail.body.data).toMatchObject({
        id: f.scorer.id,
        role: 'JUDGE',
        staffPermissions: ['SCORE'],
      });
      expectNoSecrets(detail.body);
      expect((await f.call('manager', usersPath + '/missing')).status).toBe(
        404,
      );
      for (const query of [
        'permission=INVALID',
        'kind=staff',
        'isActive=FALSE',
        'verified=0',
        'page=1e308',
        'limit=101',
      ]) {
        expect((await f.call('manager', usersPath + '?' + query)).status).toBe(
          400,
        );
      }
      expectNoSecrets(view.body);
      expectNoSecrets(registrants.body);
    });
  });

  it('keeps legacy judge writes on the shared access rules and requires reason/unit', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const input = {
        email: ' LegacyJudge@Example.invalid ',
        fullName: ' Legacy judge ',
        phone: ' 0900000000 ',
        password: 'LegacyJudgePassword1!',
        organizationUnitId: f.unit.id,
        reason: ' Legacy onboarding ',
      };
      expect((await f.call('manager', '/admin/judges', 'POST', { ...input, reason: undefined })).status).toBe(400);
      expect((await f.call('manager', '/admin/judges', 'POST', { ...input, organizationUnitId: undefined })).status).toBe(400);
      const created = await f.call('manager', '/admin/judges', 'POST', input);
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({
        email: 'legacyjudge@example.invalid',
        fullName: 'Legacy judge',
        verified: true,
        isActive: true,
      });
      const user = await prisma.user.findUniqueOrThrow({ where: { id: created.body.data.id } });
      expect(user).toMatchObject({ role: 'JUDGE', staffPermissions: ['SCORE'], organizationUnitId: f.unit.id });
      expect(await prisma.auditLog.findFirstOrThrow({ where: { entityId: user.id } })).toMatchObject({
        action: 'judge.create',
        actorId: f.manager.id,
        reason: 'Legacy onboarding',
      });
      expectNoSecrets(created.body);

      expect((await f.call('manager', `/admin/judges/${user.id}`, 'PUT', { fullName: 'Renamed' })).status).toBe(400);
      const profile = await f.call('manager', `/admin/judges/${user.id}`, 'PUT', {
        fullName: ' Renamed judge ',
        reason: ' Profile review ',
      });
      expect(profile.status).toBe(200);
      expect(profile.body.data.fullName).toBe('Renamed judge');
      expect((await f.call('manager', `/admin/judges/${user.id}/reset-password`, 'POST', {
        password: 'LegacyResetPassword2!',
      })).status).toBe(400);
      const reset = await f.call('manager', `/admin/judges/${user.id}/reset-password`, 'POST', {
        password: 'LegacyResetPassword2!',
        reason: ' Legacy recovery ',
      });
      expect(reset.status).toBe(201);
      expectNoSecrets(reset.body);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
        verified: true,
        tokenVersion: 1,
      });
      expect((await f.call('manager', `/admin/judges/${user.id}`, 'DELETE')).status).toBe(400);
      const deactivated = await f.call('manager', `/admin/judges/${user.id}`, 'DELETE', {
        reason: ' Retire judge ',
      });
      expect(deactivated.status).toBe(200);
      expect(deactivated.body.data).toMatchObject({ id: user.id, isActive: false });
      expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ tokenVersion: 2 });
      const resets = await prisma.auditLog.findMany({ where: { entityId: user.id, action: 'judge.password_reset' } });
      expect(resets).toHaveLength(1);
      expect(JSON.stringify(resets)).not.toContain('LegacyResetPassword2!');
      expect(JSON.stringify(resets)).not.toContain(user.password);
    });
  });

  it('updates profiles without revoking sessions and status through the access kernel', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const profile = await f.call(
        'manager',
        usersPath + '/' + f.viewer.id,
        'PUT',
        { fullName: ' Updated viewer ', phone: ' 0912345678 ', reason: ' Profile correction ' },
      );
      expect(profile.status).toBe(200);
      expect(profile.body.data).toMatchObject({
        fullName: 'Updated viewer',
        phone: '0912345678',
      });
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: f.viewer.id } }),
      ).toMatchObject({ tokenVersion: 0 });
      expect(
        (
          await apiRequest(baseUrl, '/auth/me', {
            headers: f.headers('viewer'),
          })
        ).status,
      ).toBe(200);
      for (const invalid of [
        { email: 'changed@example.invalid' },
        { role: 'ADMIN' },
        { verified: false },
        { staffPermissions: ['MANAGE'] },
        { organizationUnitId: f.unit.id },
        { isActive: false },
        { fullName: '   ' },
        { fullName: 'Updated' },
      ]) {
        expect(
          (
            await f.call('manager', usersPath + '/' + f.viewer.id, 'PUT', {
              reason: 'Profile update',
              ...invalid,
            })
          ).status,
        ).toBe(400);
      }

      const status = await f.call(
        'manager',
        usersPath + '/' + f.viewer.id + '/status',
        'PUT',
        { isActive: false, reason: ' Account closed ' },
      );
      expect(status.status).toBe(200);
      expect(status.body.data).toMatchObject({
        isActive: false,
        role: 'VIEWER',
        staffPermissions: ['VIEW'],
      });
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: f.viewer.id } }),
      ).toMatchObject({ tokenVersion: 1 });
      expect(
        (
          await apiRequest(baseUrl, '/auth/me', {
            headers: f.headers('viewer'),
          })
        ).status,
      ).toBe(401);
      expect(
        await prisma.auditLog.findFirstOrThrow({
          where: { entityId: f.viewer.id, action: 'user.status_update' },
        }),
      ).toMatchObject({
        actorId: f.manager.id,
        reason: 'Account closed',
        beforeData: { isActive: true, staffPermissions: ['VIEW'] },
        afterData: { isActive: false, staffPermissions: ['VIEW'] },
      });
      const noOp = await f.call(
        'manager',
        usersPath + '/' + f.viewer.id + '/status',
        'PUT',
        { isActive: false, reason: 'Still closed' },
      );
      expect(noOp.status).toBe(200);
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: f.viewer.id } }),
      ).toMatchObject({ tokenVersion: 1 });
    });
  });

  it('does not revoke a session for an effective no-op MANAGE update', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const managerOnly = await prisma.user.create({
        data: {
          email: 'manager-only@example.invalid',
          password: 'unused',
          fullName: 'Manager only',
          role: 'ADMIN',
          staffPermissions: ['MANAGE'],
          verified: true,
          organizationUnitId: f.unit.id,
        },
      });
      const result = await f.call(
        'manager',
        usersPath + '/' + managerOnly.id + '/staff-access',
        'PUT',
        {
          staffPermissions: ['MANAGE'],
          organizationUnitId: f.unit.id,
          isActive: true,
          reason: 'No access change',
        },
      );
      expect(result.status).toBe(200);
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: managerOnly.id } }),
      ).toMatchObject({ tokenVersion: 0, staffPermissions: ['MANAGE'] });
      expect(await prisma.auditLog.count({ where: { entityId: managerOnly.id } })).toBe(0);
    });
  });

  it('preserves current status when staff access omits isActive', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const statusPath = usersPath + '/' + f.viewer.id + '/status';
      const accessPath = usersPath + '/' + f.viewer.id + '/staff-access';
      const locked = await f.call('manager', statusPath, 'PUT', {
        isActive: false,
        reason: 'Lock account',
      });
      expect(locked.status).toBe(200);

      const inactiveAccess = await f.call('manager', accessPath, 'PUT', {
        staffPermissions: ['VIEW', 'SCORE'],
        organizationUnitId: f.unit.id,
        reason: 'Change access while locked',
      });
      expect(inactiveAccess.status).toBe(200);
      expect(inactiveAccess.body.data).toMatchObject({
        isActive: false,
        staffPermissions: ['VIEW', 'SCORE'],
      });
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: f.viewer.id } }),
      ).toMatchObject({ isActive: false, staffPermissions: ['VIEW', 'SCORE'] });

      const active = await f.call('manager', statusPath, 'PUT', {
        isActive: true,
        reason: 'Unlock account',
      });
      expect(active.status).toBe(200);
      const activeAccess = await f.call('manager', accessPath, 'PUT', {
        staffPermissions: ['VIEW'],
        organizationUnitId: f.unit.id,
        reason: 'Change access while active',
      });
      expect(activeAccess.status).toBe(200);
      expect(activeAccess.body.data).toMatchObject({
        isActive: true,
        staffPermissions: ['VIEW'],
      });
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: f.viewer.id } }),
      ).toMatchObject({ isActive: true, staffPermissions: ['VIEW'] });
    });
  });

  it('serializes status and access updates without losing permission changes', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const [status, access] = await Promise.all([
        f.call('manager', usersPath + '/' + f.viewer.id + '/status', 'PUT', {
          isActive: false,
          reason: 'Suspend staff',
        }),
        f.call(
          'manager',
          usersPath + '/' + f.viewer.id + '/staff-access',
          'PUT',
          {
            staffPermissions: ['VIEW', 'SCORE'],
            organizationUnitId: f.unit.id,
            isActive: true,
            reason: 'Add scoring access',
          },
        ),
      ]);
      expect([status.status, access.status]).toEqual([200, 200]);
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: f.viewer.id } }),
      ).toMatchObject({
        staffPermissions: ['VIEW', 'SCORE'],
        role: 'JUDGE',
        tokenVersion: 2,
      });
      expect(
        await prisma.auditLog.count({ where: { entityId: f.viewer.id } }),
      ).toBe(2);
    });
  });

  it('protects the final manager and open scoring work through user status', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const blockedManager = await f.call(
        'manager',
        usersPath + '/' + f.manager.id + '/status',
        'PUT',
        { isActive: false, reason: 'Suspend final manager' },
      );
      expect(blockedManager.status).toBe(409);
      const category = await prisma.productCategory.findFirstOrThrow();
      await prisma.judgeAssignment.create({
        data: {
          judgeId: f.scorer.id,
          categoryId: category.id,
          criterionIds: [],
        },
      });
      await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          name: 'Open assignment',
          status: 'SUBMITTED',
          formData: {},
        },
      });
      const blockedScorer = await f.call(
        'manager',
        usersPath + '/' + f.scorer.id + '/status',
        'PUT',
        { isActive: false, reason: 'Suspend scorer' },
      );
      expect(blockedScorer.status).toBe(409);
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: f.scorer.id } }),
      ).toMatchObject({ isActive: true, tokenVersion: 0 });
      expect(await prisma.auditLog.count()).toBe(0);
    });
  });

  it('resets staff and registrant passwords without exposing credentials or changing verification', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      for (const password of ['short', 'é'.repeat(37)]) {
        expect(
          (
            await f.call(
              'manager',
              usersPath + '/' + f.owner.id + '/reset-password',
              'POST',
              { password, reason: 'Reset request' },
            )
          ).status,
        ).toBe(400);
      }
      expect(
        (
          await f.call(
            'manager',
            usersPath + '/' + f.scorer.id + '/reset-password',
            'POST',
            { password: 'TooShort1!', reason: 'Reset request' },
          )
        ).status,
      ).toBe(400);

      const registrantPassword = 'Reset8!!';
      const registrantReset = await f.call(
        'manager',
        usersPath + '/' + f.owner.id + '/reset-password',
        'POST',
        { password: registrantPassword, reason: ' Registrant recovery ' },
      );
      expect(registrantReset.status).toBe(201);
      expectNoSecrets(registrantReset.body);
      const registrant = await prisma.user.findUniqueOrThrow({
        where: { id: f.owner.id },
      });
      expect(registrant).toMatchObject({ verified: true, tokenVersion: 1 });
      expect(await bcryptCompare(registrantPassword, registrant.password)).toBe(
        true,
      );
      expect(
        (
          await apiRequest(baseUrl, '/auth/me', {
            headers: f.headers('owner'),
          })
        ).status,
      ).toBe(401);

      const staffPassword = 'StaffResetPassword2!';
      const staffReset = await f.call(
        'manager',
        usersPath + '/' + f.scorer.id + '/reset-password',
        'POST',
        { password: staffPassword, reason: 'Staff recovery' },
      );
      expect(staffReset.status).toBe(201);
      expectNoSecrets(staffReset.body);
      const scorer = await prisma.user.findUniqueOrThrow({
        where: { id: f.scorer.id },
      });
      expect(scorer).toMatchObject({ verified: true, tokenVersion: 1 });
      expect(await bcryptCompare(staffPassword, scorer.password)).toBe(true);
      const audits = await prisma.auditLog.findMany({
        where: {
          entityId: { in: [f.owner.id, f.scorer.id] },
          action: 'user.password_reset',
        },
      });
      expect(audits).toHaveLength(2);
      expect(audits.map(({ reason }) => reason)).toEqual(
        expect.arrayContaining(['Registrant recovery', 'Staff recovery']),
      );
      expectNoSecrets(audits);
    });
  });
});
