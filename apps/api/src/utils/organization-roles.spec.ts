import { BadRequestException } from '@nestjs/common';
import { assertOrganizationRoles } from './organization-roles';

const org = (
  id: number,
  overrides: Partial<{
    status: 'ACTIVE' | 'INACTIVE';
    isAssigningAuthority: boolean;
    isExecutingUnit: boolean;
  }> = {},
) => ({
  id,
  status: 'ACTIVE' as const,
  isAssigningAuthority: false,
  isExecutingUnit: true,
  ...overrides,
});

const input = {
  assigningOrganizationId: 1,
  leadOrganizationId: 2,
  collaboratorOrganizationIds: [3],
};
const rows = [
  org(1, { isAssigningAuthority: true, isExecutingUnit: false }),
  org(2),
  org(3),
];

describe('assertOrganizationRoles', () => {
  it('accepts a valid trio', () => {
    expect(() => assertOrganizationRoles(rows, input, 'Task')).not.toThrow();
  });

  it('allows one organization to hold several roles', () => {
    const shared = [org(1, { isAssigningAuthority: true })];
    expect(() =>
      assertOrganizationRoles(
        shared,
        {
          assigningOrganizationId: 1,
          leadOrganizationId: 1,
          collaboratorOrganizationIds: [1],
        },
        'Task',
      ),
    ).not.toThrow();
  });

  it('rejects duplicate collaborators', () => {
    expect(() =>
      assertOrganizationRoles(
        rows,
        { ...input, collaboratorOrganizationIds: [3, 3] },
        'Task',
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts an empty collaborator list — cardinality belongs to the DTO', () => {
    expect(() =>
      assertOrganizationRoles(
        [org(1, { isAssigningAuthority: true }), org(2)],
        { ...input, collaboratorOrganizationIds: [] },
        'Task',
      ),
    ).not.toThrow();
  });

  it('rejects an assigning org without isAssigningAuthority', () => {
    const bad = [org(1), org(2), org(3)];
    expect(() => assertOrganizationRoles(bad, input, 'Task')).toThrow(
      BadRequestException,
    );
  });

  it('rejects a lead org without isExecutingUnit', () => {
    const bad = [
      org(1, { isAssigningAuthority: true }),
      org(2, { isExecutingUnit: false }),
      org(3),
    ];
    expect(() => assertOrganizationRoles(bad, input, 'Task')).toThrow(
      BadRequestException,
    );
  });

  it('rejects an inactive collaborator', () => {
    const bad = [
      org(1, { isAssigningAuthority: true }),
      org(2),
      org(3, { status: 'INACTIVE' }),
    ];
    expect(() => assertOrganizationRoles(bad, input, 'Task')).toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing organization row', () => {
    expect(() =>
      assertOrganizationRoles([org(1, { isAssigningAuthority: true })], input, 'Task'),
    ).toThrow(BadRequestException);
  });
});
