import type { Request } from 'express';
import { RejectReportDto, SaveReportDraftDto } from '../dtos/reports.dto';
import { FilesService, UploadedPrivateFile } from '../services/files.service';
import { ReportsService } from '../services/reports.service';
import type { AccessTokenPayload } from '../types/auth';
export declare class ConsolidatedReportsController {
    private readonly reports;
    private readonly files;
    constructor(reports: ReportsService, files: FilesService);
    open(periodId: number, principal: AccessTokenPayload): Promise<import("../repositories/reports.repository").ReportWorkspaceView>;
    get(id: number, principal: AccessTokenPayload): Promise<import("../repositories/reports.repository").ReportWorkspaceView>;
    save(id: number, body: SaveReportDraftDto, principal: AccessTokenPayload, request: Request): Promise<import("../repositories/reports.repository").ReportWorkspaceView>;
    submit(id: number, principal: AccessTokenPayload, request: Request): Promise<{
        id: number;
        workspaceId: number;
        versionNumber: number;
        content: string | null;
        status: import("@prisma/client").$Enums.ReportStatus;
        submittedBy: {
            organization: {
                id: number;
                code: string;
                name: string;
            };
            id: number;
            username: string;
            fullName: string;
        };
        submittedAt: Date;
        reviewedBy: {
            organization: {
                id: number;
                code: string;
                name: string;
            };
            id: number;
            username: string;
            fullName: string;
        } | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        files: {
            id: number;
            createdAt: Date;
            originalName: string;
            mimeType: string;
            sizeBytes: number;
            checksum: string;
        }[];
        workspace: {
            id: number;
            kind: import("@prisma/client").$Enums.ReportKind;
            ownerOrganization: {
                id: number;
                code: string;
                name: string;
            };
            reportingPeriod: {
                task: {
                    program: {
                        id: number;
                        code: string;
                        name: string;
                    };
                } & {
                    id: number;
                    code: string;
                    name: string;
                    createdAt: Date;
                    updatedAt: Date;
                    description: string | null;
                    deletedAt: Date | null;
                    frequency: import("@prisma/client").$Enums.Frequency | null;
                    dueAt: Date | null;
                    completedAt: Date | null;
                    expectedOutput: string | null;
                    type: import("@prisma/client").$Enums.TaskType;
                    programId: number;
                    assigningOrganizationId: number;
                    leadOrganizationId: number;
                    periodicStartAt: Date | null;
                    closedAt: Date | null;
                    closedById: number | null;
                    closeReason: string | null;
                    completedById: number | null;
                    createdById: number;
                    updatedById: number;
                };
            } & {
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
            };
        };
    }>;
    approve(id: number, principal: AccessTokenPayload, request: Request): Promise<{
        id: number;
        workspaceId: number;
        versionNumber: number;
        content: string | null;
        status: import("@prisma/client").$Enums.ReportStatus;
        submittedBy: {
            organization: {
                id: number;
                code: string;
                name: string;
            };
            id: number;
            username: string;
            fullName: string;
        };
        submittedAt: Date;
        reviewedBy: {
            organization: {
                id: number;
                code: string;
                name: string;
            };
            id: number;
            username: string;
            fullName: string;
        } | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        files: {
            id: number;
            createdAt: Date;
            originalName: string;
            mimeType: string;
            sizeBytes: number;
            checksum: string;
        }[];
        workspace: {
            id: number;
            kind: import("@prisma/client").$Enums.ReportKind;
            ownerOrganization: {
                id: number;
                code: string;
                name: string;
            };
            reportingPeriod: {
                task: {
                    program: {
                        id: number;
                        code: string;
                        name: string;
                    };
                } & {
                    id: number;
                    code: string;
                    name: string;
                    createdAt: Date;
                    updatedAt: Date;
                    description: string | null;
                    deletedAt: Date | null;
                    frequency: import("@prisma/client").$Enums.Frequency | null;
                    dueAt: Date | null;
                    completedAt: Date | null;
                    expectedOutput: string | null;
                    type: import("@prisma/client").$Enums.TaskType;
                    programId: number;
                    assigningOrganizationId: number;
                    leadOrganizationId: number;
                    periodicStartAt: Date | null;
                    closedAt: Date | null;
                    closedById: number | null;
                    closeReason: string | null;
                    completedById: number | null;
                    createdById: number;
                    updatedById: number;
                };
            } & {
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
            };
        };
    }>;
    reject(id: number, body: RejectReportDto, principal: AccessTokenPayload, request: Request): Promise<{
        id: number;
        workspaceId: number;
        versionNumber: number;
        content: string | null;
        status: import("@prisma/client").$Enums.ReportStatus;
        submittedBy: {
            organization: {
                id: number;
                code: string;
                name: string;
            };
            id: number;
            username: string;
            fullName: string;
        };
        submittedAt: Date;
        reviewedBy: {
            organization: {
                id: number;
                code: string;
                name: string;
            };
            id: number;
            username: string;
            fullName: string;
        } | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        files: {
            id: number;
            createdAt: Date;
            originalName: string;
            mimeType: string;
            sizeBytes: number;
            checksum: string;
        }[];
        workspace: {
            id: number;
            kind: import("@prisma/client").$Enums.ReportKind;
            ownerOrganization: {
                id: number;
                code: string;
                name: string;
            };
            reportingPeriod: {
                task: {
                    program: {
                        id: number;
                        code: string;
                        name: string;
                    };
                } & {
                    id: number;
                    code: string;
                    name: string;
                    createdAt: Date;
                    updatedAt: Date;
                    description: string | null;
                    deletedAt: Date | null;
                    frequency: import("@prisma/client").$Enums.Frequency | null;
                    dueAt: Date | null;
                    completedAt: Date | null;
                    expectedOutput: string | null;
                    type: import("@prisma/client").$Enums.TaskType;
                    programId: number;
                    assigningOrganizationId: number;
                    leadOrganizationId: number;
                    periodicStartAt: Date | null;
                    closedAt: Date | null;
                    closedById: number | null;
                    closeReason: string | null;
                    completedById: number | null;
                    createdById: number;
                    updatedById: number;
                };
            } & {
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
            };
        };
    }>;
    upload(id: number, file: UploadedPrivateFile | undefined, principal: AccessTokenPayload, request: Request): Promise<{
        id: number;
        createdAt: Date;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        checksum: string;
    }>;
    removeFile(id: number, fileId: number, principal: AccessTokenPayload, request: Request): Promise<{
        id: number;
    }>;
    download(id: number, fileId: number, principal: AccessTokenPayload, request: Request): Promise<import("@nestjs/common").StreamableFile>;
}
