import { ProductStatus } from '@prisma/client';
import { adminFixture } from './support/admin-fixture';
import { withTestApp } from './support/db-app';

describe('H6 statistical reports and analytics dashboard endpoints', () => {
  it('verifies REP-01..05 and DASH-01..02 across /admin/reports/registrations, /admin/reports/results, and /admin/dashboard', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
        include: { criteriaSet: { include: { criteria: true } } },
      });

      // Product A: submitted 31/01/2026, completed 02/02/2026 with 3 stars (score 60) + multiple attachments & evaluations (REP-01, REP-02)
      const prodA = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          localityCodeAtSubmit: f.locality.code,
          localityNameAtSubmit: f.locality.name,
          localityTypeAtSubmit: f.locality.type,
          provinceNameAtSubmit: f.locality.provinceName,
          name: 'Sản phẩm A (Nộp T1, Hoàn tất T2)',
          formData: { registrationType: 'FIRST', assessmentYear: 2026 },
          status: ProductStatus.COMPLETED,
          submittedAt: new Date('2026-01-31T10:00:00+07:00'),
          completedAt: new Date('2026-02-02T14:00:00+07:00'),
          finalScore: 60,
          starRating: 3,
          attachments: {
            create: [
              { type: 'IMAGE', fileName: 'a1.png', filePath: 'a1' },
              { type: 'IMAGE', fileName: 'a2.png', filePath: 'a2' },
              { type: 'EVIDENCE', fileName: 'a3.pdf', filePath: 'a3' },
            ],
          },
          statusEvents: {
            create: [
              {
                sequence: 1,
                fromStatus: null,
                toStatus: ProductStatus.DRAFT,
                createdAt: new Date('2026-01-30T09:00:00+07:00'),
              },
              {
                sequence: 2,
                fromStatus: ProductStatus.DRAFT,
                toStatus: ProductStatus.SUBMITTED,
                createdAt: new Date('2026-01-31T10:00:00+07:00'),
              },
              {
                sequence: 3,
                fromStatus: ProductStatus.SUBMITTED,
                toStatus: ProductStatus.COMPLETED,
                createdAt: new Date('2026-02-02T14:00:00+07:00'),
              },
            ],
          },
        },
      });

      // Product B: submitted 10/01/2026, completed 20/01/2026 with 2 stars (score 40)
      await prisma.product.create({
        data: {
          registrantId: f.otherOwner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          localityCodeAtSubmit: f.locality.code,
          localityNameAtSubmit: f.locality.name,
          localityTypeAtSubmit: f.locality.type,
          provinceNameAtSubmit: f.locality.provinceName,
          name: 'Sản phẩm B (Nộp T1, Hoàn tất T1 - 2 sao)',
          formData: { registrationType: 'FIRST', assessmentYear: 2026 },
          status: ProductStatus.COMPLETED,
          submittedAt: new Date('2026-01-10T09:00:00+07:00'),
          completedAt: new Date('2026-01-20T15:00:00+07:00'),
          finalScore: 40,
          starRating: 2,
          statusEvents: {
            create: [
              {
                sequence: 1,
                fromStatus: ProductStatus.DRAFT,
                toStatus: ProductStatus.SUBMITTED,
                createdAt: new Date('2026-01-10T09:00:00+07:00'),
              },
              {
                sequence: 2,
                fromStatus: ProductStatus.SUBMITTED,
                toStatus: ProductStatus.COMPLETED,
                createdAt: new Date('2026-01-20T15:00:00+07:00'),
              },
            ],
          },
        },
      });

      // Product C: submitted 12/01/2026, SCORING at end of Jan, unmapped locality
      await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: null,
          name: 'Sản phẩm C (Đang chấm, chưa gán địa bàn)',
          formData: { registrationType: 'UPGRADE', assessmentYear: 2026 },
          status: ProductStatus.SCORING,
          submittedAt: new Date('2026-01-12T08:00:00+07:00'),
          statusEvents: {
            create: [
              {
                sequence: 1,
                fromStatus: ProductStatus.DRAFT,
                toStatus: ProductStatus.SUBMITTED,
                createdAt: new Date('2026-01-12T08:00:00+07:00'),
              },
              {
                sequence: 2,
                fromStatus: ProductStatus.SUBMITTED,
                toStatus: ProductStatus.SCORING,
                createdAt: new Date('2026-01-18T11:00:00+07:00'),
              },
            ],
          },
        },
      });

      // Product D: DRAFT (excluded from registrations)
      await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          name: 'Sản phẩm D (Nháp)',
          formData: {},
          status: ProductStatus.DRAFT,
        },
      });

      // Permission check: SCORE-only and REGISTRANT get 403
      expect(
        (
          await f.call(
            'scorer',
            '/admin/reports/registrations?year=2026&month=1',
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await f.call('owner', '/admin/reports/results?year=2026&month=1')
        ).status,
      ).toBe(403);

      // 1. January 2026 Registration Report (VIEW can access)
      const janReg = await f.call(
        'viewer',
        '/admin/reports/registrations?year=2026&month=1&groupBy=locality',
      );
      expect(janReg.status).toBe(200);
      expect(janReg.body.data.period).toMatchObject({
        timezone: 'Asia/Ho_Chi_Minh',
        year: 2026,
        month: 1,
        from: '2026-01-01T00:00:00+07:00',
        toExclusive: '2026-02-01T00:00:00+07:00',
      });
      expect(janReg.body.data.totals).toMatchObject({
        registeredCount: 3,
        waitingCount: 1,
        scoringCount: 1,
        completedCount: 1,
        passedCount: 0,
        failedCount: 1,
        distinctRegistrantCount: 2,
        unmappedLocalityCount: 1,
      });

      // 2. January 2026 Results Report
      const janRes = await f.call(
        'viewer',
        '/admin/reports/results?year=2026&month=1&groupBy=group',
      );
      expect(janRes.status).toBe(200);
      expect(janRes.body.data.totals).toMatchObject({
        completedCount: 1,
        passedCount: 0,
        failedCount: 1,
        starCounts: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 },
      });

      // 3. February 2026 Results Report (Product A completed 02/02 with 3 stars)
      const febRes = await f.call(
        'viewer',
        '/admin/reports/results?year=2026&month=2&groupBy=category',
      );
      expect(febRes.status).toBe(200);
      expect(febRes.body.data.totals).toMatchObject({
        completedCount: 1,
        passedCount: 1,
        failedCount: 0,
        starCounts: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 },
      });

      // 4. Analytics Dashboard with filters
      const dash = await f.call(
        'viewer',
        '/admin/dashboard?year=2026&month=1',
      );
      expect(dash.status).toBe(200);
      expect(dash.body.data.kpis).toHaveLength(8);
      expect(dash.body.data.charts.monthlyTrend).toHaveLength(12);
      expect(dash.body.data.charts.byProductGroup).toHaveLength(6);
      expect(dash.body.data.charts.cohortProgress).toMatchObject({
        registeredCount: 3,
        waitingCount: 1,
        scoringCount: 1,
        completedCount: 1,
      });
      expect(prodA.id).toBeDefined();
    });
  });
});
