import { ProductStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { databaseObject } from '../src/prisma/sql';
import { apiRequest, withTestApp } from './support/db-app';
import { adminFixture } from './support/admin-fixture';

const groupsPath = '/admin/product-groups';
const categoriesPath = '/admin/categories';
const categoryInput = (groupId: string) => ({
  groupId,
  name: 'Test leaf ' + randomUUID(),
  classificationGroup: 'Test classification',
  order: 1,
  reason: 'Catalog addition',
});

describe('H4 product catalogs', () => {
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
