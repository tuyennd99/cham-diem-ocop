import { adminFixture, draftPayload } from './support/admin-fixture';
import { withTestApp } from './support/db-app';
import { Prisma } from '@prisma/client';
import { databaseObject } from '../src/prisma/sql';

describe('admin product mutations and registration snapshots', () => {
  it('creates one owner-visible draft and freezes registration data on manager submission', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
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
        version: 2,
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
        where: { isActive: true },
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
        where: { isActive: true },
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
        where: { isActive: true },
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
      ).toBe(403);
      expect(
        (
          await f.call('otherOwner', `/my/products/${id}`, 'PUT', {
            name: 'Different owner cannot update',
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
        where: { isActive: true },
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
        where: { isActive: true },
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
      const productBeforeNoOp = await prisma.product.findUniqueOrThrow({
        where: { id },
      });
      const statusEventCountBeforeNoOp = await prisma.productStatusEvent.count({
        where: { productId: id },
      });
      const updateAuditCountBeforeNoOp = await prisma.auditLog.count({
        where: {
          entityType: 'Product',
          entityId: id,
          action: 'product.update_on_behalf',
        },
      });
      expect(
        (
          await f.call('manager', `/admin/products/${id}`, 'PUT', {
            name: 'Updated draft',
            reason: 'Confirm unchanged draft',
          })
        ).status,
      ).toBe(200);
      const noOpAudit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: 'Product',
          entityId: id,
          action: 'product.update_on_behalf',
          reason: 'Confirm unchanged draft',
        },
      });
      expect(noOpAudit).toMatchObject({
        actorId: f.manager.id,
        reason: 'Confirm unchanged draft',
        requestId: expect.any(String),
      });
      expect(noOpAudit.beforeData).toEqual(noOpAudit.afterData);
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: 'Product',
            entityId: id,
            action: 'product.update_on_behalf',
          },
        }),
      ).toBe(updateAuditCountBeforeNoOp + 1);
      expect(
        await prisma.productStatusEvent.count({ where: { productId: id } }),
      ).toBe(statusEventCountBeforeNoOp);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        status: productBeforeNoOp.status,
        submittedAt: productBeforeNoOp.submittedAt,
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
        CHECK ("action" <> 'product.create_on_behalf') NOT VALID
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

  it('filters before count and paging, hides drafts from VIEW, and returns allowlisted records', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
      });
      const periodStart = new Date('2026-10-01T00:00:00+07:00');
      const periodEnd = new Date('2026-10-02T00:00:00+07:00');
      const make = (
        id: string,
        input: {
          status?: 'DRAFT' | 'SUBMITTED' | 'COMPLETED';
          submittedAt?: Date;
          completedAt?: Date;
          finalScore?: number | null;
          starRating?: number | null;
          localityId?: string | null;
          entityName?: string;
        } = {},
      ) =>
        prisma.product.create({
          data: {
            id,
            registrantId: f.owner.id,
            categoryId: category.id,
            localityId:
              input.localityId === undefined ? f.locality.id : input.localityId,
            name: `Needle ${id}`,
            status: input.status ?? 'SUBMITTED',
            submittedAt: input.submittedAt ?? periodStart,
            completedAt: input.completedAt,
            finalScore: input.finalScore,
            starRating: input.starRating,
            formData: {
              entityName: input.entityName ?? `Needle entity ${id}`,
              registrationType: 'FIRST',
              assessmentYear: 2026,
              filePath: '/must-not-return',
              password: 'must-not-return',
              tokenVersion: 90,
            },
          },
        });
      const draft = await make('c2-draft', { status: 'DRAFT' });
      const first = await make('c2-a');
      const second = await make('c2-b');
      await make('c2-upper-bound', { submittedAt: periodEnd });
      await make('c2-unmapped', { localityId: null });
      const scored = await make('c2-scored', {
        status: 'COMPLETED',
        finalScore: 88,
        starRating: 3,
        completedAt: periodStart,
      });
      await make('c2-null-score', {
        status: 'COMPLETED',
        finalScore: null,
        starRating: null,
      });

      await prisma.attachment.createMany({
        data: ['IMAGE', 'IMAGE', 'EVIDENCE'].map((type, index) => ({
          productId: first.id,
          type: type as 'IMAGE' | 'EVIDENCE',
          fileName: `file-${index}.${type === 'EVIDENCE' ? 'pdf' : 'png'}`,
          filePath: `private-${index}`,
        })),
      });
      const judge2 = await prisma.user.create({
        data: {
          email: `${draft.id}@example.invalid`,
          password: 'test-only',
          fullName: 'Second judge',
          role: 'JUDGE',
          verified: true,
          staffPermissions: ['SCORE'],
        },
      });
      await prisma.evaluation.createMany({
        data: [
          { productId: first.id, judgeId: f.scorer.id },
          { productId: first.id, judgeId: judge2.id },
        ],
      });

      const viewerPage = await f.call(
        'viewer',
        '/admin/products?q=Needle&limit=1&page=1',
      );
      expect(viewerPage.status).toBe(200);
      expect(viewerPage.body.meta).toMatchObject({
        page: 1,
        limit: 1,
        total: 6,
        totalPages: 6,
      });
      expect(viewerPage.body.data.map((row: { id: string }) => row.id)).toEqual(
        ['c2-upper-bound'],
      );
      expect(viewerPage.body.data[0].attachments).toEqual([]);
      expect(viewerPage.body.data[0]).not.toHaveProperty('evaluations');
      expect(JSON.stringify(viewerPage.body)).not.toMatch(
        /filePath|password|tokenVersion/,
      );

      const filters = new URLSearchParams({
        q: 'Needle entity',
        categoryId: category.id,
        registrantId: f.owner.id,
        registrantQ: 'Test user',
        localityId: f.locality.id,
        status: 'SUBMITTED',
        registrationType: 'FIRST',
        assessmentYear: '2026',
        dateBasis: 'submittedAt',
        from: '2026-10-01T00:00:00+07:00',
        toExclusive: '2026-10-02T00:00:00+07:00',
        limit: '1',
        page: '1',
      });
      const filteredFirst = await f.call(
        'viewer',
        `/admin/products?${filters}`,
      );
      expect(filteredFirst.status).toBe(200);
      expect(filteredFirst.body.meta.total).toBe(2);
      expect(
        filteredFirst.body.data.map((row: { id: string }) => row.id),
      ).toEqual([second.id]);
      filters.set('page', '2');
      const filteredLast = await f.call('viewer', `/admin/products?${filters}`);
      expect(
        filteredLast.body.data.map((row: { id: string }) => row.id),
      ).toEqual([first.id]);
      filters.set('page', '3');
      const filteredEmpty = await f.call(
        'viewer',
        `/admin/products?${filters}`,
      );
      expect(filteredEmpty.body.data).toEqual([]);
      expect(filteredEmpty.body.meta.total).toBe(2);

      expect(
        (
          await f.call(
            'viewer',
            `/admin/products?localityId=${f.locality.id}&unmappedLocality=true`,
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await f.call(
            'viewer',
            '/admin/products?from=2026-10-01T00%3A00%3A00Z',
          )
        ).status,
      ).toBe(400);
      expect(
        (await f.call('viewer', '/admin/products?status=DRAFT')).body.meta
          .total,
      ).toBe(0);
      expect(
        (await f.call('manager', `/admin/products/${draft.id}`)).status,
      ).toBe(200);
      expect(
        (await f.call('viewer', `/admin/products/${draft.id}`)).status,
      ).toBe(404);

      const detail = await f.call('viewer', `/admin/products/${first.id}`);
      expect(detail.status).toBe(200);
      expect(
        detail.body.data.attachments.map(({ type }: { type: string }) => type),
      ).toEqual(['IMAGE', 'IMAGE', 'EVIDENCE']);
      expect(detail.body.data.formData).toMatchObject({
        entityName: `Needle entity ${first.id}`,
      });
      expect(JSON.stringify(detail.body)).not.toMatch(
        /filePath|password|tokenVersion/,
      );

      const nullLast = await f.call(
        'manager',
        '/admin/products?status=COMPLETED&sortBy=finalScore&sortDirection=asc',
      );
      expect(nullLast.body.data.map(({ id }: { id: string }) => id)).toEqual([
        scored.id,
        'c2-null-score',
      ]);
      const stars = await f.call('viewer', '/admin/products?starRating=3');
      expect(stars.body.data.map(({ id }: { id: string }) => id)).toEqual([
        scored.id,
      ]);
      const unmapped = await f.call(
        'viewer',
        '/admin/products?unmappedLocality=true',
      );
      expect(unmapped.body.data.map(({ id }: { id: string }) => id)).toEqual([
        'c2-unmapped',
      ]);
    });
  });

  it('covers registrant draft lifecycle, partial field updates, mandatory submit validation, post-submit immutability, and UPGRADE/REASSESSMENT independence (REG-01..06)', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
      });

      // REG-01: Minimal draft save (only name + categoryId, sampleQuantity = 0, no localityId, declarationAccepted = false)
      const minDraftRes = await f.call('owner', '/my/products', 'POST', {
        name: 'Mật ong nháp tối thiểu REG-01',
        categoryId: category.id,
        formData: {
          sampleQuantity: 0,
          declarationAccepted: false,
        },
      });
      expect(minDraftRes.status).toBe(201);
      expect(minDraftRes.body.data).toMatchObject({
        status: 'DRAFT',
        localityId: null,
        formData: {
          sampleQuantity: 0,
          declarationAccepted: false,
        },
      });
      const draftId = minDraftRes.body.data.id as string;

      // REG-02: Populate full 3-step formData, reload via GET /my/products/:id, update sampleQuantity from 6 -> 10 while preserving all other fields
      const fullForm = {
        entityName: 'Hợp tác xã Mật ong rừng U Minh Hạ',
        representativeName: 'Nguyễn Văn An',
        representativeTitle: 'Giám đốc Hợp tác xã',
        contactAddress: 'Ấp 3, Xã Khánh An, Huyện U Minh, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0912345678',
        email: 'htx.uminh@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 6,
        assessmentYear: 2026,
        declarationAccepted: true,
      };
      const savedFull = await f.call(
        'owner',
        `/my/products/${draftId}`,
        'PUT',
        {
          name: 'Mật ong rừng tràm U Minh nguyên chất 500ml',
          categoryId: category.id,
          localityId: f.locality.id,
          description: 'Mật ong khai thác tự nhiên từ rừng tràm U Minh Hạ.',
          formData: fullForm,
        },
      );
      expect(savedFull.status).toBe(200);

      const reloaded = await f.call('owner', `/my/products/${draftId}`);
      expect(reloaded.status).toBe(200);
      expect(reloaded.body.data.formData).toMatchObject(fullForm);

      const updatedQty = await f.call(
        'owner',
        `/my/products/${draftId}`,
        'PUT',
        {
          name: reloaded.body.data.name,
          categoryId: reloaded.body.data.categoryId,
          localityId: reloaded.body.data.localityId,
          description: reloaded.body.data.description,
          formData: {
            ...reloaded.body.data.formData,
            sampleQuantity: 10,
          },
        },
      );
      expect(updatedQty.status).toBe(200);
      expect(updatedQty.body.data.formData).toMatchObject({
        ...fullForm,
        sampleQuantity: 10,
      });

      // REG-03: Each missing mandatory condition on POST /my/products/:id/submit returns 400 and keeps DRAFT
      const missingCases: Array<{
        localityId: string | null;
        formData: Record<string, unknown>;
      }> = [
        { localityId: null, formData: fullForm },
        {
          localityId: f.locality.id,
          formData: { ...fullForm, entityName: undefined },
        },
        {
          localityId: f.locality.id,
          formData: { ...fullForm, representativeName: undefined },
        },
        {
          localityId: f.locality.id,
          formData: { ...fullForm, representativeTitle: undefined },
        },
        {
          localityId: f.locality.id,
          formData: { ...fullForm, contactAddress: undefined },
        },
        {
          localityId: f.locality.id,
          formData: { ...fullForm, provinceName: undefined },
        },
        {
          localityId: f.locality.id,
          formData: { ...fullForm, phone: undefined, email: undefined },
        },
        {
          localityId: f.locality.id,
          formData: { ...fullForm, sampleQuantity: 0 },
        },
        {
          localityId: f.locality.id,
          formData: { ...fullForm, declarationAccepted: false },
        },
      ];

      for (const testCase of missingCases) {
        const branchDraft = await f.call('owner', '/my/products', 'POST', {
          name: 'Nhánh thiếu điều kiện REG-03',
          categoryId: category.id,
          localityId: testCase.localityId,
          formData: testCase.formData,
        });
        expect(branchDraft.status).toBe(201);
        const branchId = branchDraft.body.data.id as string;
        const branchSubmit = await f.call(
          'owner',
          `/my/products/${branchId}/submit`,
          'POST',
        );
        expect(branchSubmit.status).toBe(400);
        expect(
          (await prisma.product.findUniqueOrThrow({ where: { id: branchId } }))
            .status,
        ).toBe('DRAFT');
      }

      // REG-03 boundary validation on create/update: assessmentYear outside 2020..2100 or invalid sampleQuantity returns 400
      for (const badForm of [
        { ...fullForm, assessmentYear: 2019 },
        { ...fullForm, assessmentYear: 2101 },
        { ...fullForm, sampleQuantity: -1 },
        { ...fullForm, sampleQuantity: 100001 },
        { ...fullForm, sampleQuantity: 1.5 },
      ]) {
        const badRes = await f.call('owner', '/my/products', 'POST', {
          name: 'Biên ngoài khoảng REG-03',
          categoryId: category.id,
          localityId: f.locality.id,
          formData: badForm,
        });
        expect(badRes.status).toBe(400);
      }

      // REG-04: Once submitted, PUT/DELETE/submit from stale tab on /my/products/:id returns 409 Conflict ("Only draft products can be changed")
      const submitRes = await f.call(
        'owner',
        `/my/products/${draftId}/submit`,
        'POST',
      );
      expect(submitRes.status).toBe(201);
      expect(submitRes.body.data.status).toBe('SUBMITTED');

      const staleUpdate = await f.call(
        'owner',
        `/my/products/${draftId}`,
        'PUT',
        {
          name: 'Sửa từ tab cũ sau khi đã nộp',
          categoryId: category.id,
          localityId: f.locality.id,
          formData: fullForm,
        },
      );
      expect(staleUpdate.status).toBe(409);
      expect(staleUpdate.body.message).toContain(
        'Only draft products can be changed',
      );

      const staleDelete = await f.call(
        'owner',
        `/my/products/${draftId}`,
        'DELETE',
      );
      expect(staleDelete.status).toBe(409);

      // REG-05: Admin create-on-behalf requires registrantId and reason
      expect(
        (
          await f.call('manager', '/admin/products', 'POST', {
            ...draftPayload(category.id, f.locality.id),
            reason: 'Thiếu registrantId',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await f.call('manager', '/admin/products', 'POST', {
            ...draftPayload(category.id, f.locality.id),
            registrantId: f.owner.id,
            reason: '   ',
          })
        ).status,
      ).toBe(400);

      // REG-06: UPGRADE and REASSESSMENT create new independent products without altering existing COMPLETED product
      const completedOld = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          name: 'Mật ong rừng tràm U Minh nguyên chất 500ml',
          status: 'COMPLETED',
          submittedAt: new Date('2025-06-01T08:00:00+07:00'),
          completedAt: new Date('2025-06-15T10:00:00+07:00'),
          finalScore: 65,
          starRating: 3,
          formData: fullForm,
        },
      });

      const upgradeCreate = await f.call('owner', '/my/products', 'POST', {
        name: completedOld.name,
        categoryId: category.id,
        localityId: f.locality.id,
        formData: { ...fullForm, registrationType: 'UPGRADE' },
      });
      expect(upgradeCreate.status).toBe(201);
      const upgradeId = upgradeCreate.body.data.id as string;
      expect(upgradeId).not.toBe(completedOld.id);
      expect(
        (await f.call('owner', `/my/products/${upgradeId}/submit`, 'POST'))
          .status,
      ).toBe(201);

      const reassessCreate = await f.call('owner', '/my/products', 'POST', {
        name: completedOld.name,
        categoryId: category.id,
        localityId: f.locality.id,
        formData: { ...fullForm, registrationType: 'REASSESSMENT' },
      });
      expect(reassessCreate.status).toBe(201);
      const reassessId = reassessCreate.body.data.id as string;
      expect(reassessId).not.toBe(completedOld.id);
      expect(reassessId).not.toBe(upgradeId);
      expect(
        (await f.call('owner', `/my/products/${reassessId}/submit`, 'POST'))
          .status,
      ).toBe(201);

      const oldAfter = await prisma.product.findUniqueOrThrow({
        where: { id: completedOld.id },
      });
      expect(oldAfter).toMatchObject({
        id: completedOld.id,
        status: 'COMPLETED',
        finalScore: 65,
        starRating: 3,
      });

      const upgradeAfter = await prisma.product.findUniqueOrThrow({
        where: { id: upgradeId },
      });
      expect(upgradeAfter.registrationSnapshot).toMatchObject({
        formData: { registrationType: 'UPGRADE' },
      });
      const reassessAfter = await prisma.product.findUniqueOrThrow({
        where: { id: reassessId },
      });
      expect(reassessAfter.registrationSnapshot).toMatchObject({
        formData: { registrationType: 'REASSESSMENT' },
      });
    });
  });
});
