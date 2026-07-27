import { Prisma } from '@prisma/client';
import { AuditAppendInput, AuditListFilters, AuditRepository } from '../repositories/audit.repository';
import { AccessTokenPayload } from '../types/auth';
export declare class AuditService {
    private readonly repository;
    constructor(repository: AuditRepository);
    append(input: Omit<AuditAppendInput, 'beforeData' | 'afterData'> & {
        beforeData?: unknown;
        afterData?: unknown;
    }): Prisma.Prisma__AuditLogClient<{
        id: number;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    list(filters: AuditListFilters, principal: AccessTokenPayload): Promise<{
        data: {
            beforeData: Prisma.InputJsonValue | null;
            afterData: Prisma.InputJsonValue | null;
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
    private sanitizeJson;
}
