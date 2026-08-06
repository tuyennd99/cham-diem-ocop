import { SubtaskStatus, TaskDeadlineStatus, TaskType } from "@prisma/client";

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
  hasSubmittedReport: boolean;
  dueAt: Date | null;
  deadlineStatus: TaskDeadlineStatus | null;
  startAt: Date | null;
  closedAt: Date | null;
  closeReason: string | null;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  program: { id: number; code: string; name: string };
  assigningOrganization: { id: number; code: string; name: string };
  leadOrganization: { id: number; code: string; name: string };
  collaboratorOrganizations: { id: number; code: string; name: string }[];
  subtasks: {
    id: number;
    taskId: number;
    title: string;
    description: string | null;
    startAt: Date;
    dueAt: Date;
    status: SubtaskStatus;
    completedAt: Date | null;
    canceledAt: Date | null;
    cancelReason: string | null;
    createdById: number;
    createdByOrganizationId: number;
    createdAt: Date;
    hasReports: boolean;
  }[];
}

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
}