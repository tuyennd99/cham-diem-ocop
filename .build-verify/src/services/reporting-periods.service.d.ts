import { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { TasksRepository } from '../repositories/tasks.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import { NotificationsService } from './notifications.service';
export declare class ReportingPeriodsService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly repository;
    private readonly notificationsService;
    private readonly logger;
    private timer?;
    constructor(repository: TasksRepository, notificationsService: NotificationsService);
    onApplicationBootstrap(): Promise<void>;
    onApplicationShutdown(): void;
    ensurePeriods(now?: Date): Promise<number>;
    list(taskId: number, principal: AccessTokenPayload): Promise<{
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
    cancel(periodId: number, reason: string, principal: AccessTokenPayload, meta?: RequestMeta): Promise<{
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
    handleDailyGeneration(now?: Date): Promise<number>;
    private scheduleNextRun;
    private runScheduled;
    private periodsThrough;
    private hasGlobalScope;
    private assertPermission;
    private safeNotify;
}
