import assert from 'node:assert/strict';
import { it } from 'node:test';
import baseRequest from '../src/api/base-request';
import { scoringPrintApi } from '../src/api/scoring-print';
import {
  formatExactScore,
  formatStarRatingLabel,
} from '../src/lib/print-format';

it('formats exact score without rounding 89.99 up to 90.00 and labels 5 stars as proposed consideration', () => {
  assert.equal(formatExactScore(0), '0');
  assert.equal(formatExactScore(81.5), '81.5');
  assert.equal(formatExactScore(89.99), '89.99');
  assert.equal(formatExactScore(89.999), '89.99');
  assert.equal(formatExactScore(90), '90');
  assert.equal(formatExactScore(100), '100');
  assert.equal(formatExactScore(75.5), '75.5');
  assert.equal(formatExactScore(null), '—');
  assert.equal(formatStarRatingLabel(1), 'Mức điểm 1 sao');
  assert.equal(formatStarRatingLabel(2), 'Mức điểm 2 sao');
  assert.equal(formatStarRatingLabel(3), 'Mức điểm 3 sao');
  assert.equal(formatStarRatingLabel(4), 'Mức điểm 4 sao');
  assert.equal(
    formatStarRatingLabel(5),
    'Mức điểm 5 sao / Đề nghị xem xét 5 sao',
  );
  assert.equal(formatStarRatingLabel(null), 'Chưa xếp sao');
});

it('calls scoring-forms and print-data endpoints without leaking tokens into URLs', async () => {
  const previous = baseRequest.defaults.adapter;
  const captured: Array<{ params?: Record<string, unknown>; url?: string }> = [];
  baseRequest.defaults.adapter = async (config) => {
    captured.push({
      params: config.params as Record<string, unknown> | undefined,
      url: config.url,
    });
    return {
      data: { data: {}, meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  try {
    await scoringPrintApi.criteriaSets({ page: 1, limit: 20, q: 'tea' });
    await scoringPrintApi.criteriaSetPrintData('set-1');
    await scoringPrintApi.evaluations({ page: 1, limit: 20, status: 'SUBMITTED' });
    await scoringPrintApi.evaluationPrintData('eval-1');
    await scoringPrintApi.judgeEvaluationPrintData('prod-1');
    await scoringPrintApi.adminRegistrationPrintData('prod-1');
    await scoringPrintApi.adminResultsPrintData('prod-1');
    await scoringPrintApi.myRegistrationPrintData('prod-1');
    await scoringPrintApi.myResultsPrintData('prod-1');

    assert.equal(captured[0]?.url, '/admin/criteria-sets');
    assert.equal(captured[1]?.url, '/admin/criteria-sets/set-1/print-data');
    assert.equal(captured[2]?.url, '/admin/evaluations');
    assert.equal(captured[3]?.url, '/admin/evaluations/eval-1/print-data');
    assert.equal(captured[4]?.url, '/judge/products/prod-1/evaluation/print-data');
    assert.equal(captured[5]?.url, '/admin/products/prod-1/registration-print-data');
    assert.equal(captured[6]?.url, '/admin/products/prod-1/results/print-data');
    assert.equal(captured[7]?.url, '/my/products/prod-1/registration-print-data');
    assert.equal(captured[8]?.url, '/my/products/prod-1/results/print-data');
    for (const item of captured) {
      assert.ok(!String(item.url).includes('token'));
    }
  } finally {
    baseRequest.defaults.adapter = previous;
  }
});
