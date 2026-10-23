import assert from 'node:assert/strict';
import { it } from 'node:test';
import { staffPermissionsForForm } from '../src/lib/admin-user-form';

it('MANAGE includes VIEW but never adds SCORE', () => {
  assert.deepEqual(staffPermissionsForForm(['MANAGE']), ['MANAGE', 'VIEW']);
  assert.deepEqual(staffPermissionsForForm(['VIEW', 'SCORE']), ['VIEW', 'SCORE']);
});
