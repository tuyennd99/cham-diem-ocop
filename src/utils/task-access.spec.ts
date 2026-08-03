import { canAccessTask } from './task-access';

describe('canAccessTask', () => {
  const task = {
    assigningOrganizationId: 10,
    leadOrganizationId: 20,
    collaboratorOrganizationIds: [30],
  };

  it.each([10, 20, 30])('allows participating organization %s', (organizationId) => {
    expect(canAccessTask({ organizationId, isAdmin: false }, task)).toBe(true);
  });

  it('rejects an unrelated organization and allows admin', () => {
    expect(canAccessTask({ organizationId: 40, isAdmin: false }, task)).toBe(false);
    expect(canAccessTask({ organizationId: 40, isAdmin: true }, task)).toBe(true);
  });
});
