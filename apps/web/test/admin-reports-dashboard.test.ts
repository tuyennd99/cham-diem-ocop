import assert from 'node:assert/strict';
import { it } from 'node:test';
import { adminApi } from '../src/api/admin';
import baseRequest from '../src/api/base-request';
import { dashboardKpiLinkLabel, formatComparisonDelta } from '../src/lib/report-format';

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
      localityType: 'COMMUNE',
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
      localityType: 'COMMUNE',
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
