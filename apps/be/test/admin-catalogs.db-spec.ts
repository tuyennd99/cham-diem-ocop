import { ProductStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { databaseObject } from '../src/prisma/sql';
import { apiRequest, withTestApp } from './support/db-app';
import { adminFixture } from './support/admin-fixture';

const groupsPath = '/admin/product-groups';
const categoriesPath = '/admin/categories';
const localitiesPath = '/admin/localities';
const categoryInput = (groupId: string) => ({
  groupId,
  name: 'Test leaf ' + randomUUID(),
  classificationGroup: 'Test classification',
  order: 1,
  reason: 'Catalog addition',
});
const localityInput = (overrides: Record<string, unknown> = {}) => ({
  code: 'TEST-L-' + randomUUID(),
  name: ' Test locality ',
  type: 'COMMUNE',
  provinceName: ' Test province ',
  isActive: true,
  reason: ' Catalog setup ',
  ...overrides,
});

describe('H4 product catalogs', () => {
  it('creates, filters, and retires localities through the correct permissions', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const input = localityInput();
      const created = await f.call('manager', localitiesPath, 'POST', input);
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({
        code: input.code,
        name: 'Test locality',
        type: 'COMMUNE',
        provinceName: 'Test province',
        effectiveFrom: null,
        effectiveTo: null,
        isActive: true,
      });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: created.body.data.id, action: 'locality.create' },
      });
      expect(audit).toMatchObject({
        actorId: f.manager.id,
        entityType: 'Locality',
        reason: 'Catalog setup',
        afterData: expect.objectContaining({ id: created.body.data.id }),
      });

      expect(
        (
          await f.call(
            'manager',
            localitiesPath,
            'POST',
            localityInput({ code: input.code }),
          )
        ).status,
      ).toBe(409);
      expect(
        (await f.call('viewer', localitiesPath, 'POST', localityInput()))
          .status,
      ).toBe(403);
      expect(
        (
          await f.call(
            'viewer',
            `${localitiesPath}/${created.body.data.id}`,
            'PUT',
            { name: 'Unauthorized update', reason: 'No permission' },
          )
        ).status,
      ).toBe(403);
      expect((await f.call('viewer', localitiesPath)).status).toBe(200);
      expect((await f.call('scorer', localitiesPath)).status).toBe(403);

      const adminList = await f.call(
        'viewer',
        `${localitiesPath}?q=${encodeURIComponent(input.code)}&type=COMMUNE&provinceName=TEST%20PROVINCE&isActive=true&page=1&limit=1`,
      );
      expect(adminList.status).toBe(200);
      expect(adminList.body.data).toHaveLength(1);
      expect(adminList.body.meta).toMatchObject({
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      });
      expect(
        (await f.call('viewer', `${localitiesPath}?isActive=1`)).status,
      ).toBe(400);
      expect(
        (
          await f.call(
            'viewer',
            `${localitiesPath}?isActive=true&isActive=false`,
          )
        ).status,
      ).toBe(400);

      const publicResult = await apiRequest<any>(
        baseUrl,
        `/localities?q=${encodeURIComponent(input.code)}`,
      );
      expect(publicResult.status).toBe(200);
      expect(
        publicResult.body.data.map(({ id }: { id: string }) => id),
      ).toContain(created.body.data.id);

      const retired = await f.call(
        'manager',
        `${localitiesPath}/${created.body.data.id}`,
        'PUT',
        { isActive: false, reason: 'Official retirement' },
      );
      expect(retired.status).toBe(200);
      expect(
        (
          await f.call(
            'viewer',
            `${localitiesPath}?q=${encodeURIComponent(input.code)}&isActive=false`,
          )
        ).body.data,
      ).toHaveLength(1);
      expect(
        (
          await apiRequest<any>(
            baseUrl,
            `/localities?q=${encodeURIComponent(input.code)}`,
          )
        ).body.data,
      ).toEqual([]);
    });
  });

  it('returns only localities inside the active half-open effective interval', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const now = Date.now();
      const future = localityInput({
        code: 'TEST-FUTURE-' + randomUUID(),
        effectiveFrom: new Date(now + 3_600_000).toISOString(),
      });
      const ended = localityInput({
        code: 'TEST-END-' + randomUUID(),
        effectiveTo: new Date(now).toISOString(),
      });
      const current = localityInput({
        code: 'TEST-CURRENT-' + randomUUID(),
        effectiveFrom: '2020-01-01T00:00:00Z',
        effectiveTo: new Date(now + 3_600_000).toISOString(),
      });
      for (const input of [future, ended, current]) {
        expect(
          (await f.call('manager', localitiesPath, 'POST', input)).status,
        ).toBe(201);
      }
      const lookup = (code: string) =>
        apiRequest<any>(baseUrl, `/localities?q=${encodeURIComponent(code)}`);
      expect((await lookup(future.code)).body.data).toEqual([]);
      expect((await lookup(ended.code)).body.data).toEqual([]);
      expect((await lookup(current.code)).body.data).toHaveLength(1);

      expect(
        (
          await f.call(
            'manager',
            localitiesPath,
            'POST',
            localityInput({
              effectiveFrom: '2027-01-01T00:00:00Z',
              effectiveTo: '2026-01-01T00:00:00Z',
            }),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await f.call(
            'manager',
            localitiesPath,
            'POST',
            localityInput({ effectiveFrom: '2026-01-01T00:00:00' }),
          )
        ).status,
      ).toBe(400);

      const futureRow = (
        await f.call(
          'viewer',
          `${localitiesPath}?q=${encodeURIComponent(future.code)}`,
        )
      ).body.data[0];
      const invalidUpdate = await f.call(
        'manager',
        `${localitiesPath}/${futureRow.id}`,
        'PUT',
        {
          effectiveTo: new Date(now + 30_000).toISOString(),
          reason: 'Invalid interval',
        },
      );
      expect(invalidUpdate.status).toBe(400);
    });
  });

  it('retires localities without losing submitted references and blocks identity changes', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow();
      const product = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          localityCodeAtSubmit: f.locality.code,
          localityNameAtSubmit: f.locality.name,
          localityTypeAtSubmit: f.locality.type,
          provinceNameAtSubmit: f.locality.provinceName,
          name: 'Existing submitted product',
          formData: {},
          status: ProductStatus.SUBMITTED,
        },
      });
      const originalUpdatedAt = (
        await prisma.locality.findUniqueOrThrow({
          where: { id: f.locality.id },
        })
      ).updatedAt;
      const renamed = await f.call(
        'manager',
        `${localitiesPath}/${f.locality.id}`,
        'PUT',
        { name: 'Renamed locality', reason: 'Official rename' },
      );
      expect(renamed.status).toBe(200);
      const snapshots = {
        localityCodeAtSubmit: f.locality.code,
        localityNameAtSubmit: f.locality.name,
        localityTypeAtSubmit: f.locality.type,
        provinceNameAtSubmit: f.locality.provinceName,
      };
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
      ).toMatchObject({ localityId: f.locality.id, ...snapshots });

      const auditCount = await prisma.auditLog.count({
        where: { entityId: f.locality.id, action: 'locality.update' },
      });
      const afterRename = await prisma.locality.findUniqueOrThrow({
        where: { id: f.locality.id },
      });
      const duplicate = await f.call(
        'manager',
        `${localitiesPath}/${f.locality.id}`,
        'PUT',
        { name: 'Renamed locality', reason: 'Retry' },
      );
      expect(duplicate.status).toBe(200);
      expect(
        await prisma.locality.findUniqueOrThrow({
          where: { id: f.locality.id },
        }),
      ).toMatchObject({
        updatedAt: afterRename.updatedAt,
      });
      expect(
        await prisma.auditLog.count({
          where: { entityId: f.locality.id, action: 'locality.update' },
        }),
      ).toBe(auditCount);
      expect(afterRename.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );

      for (const change of [
        { type: 'WARD' },
        { provinceName: 'Other province' },
      ]) {
        expect(
          (
            await f.call(
              'manager',
              `${localitiesPath}/${f.locality.id}`,
              'PUT',
              { ...change, reason: 'Attempt identity change' },
            )
          ).status,
        ).toBe(409);
      }
      expect(
        (
          await f.call('manager', `${localitiesPath}/${f.locality.id}`, 'PUT', {
            code: 'TEST-IMMUTABLE',
            reason: 'Try changing code',
          })
        ).status,
      ).toBe(400);

      const draftLocality = await prisma.locality.create({
        data: {
          code: 'TEST-L-DRAFT-' + randomUUID(),
          name: 'Draft locality',
          type: 'COMMUNE',
          provinceName: 'Test province',
        },
      });
      await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: draftLocality.id,
          name: 'Draft product',
          formData: {},
        },
      });
      expect(
        (
          await f.call(
            'manager',
            `${localitiesPath}/${draftLocality.id}`,
            'PUT',
            {
              type: 'WARD',
              provinceName: 'New province',
              reason: 'Verified correction',
            },
          )
        ).status,
      ).toBe(200);

      expect(
        (
          await f.call('manager', `${localitiesPath}/${f.locality.id}`, 'PUT', {
            isActive: false,
            reason: 'Official retirement',
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await apiRequest<any>(
            baseUrl,
            `/localities?q=${encodeURIComponent(f.locality.code)}`,
          )
        ).body.data,
      ).toEqual([]);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
      ).toMatchObject({ localityId: f.locality.id, ...snapshots });
    });
  });

  it('rolls locality create and update back when audit insertion fails', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const createConstraint = 'test_locality_create_audit_failure';
      await prisma.$executeRaw(Prisma.sql`
        ALTER TABLE ${databaseObject('audit_logs')}
        ADD CONSTRAINT ${Prisma.raw('"' + createConstraint + '"')}
        CHECK ("action" <> 'locality.create')
      `);
      try {
        const input = localityInput();
        expect(
          (await f.call('manager', localitiesPath, 'POST', input)).status,
        ).toBe(500);
        expect(
          await prisma.locality.count({ where: { code: input.code } }),
        ).toBe(0);
      } finally {
        await prisma.$executeRaw(Prisma.sql`
          ALTER TABLE ${databaseObject('audit_logs')}
          DROP CONSTRAINT IF EXISTS ${Prisma.raw('"' + createConstraint + '"')}
        `);
      }

      const updateConstraint = 'test_locality_update_audit_failure';
      await prisma.$executeRaw(Prisma.sql`
        ALTER TABLE ${databaseObject('audit_logs')}
        ADD CONSTRAINT ${Prisma.raw('"' + updateConstraint + '"')}
        CHECK ("action" <> 'locality.update')
      `);
      try {
        expect(
          (
            await f.call(
              'manager',
              `${localitiesPath}/${f.locality.id}`,
              'PUT',
              { name: 'Must roll back', reason: 'Rollback check' },
            )
          ).status,
        ).toBe(500);
        await expect(
          prisma.locality.findUniqueOrThrow({
            where: { id: f.locality.id },
          }),
        ).resolves.toMatchObject({ name: f.locality.name });
      } finally {
        await prisma.$executeRaw(Prisma.sql`
          ALTER TABLE ${databaseObject('audit_logs')}
          DROP CONSTRAINT IF EXISTS ${Prisma.raw('"' + updateConstraint + '"')}
        `);
      }
    });
  });

  it('creates groups and inactive categories, and activates only the category with its own complete 100-point set', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const group = await prisma.productGroup.findFirstOrThrow();
      const madeGroup = await f.call('manager', groupsPath, 'POST', {
        code: 'TEST-' + randomUUID(),
        name: ' Test group ',
        description: ' Group description ',
        order: 9,
        isActive: true,
        reason: ' Catalog setup ',
      });
      expect(madeGroup.status).toBe(201);
      expect(madeGroup.body.data).toMatchObject({
        name: 'Test group',
        description: 'Group description',
        order: 9,
        isActive: true,
      });
      expect(
        (await f.call('viewer', groupsPath + '?isActive=false')).status,
      ).toBe(200);
      expect((await f.call('scorer', groupsPath)).status).toBe(403);
      expect(
        (
          await f.call(
            'manager',
            groupsPath + '/' + madeGroup.body.data.id,
            'PUT',
            {
              code: 'TEST-IMMUTABLE',
              reason: 'Try changing identifier',
            },
          )
        ).status,
      ).toBe(400);

      const input = categoryInput(group.id);
      const created = await f.call('manager', categoriesPath, 'POST', input);
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({
        id: expect.any(String),
        groupId: group.id,
        groupCode: group.code,
        groupName: group.name,
        name: input.name,
        isActive: false,
        referenceCount: 0,
        submittedReferenceCount: 0,
        criteriaSet: null,
      });
      expect((await f.call('viewer', categoriesPath)).status).toBe(200);
      expect(
        (await f.call('viewer', categoriesPath + '/' + created.body.data.id))
          .status,
      ).toBe(200);
      expect(
        (
          await f.call(
            'viewer',
            categoriesPath + '/' + created.body.data.id,
            'PUT',
            {
              name: 'Unauthorized',
              reason: 'No permission',
            },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await f.call('manager', categoriesPath, 'POST', {
            ...categoryInput(group.id),
            criteriaSetId: 'not-allowed',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await f.call(
            'manager',
            categoriesPath + '/' + created.body.data.id,
            'PUT',
            {
              isActive: true,
              reason: 'Activate without a set',
            },
          )
        ).status,
      ).toBe(409);

      const set = await prisma.criteriaSet.create({
        data: {
          categoryId: created.body.data.id,
          name: 'Verified test set',
          version: 'test',
          criteria: {
            create: {
              code: 'TEST-C1',
              name: 'Test criterion',
              maxScore: 99,
              sectionCode: 'T',
              sectionName: 'Test section',
              order: 1,
              subCriteria: {
                create: {
                  code: 'TEST-S1',
                  content: 'Test subcriterion',
                  order: 1,
                  options: {
                    create: { label: 'Complete', points: 99, order: 1 },
                  },
                },
              },
            },
          },
        },
      });
      expect(
        (
          await f.call(
            'manager',
            categoriesPath + '/' + created.body.data.id,
            'PUT',
            {
              isActive: true,
              reason: 'Reject 99 point set',
            },
          )
        ).status,
      ).toBe(409);
      const criterion = await prisma.criterion.findFirstOrThrow({
        where: { setId: set.id },
      });
      const option = await prisma.scoreOption.findFirstOrThrow({
        where: { subCriterion: { criterionId: criterion.id } },
      });
      await prisma.scoreOption.delete({ where: { id: option.id } });
      expect(
        (
          await f.call(
            'manager',
            categoriesPath + '/' + created.body.data.id,
            'PUT',
            {
              isActive: true,
              reason: 'Reject incomplete set',
            },
          )
        ).status,
      ).toBe(409);
      const completeOption = await prisma.scoreOption.create({
        data: {
          subCriterionId: option.subCriterionId,
          label: 'Complete',
          points: 99,
          order: 1,
        },
      });
      await prisma.criterion.update({
        where: { id: criterion.id },
        data: { maxScore: 101 },
      });
      await prisma.scoreOption.update({
        where: { id: completeOption.id },
        data: { points: 101 },
      });
      expect(
        (
          await f.call(
            'manager',
            categoriesPath + '/' + created.body.data.id,
            'PUT',
            {
              isActive: true,
              reason: 'Reject 101 point set',
            },
          )
        ).status,
      ).toBe(409);
      await prisma.criterion.update({
        where: { id: criterion.id },
        data: { maxScore: 100 },
      });
      await prisma.scoreOption.update({
        where: { id: completeOption.id },
        data: { points: 100 },
      });
      await prisma.criteriaSet.update({
        where: { id: set.id },
        data: { isActive: false },
      });
      expect(
        (
          await f.call(
            'manager',
            categoriesPath + '/' + created.body.data.id,
            'PUT',
            {
              isActive: true,
              reason: 'Reject inactive set',
            },
          )
        ).status,
      ).toBe(409);
      await prisma.criteriaSet.update({
        where: { id: set.id },
        data: { isActive: true },
      });
      const activated = await f.call(
        'manager',
        categoriesPath + '/' + created.body.data.id,
        'PUT',
        {
          isActive: true,
          reason: 'Activate verified category',
        },
      );
      expect(activated.status).toBe(200);
      expect(activated.body.data).toMatchObject({
        isActive: true,
        criteriaSet: { maxScore: 100, criterionCount: 1 },
      });
      const choices = await f.call('owner', '/categories');
      expect(
        choices.body.data.some(
          ({ id }: { id: string }) => id === created.body.data.id,
        ),
      ).toBe(true);
    });
  });

  it('keeps submitted products and evaluation snapshots while mirroring group rename and retiring the category', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        include: { group: true },
      });
      const beforeSnapshot = {
        schemaVersion: 1,
        title: 'Historical evaluation label',
      };
      const product = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          name: 'Submitted product',
          formData: {},
          status: ProductStatus.SUBMITTED,
        },
      });
      const evaluation = await prisma.evaluation.create({
        data: {
          judgeId: f.scorer.id,
          productId: product.id,
          status: 'SUBMITTED',
          submissionSnapshot: beforeSnapshot,
          total: 100,
        },
      });
      const renamedGroup = await f.call(
        'manager',
        groupsPath + '/' + category.groupId,
        'PUT',
        {
          name: 'Renamed group',
          reason: 'Official group rename',
        },
      );
      expect(renamedGroup.status).toBe(200);
      expect(
        await prisma.productCategory.findUniqueOrThrow({
          where: { id: category.id },
        }),
      ).toMatchObject({
        groupCode: category.groupCode,
        groupName: 'Renamed group',
      });
      const retired = await f.call(
        'manager',
        categoriesPath + '/' + category.id,
        'PUT',
        {
          isActive: false,
          reason: 'Category retirement',
        },
      );
      expect(retired.status).toBe(200);
      const choices = await f.call('owner', '/categories');
      expect(
        choices.body.data.some(({ id }: { id: string }) => id === category.id),
      ).toBe(false);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
      ).toMatchObject({
        categoryId: category.id,
        status: ProductStatus.SUBMITTED,
      });
      await expect(
        prisma.evaluation.findUniqueOrThrow({ where: { id: evaluation.id } }),
      ).resolves.toMatchObject({
        submissionSnapshot: beforeSnapshot,
        status: 'SUBMITTED',
      });
    });
  });

  it('blocks new drafts and draft submissions on a retired category or expired locality while allowing submitted products to finish scoring (CAT-02, LOC-01)', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true, group: { isActive: true } },
        include: {
          criteriaSet: {
            include: {
              criteria: {
                include: { subCriteria: { include: { options: true } } },
              },
            },
          },
        },
      });
      await prisma.judgeAssignment.create({
        data: {
          judgeId: f.scorer.id,
          categoryId: category.id,
          criterionIds: [],
        },
      });

      const validFormData = {
        entityName: 'HTX Kiểm thử CAT-02',
        representativeName: 'Nguyễn Văn B',
        representativeTitle: 'Giám đốc',
        contactAddress: 'Xã Khánh An, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0912345678',
        email: 'cat02@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 6,
        assessmentYear: 2026,
        declarationAccepted: true,
      };

      const draftProduct = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          name: 'Hồ sơ 1 (DRAFT trước khi ngừng phân loại)',
          formData: validFormData,
          status: ProductStatus.DRAFT,
        },
      });
      const submittedProduct = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          localityCodeAtSubmit: f.locality.code,
          localityNameAtSubmit: f.locality.name,
          localityTypeAtSubmit: f.locality.type,
          provinceNameAtSubmit: f.locality.provinceName,
          name: 'Hồ sơ 2 (SUBMITTED trước khi ngừng phân loại)',
          formData: validFormData,
          status: ProductStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });

      // Retire category (CAT-02 step 1)
      const retired = await f.call(
        'manager',
        `${categoriesPath}/${category.id}`,
        'PUT',
        {
          isActive: false,
          reason: 'Ngừng sử dụng phân loại CAT-02',
        },
      );
      expect(retired.status).toBe(200);

      // CAT-02 step 2: Creating a new draft on the retired category is rejected with 409
      const createOnRetired = await f.call('owner', '/my/products', 'POST', {
        name: 'Hồ sơ tạo mới trên phân loại đã ngừng',
        categoryId: category.id,
        localityId: f.locality.id,
        formData: validFormData,
      });
      expect(createOnRetired.status).toBe(409);

      // CAT-02 step 3: Existing DRAFT can still be viewed/updated (if switched to active category), but submitting on retired category is blocked with 409
      const submitOnRetired = await f.call(
        'owner',
        `/my/products/${draftProduct.id}/submit`,
        'POST',
      );
      expect(submitOnRetired.status).toBe(409);

      // CAT-02 step 4: Existing SUBMITTED product can still be scored and completed
      const allScores = category.criteriaSet!.criteria.flatMap((criterion) =>
        criterion.subCriteria.map((sub) => ({
          subCriterionId: sub.id,
          optionId: sub.options[sub.options.length - 1].id,
        })),
      );
      expect(
        (
          await f.call(
            'scorer',
            `/judge/products/${submittedProduct.id}/evaluation`,
            'PUT',
            { scores: allScores },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await f.call(
            'scorer',
            `/judge/products/${submittedProduct.id}/evaluation/submit`,
            'POST',
          )
        ).status,
      ).toBe(201);
      expect(
        await prisma.product.findUniqueOrThrow({
          where: { id: submittedProduct.id },
        }),
      ).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 100,
        starRating: 5,
      });

      // Re-activate category, then test LOC-01: draft attached to a locality whose effectiveTo is in the past cannot be submitted (409)
      await f.call('manager', `${categoriesPath}/${category.id}`, 'PUT', {
        isActive: true,
        reason: 'Kích hoạt lại phân loại để kiểm tra LOC-01',
      });
      await f.call('manager', `${localitiesPath}/${f.locality.id}`, 'PUT', {
        effectiveFrom: '2020-01-01T00:00:00+07:00',
        effectiveTo: '2025-12-31T23:59:59+07:00',
        reason: 'Đặt ngày hết hiệu lực trong quá khứ (LOC-01)',
      });
      expect(
        (
          await apiRequest<any>(
            baseUrl,
            `/localities?q=${encodeURIComponent(f.locality.code)}`,
          )
        ).body.data,
      ).toEqual([]);
      const submitExpiredLocality = await f.call(
        'owner',
        `/my/products/${draftProduct.id}/submit`,
        'POST',
      );
      expect(submitExpiredLocality.status).toBe(409);
    });
  });

  it('does not move a category that has a submitted product', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow();
      const target = await prisma.productGroup.findFirstOrThrow({
        where: { id: { not: category.groupId } },
      });
      await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          name: 'Submitted product',
          formData: {},
          status: ProductStatus.SUBMITTED,
        },
      });
      const moved = await f.call(
        'manager',
        categoriesPath + '/' + category.id,
        'PUT',
        {
          groupId: target.id,
          reason: 'Attempt move with history',
        },
      );
      expect(moved.status).toBe(409);
      await expect(
        prisma.productCategory.findUniqueOrThrow({
          where: { id: category.id },
        }),
      ).resolves.toMatchObject({
        groupId: category.groupId,
        groupCode: category.groupCode,
        groupName: category.groupName,
      });
    });
  });

  it('rolls category creation back if its audit insert fails', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const group = await prisma.productGroup.findFirstOrThrow();
      const constraint = 'test_admin_catalog_audit_failure';
      const input = categoryInput(group.id);
      await prisma.$executeRaw(Prisma.sql`
        ALTER TABLE ${databaseObject('audit_logs')}
        ADD CONSTRAINT ${Prisma.raw('"' + constraint + '"')}
        CHECK ("action" <> 'product_category.create')
      `);
      try {
        const result = await f.call('manager', categoriesPath, 'POST', input);
        expect(result.status).toBe(500);
        expect(
          await prisma.productCategory.count({ where: { name: input.name } }),
        ).toBe(0);
        expect(
          await prisma.auditLog.count({
            where: { action: 'product_category.create' },
          }),
        ).toBe(0);
      } finally {
        await prisma.$executeRaw(Prisma.sql`
          ALTER TABLE ${databaseObject('audit_logs')}
          DROP CONSTRAINT IF EXISTS ${Prisma.raw('"' + constraint + '"')}
        `);
      }
    });
  });
});
