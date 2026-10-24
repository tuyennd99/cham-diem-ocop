import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  parseAdminAssignmentSearch,
  parseAdminCatalogSearch,
  parseAdminDashboardSearch,
  parseAdminProductSearch,
  parseAdminReportsSearch,
  parseAdminScoringSearch,
  parseAdminUsersSearch,
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

it('keeps inactive locality filters and selected catalog tab', () => {
  const query = parseAdminCatalogSearch({ tab: 'localities', isActive: 'false', type: 'WARD' });
  assert.equal(query.tab, 'localities');
  assert.equal(query.isActive, false);
  assert.equal(query.type, 'WARD');
});

it('preserves legacy judge filter and false user filters', () => {
  const query = parseAdminUsersSearch({
    permission: 'SCORE',
    verified: false,
    isActive: 'false',
    page: '2',
    tab: 'users',
  });
  assert.equal(query.permission, 'SCORE');
  assert.equal(query.verified, false);
  assert.equal(query.isActive, false);
  assert.equal(query.page, 2);
  assert.equal(parseAdminUsersSearch({ permission: 'ROOT' }).permission, undefined);
});

it('keeps evaluation identifiers and ignores invalid evaluation status', () => {
  const query = parseAdminScoringSearch({
    tab: 'evaluations',
    productId: 'p1',
    judgeId: 'j1',
    status: 'SUBMITTED',
    page: 3,
  });
  assert.equal(query.tab, 'evaluations');
  assert.equal(query.productId, 'p1');
  assert.equal(query.judgeId, 'j1');
  assert.equal(query.page, 3);
  assert.equal(parseAdminScoringSearch({ status: 'COMPLETED' }).status, undefined);
});

it('parses assignment matrix filters without carrying unknown keys', () => {
  const query = parseAdminAssignmentSearch({
    groupId: 'g1',
    categoryId: 'c1',
    uncoveredOnly: 'true',
    unknown: 'x',
  });
  assert.equal(query.groupId, 'g1');
  assert.equal(query.categoryId, 'c1');
  assert.equal(query.uncoveredOnly, true);
  assert.equal(Object.hasOwn(query, 'unknown'), false);
});

it('parses dashboard period filters with Vietnamese default year', () => {
  const query = parseAdminDashboardSearch({
    month: '10',
    localityType: 'WARD',
    registrationType: 'UPGRADE',
    assessmentYear: '2026',
  });
  assert.equal(typeof query.year, 'number');
  assert.equal(query.month, 10);
  assert.equal(query.localityType, 'WARD');
  assert.equal(query.registrationType, 'UPGRADE');
  assert.equal(query.assessmentYear, 2026);
});

it('restores result report tab and grouping after reload', () => {
  const query = parseAdminReportsSearch({
    tab: 'results',
    year: '2026',
    month: '10',
    groupBy: 'locality',
    localityType: 'COMMUNE',
    assessmentYear: '2025',
  });
  assert.equal(query.tab, 'results');
  assert.equal(query.year, 2026);
  assert.equal(query.month, 10);
  assert.equal(query.groupBy, 'locality');
  assert.equal(query.assessmentYear, 2025);
});
