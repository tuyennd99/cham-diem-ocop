import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  parseAdminProductSearch,
  toAdminProductApiQuery,
} from '../src/lib/admin-search';

it('retains report filters, page and explicit boolean without carrying unknown keys', () => {
  const input = {
    page: '2',
    groupId: 'g1',
    categoryId: 'c1',
    dateBasis: 'completedAt',
    from: '2026-10-01T00:00:00+07:00',
    toExclusive: '2026-11-01T00:00:00+07:00',
    unmappedLocality: false,
    status: 'COMPLETED',
    unknown: 'ignored',
  };
  const result = parseAdminProductSearch(input);
  assert.equal(result.page, 2);
  assert.equal(result.groupId, 'g1');
  assert.equal(result.categoryId, 'c1');
  assert.equal(result.unmappedLocality, false);
  assert.equal(result.from, input.from);
  assert.equal(result.toExclusive, input.toExclusive);
  assert.equal(Object.hasOwn(result, 'unknown'), false);
  assert.equal(parseAdminProductSearch({ page: -1 }).page, 1);
  assert.equal(parseAdminProductSearch({ status: ['DRAFT'] }).status, undefined);
  assert.equal(parseAdminProductSearch({ from: input.from }).from, input.from);
  assert.throws(() => parseAdminProductSearch({ from: 'khong-phai-ngay' }));
  assert.throws(() => parseAdminProductSearch({ localityId: 'l1', unmappedLocality: true }));
});

it('preserves detail tab in URL search and strips tab before API query', () => {
  const parsed = parseAdminProductSearch({ page: '3', status: 'SCORING', tab: 'results' });
  assert.equal(parsed.tab, 'results');
  assert.equal(parsed.page, 3);
  assert.equal(parseAdminProductSearch({ tab: 'invalid-tab' }).tab, undefined);
  const apiQuery = toAdminProductApiQuery(parsed);
  assert.equal(Object.hasOwn(apiQuery, 'tab'), false);
  assert.equal(apiQuery.page, 3);
  assert.equal(apiQuery.status, 'SCORING');
});
