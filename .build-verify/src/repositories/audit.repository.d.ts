import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export interface AuditAppendInput {
    actorId?: number | null;
    organizationId?: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    beforeData?: Prisma.InputJsonValue | null;
    afterData?: Prisma.InputJsonValue | null;
    reason?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
}
export interface AuditListFilters {
    page: number;
    limit: number;
    action?: string;
    entityType?: string;
    entityId?: number;
    actorId?: number;
    organizationId?: number;
    createdFrom?: string;
    createdTo?: string;
}
declare const auditSelect: {
    id: true;
    actorId: true;
    organizationId: true;
    action: true;
    entityType: true;
    entityId: true;
    beforeData: true;
    afterData: true;
    reason: true;
    ipAddress: true;
    userAgent: true;
    requestId: true;
    createdAt: true;
    actor: {
        select: {
            id: true;
            username: true;
            fullName: true;
        };
    };
    organization: {
        select: {
            id: true;
            code: true;
            name: true;
        };
    };
};
export type AuditListRow = Prisma.AuditLogGetPayload<{
    select: typeof auditSelect;
}>;
export declare class AuditRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    append(input: AuditAppendInput): Prisma.Prisma__AuditLogClient<{
        id: number;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    list(filters: AuditListFilters): Promise<{
        data: {
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
            beforeData: Prisma.JsonValue;
            afterData: Prisma.JsonValue;
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
        total: number;
    }>;
}
export {};
