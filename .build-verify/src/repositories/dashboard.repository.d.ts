import { Frequency, PeriodStatus, ReportStatus, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export interface DashboardFilters {
    taskCode?: string;
    taskName?: string;
    frequency?: Frequency;
    year?: number;
    sequence?: number;
    programId?: number;
    dueFrom?: string;
    dueTo?: string;
}
export interface DashboardTaskRow {
    id: number;
    type: TaskType;
    completedAt: Date | null;
    closedAt: Date | null;
    periods: {
        id: number;
        frequency: Frequency | null;
        status: PeriodStatus;
        dueAt: Date;
        workspaceStatuses: ReportStatus[];
    }[];
}
export declare class DashboardRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    loadSummaryRows(input: {
        filters: DashboardFilters;
        organizationId: number;
        globalScope: boolean;
    }): Promise<DashboardTaskRow[]>;
    private periodWhere;
}
