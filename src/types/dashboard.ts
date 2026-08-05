import { ReportStatus, SubtaskStatus, TaskType } from "@prisma/client";

export type DashboardStatus =
  | 'HOAN_THANH'
  | 'DANG_CAP_NHAT'
  | 'QUA_HAN'
  | 'SAP_DEN_HAN'
  | 'CHUA_HOAN_THANH';

export type DashboardStatusCounts = Record<DashboardStatus, number>;
export interface DashboardFilters {
  taskCode?: string;
  taskName?: string;
  year?: number;
  programId?: number;
  dueFrom?: string;
  dueTo?: string;
}

export interface DashboardTaskRow {
  id: number;
  type: TaskType;
  completedAt: Date | null;
  closedAt: Date | null;
  subtasks: {
    id: number;
    startAt: Date | null;
    dueAt: Date;
    status: SubtaskStatus;
    reportStatus: ReportStatus[];
  }[];
}