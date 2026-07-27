import { AuditLogsQueryDto } from '../dtos/observability.dto';
import { AuditService } from '../services/audit.service';
import type { AccessTokenPayload } from '../types/auth';
export declare class AuditLogsController {
    private readonly service;
    constructor(service: AuditService);
    list(query: AuditLogsQueryDto, principal: AccessTokenPayload): Promise<{
        data: {
            beforeData: import("@prisma/client/runtime/library").InputJsonValue | null;
            afterData: import("@prisma/client/runtime/library").InputJsonValue | null;
            id: number;
            createdAt: Date;
            organization: {
                code: string;
                id: number;
                name: string;
            } | null;
            organizationId: number | null;
            action: string;
            entityType: string;
            entityId: number | null;
            reason: string | null;
            ipAddress: string | null;
            userAgent: string | null;
            requestId: string | null;
            actor: {
                id: number;
                username: string;
                fullName: string;
            } | null;
            actorId: number | null;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
}
