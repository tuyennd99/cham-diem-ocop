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

      expect((await f.call('viewer', '/admin/reports/results?groupBy=group')).status).toBe(400);
      expect((await f.call('viewer', '/admin/dashboard?groupId=legacy-group')).status).toBe(400);

      // 2. January 2026 Results Report
      const janRes = await f.call(
        'viewer',
        '/admin/reports/results?year=2026&month=1&groupBy=category',
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
      expect(dash.body.data.charts.byCategory).toHaveLength(26);
      expect(dash.body.data.charts).not.toHaveProperty('byProductGroup');
      for (const category of dash.body.data.charts.byCategory) {
        expect(category).toMatchObject({ categoryId: expect.any(String), categoryName: expect.any(String), registeredCount: expect.any(Number), completedCount: expect.any(Number) });
        expect(category).not.toHaveProperty('categories');
      }
      expect(dash.body.data.charts.cohortProgress).toMatchObject({
        registeredCount: 3,
        waitingCount: 1,
        scoringCount: 1,
        completedCount: 1,
      });
      expect(prodA.id).toBeDefined();
    });
  });

  it('verifies REP-01 cross-month cohort, REP-02 unmapped locality and 49 vs 50 threshold, REP-03 +07:00 month boundary, and DASH-01 KPIs/attention list', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
      });

      // REP-01 (REP-CROSS): submitted 2026-09-30T10:00:00+07:00, completed 2026-10-01T10:00:00+07:00, finalScore=60, starRating=3
      const repCross = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          localityCodeAtSubmit: f.locality.code,
          localityNameAtSubmit: f.locality.name,
          localityTypeAtSubmit: f.locality.type,
          provinceNameAtSubmit: f.locality.provinceName,
          name: 'Hồ sơ REP-CROSS (Nộp 30/09, Hoàn tất 01/10)',
          formData: { registrationType: 'FIRST', assessmentYear: 2026 },
          status: ProductStatus.COMPLETED,
          submittedAt: new Date('2026-09-30T10:00:00+07:00'),
          completedAt: new Date('2026-10-01T10:00:00+07:00'),
          finalScore: 60,
          starRating: 3,
          statusEvents: {
            create: [
              {
                sequence: 1,
                fromStatus: ProductStatus.DRAFT,
                toStatus: ProductStatus.SUBMITTED,
                createdAt: new Date('2026-09-30T10:00:00+07:00'),
              },
              {
                sequence: 2,
                fromStatus: ProductStatus.SUBMITTED,
                toStatus: ProductStatus.COMPLETED,
                createdAt: new Date('2026-10-01T10:00:00+07:00'),
              },
            ],
          },
        },
      });

      // REP-02 (REP-LEGACY):
      // 1) Legacy submitted product in Sept 2026 without localityId, localityCodeAtSubmit, localityNameAtSubmit, or registrationSnapshot
      const repLegacyUnmapped = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: null,
          localityCodeAtSubmit: null,
          localityNameAtSubmit: null,
          localityTypeAtSubmit: null,
          provinceNameAtSubmit: null,
          name: 'Hồ sơ lịch sử thiếu địa bàn (REP-02)',
          formData: { registrationType: 'FIRST', assessmentYear: 2026 },
          status: ProductStatus.SUBMITTED,
          submittedAt: new Date('2026-09-15T09:00:00+07:00'),
          statusEvents: {
            create: [
              {
                sequence: 1,
                fromStatus: ProductStatus.DRAFT,
                toStatus: ProductStatus.SUBMITTED,
                createdAt: new Date('2026-09-15T09:00:00+07:00'),
              },
            ],
          },
        },
      });

      // 2) Score 49 (2 stars -> failed) and Score 50 (3 stars -> passed) completed in Sept 2026
      await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          localityCodeAtSubmit: f.locality.code,
          localityNameAtSubmit: f.locality.name,
          localityTypeAtSubmit: f.locality.type,
          provinceNameAtSubmit: f.locality.provinceName,
          name: 'Hồ sơ 49 điểm - 2 sao (Chưa đạt)',
          formData: { registrationType: 'FIRST', assessmentYear: 2026 },
          status: ProductStatus.COMPLETED,
          submittedAt: new Date('2026-09-10T08:00:00+07:00'),
          completedAt: new Date('2026-09-20T10:00:00+07:00'),
          finalScore: 49,
          starRating: 2,
          statusEvents: {
            create: [
              {
                sequence: 1,
                fromStatus: ProductStatus.DRAFT,
                toStatus: ProductStatus.SUBMITTED,
                createdAt: new Date('2026-09-10T08:00:00+07:00'),
              },
              {
                sequence: 2,
                fromStatus: ProductStatus.SUBMITTED,
                toStatus: ProductStatus.COMPLETED,
                createdAt: new Date('2026-09-20T10:00:00+07:00'),
              },
            ],
          },
        },
      });

      await prisma.product.create({
        data: {
          registrantId: f.otherOwner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          localityCodeAtSubmit: f.locality.code,
          localityNameAtSubmit: f.locality.name,
          localityTypeAtSubmit: f.locality.type,
          provinceNameAtSubmit: f.locality.provinceName,
          name: 'Hồ sơ 50 điểm - 3 sao (Đạt)',
          formData: { registrationType: 'FIRST', assessmentYear: 2026 },
          status: ProductStatus.COMPLETED,
          submittedAt: new Date('2026-09-11T08:00:00+07:00'),
          completedAt: new Date('2026-09-21T10:00:00+07:00'),
          finalScore: 50,
          starRating: 3,
          statusEvents: {
            create: [
              {
                sequence: 1,
                fromStatus: ProductStatus.DRAFT,
                toStatus: ProductStatus.SUBMITTED,
                createdAt: new Date('2026-09-11T08:00:00+07:00'),
              },
              {
                sequence: 2,
                fromStatus: ProductStatus.SUBMITTED,
                toStatus: ProductStatus.COMPLETED,
                createdAt: new Date('2026-09-21T10:00:00+07:00'),
              },
            ],
          },
        },
      });

      // Biên múi giờ Việt Nam (REP-03): cả hai thời điểm đều có ngày UTC là 2026-09-30 (16:59:59Z và 17:00:00Z)
      // nhưng theo Asia/Ho_Chi_Minh (+07:00) phải tách đúng vào kỳ 2026-09 và 2026-10.
      const septEnd = new Date('2026-09-30T23:59:59+07:00');
      const octStart = new Date('2026-10-01T00:00:00+07:00');
      expect(septEnd.toISOString()).toBe('2026-09-30T16:59:59.000Z');
      expect(octStart.toISOString()).toBe('2026-09-30T17:00:00.000Z');

      const prodSeptBoundary = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          localityCodeAtSubmit: f.locality.code,
          localityNameAtSubmit: f.locality.name,
          localityTypeAtSubmit: f.locality.type,
          provinceNameAtSubmit: f.locality.provinceName,
          name: 'Hồ sơ biên cuối tháng 9 (23:59:59+07)',
          formData: { registrationType: 'FIRST', assessmentYear: 2026 },
          status: ProductStatus.COMPLETED,
          submittedAt: septEnd,
          completedAt: septEnd,
          finalScore: 92,
          starRating: 5,
          statusEvents: {
            create: [
              {
                sequence: 1,
                fromStatus: ProductStatus.DRAFT,
                toStatus: ProductStatus.SUBMITTED,
                createdAt: septEnd,
              },
              {
                sequence: 2,
                fromStatus: ProductStatus.SUBMITTED,
                toStatus: ProductStatus.COMPLETED,
                createdAt: septEnd,
              },
            ],
          },
        },
      });

      const prodOctBoundary = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          localityCodeAtSubmit: f.locality.code,
          localityNameAtSubmit: f.locality.name,
          localityTypeAtSubmit: f.locality.type,
          provinceNameAtSubmit: f.locality.provinceName,
          name: 'Hồ sơ biên đầu tháng 10 (00:00:00+07)',
          formData: { registrationType: 'FIRST', assessmentYear: 2026 },
          status: ProductStatus.COMPLETED,
          submittedAt: octStart,
          completedAt: octStart,
          finalScore: 75,
          starRating: 4,
          statusEvents: {
            create: [
              {
                sequence: 1,
                fromStatus: ProductStatus.DRAFT,
                toStatus: ProductStatus.SUBMITTED,
                createdAt: octStart,
              },
              {
                sequence: 2,
                fromStatus: ProductStatus.SUBMITTED,
                toStatus: ProductStatus.COMPLETED,
                createdAt: octStart,
              },
            ],
          },
        },
      });

      // Verify September 2026 Registrations & Results Reports (REP-01, REP-02, REP-03)
      // Sept registrations: repCross (waiting at Sept asOf), repLegacyUnmapped (waiting), 49-pt (completed), 50-pt (completed), prodSeptBoundary (completed 92-pt) => 5 total
      const septReg = await f.call(
        'viewer',
        '/admin/reports/registrations?year=2026&month=9&groupBy=locality',
      );
      expect(septReg.status).toBe(200);
      expect(septReg.body.data.period).toMatchObject({
        timezone: 'Asia/Ho_Chi_Minh',
        year: 2026,
        month: 9,
        from: '2026-09-01T00:00:00+07:00',
        toExclusive: '2026-10-01T00:00:00+07:00',
      });
      expect(septReg.body.data.totals).toMatchObject({
        registeredCount: 5,
        waitingCount: 2,
        completedCount: 3,
        passedCount: 2,
        failedCount: 1,
        unmappedLocalityCount: 1,
      });

      const unmappedRow = septReg.body.data.rows.find(
        (r: { key: string }) => r.key === 'UNMAPPED_LOCALITY',
      );
      expect(unmappedRow).toMatchObject({
        key: 'UNMAPPED_LOCALITY',
        label: 'Chưa xác định địa bàn',
        registeredCount: 1,
        drillDown: expect.objectContaining({ unmappedLocality: true }),
      });
      const sumRowRegistered = septReg.body.data.rows.reduce(
        (sum: number, r: { registeredCount: number }) =>
          sum + r.registeredCount,
        0,
      );
      expect(sumRowRegistered).toBe(septReg.body.data.totals.registeredCount);

      // Sept results: 49-pt (2 stars), 50-pt (3 stars), prodSeptBoundary (92-pt, 5 stars). repCross & prodOctBoundary are in Oct!
      const septRes = await f.call(
        'viewer',
        '/admin/reports/results?year=2026&month=9&groupBy=locality',
      );
      expect(septRes.status).toBe(200);
      expect(septRes.body.data.totals).toMatchObject({
        completedCount: 3,
        passedCount: 2,
        failedCount: 1,
        starCounts: { 1: 0, 2: 1, 3: 1, 4: 0, 5: 1 },
      });

      // Verify October 2026 Registrations & Results Reports (REP-01, REP-03)
      // Oct registrations: only prodOctBoundary (repCross was submitted in Sept)
      const octReg = await f.call(
        'viewer',
        '/admin/reports/registrations?year=2026&month=10&groupBy=locality',
      );
      expect(octReg.status).toBe(200);
      expect(octReg.body.data.totals).toMatchObject({
        registeredCount: 1,
        completedCount: 1,
        passedCount: 1,
        failedCount: 0,
      });

      // Oct results: repCross (60-pt, 3 stars) + prodOctBoundary (75-pt, 4 stars) => 2 completed
      const octRes = await f.call(
        'viewer',
        '/admin/reports/results?year=2026&month=10&groupBy=locality',
      );
      expect(octRes.status).toBe(200);
      expect(octRes.body.data.totals).toMatchObject({
        completedCount: 2,
        passedCount: 2,
        failedCount: 0,
        starCounts: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 0 },
      });

      // Verify exact product IDs via drill-down for September vs October (REP-01, REP-03)
      const septRegList = await f.call(
        'viewer',
        `/admin/products?dateBasis=submittedAt&from=${encodeURIComponent('2026-09-01T00:00:00+07:00')}&toExclusive=${encodeURIComponent('2026-10-01T00:00:00+07:00')}`,
      );
      const septRegIds = septRegList.body.data.map((p: { id: string }) => p.id);
      expect(septRegIds).toContain(repCross.id);
      expect(septRegIds).toContain(prodSeptBoundary.id);
      expect(septRegIds).not.toContain(prodOctBoundary.id);

      const octRegList = await f.call(
        'viewer',
        `/admin/products?dateBasis=submittedAt&from=${encodeURIComponent('2026-10-01T00:00:00+07:00')}&toExclusive=${encodeURIComponent('2026-11-01T00:00:00+07:00')}`,
      );
      const octRegIds = octRegList.body.data.map((p: { id: string }) => p.id);
      expect(octRegIds).toEqual([prodOctBoundary.id]);

      const octResList = await f.call(
        'viewer',
        `/admin/products?dateBasis=completedAt&status=COMPLETED&from=${encodeURIComponent('2026-10-01T00:00:00+07:00')}&toExclusive=${encodeURIComponent('2026-11-01T00:00:00+07:00')}`,
      );
      const octResIds = octResList.body.data.map((p: { id: string }) => p.id);
      expect(octResIds).toEqual(
        expect.arrayContaining([repCross.id, prodOctBoundary.id]),
      );
      expect(octResIds).not.toContain(prodSeptBoundary.id);

      // DASH-01: 8 KPIs, 3 drill-down links (registeredInPeriod, completedInPeriod, fiveStarInPeriod), and needsAttention for unassigned category
      const dashSept = await f.call(
        'viewer',
        '/admin/dashboard?year=2026&month=9',
      );
      expect(dashSept.status).toBe(200);
      const kpis = dashSept.body.data.kpis as Array<{
        id: string;
        value: number | null;
        drillDown: Record<string, unknown>;
      }>;
      expect(kpis.map((k) => k.id)).toEqual([
        'registeredInPeriod',
        'completedInPeriod',
        'passedInPeriod',
        'failedInPeriod',
        'passRateInPeriod',
        'fiveStarInPeriod',
        'openBacklogAtAsOf',
        'underAssignedBacklogAtAsOf',
      ]);

      const regKpi = kpis.find((k) => k.id === 'registeredInPeriod')!;
      expect(regKpi.value).toBe(5);
      expect(regKpi.drillDown).toMatchObject({
        dateBasis: 'submittedAt',
        from: '2026-09-01T00:00:00+07:00',
        toExclusive: '2026-10-01T00:00:00+07:00',
      });

      const compKpi = kpis.find((k) => k.id === 'completedInPeriod')!;
      expect(compKpi.value).toBe(3);
      expect(compKpi.drillDown).toMatchObject({
        dateBasis: 'completedAt',
        status: 'COMPLETED',
        from: '2026-09-01T00:00:00+07:00',
        toExclusive: '2026-10-01T00:00:00+07:00',
      });

      const fiveStarKpi = kpis.find((k) => k.id === 'fiveStarInPeriod')!;
      expect(fiveStarKpi.value).toBe(1);
      expect(fiveStarKpi.drillDown).toMatchObject({
        dateBasis: 'completedAt',
        status: 'COMPLETED',
        starRating: 5,
        from: '2026-09-01T00:00:00+07:00',
        toExclusive: '2026-10-01T00:00:00+07:00',
      });

      // Verify 5-star drill-down query returns prodSeptBoundary
      const fiveStarList = await f.call(
        'viewer',
        `/admin/products?dateBasis=completedAt&status=COMPLETED&starRating=5&from=${encodeURIComponent('2026-09-01T00:00:00+07:00')}&toExclusive=${encodeURIComponent('2026-10-01T00:00:00+07:00')}`,
      );
      expect(fiveStarList.body.data.map((p: { id: string }) => p.id)).toEqual([
        prodSeptBoundary.id,
      ]);

      // Verify needsAttention contains the open submitted product in the unassigned category
      expect(dashSept.body.data.needsAttention).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: repLegacyUnmapped.id,
            status: 'SUBMITTED',
            assignedJudgeCount: 0,
            missingCriteriaCount: 1,
          }),
        ]),
      );
    });
  });
});
