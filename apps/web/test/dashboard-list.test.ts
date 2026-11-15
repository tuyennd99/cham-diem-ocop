import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterDashboardList, paginateDashboardList } from '../src/lib/dashboard-list';

test('filters the complete list before pagination and clamps the current page', () => {
  const items = Array.from({ length: 14 }, (_, index) => `Hồ sơ ${index + 1}`);
  assert.deepEqual(
    filterDashboardList(items, ' HỒ SƠ 12 ', (item) => item),
    ['Hồ sơ 12'],
  );
  assert.deepEqual(paginateDashboardList(items, 2, 5).rows, items.slice(5, 10));
  assert.deepEqual(paginateDashboardList(items, 99, 5), {
    rows: items.slice(10),
    page: 3,
    pages: 3,
  });
  assert.deepEqual(paginateDashboardList([], 2, 5), { rows: [], page: 1, pages: 1 });
});
