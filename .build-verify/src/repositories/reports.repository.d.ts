import { Frequency, PeriodStatus, ReportKind, ReportStatus, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';
export interface ReportWorkspaceView {
    id: number;
    kind: ReportKind;
    status: ReportStatus;
    content: string | null;
    ownerOrganizationId: number;
    ownerOrganization: {
        id: number;
        code: string;
        name: string;
    };
    reportingPeriod: {
        id: number;
        status: PeriodStatus;
        frequency: Frequency | null;
        year: number;
        sequence: number;
        periodStartAt: Date;
        dueAt: Date;
        task: {
            id: number;
            code: string;
            name: string;
            type: TaskType;
            programId: number;
            assigningOrganizationId: number;
            leadOrganizationId: number;
            completedAt: Date | null;
            deletedAt: Date | null;
            collaboratorOrganizationIds: number[];
            program: {
                id: number;
                code: string;
                name: string;
            };
        };
    };
    draftAttachments: unknown[];
    latestVersion: {
        id: number;
        versionNumber: number;
        content: string | null;
        status: ReportStatus;
        submittedBy: {
            id: number;
            username: string;
            fullName: string;
        };
        submittedAt: Date;
        reviewedBy: {
            id: number;
            username: string;
            fullName: string;
        } | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        files: unknown[];
    } | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface PeriodReportContext {
    id: number;
    status: PeriodStatus;
    task: {
        id: number;
        type: TaskType;
        leadOrganizationId: number;
        completedAt: Date | null;
        deletedAt: Date | null;
        collaboratorOrganizationIds: number[];
    };
    approvedProgressCount: number;
}
export interface HistoryFilters {
    page: number;
    limit: number;
    taskCode?: string;
    taskName?: string;
    submittedFrom?: string;
    submittedTo?: string;
    reportingPeriod?: Frequency;
    dueAt?: string;
    programId?: number;
    organizationId: number;
    globalScope: boolean;
}
export declare class ReportsRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findWorkspace(id: number): Promise<ReportWorkspaceView | null>;
    findPeriodContext(id: number): Promise<PeriodReportContext | null>;
    listPeriodWorkspaces(reportingPeriodId: number): Promise<ReportWorkspaceView[]>;
    findOrCreateWorkspace(reportingPeriodId: number, kind: ReportKind, ownerOrganizationId: number): Promise<ReportWorkspaceView | null>;
    saveDraft(id: number, content: string, actorId: number, meta?: RequestMeta): Promise<ReportWorkspaceView | null>;
    createVersionFromDraft(workspaceId: number, actorId: number, meta?: RequestMeta): Promise<{
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
    } | null>;
    approveLatest(workspaceId: number, actorId: number, meta?: RequestMeta): Promise<{
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
    } | null>;
    rejectLatest(workspaceId: number, actorId: number, reason: string, meta?: RequestMeta): Promise<{
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
    } | null>;
    listHistory(filters: HistoryFilters): Promise<{
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
        total: number;
    }>;
    private reviewLatest;
    private lockWorkspaceContext;
    private workspaceAudit;
    private versionAudit;
    private auditMeta;
    private toWorkspace;
    private toVersion;
}
