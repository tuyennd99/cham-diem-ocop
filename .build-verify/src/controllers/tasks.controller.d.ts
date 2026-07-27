import type { Request } from 'express';
import { CancelReportingPeriodDto, CloseTaskDto, CreateTaskDto, TaskQueryDto, UpdateTaskDto } from '../dtos/tasks.dto';
import { ReportingPeriodsService } from '../services/reporting-periods.service';
import { ReportsService } from '../services/reports.service';
import { TasksService } from '../services/tasks.service';
import type { AccessTokenPayload } from '../types/auth';
export declare class TasksController {
    private readonly tasksService;
    private readonly reportingPeriodsService;
    constructor(tasksService: TasksService, reportingPeriodsService: ReportingPeriodsService);
    list(query: TaskQueryDto, principal: AccessTokenPayload): Promise<{
        data: import("../repositories/tasks.repository").TaskView[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    create(body: CreateTaskDto, principal: AccessTokenPayload, request: Request): Promise<import("../repositories/tasks.repository").TaskView>;
    organizationLookups(principal: AccessTokenPayload): import("@prisma/client").Prisma.PrismaPromise<{
        id: number;
        code: string;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
    }[]>;
    programLookups(principal: AccessTokenPayload): import("@prisma/client").Prisma.PrismaPromise<{
        id: number;
        code: string;
        name: string;
        status: string;
        description: string | null;
    }[]>;
    get(id: number, principal: AccessTokenPayload): Promise<import("../repositories/tasks.repository").TaskView>;
    update(id: number, body: UpdateTaskDto, principal: AccessTokenPayload, request: Request): Promise<import("../repositories/tasks.repository").TaskView>;
    remove(id: number, principal: AccessTokenPayload, request: Request): Promise<import("../repositories/tasks.repository").TaskView>;
    close(id: number, body: CloseTaskDto, principal: AccessTokenPayload, request: Request): Promise<import("../repositories/tasks.repository").TaskView>;
    periods(id: number, principal: AccessTokenPayload): Promise<{
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
}
export declare class ReportingPeriodsController {
    private readonly reportingPeriodsService;
    private readonly reportsService;
    constructor(reportingPeriodsService: ReportingPeriodsService, reportsService: ReportsService);
    listReportWorkspaces(id: number, principal: AccessTokenPayload): Promise<import("../repositories/reports.repository").ReportWorkspaceView[]>;
    cancel(id: number, body: CancelReportingPeriodDto, principal: AccessTokenPayload, request: Request): Promise<{
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
    }>;
}
