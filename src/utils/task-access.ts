type Principal = { organizationId: number; isAdmin?: boolean };
type TaskOrganizations = {
  // Không phải mọi ngữ cảnh (vd context tải tệp) đều mang assigningOrganizationId,
  // nên để optional; thiếu thì nhánh này chỉ đơn giản là false.
  assigningOrganizationId?: number;
  leadOrganizationId: number;
  collaboratorOrganizationIds: number[];
};

/** Đơn vị tham gia nhiệm vụ (giao/chủ trì/phối hợp) hoặc admin thì được truy cập. */
export const canAccessTask = (principal: Principal, task: TaskOrganizations) =>
  principal.isAdmin === true ||
  task.assigningOrganizationId === principal.organizationId ||
  task.leadOrganizationId === principal.organizationId ||
  task.collaboratorOrganizationIds.includes(principal.organizationId);
