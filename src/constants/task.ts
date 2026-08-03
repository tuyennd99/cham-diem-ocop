import {
  Frequency,
  PeriodStatus,
  Prisma,
  ReportStatus,
  TaskDeadlineStatus,
  TaskType,
} from '@prisma/client';


export const RESPONSIBILITY = {
  LEAD: 'LEAD',
  COLLABORATOR: 'COLLABORATOR',
  ADMIN: 'ADMIN',
  VIEWER: 'VIEWER',
  ASSIGNEE: 'ASSIGNEE',
} as const;


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
  frequency: Frequency | null;
  periodicStartAt: Date | null;
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
  reportingPeriods: {
    id: number;
    taskId: number;
    frequency: Frequency | null;
    year: number;
    sequence: number;
    periodStartAt: Date;
    dueAt: Date;
    status: PeriodStatus;
    completedAt: Date | null;
    canceledAt: Date | null;
    cancelReason: string | null;
    createdAt: Date;
  }[];
}

export interface TaskWrite {
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
  frequency: Frequency | null;
  periodicStartAt: Date | null;
}

export interface PeriodDraft {
  frequency: Frequency;
  year: number;
  sequence: number;
  periodStartAt: Date;
  dueAt: Date;
}