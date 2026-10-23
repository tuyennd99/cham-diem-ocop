import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  staffAccessPayloadForForm,
  staffAccessWouldRevokeSession,
  staffPermissionsForForm,
} from '../src/lib/admin-user-form';

it('MANAGE includes VIEW but never adds SCORE', () => {
  assert.deepEqual(staffPermissionsForForm(['MANAGE']), ['MANAGE', 'VIEW']);
  assert.deepEqual(staffPermissionsForForm(['VIEW', 'SCORE']), ['VIEW', 'SCORE']);
});

it('omits status from access payload even when status form state has changed', () => {
  const formState = {
    staffPermissions: ['VIEW'] as ['VIEW'],
    organizationUnitId: 'unit-1',
    reason: 'Change access',
    isActive: false,
  };

  const payload = staffAccessPayloadForForm(formState);

  assert.deepEqual(payload, {
    staffPermissions: ['VIEW'],
    organizationUnitId: 'unit-1',
    reason: 'Change access',
  });
  assert.equal(Object.hasOwn(payload, 'isActive'), false);
});

it('does not revoke the current session when access is effectively unchanged', () => {
  const current = {
    role: 'ADMIN' as const,
    staffPermissions: ['MANAGE'] as ['MANAGE'],
    organizationUnitId: 'unit-1',
  };
  const next = {
    staffPermissions: ['MANAGE', 'VIEW'] as ['MANAGE', 'VIEW'],
    organizationUnitId: 'unit-1',
    reason: 'Normalize access',
  };

  assert.equal(staffAccessWouldRevokeSession(current, next), false);
});
