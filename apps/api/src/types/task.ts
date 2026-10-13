import {
  EntityStatus,
  ReportKind,
  ReportStatus,
  TaskDeadlineStatus,
  TaskType,
} from '@prisma/client';

export type OrganizationSummary = { id: number; code: string; name: string };

export type ProgramResponsibility = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  status?: EntityStatus;
  assigningOrganizationId: number;
  leadOrganizationId: number;
  collaboratorOrganizationIds: number[];
  assigningOrganization?: OrganizationSummary;
  leadOrganization?: OrganizationSummary;
  collaboratorOrganizations?: OrganizationSummary[];
};

export type TaskView = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  expectedOutput: string | null;
  type: TaskType;
  programId: number;
  assigningOrganizationId: number;
  leadOrganizationId: number;
  collaboratorOrganizationIds: number[];
  assigningOrganization?: OrganizationSummary;
  leadOrganization?: OrganizationSummary;
  collaboratorOrganizations?: OrganizationSummary[];
  hasReports: boolean;
  dueAt: Date | null;
  deadlineStatus: TaskDeadlineStatus | null;
  startAt: Date | null;
  closedAt: Date | null;
  closeReason: string | null;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  program: ProgramResponsibility;
  workspaces: {
    id: number;
    kind: ReportKind;
    ownerOrganizationId: number;
    ownerUserId: number | null;
    status: ReportStatus;
  }[];
};

export type TaskWrite = {
  code: string;
  name: string;
  description?: string | null;
  expectedOutput?: string | null;
  type: TaskType;
  programId: number;
  assigningOrganizationId: number;
  leadOrganizationId: number;
  collaboratorOrganizationIds: number[];
  dueAt: Date | null;
  startAt: Date | null;
};
