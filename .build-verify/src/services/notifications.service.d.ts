import { NotificationWrite, NotificationsRepository } from '../repositories/notifications.repository';
export interface OrganizationNotification extends Omit<NotificationWrite, 'organizationIds'> {
    organizationId: number;
}
export declare class NotificationsService {
    private readonly repository;
    constructor(repository: NotificationsRepository);
    list(recipientId: number, query: {
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
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    markRead(id: number, recipientId: number): Promise<{
        success: boolean;
    }>;
    markAllRead(recipientId: number): Promise<{
        updated: number;
    }>;
    createForOrganization(input: OrganizationNotification): Promise<number>;
    createForOrganizations(input: NotificationWrite): Promise<number>;
    generateDailyDeadlineNotifications(now?: Date): Promise<{
        targets: number;
        created: number;
    }>;
}
