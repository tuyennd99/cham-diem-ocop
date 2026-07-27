import { NotificationsQueryDto } from '../dtos/observability.dto';
import { NotificationsService } from '../services/notifications.service';
import type { AccessTokenPayload } from '../types/auth';
export declare class NotificationsController {
    private readonly service;
    constructor(service: NotificationsService);
    list(query: NotificationsQueryDto, principal: AccessTokenPayload): Promise<{
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
    markAllRead(principal: AccessTokenPayload): Promise<{
        updated: number;
    }>;
    markRead(id: number, principal: AccessTokenPayload): Promise<{
        success: boolean;
    }>;
}
