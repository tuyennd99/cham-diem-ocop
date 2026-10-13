import { BadRequestException } from '@nestjs/common';

export type OrganizationRoleRow = {
  id: number;
  status: string;
  isAssigningAuthority: boolean;
  isExecutingUnit: boolean;
};

export type OrganizationRoleInput = {
  assigningOrganizationId: number;
  leadOrganizationId: number;
  collaboratorOrganizationIds: number[];
};

/**
 * Shared by the Program and Task assignment paths — both enforce the same
 * role rules, so the rules live here rather than being copied.
 */
export function assertOrganizationRoles(
  organizations: OrganizationRoleRow[],
  input: OrganizationRoleInput,
  label: string,
) {
  // Cardinality is NOT checked here: CreateTaskDto requires min(1) collaborator,
  // while CreateProgramDto leaves the list optional. Enforcing it here would
  // silently tighten the existing program API, which no requirement asks for.
  if (
    new Set(input.collaboratorOrganizationIds).size !==
    input.collaboratorOrganizationIds.length
  ) {
    throw new BadRequestException('Collaborators must be unique');
  }
  const ids = [
    ...new Set([
      input.assigningOrganizationId,
      input.leadOrganizationId,
      ...input.collaboratorOrganizationIds,
    ]),
  ];
  const byId = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );
  if (
    byId.size !== ids.length ||
    ids.some((id) => !byId.has(id)) ||
    byId.get(input.assigningOrganizationId)?.status !== 'ACTIVE' ||
    !byId.get(input.assigningOrganizationId)?.isAssigningAuthority ||
    byId.get(input.leadOrganizationId)?.status !== 'ACTIVE' ||
    !byId.get(input.leadOrganizationId)?.isExecutingUnit ||
    input.collaboratorOrganizationIds.some(
      (id) => byId.get(id)?.status !== 'ACTIVE' || !byId.get(id)?.isExecutingUnit,
    )
  ) {
    throw new BadRequestException(
      `${label} organizations must exist, be active, and have the required role`,
    );
  }
}
