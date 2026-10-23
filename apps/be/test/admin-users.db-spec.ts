import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { databaseObject } from '../src/prisma/sql';
import { apiRequest, withTestApp } from './support/db-app';
import { adminFixture } from './support/admin-fixture';

const unitsPath = '/admin/organization-units';
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
    /password|tokenVersion|otp|StaffPassword1!|\$2[aby]\$/i,
  );
}

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
