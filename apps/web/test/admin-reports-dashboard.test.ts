import assert from 'node:assert/strict';
import { it } from 'node:test';
import { adminApi } from '../src/api/admin';
import baseRequest from '../src/api/base-request';
import {
  buildDashboardCategoryDrillDown,
  dashboardKpiLinkLabel,
  formatComparisonDelta,
  formatJudgeProgress,
  formatNeedsAttentionSubmittedAt,
  partitionZeroCategories,
  partitionZeroMonths,
  sortNeedsAttentionByOldest,
} from '../src/lib/report-format';

it('calls registrations report, results report, and filtered dashboard through the shared transport', async () => {
  const previous = baseRequest.defaults.adapter;
  const captured: Array<{ params?: Record<string, unknown>; url?: string }> = [];
  baseRequest.defaults.adapter = async (config) => {
    captured.push({
      params: config.params as Record<string, unknown> | undefined,
      url: config.url,
    });
    return {
      data: { data: {} },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  try {
    await adminApi.registrationsReport({
      year: 2026,
      month: 1,
      groupBy: 'locality',
    });
    await adminApi.resultsReport({
      year: 2026,
      month: 2,
      groupBy: 'category',
    });
    await adminApi.dashboard({
      year: 2026,
      month: 10,
      registrationType: 'FIRST',
    });

    assert.equal(captured[0]?.url, '/admin/reports/registrations');
    assert.deepEqual(captured[0]?.params, {
      year: 2026,
      month: 1,
      groupBy: 'locality',
    });
    assert.equal(captured[1]?.url, '/admin/reports/results');
    assert.deepEqual(captured[1]?.params, {
      year: 2026,
      month: 2,
      groupBy: 'category',
    });
    assert.equal(captured[2]?.url, '/admin/dashboard');
    assert.deepEqual(captured[2]?.params, {
      year: 2026,
      month: 10,
      registrationType: 'FIRST',
    });
  } finally {
    baseRequest.defaults.adapter = previous;
  }
});

it('formats period comparison deltas without infinite percentages when prior period is 0 or insufficient history (REP-04, DASH-01)', () => {
  assert.equal(
    formatComparisonDelta({
      current: 5,
      previous: 0,
      deltaAbsolute: 5,
      deltaPercent: null,
      comparisonNote: 'NO_PRIOR_DATA',
    }),
    '+5 (Mới phát sinh / Không có số kỳ trước)',
  );
  assert.equal(
    formatComparisonDelta({
      current: null,
      previous: null,
      deltaAbsolute: null,
      deltaPercent: null,
      comparisonNote: 'INSUFFICIENT_HISTORY',
    }),
    'Chưa đủ dữ liệu lịch sử',
  );
  assert.equal(
    formatComparisonDelta({
      current: 15,
      previous: 10,
      deltaAbsolute: 5,
      deltaPercent: 50,
      comparisonNote: 'OK',
    }),
    '+5 (+50% so với kỳ trước: 10)',
  );
});

it('does not promise an exact list for KPI sets unavailable in product search', () => {
  assert.equal(dashboardKpiLinkLabel('registeredInPeriod'), 'Xem hồ sơ đăng ký trong kỳ');
  assert.equal(dashboardKpiLinkLabel('completedInPeriod'), 'Xem hồ sơ hoàn tất trong kỳ');
  assert.equal(dashboardKpiLinkLabel('passedInPeriod'), null);
  assert.equal(dashboardKpiLinkLabel('failedInPeriod'), null);
  assert.equal(dashboardKpiLinkLabel('passRateInPeriod'), null);
  assert.equal(dashboardKpiLinkLabel('openBacklogAtAsOf'), null);
  assert.equal(dashboardKpiLinkLabel('underAssignedBacklogAtAsOf'), null);
  assert.equal(dashboardKpiLinkLabel('fiveStarInPeriod'), 'Xem hồ sơ có mức điểm 5 sao');
});

it('distinguishes unassigned judges from assigned judges at 0%, partial, and 100% progress (#29)', () => {
  const unassigned = formatJudgeProgress({
    fullName: 'Giám khảo A',
    assigned: 0,
    submitted: 0,
    pending: 0,
  });
  assert.equal(unassigned.isAssigned, false);
  assert.equal(unassigned.submittedText, '—');
  assert.equal(unassigned.pendingText, '—');
  assert.equal(unassigned.percent, null);
  assert.equal(unassigned.progressLabel, 'Chưa được giao');
  assert.equal(unassigned.ariaLabel, 'Tiến độ của Giám khảo A: Chưa được giao hồ sơ');

  const zeroProgress = formatJudgeProgress({
    fullName: 'Giám khảo B',
    assigned: 4,
    submitted: 0,
    pending: 4,
  });
  assert.equal(zeroProgress.isAssigned, true);
  assert.equal(zeroProgress.submittedText, '0 / 4');
  assert.equal(zeroProgress.pendingText, '4');
  assert.equal(zeroProgress.percent, 0);
  assert.equal(zeroProgress.progressLabel, '0%');

  const partialProgress = formatJudgeProgress({
    fullName: 'Giám khảo C',
    assigned: 4,
    submitted: 1,
    pending: 3,
  });
  assert.equal(partialProgress.isAssigned, true);
  assert.equal(partialProgress.submittedText, '1 / 4');
  assert.equal(partialProgress.pendingText, '3');
  assert.equal(partialProgress.percent, 25);
  assert.equal(partialProgress.progressLabel, '25%');

  const fullProgress = formatJudgeProgress({
    fullName: 'Giám khảo D',
    assigned: 3,
    submitted: 3,
    pending: 0,
  });
  assert.equal(fullProgress.isAssigned, true);
  assert.equal(fullProgress.submittedText, '3 / 3');
  assert.equal(fullProgress.pendingText, '0');
  assert.equal(fullProgress.percent, 100);
  assert.equal(fullProgress.progressLabel, '100%');
});

it('formats submittedAt date and keeps oldest-first order with missing dates at the end (#30)', () => {
  assert.equal(
    formatNeedsAttentionSubmittedAt('2026-10-12T02:30:00.000Z'),
    `Ngày nộp: ${new Date('2026-10-12T02:30:00.000Z').toLocaleDateString('vi-VN')}`,
  );
  assert.equal(formatNeedsAttentionSubmittedAt(null), 'Chưa ghi nhận ngày nộp');
  assert.equal(formatNeedsAttentionSubmittedAt(undefined), 'Chưa ghi nhận ngày nộp');
  assert.equal(formatNeedsAttentionSubmittedAt('not-a-date'), 'Chưa ghi nhận ngày nộp');

  const sorted = sortNeedsAttentionByOldest([
    { id: 'p-missing', submittedAt: null },
    { id: 'p-newer', submittedAt: '2026-10-20T07:20:00.000Z' },
    { id: 'p-oldest', submittedAt: '2026-10-12T02:30:00.000Z' },
    { id: 'p-invalid', submittedAt: 'invalid-date' },
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['p-oldest', 'p-newer', 'p-invalid', 'p-missing'],
  );
});

it('builds exact category drill-down search for registered and completed modes with period and dimension filters (#31)', () => {
  const period = {
    from: '2026-10-01T00:00:00+07:00',
    toExclusive: '2026-11-01T00:00:00+07:00',
  };
  const filtersApplied = {
    year: 2026,
    month: 10,
    localityId: 'seed-locality-khanh-an',
    registrationType: 'FIRST' as const,
    assessmentYear: 2026,
  };

  assert.deepEqual(
    buildDashboardCategoryDrillDown({
      categoryId: 'essential-oils-and-herbs',
      mode: 'REGISTERED',
      period,
      filtersApplied,
    }),
    {
      categoryId: 'essential-oils-and-herbs',
      dateBasis: 'submittedAt',
      from: '2026-10-01T00:00:00+07:00',
      toExclusive: '2026-11-01T00:00:00+07:00',
      localityId: 'seed-locality-khanh-an',
      registrationType: 'FIRST',
      assessmentYear: 2026,
    },
  );

  assert.deepEqual(
    buildDashboardCategoryDrillDown({
      categoryId: 'essential-oils-and-herbs',
      mode: 'COMPLETED',
      period,
      filtersApplied,
    }),
    {
      categoryId: 'essential-oils-and-herbs',
      dateBasis: 'completedAt',
      status: 'COMPLETED',
      from: '2026-10-01T00:00:00+07:00',
      toExclusive: '2026-11-01T00:00:00+07:00',
      localityId: 'seed-locality-khanh-an',
      registrationType: 'FIRST',
      assessmentYear: 2026,
    },
  );
});

it('partitions zero-count months and categories preserving order and accuracy (#32)', () => {
  // 1. Monthly trend partitioning
  const allZeroMonths = [
    { month: 1, label: 'Tháng 1', registeredCount: 0, completedCount: 0 },
    { month: 2, label: 'Tháng 2', registeredCount: 0, completedCount: 0 },
  ];
  const allZeroMonthResult = partitionZeroMonths(allZeroMonths);
  assert.equal(allZeroMonthResult.active.length, 0);
  assert.equal(allZeroMonthResult.zeroCount, 2);

  const mixedMonths = [
    { month: 1, label: 'Tháng 1', registeredCount: 0, completedCount: 0 },
    { month: 9, label: 'Tháng 9', registeredCount: 5, completedCount: 1 },
    { month: 10, label: 'Tháng 10', registeredCount: 0, completedCount: 2 },
    { month: 11, label: 'Tháng 11', registeredCount: 0, completedCount: 0 },
  ];
  const mixedMonthResult = partitionZeroMonths(mixedMonths);
  assert.equal(mixedMonthResult.active.length, 2);
  assert.equal(mixedMonthResult.zeroCount, 2);
  assert.deepEqual(
    mixedMonthResult.active.map((m) => m.month),
    [9, 10],
  );

  const allActiveMonths = [
    { month: 1, label: 'Tháng 1', registeredCount: 1, completedCount: 0 },
    { month: 2, label: 'Tháng 2', registeredCount: 0, completedCount: 1 },
  ];
  const allActiveMonthResult = partitionZeroMonths(allActiveMonths);
  assert.equal(allActiveMonthResult.active.length, 2);
  assert.equal(allActiveMonthResult.zeroCount, 0);

  // 2. Category partitioning
  const categories = [
    {
      categoryId: 'cat-1',
      categoryName: 'Cat 1',
      registeredCount: 3,
      completedCount: 0,
    },
    {
      categoryId: 'cat-2',
      categoryName: 'Cat 2',
      registeredCount: 0,
      completedCount: 2,
    },
    {
      categoryId: 'cat-3',
      categoryName: 'Cat 3',
      registeredCount: 0,
      completedCount: 0,
    },
  ];

  // In REGISTERED mode: cat-1 is active; cat-2 and cat-3 are zero
  const regPartition = partitionZeroCategories(categories, 'REGISTERED');
  assert.equal(regPartition.active.length, 1);
  assert.equal(regPartition.active[0].categoryId, 'cat-1');
  assert.equal(regPartition.zeroCount, 2);

  // In COMPLETED mode: cat-2 is active; cat-1 and cat-3 are zero
  const compPartition = partitionZeroCategories(categories, 'COMPLETED');
  assert.equal(compPartition.active.length, 1);
  assert.equal(compPartition.active[0].categoryId, 'cat-2');
  assert.equal(compPartition.zeroCount, 2);

  // All zero categories case
  const allZeroCategories = [
    { categoryId: 'c1', categoryName: 'C1', registeredCount: 0, completedCount: 0 },
    { categoryId: 'c2', categoryName: 'C2', registeredCount: 0, completedCount: 0 },
  ];
  const allZeroCatResult = partitionZeroCategories(allZeroCategories, 'REGISTERED');
  assert.equal(allZeroCatResult.active.length, 0);
  assert.equal(allZeroCatResult.zeroCount, 2);
});
