import {
  buildAnalyticsDashboard,
  buildRegistrationReport,
  buildResultsReport,
  resolveVietnamPeriod,
  statusAtAsOf,
  type ReportingProductRecord,
} from './reporting';

describe('H6 reporting and analytics dashboard engine', () => {
  it('resolves half-open Asia/Ho_Chi_Minh periods, leap-year February, and partial current period comparison (REP-04)', () => {
    // Leap year Feb 2024
    const feb2024 = resolveVietnamPeriod(
      { year: 2024, month: 2 },
      new Date('2026-10-24T05:00:00.000Z'),
      new Date('2026-01-01T00:00:00+07:00'),
    );
    expect(feb2024.from).toBe('2024-02-01T00:00:00+07:00');
    expect(feb2024.toExclusive).toBe('2024-03-01T00:00:00+07:00');
    expect(feb2024.isPartialPeriod).toBe(false);
    expect(feb2024.previousPeriod.from).toBe('2024-01-01T00:00:00+07:00');
    expect(feb2024.previousPeriod.toExclusive).toBe(
      '2024-02-01T00:00:00+07:00',
    );

    // Non-leap year Feb 2026
    const feb2026 = resolveVietnamPeriod(
      { year: 2026, month: 2 },
      new Date('2026-10-24T05:00:00.000Z'),
      new Date('2026-01-01T00:00:00+07:00'),
    );
    expect(feb2026.toExclusive).toBe('2026-03-01T00:00:00+07:00');

    // Partial current month (generatedAt inside Oct 2026)
    const oct2026 = resolveVietnamPeriod(
      { year: 2026, month: 10 },
      new Date('2026-10-15T12:00:00+07:00'),
      new Date('2026-01-01T00:00:00+07:00'),
    );
    expect(oct2026.isPartialPeriod).toBe(true);
    expect(oct2026.asOf).toBe(
      new Date('2026-10-15T12:00:00+07:00').toISOString(),
    );
    expect(oct2026.previousPeriod.from).toBe('2026-09-01T00:00:00+07:00');
    expect(oct2026.previousPeriod.comparisonToExclusive).toBe(
      new Date('2026-09-15T12:00:00+07:00').toISOString(),
    );
  });

  it('evaluates statusAtAsOf strictly before asOf (< asOf) so 00:00 first day of next month belongs to next month (REP-04)', () => {
    const events = [
      {
        sequence: 1,
        toStatus: 'DRAFT' as const,
        createdAt: new Date('2026-01-10T08:00:00+07:00'),
      },
      {
        sequence: 2,
        toStatus: 'SUBMITTED' as const,
        createdAt: new Date('2026-01-15T09:00:00+07:00'),
      },
      {
        sequence: 3,
        toStatus: 'COMPLETED' as const,
        createdAt: new Date('2026-02-01T00:00:00+07:00'),
      },
    ];
    const janEnd = new Date('2026-02-01T00:00:00+07:00');
    expect(statusAtAsOf(events, janEnd)).toBe('SUBMITTED');
    expect(statusAtAsOf(events, new Date('2026-02-01T00:00:01+07:00'))).toBe(
      'COMPLETED',
    );
  });

  it('satisfies the exact REP-02 spec scenario, REP-01 distinct counting, and REP-05 reconciliation', () => {
    const baseCategory = {
      id: 'cat-tea',
      name: 'Chè tươi, chè chế biến',
      criterionIds: ['c1', 'c2'],
    };
    const baseLocality = {
      id: 'loc-1',
      code: 'LOC-01',
      name: 'Xã Tân Cương',
      type: 'COMMUNE' as const,
      provinceName: 'Thái Nguyên',
    };

    // Spec section 14 REP-02 example:
    // A submitted 31/01, completed 02/02 with 3 stars (score 60)
    // B submitted 10/01, completed 20/01 with 2 stars (score 40)
    // C submitted 12/01, SCORING at end of Jan
    // D still DRAFT
    const products: ReportingProductRecord[] = [
      {
        id: 'prod-A',
        name: 'Sản phẩm A',
        registrantId: 'reg-1',
        status: 'COMPLETED',
        submittedAt: new Date('2026-01-31T10:00:00+07:00'),
        completedAt: new Date('2026-02-02T14:00:00+07:00'),
        finalScore: 60,
        starRating: 3,
        registrationType: 'FIRST',
        assessmentYear: 2026,
        category: baseCategory,
        locality: baseLocality,
        statusEvents: [
          {
            sequence: 1,
            toStatus: 'DRAFT',
            createdAt: new Date('2026-01-30T10:00:00+07:00'),
          },
          {
            sequence: 2,
            toStatus: 'SUBMITTED',
            createdAt: new Date('2026-01-31T10:00:00+07:00'),
          },
          {
            sequence: 3,
            toStatus: 'COMPLETED',
            createdAt: new Date('2026-02-02T14:00:00+07:00'),
          },
        ],
      },
      {
        id: 'prod-B',
        name: 'Sản phẩm B',
        registrantId: 'reg-2',
        status: 'COMPLETED',
        submittedAt: new Date('2026-01-10T09:00:00+07:00'),
        completedAt: new Date('2026-01-20T15:00:00+07:00'),
        finalScore: 40,
        starRating: 2,
        registrationType: 'FIRST',
        assessmentYear: 2026,
        category: baseCategory,
        locality: baseLocality,
        statusEvents: [
          {
            sequence: 1,
            toStatus: 'SUBMITTED',
            createdAt: new Date('2026-01-10T09:00:00+07:00'),
          },
          {
            sequence: 2,
            toStatus: 'COMPLETED',
            createdAt: new Date('2026-01-20T15:00:00+07:00'),
          },
        ],
      },
      {
        id: 'prod-C',
        name: 'Sản phẩm C',
        registrantId: 'reg-1',
        status: 'SCORING',
        submittedAt: new Date('2026-01-12T08:00:00+07:00'),
        completedAt: null,
        finalScore: null,
        starRating: null,
        registrationType: 'FIRST',
        assessmentYear: 2026,
        category: baseCategory,
        locality: null, // Unmapped locality to test REP-03 dataQuality
        statusEvents: [
          {
            sequence: 1,
            toStatus: 'SUBMITTED',
            createdAt: new Date('2026-01-12T08:00:00+07:00'),
          },
          {
            sequence: 2,
            toStatus: 'SCORING',
            createdAt: new Date('2026-01-18T11:00:00+07:00'),
          },
        ],
      },
      {
        id: 'prod-D',
        name: 'Sản phẩm D (Nháp)',
        registrantId: 'reg-3',
        status: 'DRAFT',
        submittedAt: null,
        completedAt: null,
        finalScore: null,
        starRating: null,
        registrationType: 'FIRST',
        assessmentYear: 2026,
        category: baseCategory,
        locality: baseLocality,
        statusEvents: [
          {
            sequence: 1,
            toStatus: 'DRAFT',
            createdAt: new Date('2026-01-05T08:00:00+07:00'),
          },
        ],
      },
    ];

    const now = new Date('2026-03-10T10:00:00+07:00');
    const historyFrom = new Date('2026-01-01T00:00:00+07:00');

    // 1. January Registration Report
    const janReg = buildRegistrationReport({
      query: { year: 2026, month: 1, groupBy: 'locality' },
      products,
      categories: [baseCategory],
      localities: [baseLocality],
      now,
      historyAvailableFrom: historyFrom,
      assignmentHistoryAvailable: false,
    });

    expect(janReg.totals).toMatchObject({
      registeredCount: 3,
      waitingCount: 1, // A is still SUBMITTED at 2026-02-01T00:00:00+07:00
      scoringCount: 1, // C is SCORING at 2026-02-01T00:00:00+07:00
      completedCount: 1, // B is COMPLETED in Jan
      completedValidCount: 1,
      passedCount: 0,
      failedCount: 1, // B has 2 stars (< 50)
      passRate: 0,
      averageScore: 40,
      distinctRegistrantCount: 2,
      unmappedLocalityCount: 1,
    });
    expect(janReg.dataQuality.unmappedLocalityCount).toBe(1);
    // Reconciliation: sum of locality rows equals system totals
    const sumRowReg = janReg.rows.reduce(
      (sum, row) => sum + row.registeredCount,
      0,
    );
    expect(sumRowReg).toBe(janReg.totals.registeredCount);

    // 2. January Results Report
    const janRes = buildResultsReport({
      query: { year: 2026, month: 1, groupBy: 'category' },
      products,
      categories: [baseCategory],
      localities: [baseLocality],
      now,
      historyAvailableFrom: historyFrom,
      assignmentHistoryAvailable: false,
    });
    expect(janRes.rows[0]).toMatchObject({ key: baseCategory.id, label: baseCategory.name, drillDown: { categoryId: baseCategory.id } });
    expect(janRes.rows[0].drillDown).not.toHaveProperty('groupId');
    expect(janRes.totals).toMatchObject({
      completedCount: 1,
      completedValidCount: 1,
      passedCount: 0,
      failedCount: 1,
      starCounts: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 },
    });

    // 3. February Results Report (A completed 02/02 with 3 stars, even though 0 new submissions in Feb)
    const febRes = buildResultsReport({
      query: { year: 2026, month: 2, groupBy: 'category' },
      products,
      categories: [baseCategory],
      localities: [baseLocality],
      now,
      historyAvailableFrom: historyFrom,
      assignmentHistoryAvailable: false,
    });
    expect(febRes.totals).toMatchObject({
      completedCount: 1,
      completedValidCount: 1,
      passedCount: 1,
      failedCount: 0,
      passRate: 100,
      averageScore: 60,
      starCounts: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 },
    });

    // 4. Analytics Dashboard for February 2026 (historical month: KPI 7 = 1 open backlog C, KPI 8 = INSUFFICIENT_HISTORY)
    const febDash = buildAnalyticsDashboard({
      query: { year: 2026, month: 2 },
      products,
      categories: [baseCategory],
      localities: [baseLocality],
      coveredCategoryIdsAtNow: new Set(),
      now,
      historyAvailableFrom: historyFrom,
      productsByStatus: { DRAFT: 1, SUBMITTED: 0, SCORING: 1, COMPLETED: 2 },
      judges: [],
      needsAttention: [],
    });
    expect(febDash.kpis).toHaveLength(8);
    expect(febDash.charts.byCategory).toEqual([{
      categoryId: baseCategory.id, categoryName: baseCategory.name,
      registeredCount: 0, completedCount: 1,
    }]);
    expect(febDash.charts).not.toHaveProperty('byProductGroup');
    const kpiById = new Map(febDash.kpis.map((k) => [k.id, k]));
    expect(kpiById.get('registeredInPeriod')?.value).toBe(0);
    expect(kpiById.get('completedInPeriod')?.value).toBe(1);
    expect(kpiById.get('passedInPeriod')?.value).toBe(1);
    expect(kpiById.get('openBacklogAtAsOf')?.value).toBe(1); // prod-C submitted in Jan is still SCORING at end of Feb
    expect(kpiById.get('underAssignedBacklogAtAsOf')?.availability).toBe(
      'INSUFFICIENT_HISTORY',
    );
    expect(kpiById.get('underAssignedBacklogAtAsOf')?.value).toBeNull();
  });
});
