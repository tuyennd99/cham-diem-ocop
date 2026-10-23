import { adminFixture, draftPayload } from './support/admin-fixture';
import { withTestApp } from './support/db-app';
import { Prisma } from '@prisma/client';
import { databaseObject } from '../src/prisma/sql';

describe('admin product mutations and registration snapshots', () => {
  it('creates one owner-visible draft and freezes registration data on manager submission', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true, group: { isActive: true } },
      });
      const created = await f.call('manager', '/admin/products', 'POST', {
        ...draftPayload(category.id, f.locality.id),
        registrantId: f.owner.id,
        reason: 'Enter on behalf',
      });

      expect(created.status).toBe(201);
      const id = created.body.data.id as string;
      expect((await f.call('owner', `/my/products/${id}`)).status).toBe(200);
      expect(created.body.data).toMatchObject({
        registrantId: f.owner.id,
        createdById: f.manager.id,
        localityId: f.locality.id,
      });

      const submitted = await f.call(
        'manager',
        `/admin/products/${id}/submit`,
        'POST',
        { reason: 'Submit on behalf' },
      );
      expect(submitted.status).toBe(201);
      const before = await prisma.product.findUniqueOrThrow({ where: { id } });
      expect(before).toMatchObject({
        status: 'SUBMITTED',
        localityCodeAtSubmit: f.locality.code,
        localityNameAtSubmit: f.locality.name,
      });
      expect(before.registrationSnapshot).toMatchObject({
        version: 1,
        registrant: { id: f.owner.id, fullName: f.owner.fullName },
        category: { id: category.id, name: category.name },
        locality: { id: f.locality.id, name: f.locality.name },
      });

      await prisma.locality.update({
        where: { id: f.locality.id },
        data: { name: 'Renamed locality' },
      });
      await prisma.user.update({
        where: { id: f.owner.id },
        data: { fullName: 'Renamed owner' },
      });
      await prisma.productCategory.update({
        where: { id: category.id },
        data: { name: 'Renamed category' },
      });
      await prisma.productGroup.update({
        where: { id: category.groupId },
        data: { name: 'Renamed group' },
      });
      const after = await prisma.product.findUniqueOrThrow({ where: { id } });
      expect(after.registrationSnapshot).toEqual(before.registrationSnapshot);
      expect(
        await prisma.productStatusEvent.count({ where: { productId: id } }),
      ).toBe(2);
      expect(
        await prisma.productStatusEvent.findMany({
          where: { productId: id },
          orderBy: { sequence: 'asc' },
        }),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actorId: f.manager.id,
            reason: 'Enter on behalf',
          }),
          expect.objectContaining({
            actorId: f.manager.id,
            reason: 'Submit on behalf',
          }),
        ]),
      );
      expect(
        await prisma.auditLog.findMany({
          where: { entityType: 'Product', entityId: id },
          orderBy: { createdAt: 'asc' },
        }),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actorId: f.manager.id,
            action: 'product.create_on_behalf',
            reason: 'Enter on behalf',
            requestId: expect.any(String),
          }),
          expect.objectContaining({
            actorId: f.manager.id,
            action: 'product.submit_on_behalf',
            reason: 'Submit on behalf',
          }),
        ]),
      );
    });
  });

  it('allows incomplete drafts without locality, then requires complete form and effective locality to submit', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true, group: { isActive: true } },
      });
      const created = await f.call('owner', '/my/products', 'POST', {
        categoryId: category.id,
        name: 'Incomplete draft',
        formData: {},
      });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ localityId: null });

      const submit = await f.call(
        'owner',
        `/my/products/${created.body.data.id}/submit`,
        'POST',
        {},
      );
      expect(submit.status).toBe(400);

      const complete = await f.call(
        'owner',
        `/my/products/${created.body.data.id}`,
        'PUT',
        {
          ...draftPayload(category.id, f.locality.id),
          localityId: f.locality.id,
        },
      );
      expect(complete.status).toBe(200);
      await prisma.locality.update({
        where: { id: f.locality.id },
        data: { isActive: false },
      });
      const rejectedSubmit = await f.call(
        'owner',
        `/my/products/${created.body.data.id}/submit`,
        'POST',
        {},
      );
      expect(rejectedSubmit.status).toBe(409);
      expect(
        await prisma.productStatusEvent.count({
          where: { productId: created.body.data.id },
        }),
      ).toBe(1);
    });
  });

  it('keeps a retired locality on an existing draft but rejects changing to a retired locality', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true, group: { isActive: true } },
      });
      const retired = await prisma.locality.create({
        data: {
          code: `RETIRED-${f.locality.id}`,
          name: 'Retired locality',
          provinceName: 'Test province',
          type: 'COMMUNE',
          isActive: false,
        },
      });
      const created = await f.call('manager', '/admin/products', 'POST', {
        ...draftPayload(category.id, f.locality.id),
        registrantId: f.owner.id,
        reason: 'Create draft',
      });
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;
      await prisma.locality.update({
        where: { id: f.locality.id },
        data: { isActive: false },
      });

      expect(
        (
          await f.call('manager', `/admin/products/${id}`, 'PUT', {
            name: 'Retained locality draft',
            reason: 'Update without changing locality',
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await f.call('manager', `/admin/products/${id}`, 'PUT', {
            localityId: retired.id,
            reason: 'Attempt retired locality change',
          })
        ).status,
      ).toBe(409);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        localityId: f.locality.id,
        name: 'Retained locality draft',
        status: 'DRAFT',
      });
    });
  });

  it('restricts manager create to active verified registrants and keeps post-submit writes immutable', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true, group: { isActive: true } },
      });
      const unverified = await prisma.user.create({
        data: {
          email: 'unverified-' + f.owner.id + '@example.invalid',
          password: 'not-used',
          fullName: 'Unverified registrant',
          role: 'REGISTRANT',
          verified: false,
        },
      });
      const inactive = await prisma.user.create({
        data: {
          email: 'inactive-' + f.owner.id + '@example.invalid',
          password: 'not-used',
          fullName: 'Inactive registrant',
          role: 'REGISTRANT',
          verified: true,
          isActive: false,
        },
      });
      for (const registrantId of [unverified.id, inactive.id, f.scorer.id]) {
        const invalidOwner = await f.call(
          'manager',
          '/admin/products',
          'POST',
          {
            ...draftPayload(category.id),
            registrantId,
            reason: 'Invalid owner',
          },
        );
        expect(invalidOwner.status).not.toBe(201);
      }
      expect(
        await prisma.product.count({
          where: {
            registrantId: { in: [unverified.id, inactive.id, f.scorer.id] },
          },
        }),
      ).toBe(0);

      const created = await f.call('manager', '/admin/products', 'POST', {
        ...draftPayload(category.id, f.locality.id),
        registrantId: f.owner.id,
        reason: 'Create draft',
      });
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;
      for (const role of ['owner', 'otherOwner', 'viewer', 'scorer'] as const) {
        expect(
          (
            await f.call(role, '/admin/products', 'POST', {
              ...draftPayload(category.id),
              registrantId: f.owner.id,
              reason: 'Unauthorized create',
            })
          ).status,
        ).not.toBe(201);
      }
      expect(
        (
          await f.call('otherOwner', `/admin/products/${id}`, 'PUT', {
            name: 'Different owner cannot update',
            reason: 'Unauthorized update',
          })
        ).status,
      ).toBe(404);
      const submitted = await f.call(
        'manager',
        `/admin/products/${id}/submit`,
        'POST',
        { reason: 'Submit draft' },
      );
      expect(submitted.status).toBe(201);
      expect(
        (
          await f.call('manager', `/admin/products/${id}`, 'PUT', {
            name: 'Changed after submit',
            reason: 'Late edit',
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await f.call('manager', `/admin/products/${id}`, 'DELETE', {
            reason: 'Late delete',
          })
        ).status,
      ).toBe(409);
      const beforeRetry = await prisma.product.findUniqueOrThrow({
        where: { id },
      });
      expect(
        (
          await f.call('manager', `/admin/products/${id}/submit`, 'POST', {
            reason: 'Retry submit',
          })
        ).status,
      ).toBe(409);
      const afterRetry = await prisma.product.findUniqueOrThrow({
        where: { id },
      });
      expect(afterRetry.submittedAt).toEqual(beforeRetry.submittedAt);
      expect(
        await prisma.productStatusEvent.count({ where: { productId: id } }),
      ).toBe(2);
    });
  });

  it('rejects owner fields supplied to admin update without changing the draft', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true, group: { isActive: true } },
      });
      const created = await f.call('manager', '/admin/products', 'POST', {
        ...draftPayload(category.id, f.locality.id),
        registrantId: f.owner.id,
        reason: 'Create draft',
      });
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;
      const rejected = await f.call('manager', `/admin/products/${id}`, 'PUT', {
        registrantId: f.otherOwner.id,
        createdById: f.otherOwner.id,
        status: 'SUBMITTED',
        registrationSnapshot: { version: 99 },
        name: 'Must not persist',
        reason: 'Attempt to replace immutable fields',
      });
      expect(rejected.status).toBe(400);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        registrantId: f.owner.id,
        createdById: f.manager.id,
        status: 'DRAFT',
        name: 'Test product',
      });
    });
  });

  it('audits manager update/delete and rolls back manager creation when audit insert fails', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true, group: { isActive: true } },
      });
      const created = await f.call('manager', '/admin/products', 'POST', {
        ...draftPayload(category.id, f.locality.id),
        registrantId: f.owner.id,
        reason: 'Create draft',
      });
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;
      await prisma.product.update({
        where: { id },
        data: {
          formData: {
            ...draftPayload(category.id).formData,
            secretToken: 'must not enter audit data',
            filePath: '/private/storage-key',
          } as Prisma.InputJsonValue,
        },
      });
      expect(
        (
          await f.call('manager', `/admin/products/${id}`, 'PUT', {
            name: 'Updated draft',
            reason: 'Correct product name',
          })
        ).status,
      ).toBe(200);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        name: 'Updated draft',
        registrantId: f.owner.id,
        createdById: f.manager.id,
      });
      expect(
        (
          await f.call('manager', `/admin/products/${id}`, 'DELETE', {
            reason: 'Remove draft',
          })
        ).status,
      ).toBe(200);
      expect(await prisma.product.findUnique({ where: { id } })).toBeNull();
      const audits = await prisma.auditLog.findMany({
        where: { entityType: 'Product', entityId: id },
      });
      expect(
        audits.map(({ action, actorId, reason }) => ({
          action,
          actorId,
          reason,
        })),
      ).toEqual(
        expect.arrayContaining([
          {
            action: 'product.create_on_behalf',
            actorId: f.manager.id,
            reason: 'Create draft',
          },
          {
            action: 'product.update_on_behalf',
            actorId: f.manager.id,
            reason: 'Correct product name',
          },
          {
            action: 'product.delete_on_behalf',
            actorId: f.manager.id,
            reason: 'Remove draft',
          },
        ]),
      );
      const updateAudit = audits.find(
        ({ action }) => action === 'product.update_on_behalf',
      );
      expect(updateAudit?.beforeData).toMatchObject({
        createdById: f.manager.id,
        formData: { entityName: 'Test entity' },
      });
      expect(JSON.stringify(updateAudit?.beforeData)).not.toContain(
        'secretToken',
      );
      expect(JSON.stringify(updateAudit?.beforeData)).not.toContain(
        '/private/storage-key',
      );

      await prisma.$executeRaw(Prisma.sql`
        ALTER TABLE ${databaseObject('audit_logs')}
        ADD CONSTRAINT "test_reject_product_create_audit"
        CHECK ("action" <> 'product.create_on_behalf')
      `);
      try {
        const failed = await f.call('manager', '/admin/products', 'POST', {
          ...draftPayload(category.id, f.locality.id),
          registrantId: f.owner.id,
          reason: 'Audit must roll back',
        });
        expect(failed.status).toBe(500);
        expect(
          await prisma.product.count({
            where: { registrantId: f.owner.id, name: 'Test product' },
          }),
        ).toBe(0);
      } finally {
        await prisma.$executeRaw(Prisma.sql`
          ALTER TABLE ${databaseObject('audit_logs')}
          DROP CONSTRAINT "test_reject_product_create_audit"
        `);
      }
    });
  });
});
