import { PrismaService } from '../prisma/prisma.service';
export interface NotificationWrite {
    organizationIds: number[];
    eventKey: string;
    type: string;
    title: string;
    body?: string | null;
    entityType?: string | null;
    entityId?: number | null;
}
export interface DeadlineNotificationTarget {
    periodId: number;
    taskId: number;
    taskCode: string;
    taskName: string;
    dueAt: Date;
    organizationIds: number[];
}
export declare class NotificationsRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(input: {
        recipientId: number;
        page: number;
        limit: number;
        unreadOnly: boolean;
    }): Promise<{
        data: {
            id: number;
            createdAt: Date;
            type: string;
            title: string;
            entityType: string | null;
            entityId: number | null;
            readAt: Date | null;
            recipientId: number;
            eventKey: string;
            body: string | null;
        }[];
        total: number;
    }>;
    markRead(id: number, recipientId: number, readAt: Date): Promise<boolean>;
    markAllRead(recipientId: number, readAt: Date): Promise<number>;
    createForActiveUsers(input: NotificationWrite): Promise<number>;
    findDeadlineTargets(now: Date, dueSoonThrough: Date): Promise<DeadlineNotificationTarget[]>;
}
