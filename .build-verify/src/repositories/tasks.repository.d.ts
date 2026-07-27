import { Frequency, PeriodStatus, Prisma, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';
export interface TaskView {
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
    frequency: Frequency | null;
    periodicStartAt: Date | null;
    closedAt: Date | null;
    closeReason: string | null;
    completedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    program: {
        id: number;
        code: string;
        name: string;
    };
    assigningOrganization: {
        id: number;
        code: string;
        name: string;
    };
    leadOrganization: {
        id: number;
        code: string;
        name: string;
    };
    collaboratorOrganizations: {
        id: number;
        code: string;
        name: string;
    }[];
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
export declare class TasksRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(input: {
        page: number;
        limit: number;
        organizationId: number;
        globalScope: boolean;
    }): Promise<{
        data: TaskView[];
        total: number;
    }>;
    findById(id: number, organizationId: number, globalScope: boolean): Promise<TaskView | null>;
    codeExists(code: string, excludeId?: number): Promise<boolean>;
    findActiveProgram(id: number): Prisma.Prisma__ProgramClient<{
        id: number;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    findActiveOrganizations(ids: number[]): Prisma.PrismaPromise<{
        id: number;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
    }[]>;
    listActiveOrganizations(): Prisma.PrismaPromise<{
        id: number;
        code: string;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
    }[]>;
    listActivePrograms(): Prisma.PrismaPromise<{
        id: number;
        code: string;
        name: string;
        status: string;
        description: string | null;
    }[]>;
    create(input: TaskWrite, actorId: number, now: Date, meta?: RequestMeta): Promise<TaskView>;
    update(id: number, input: Partial<TaskWrite>, actorId: number, meta?: RequestMeta): Promise<TaskView>;
    private changesAssignment;
    softDelete(id: number, deletedAt: Date, actorId: number, meta?: RequestMeta): Promise<TaskView>;
    countOpenPeriods(taskId: number): Prisma.PrismaPromise<number>;
    close(id: number, reason: string, closedAt: Date, actorId: number, meta?: RequestMeta): Promise<TaskView | null>;
    listPeriodicTasksForGeneration(): Prisma.PrismaPromise<{
        id: number;
        code: string;
        name: string;
        collaborators: {
            organizationId: number;
        }[];
        frequency: import("@prisma/client").$Enums.Frequency | null;
        leadOrganizationId: number;
        periodicStartAt: Date | null;
    }[]>;
    createReportingPeriods(taskId: number, periods: PeriodDraft[]): Promise<number>;
    listReportingPeriods(taskId: number): Prisma.PrismaPromise<{
        id: number;
        status: import("@prisma/client").$Enums.PeriodStatus;
        createdAt: Date;
        taskId: number;
        frequency: import("@prisma/client").$Enums.Frequency | null;
        year: number;
        sequence: number;
        periodStartAt: Date;
        dueAt: Date;
        completedAt: Date | null;
        canceledAt: Date | null;
        cancelReason: string | null;
    }[]>;
    findReportingPeriod(id: number): Prisma.Prisma__ReportingPeriodClient<{
        id: number;
        status: import("@prisma/client").$Enums.PeriodStatus;
        taskId: number;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    cancelReportingPeriod(id: number, reason: string, canceledAt: Date, actorId: number, meta?: RequestMeta): Promise<{
        id: number;
        status: import("@prisma/client").$Enums.PeriodStatus;
        createdAt: Date;
        taskId: number;
        frequency: import("@prisma/client").$Enums.Frequency | null;
        year: number;
        sequence: number;
        periodStartAt: Date;
        dueAt: Date;
        completedAt: Date | null;
        canceledAt: Date | null;
        cancelReason: string | null;
    } | null>;
    private taskScope;
    private toTask;
    private taskAudit;
    private periodAudit;
    private auditMeta;
}
