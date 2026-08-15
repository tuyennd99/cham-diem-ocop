type Principal = { organizationId: number; isAdmin?: boolean };
type ProgramOrganizations = {
  assigningOrganizationId?: number;
  leadOrganizationId: number;
  collaboratorOrganizationIds: number[];
};
type TaskOrganizations =
  ProgramOrganizations | { program: ProgramOrganizations };

export const canAccessTask = (
  principal: Principal,
  task: TaskOrganizations,
) => {
  const program = 'program' in task ? task.program : task;
  return (
    principal.isAdmin === true ||
    program.assigningOrganizationId === principal.organizationId ||
    program.leadOrganizationId === principal.organizationId ||
    program.collaboratorOrganizationIds.includes(principal.organizationId)
  );
};
