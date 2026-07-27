import { Prisma, ReportKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';
export interface DraftFileContext {
    id: number;
    kind: ReportKind;
    status: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED';
    ownerOrganizationId: number;
    reportingPeriod: {
        status: 'OPEN' | 'COMPLETED' | 'CANCELED';
        task: {
            leadOrganizationId: number;
            completedAt: Date | null;
            deletedAt: Date | null;
            collaboratorOrganizationIds: number[];
        };
    };
}
export interface StoredFileInput {
    originalName: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
}
export interface DownloadRecord {
    id: number;
    originalName: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    context: DraftFileContext;
}
export declare class FilesRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findDraftContext(workspaceId: number): Promise<DraftFileContext | null>;
    draftSize(workspaceId: number): Promise<number>;
    addDraftFile(workspaceId: number, file: StoredFileInput, actorId: number, maxDraftBytes: number, meta?: RequestMeta): Promise<{
        id: number;
        createdAt: Date;
        sizeBytes: number;
        originalName: string;
        mimeType: string;
        checksum: string;
    } | null>;
    removeDraftFile(workspaceId: number, storedFileId: number, actorId: number, meta?: RequestMeta): Promise<{
        storageKey: string;
        orphaned: boolean;
    } | null>;
    findWorkspaceDownload(workspaceId: number, storedFileId: number): Promise<DownloadRecord | null>;
    findVersionDownload(versionId: number, storedFileId: number): Promise<DownloadRecord | null>;
    recordDownload(storedFileId: number, actorId: number, meta?: RequestMeta): Prisma.Prisma__AuditLogClient<{
        id: number;
        createdAt: Date;
        organizationId: number | null;
        action: string;
        entityType: string;
        entityId: number | null;
        beforeData: Prisma.JsonValue | null;
        afterData: Prisma.JsonValue | null;
        reason: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        requestId: string | null;
        actorId: number | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    private toContext;
    private auditMeta;
    private lockWorkspaceContext;
    private isEditable;
}
