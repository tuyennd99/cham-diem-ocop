import { Frequency } from '@prisma/client';
declare class PaginationQueryDto {
    page: number;
    limit: number;
}
export declare class NotificationsQueryDto extends PaginationQueryDto {
    unreadOnly: boolean;
}
export declare class DashboardQueryDto {
    taskCode?: string;
    taskName?: string;
    frequency?: Frequency;
    year?: number;
    sequence?: number;
    programId?: number;
    dueFrom?: string;
    dueTo?: string;
}
export declare class AuditLogsQueryDto extends PaginationQueryDto {
    action?: string;
    entityType?: string;
    entityId?: number;
    actorId?: number;
    organizationId?: number;
    createdFrom?: string;
    createdTo?: string;
}
export {};
