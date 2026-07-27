import { ReportKind } from '@prisma/client';
import { ReportHistoryQueryDto } from '../dtos/reports.dto';
import { ReportWorkspaceView, ReportsRepository } from '../repositories/reports.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import { NotificationsService } from './notifications.service';
export declare class ReportsService {
    private readonly repository;
    private readonly notificationsService?;
    private readonly logger;
    constructor(repository: ReportsRepository, notificationsService?: NotificationsService | undefined);
    openProgress(reportingPeriodId: number, principal: AccessTokenPayload): Promise<ReportWorkspaceView>;
    openConsolidated(reportingPeriodId: number, principal: AccessTokenPayload): Promise<ReportWorkspaceView>;
    get(workspaceId: number, kind: ReportKind, principal: AccessTokenPayload): Promise<ReportWorkspaceView>;
    listPeriodWorkspaces(reportingPeriodId: number, principal: AccessTokenPayload): Promise<ReportWorkspaceView[]>;
    saveDraft(workspaceId: number, kind: ReportKind, content: string, principal: AccessTokenPayload, meta?: RequestMeta): Promise<ReportWorkspaceView>;
    submit(workspaceId: number, kind: ReportKind, principal: AccessTokenPayload, meta?: RequestMeta): Promise<{
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
    approve(workspaceId: number, kind: ReportKind, principal: AccessTokenPayload, meta?: RequestMeta): Promise<{
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
    reject(workspaceId: number, kind: ReportKind, reason: string, principal: AccessTokenPayload, meta?: RequestMeta): Promise<{
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
    history(query: ReportHistoryQueryDto, principal: AccessTokenPayload): Promise<{
        data: {
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
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    private requireWorkspace;
    private requirePeriod;
    private assertPeriodEditable;
    private assertDraftEditable;
    private assertOwner;
    private assertReadScope;
    private assertReviewer;
    private assertSubmitted;
    private assertPermission;
    private notifyReview;
    private safeNotify;
}
