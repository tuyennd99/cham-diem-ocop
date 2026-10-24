import assert from 'node:assert/strict';
import { it } from 'node:test';
import { assignmentPayload, assignmentScopeFor } from '../src/lib/admin-assignment-form';
import type { Assignment } from '../src/types/admin';

it('loads scope for either changed key and returns a copy', () => {
  const rows = [
    { judgeId: 'j1', categoryId: 'c1', criterionIds: ['a'] },
    { judgeId: 'j2', categoryId: 'c1', criterionIds: ['b'] },
    { judgeId: 'j2', categoryId: 'c2', criterionIds: [] },
  ];
  assert.deepEqual(assignmentScopeFor(rows, 'j2', 'c1'), ['b']);
  assert.deepEqual(assignmentScopeFor(rows, 'j2', 'c2'), []);
  const selected = assignmentScopeFor(rows, 'j1', 'c1');
  selected.push('x');
  assert.deepEqual(rows[0].criterionIds, ['a']);
});

it('serializes the full assignment set including rows outside a visible filter', () => {
  const rows = [
    { judgeId: 'j1', categoryId: 'visible', criterionIds: [] },
    { judgeId: 'j2', categoryId: 'hidden', criterionIds: ['b'] },
  ] as Assignment[];
  assert.deepEqual(assignmentPayload(rows), [
    { judgeId: 'j1', categoryId: 'visible', criterionIds: [] },
    { judgeId: 'j2', categoryId: 'hidden', criterionIds: ['b'] },
  ]);
});
