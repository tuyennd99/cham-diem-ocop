import { EvaluationStatus, ProductStatus } from '@prisma/client';
import { adminFixture, draftPayload } from './support/admin-fixture';
import { withTestApp } from './support/db-app';

describe('H5 scoring forms and print-data endpoints', () => {
  it('lists 26 criteria sets for VIEW, restricts SCORE-only to assigned sets, and returns blank print-data (FORM-01, PRINT-01)', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const allSets = await f.call(
        'viewer',
        '/admin/criteria-sets?page=1&limit=100',
      );
      expect(allSets.status).toBe(200);
      expect(allSets.body.meta.total).toBe(26);
      expect(allSets.body.data).toHaveLength(26);
      for (const item of allSets.body.data) {
        expect(item.maxScore).toBe(100);
        expect(item.criterionCount).toBeGreaterThan(0);
      }

      const targetSet = allSets.body.data[0];
      const unassignedScoreList = await f.call(
        'scorer',
        '/admin/criteria-sets?page=1&limit=100',
      );
      expect(unassignedScoreList.status).toBe(200);
      expect(unassignedScoreList.body.data).toEqual([]);

      const forbiddenSet = await f.call(
        'scorer',
        `/admin/criteria-sets/${targetSet.id}/print-data`,
      );
      expect(forbiddenSet.status).toBe(404);

      await prisma.judgeAssignment.create({
        data: {
          judgeId: f.scorer.id,
          categoryId: targetSet.categoryId,
          criterionIds: [],
        },
      });

      const assignedScoreList = await f.call(
        'scorer',
        '/admin/criteria-sets?page=1&limit=100',
      );
      expect(assignedScoreList.status).toBe(200);
      expect(assignedScoreList.body.data.map((s: { id: string }) => s.id)).toEqual([
        targetSet.id,
      ]);

      const blankPrint = await f.call(
        'scorer',
        `/admin/criteria-sets/${targetSet.id}/print-data`,
      );
      expect(blankPrint.status).toBe(200);
      expect(blankPrint.body.data).toMatchObject({
        kind: 'BLANK_CRITERIA',
        criteriaSet: {
          id: targetSet.id,
          categoryId: targetSet.categoryId,
          maxScore: 100,
        },
      });
      expect(blankPrint.body.data.criteriaSet.criteria.length).toBe(
        targetSet.criterionCount,
      );

      // PRINT-01: MANAGE and VIEW can also fetch blank criteria print-data for any set
      const managerBlankPrint = await f.call(
        'manager',
        `/admin/criteria-sets/${targetSet.id}/print-data`,
      );
      expect(managerBlankPrint.status).toBe(200);
      expect(managerBlankPrint.body.data.kind).toBe('BLANK_CRITERIA');

      const viewerBlankPrint = await f.call(
        'viewer',
        `/admin/criteria-sets/${targetSet.id}/print-data`,
      );
      expect(viewerBlankPrint.status).toBe(200);
      expect(viewerBlankPrint.body.data.kind).toBe('BLANK_CRITERIA');

      const registrantDenied = await f.call(
        'owner',
        `/admin/criteria-sets/${targetSet.id}/print-data`,
      );
      expect(registrantDenied.status).toBe(403);
    });
  });

  it('Enforces evaluation list/print permissions, preserves snapshots after unit/catalog renames, and handles partial-scope + 89.99 vs 90 stars (FORM-02, PRINT-01..03, FILE-01)', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
        include: {
          criteriaSet: {
            include: {
              criteria: {
                orderBy: { order: 'asc' },
                include: {
                  subCriteria: {
                    orderBy: { order: 'asc' },
                    include: { options: { orderBy: { order: 'asc' } } },
                  },
                },
              },
            },
          },
        },
      });
      const criteria = category.criteriaSet!.criteria;
      const firstCriterion = criteria[0];
      const remainingCriteriaIds = criteria.slice(1).map((c) => c.id);

      const secondScorer = await prisma.user.create({
        data: {
          email: 'scorer2@example.invalid',
          password: f.scorer.password,
          fullName: 'Giám khảo Hai',
          role: 'JUDGE',
          staffPermissions: ['SCORE'],
          organizationUnitId: f.unit.id,
          verified: true,
          isActive: true,
        },
      });

      await prisma.judgeAssignment.createMany({
        data: [
          {
            judgeId: f.scorer.id,
            categoryId: category.id,
            criterionIds: [firstCriterion.id],
          },
          {
            judgeId: secondScorer.id,
            categoryId: category.id,
            criterionIds: remainingCriteriaIds,
          },
        ],
      });

      // Manager creates and submits a product for owner
      const created = await f.call('manager', '/admin/products', 'POST', {
        ...draftPayload(category.id, f.locality.id),
        registrantId: f.owner.id,
        reason: 'Nhập hộ hồ sơ',
      });
      expect(created.status).toBe(201);
      const productId = created.body.data.id as string;

      // Draft registration print-data: MANAGE & owner can read, VIEW gets 404
      expect(
        (
          await f.call(
            'viewer',
            `/admin/products/${productId}/registration-print-data`,
          )
        ).status,
      ).toBe(404);
      const draftRegPrint = await f.call(
        'manager',
        `/admin/products/${productId}/registration-print-data`,
      );
      expect(draftRegPrint.status).toBe(200);
      expect(draftRegPrint.body.data).toMatchObject({
        kind: 'REGISTRATION',
        isDraft: true,
      });

      // Submit product
      expect(
        (
          await f.call('manager', `/admin/products/${productId}/submit`, 'POST', {
            reason: 'Nộp hồ sơ',
          })
        ).status,
      ).toBe(201);

      // Scorer 1 saves draft for firstCriterion
      const scorer1Scores = firstCriterion.subCriteria.map((sub) => ({
        subCriterionId: sub.id,
        optionId: sub.options[sub.options.length - 1].id,
        note: 'Ghi chú tiêu chí 1',
      }));
      expect(
        (
          await f.call('scorer', `/judge/products/${productId}/evaluation`, 'PUT', {
            scores: scorer1Scores,
          })
        ).status,
      ).toBe(200);

      // Judge draft print-data works for scorer
      const judgeDraftPrint = await f.call(
        'scorer',
        `/judge/products/${productId}/evaluation/print-data`,
      );
      expect(judgeDraftPrint.status).toBe(200);
      expect(judgeDraftPrint.body.data).toMatchObject({
        kind: 'EVALUATION',
        isDraft: true,
        isPartialScope: true,
        scopeMaxScore: firstCriterion.maxScore,
      });

      const evalRecord = await prisma.evaluation.findUniqueOrThrow({
        where: {
          judgeId_productId: { judgeId: f.scorer.id, productId },
        },
      });

      // VIEW cannot print IN_PROGRESS evaluation, MANAGE and author can
      expect(
        (
          await f.call(
            'viewer',
            `/admin/evaluations/${evalRecord.id}/print-data`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await f.call(
            'manager',
            `/admin/evaluations/${evalRecord.id}/print-data`,
          )
        ).status,
      ).toBe(200);

      // Submit scorer 1 evaluation
      expect(
        (
          await f.call(
            'scorer',
            `/judge/products/${productId}/evaluation/submit`,
            'POST',
          )
        ).status,
      ).toBe(201);

      // Rename unit, judge, locality, and category after submission
      await prisma.organizationUnit.update({
        where: { id: f.unit.id },
        data: { name: 'Đơn vị Đã Đổi Tên' },
      });
      await prisma.user.update({
        where: { id: f.scorer.id },
        data: { fullName: 'Tên Giám Khảo Đã Đổi' },
      });
      await prisma.locality.update({
        where: { id: f.locality.id },
        data: { name: 'Xã Đã Đổi Tên' },
      });

      // Submitted evaluation print-data preserves snapshot judge & unit names
      const submittedEvalPrint = await f.call(
        'viewer',
        `/admin/evaluations/${evalRecord.id}/print-data`,
      );
      expect(submittedEvalPrint.status).toBe(200);
      expect(submittedEvalPrint.body.data).toMatchObject({
        kind: 'EVALUATION',
        isDraft: false,
        provenance: 'SNAPSHOT_V1',
        isPartialScope: true,
        judge: {
          id: f.scorer.id,
          fullName: 'Test user',
          organizationUnitName: 'Test unit',
        },
      });
      expect(
        submittedEvalPrint.body.data.criteria.filter(
          (c: { inScope: boolean }) => !c.inScope,
        ).length,
      ).toBe(criteria.length - 1);

      // Submitted registration print-data preserves locality snapshot
      const submittedRegPrint = await f.call(
        'viewer',
        `/admin/products/${productId}/registration-print-data`,
      );
      expect(submittedRegPrint.status).toBe(200);
      expect(submittedRegPrint.body.data.locality.name).toBe('Test locality');

      // Owner can read own registration print-data, otherOwner gets 404
      expect(
        (
          await f.call(
            'owner',
            `/my/products/${productId}/registration-print-data`,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await f.call(
            'otherOwner',
            `/my/products/${productId}/registration-print-data`,
          )
        ).status,
      ).toBe(404);

      // Results print-data while SCORING withholds finalScore and starRating
      const scoringResultsPrint = await f.call(
        'viewer',
        `/admin/products/${productId}/results/print-data`,
      );
      expect(scoringResultsPrint.status).toBe(200);
      expect(scoringResultsPrint.body.data.product).toMatchObject({
        status: ProductStatus.SCORING,
        finalScore: null,
        starRating: null,
        starLabel: null,
      });

      // Verify 89.99 stays 4 stars and 90 gets proposed 5-star label when COMPLETED
      await prisma.product.update({
        where: { id: productId },
        data: {
          status: ProductStatus.COMPLETED,
          completedAt: new Date(),
          finalScore: 89.99,
          starRating: 4,
        },
      });
      const completed4Star = await f.call(
        'viewer',
        `/admin/products/${productId}/results/print-data`,
      );
      expect(completed4Star.status).toBe(200);
      expect(completed4Star.body.data.product).toMatchObject({
        finalScore: 89.99,
        starRating: 4,
        starLabel: 'Mức điểm 4 sao',
      });

      await prisma.product.update({
        where: { id: productId },
        data: { finalScore: 90, starRating: 5 },
      });
      const completed5Star = await f.call(
        'owner',
        `/my/products/${productId}/results/print-data`,
      );
      expect(completed5Star.status).toBe(200);
      expect(completed5Star.body.data.product).toMatchObject({
        finalScore: 90,
        starRating: 5,
        starLabel: 'Mức điểm 5 sao / Đề nghị xem xét 5 sao',
      });

      // Evaluations list endpoint checks
      const evalListViewer = await f.call(
        'viewer',
        `/admin/evaluations?productId=${productId}`,
      );
      expect(evalListViewer.status).toBe(200);
      expect(evalListViewer.body.data).toHaveLength(1);
      expect(evalListViewer.body.data[0]).toMatchObject({
        id: evalRecord.id,
        status: EvaluationStatus.SUBMITTED,
        isPartialScope: true,
        judge: {
          fullName: 'Test user',
          organizationUnitName: 'Test unit',
        },
      });
    });
  });
});
