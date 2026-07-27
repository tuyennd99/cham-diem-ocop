"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const workspaceInclude = client_1.Prisma.validator()({
    ownerOrganization: { select: { id: true, code: true, name: true } },
    reportingPeriod: {
        include: {
            task: {
                include: {
                    collaborators: { select: { organizationId: true } },
                    program: { select: { id: true, code: true, name: true } },
                },
            },
        },
    },
    draftAttachments: {
        include: {
            storedFile: {
                select: {
                    id: true,
                    originalName: true,
                    mimeType: true,
                    sizeBytes: true,
                    checksum: true,
                    createdAt: true,
                },
            },
        },
    },
    versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        include: {
            submittedBy: { select: { id: true, username: true, fullName: true } },
            reviewedBy: { select: { id: true, username: true, fullName: true } },
            attachments: {
                include: {
                    storedFile: {
                        select: {
                            id: true,
                            originalName: true,
                            mimeType: true,
                            sizeBytes: true,
                            checksum: true,
                            createdAt: true,
                        },
                    },
                },
            },
        },
    },
});
const versionHistoryInclude = client_1.Prisma.validator()({
    submittedBy: {
        select: {
            id: true,
            username: true,
            fullName: true,
            organization: { select: { id: true, code: true, name: true } },
        },
    },
    reviewedBy: {
        select: {
            id: true,
            username: true,
            fullName: true,
            organization: { select: { id: true, code: true, name: true } },
        },
    },
    attachments: {
        include: {
            storedFile: {
                select: {
                    id: true,
                    originalName: true,
                    mimeType: true,
                    sizeBytes: true,
                    checksum: true,
                    createdAt: true,
                },
            },
        },
    },
    workspace: {
        include: {
            ownerOrganization: { select: { id: true, code: true, name: true } },
            reportingPeriod: {
                include: {
                    task: {
                        include: {
                            program: { select: { id: true, code: true, name: true } },
                        },
                    },
                },
            },
        },
    },
});
let ReportsRepository = class ReportsRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findWorkspace(id) {
        const row = await this.prisma.reportWorkspace.findUnique({
            where: { id },
            include: workspaceInclude,
        });
        return row ? this.toWorkspace(row) : null;
    }
    async findPeriodContext(id) {
        const row = await this.prisma.reportingPeriod.findUnique({
            where: { id },
            include: {
                task: {
                    include: { collaborators: { select: { organizationId: true } } },
                },
                workspaces: {
                    where: {
                        kind: client_1.ReportKind.PROGRESS,
                        status: client_1.ReportStatus.APPROVED,
                    },
                    select: { id: true, ownerOrganizationId: true },
                },
            },
        });
        if (!row)
            return null;
        return {
            id: row.id,
            status: row.status,
            task: {
                id: row.task.id,
                type: row.task.type,
                leadOrganizationId: row.task.leadOrganizationId,
                completedAt: row.task.completedAt,
                deletedAt: row.task.deletedAt,
                collaboratorOrganizationIds: row.task.collaborators.map(({ organizationId }) => organizationId),
            },
            approvedProgressCount: row.workspaces.filter(({ ownerOrganizationId }) => row.task.collaborators.some(({ organizationId }) => organizationId === ownerOrganizationId)).length,
        };
    }
    async listPeriodWorkspaces(reportingPeriodId) {
        const rows = await this.prisma.reportWorkspace.findMany({
            where: {
                reportingPeriodId,
                status: { not: client_1.ReportStatus.DRAFT },
            },
            include: workspaceInclude,
            orderBy: [{ kind: 'asc' }, { ownerOrganizationId: 'asc' }],
        });
        return rows.map((row) => this.toWorkspace(row));
    }
    async findOrCreateWorkspace(reportingPeriodId, kind, ownerOrganizationId) {
        return this.prisma.$transaction(async (transaction) => {
            await transaction.$queryRaw(client_1.Prisma.sql `
          SELECT rp."id"
          FROM "reporting_periods" rp
          JOIN "tasks" task ON task."id" = rp."taskId"
          WHERE rp."id" = ${reportingPeriodId}
          FOR UPDATE OF task, rp
        `);
            const period = await transaction.reportingPeriod.findUnique({
                where: { id: reportingPeriodId },
                select: {
                    status: true,
                    task: {
                        select: {
                            type: true,
                            deletedAt: true,
                            closedAt: true,
                            completedAt: true,
                            leadOrganizationId: true,
                            collaborators: { select: { organizationId: true } },
                        },
                    },
                },
            });
            if (!period ||
                period.status !== client_1.PeriodStatus.OPEN ||
                period.task.deletedAt !== null ||
                period.task.closedAt !== null ||
                period.task.completedAt !== null) {
                return null;
            }
            const collaboratorIds = period.task.collaborators.map(({ organizationId }) => organizationId);
            if ((kind === client_1.ReportKind.PROGRESS &&
                !collaboratorIds.includes(ownerOrganizationId)) ||
                (kind === client_1.ReportKind.CONSOLIDATED &&
                    (period.task.type !== client_1.TaskType.DINH_KY ||
                        period.task.leadOrganizationId !== ownerOrganizationId ||
                        (await transaction.reportWorkspace.count({
                            where: {
                                reportingPeriodId,
                                kind: client_1.ReportKind.PROGRESS,
                                status: client_1.ReportStatus.APPROVED,
                                ownerOrganizationId: { in: collaboratorIds },
                            },
                        })) !== collaboratorIds.length))) {
                return null;
            }
            const row = await transaction.reportWorkspace.upsert({
                where: {
                    reportingPeriodId_kind_ownerOrganizationId: {
                        reportingPeriodId,
                        kind,
                        ownerOrganizationId,
                    },
                },
                update: {},
                create: { reportingPeriodId, kind, ownerOrganizationId },
                include: workspaceInclude,
            });
            return this.toWorkspace(row);
        });
    }
    async saveDraft(id, content, actorId, meta = {}) {
        return this.prisma.$transaction(async (transaction) => {
            await this.lockWorkspaceContext(transaction, id);
            const before = await transaction.reportWorkspace.findUnique({
                where: { id },
                include: workspaceInclude,
            });
            if (!before ||
                (before.status !== client_1.ReportStatus.DRAFT &&
                    before.status !== client_1.ReportStatus.REJECTED) ||
                before.reportingPeriod.status !== client_1.PeriodStatus.OPEN ||
                before.reportingPeriod.task.deletedAt !== null ||
                before.reportingPeriod.task.completedAt !== null) {
                return null;
            }
            const changed = await transaction.reportWorkspace.updateMany({
                where: {
                    id,
                    status: { in: [client_1.ReportStatus.DRAFT, client_1.ReportStatus.REJECTED] },
                },
                data: { content, status: client_1.ReportStatus.DRAFT },
            });
            if (changed.count !== 1)
                return null;
            const after = await transaction.reportWorkspace.findUniqueOrThrow({
                where: { id },
                include: workspaceInclude,
            });
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: 'REPORT_DRAFT_SAVED',
                    entityType: 'ReportWorkspace',
                    entityId: id,
                    beforeData: this.workspaceAudit(this.toWorkspace(before)),
                    afterData: this.workspaceAudit(this.toWorkspace(after)),
                    ...this.auditMeta(meta),
                },
            });
            return this.toWorkspace(after);
        });
    }
    async createVersionFromDraft(workspaceId, actorId, meta = {}) {
        return this.prisma.$transaction(async (transaction) => {
            await this.lockWorkspaceContext(transaction, workspaceId);
            const workspace = await transaction.reportWorkspace.findUnique({
                where: { id: workspaceId },
                include: {
                    draftAttachments: { select: { storedFileId: true } },
                    versions: {
                        orderBy: { versionNumber: 'desc' },
                        take: 1,
                        select: { versionNumber: true },
                    },
                    reportingPeriod: {
                        select: {
                            status: true,
                            task: {
                                select: {
                                    deletedAt: true,
                                    completedAt: true,
                                    collaborators: { select: { organizationId: true } },
                                },
                            },
                        },
                    },
                },
            });
            if (!workspace ||
                (workspace.status !== client_1.ReportStatus.DRAFT &&
                    workspace.status !== client_1.ReportStatus.REJECTED) ||
                workspace.reportingPeriod.status !== client_1.PeriodStatus.OPEN ||
                workspace.reportingPeriod.task.deletedAt !== null ||
                workspace.reportingPeriod.task.completedAt !== null) {
                return null;
            }
            if (workspace.kind === client_1.ReportKind.CONSOLIDATED) {
                const collaboratorIds = workspace.reportingPeriod.task.collaborators.map(({ organizationId }) => organizationId);
                const approved = await transaction.reportWorkspace.count({
                    where: {
                        reportingPeriodId: workspace.reportingPeriodId,
                        kind: client_1.ReportKind.PROGRESS,
                        status: client_1.ReportStatus.APPROVED,
                        ownerOrganizationId: { in: collaboratorIds },
                    },
                });
                if (approved !== collaboratorIds.length)
                    return null;
            }
            const version = await transaction.reportVersion.create({
                data: {
                    workspaceId,
                    versionNumber: (workspace.versions[0]?.versionNumber ?? 0) + 1,
                    content: workspace.content,
                    submittedById: actorId,
                    attachments: {
                        create: workspace.draftAttachments.map(({ storedFileId }) => ({
                            storedFileId,
                        })),
                    },
                },
                include: versionHistoryInclude,
            });
            await transaction.reportWorkspace.update({
                where: { id: workspaceId },
                data: { status: client_1.ReportStatus.SUBMITTED },
            });
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: 'REPORT_SUBMITTED',
                    entityType: 'ReportVersion',
                    entityId: version.id,
                    beforeData: {
                        workspaceId,
                        status: workspace.status,
                        content: workspace.content,
                    },
                    afterData: this.versionAudit(this.toVersion(version)),
                    ...this.auditMeta(meta),
                },
            });
            return this.toVersion(version);
        });
    }
    async approveLatest(workspaceId, actorId, meta = {}) {
        return this.reviewLatest(workspaceId, actorId, client_1.ReportStatus.APPROVED, undefined, meta);
    }
    async rejectLatest(workspaceId, actorId, reason, meta = {}) {
        return this.reviewLatest(workspaceId, actorId, client_1.ReportStatus.REJECTED, reason, meta);
    }
    async listHistory(filters) {
        const workspace = filters.globalScope
            ? {}
            : {
                OR: [
                    {
                        reportingPeriod: {
                            task: { leadOrganizationId: filters.organizationId },
                        },
                    },
                    {
                        kind: client_1.ReportKind.PROGRESS,
                        ownerOrganizationId: filters.organizationId,
                    },
                ],
            };
        const where = {
            submittedAt: {
                ...(filters.submittedFrom
                    ? { gte: new Date(filters.submittedFrom) }
                    : {}),
                ...(filters.submittedTo ? { lte: new Date(filters.submittedTo) } : {}),
            },
            workspace: {
                ...workspace,
                reportingPeriod: {
                    ...(filters.reportingPeriod
                        ? { frequency: filters.reportingPeriod }
                        : {}),
                    ...(filters.dueAt ? { dueAt: new Date(filters.dueAt) } : {}),
                    task: {
                        ...(filters.taskCode
                            ? {
                                code: {
                                    contains: filters.taskCode,
                                    mode: client_1.Prisma.QueryMode.insensitive,
                                },
                            }
                            : {}),
                        ...(filters.taskName
                            ? {
                                name: {
                                    contains: filters.taskName,
                                    mode: client_1.Prisma.QueryMode.insensitive,
                                },
                            }
                            : {}),
                        ...(filters.programId ? { programId: filters.programId } : {}),
                    },
                },
            },
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.reportVersion.findMany({
                where,
                include: versionHistoryInclude,
                orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
                skip: (filters.page - 1) * filters.limit,
                take: filters.limit,
            }),
            this.prisma.reportVersion.count({ where }),
        ]);
        return { data: rows.map((row) => this.toVersion(row)), total };
    }
    async reviewLatest(workspaceId, actorId, status, rejectionReason, meta = {}) {
        return this.prisma.$transaction(async (transaction) => {
            await this.lockWorkspaceContext(transaction, workspaceId);
            const workspace = await transaction.reportWorkspace.findUnique({
                where: { id: workspaceId },
                include: {
                    reportingPeriod: {
                        include: {
                            task: {
                                include: {
                                    collaborators: { select: { organizationId: true } },
                                },
                            },
                        },
                    },
                    versions: {
                        where: { status: client_1.ReportStatus.SUBMITTED },
                        orderBy: { versionNumber: 'desc' },
                        take: 1,
                        include: {
                            attachments: { select: { storedFileId: true } },
                        },
                    },
                },
            });
            const latest = workspace?.versions[0];
            if (!workspace ||
                workspace.status !== client_1.ReportStatus.SUBMITTED ||
                !latest ||
                workspace.reportingPeriod.status !== client_1.PeriodStatus.OPEN ||
                workspace.reportingPeriod.task.deletedAt !== null ||
                workspace.reportingPeriod.task.completedAt !== null) {
                return null;
            }
            const reviewedAt = new Date();
            if (status === client_1.ReportStatus.APPROVED &&
                workspace.kind === client_1.ReportKind.CONSOLIDATED) {
                const completed = await transaction.reportingPeriod.updateMany({
                    where: {
                        id: workspace.reportingPeriodId,
                        status: client_1.PeriodStatus.OPEN,
                    },
                    data: { status: client_1.PeriodStatus.COMPLETED, completedAt: reviewedAt },
                });
                if (completed.count !== 1)
                    return null;
            }
            await transaction.reportVersion.update({
                where: { id: latest.id },
                data: {
                    status,
                    reviewedById: actorId,
                    reviewedAt,
                    rejectionReason: rejectionReason ?? null,
                },
            });
            await transaction.reportWorkspace.update({
                where: { id: workspaceId },
                data: {
                    status,
                    ...(status === client_1.ReportStatus.REJECTED
                        ? { content: latest.content }
                        : {}),
                },
            });
            if (status === client_1.ReportStatus.REJECTED) {
                await transaction.draftAttachment.deleteMany({
                    where: { workspaceId },
                });
                if (latest.attachments.length > 0) {
                    await transaction.draftAttachment.createMany({
                        data: latest.attachments.map(({ storedFileId }) => ({
                            workspaceId,
                            storedFileId,
                        })),
                        skipDuplicates: true,
                    });
                }
            }
            else if (workspace.kind === client_1.ReportKind.PROGRESS) {
                const approved = await transaction.reportWorkspace.count({
                    where: {
                        reportingPeriodId: workspace.reportingPeriodId,
                        kind: client_1.ReportKind.PROGRESS,
                        status: client_1.ReportStatus.APPROVED,
                        ownerOrganizationId: {
                            in: workspace.reportingPeriod.task.collaborators.map(({ organizationId }) => organizationId),
                        },
                    },
                });
                if (workspace.reportingPeriod.task.type === client_1.TaskType.DOT_XUAT &&
                    approved === workspace.reportingPeriod.task.collaborators.length) {
                    await transaction.task.updateMany({
                        where: {
                            id: workspace.reportingPeriod.taskId,
                            completedAt: null,
                            deletedAt: null,
                        },
                        data: { completedAt: reviewedAt, completedById: actorId },
                    });
                }
            }
            const version = await transaction.reportVersion.findUniqueOrThrow({
                where: { id: latest.id },
                include: versionHistoryInclude,
            });
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: status === client_1.ReportStatus.APPROVED
                        ? 'REPORT_APPROVED'
                        : 'REPORT_REJECTED',
                    entityType: 'ReportVersion',
                    entityId: latest.id,
                    reason: rejectionReason,
                    beforeData: {
                        status: latest.status,
                        content: latest.content,
                    },
                    afterData: this.versionAudit(this.toVersion(version)),
                    ...this.auditMeta(meta),
                },
            });
            return this.toVersion(version);
        });
    }
    lockWorkspaceContext(transaction, workspaceId) {
        return transaction.$queryRaw(client_1.Prisma.sql `
        SELECT rw."id"
        FROM "report_workspaces" rw
        JOIN "reporting_periods" rp ON rp."id" = rw."reportingPeriodId"
        JOIN "tasks" task ON task."id" = rp."taskId"
        WHERE rw."id" = ${workspaceId}
        FOR UPDATE OF task, rp, rw
      `);
    }
    workspaceAudit(workspace) {
        return {
            kind: workspace.kind,
            status: workspace.status,
            content: workspace.content,
            ownerOrganizationId: workspace.ownerOrganizationId,
            reportingPeriodId: workspace.reportingPeriod.id,
        };
    }
    versionAudit(version) {
        return {
            workspaceId: version.workspaceId,
            versionNumber: version.versionNumber,
            status: version.status,
            content: version.content,
            submittedAt: version.submittedAt.toISOString(),
            reviewedAt: version.reviewedAt?.toISOString() ?? null,
            rejectionReason: version.rejectionReason,
            files: version.files.map((file) => {
                const safe = file;
                return {
                    id: safe.id,
                    originalName: safe.originalName,
                    mimeType: safe.mimeType,
                    sizeBytes: safe.sizeBytes,
                };
            }),
        };
    }
    auditMeta(meta) {
        return {
            organizationId: meta.organizationId,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            requestId: meta.requestId && /^[A-Za-z0-9._-]{1,100}$/.test(meta.requestId)
                ? meta.requestId
                : (0, node_crypto_1.randomUUID)(),
        };
    }
    toWorkspace(row) {
        const { task } = row.reportingPeriod;
        return {
            id: row.id,
            kind: row.kind,
            status: row.status,
            content: row.content,
            ownerOrganizationId: row.ownerOrganizationId,
            ownerOrganization: row.ownerOrganization,
            reportingPeriod: {
                id: row.reportingPeriod.id,
                status: row.reportingPeriod.status,
                frequency: row.reportingPeriod.frequency,
                year: row.reportingPeriod.year,
                sequence: row.reportingPeriod.sequence,
                periodStartAt: row.reportingPeriod.periodStartAt,
                dueAt: row.reportingPeriod.dueAt,
                task: {
                    id: task.id,
                    code: task.code,
                    name: task.name,
                    type: task.type,
                    programId: task.programId,
                    assigningOrganizationId: task.assigningOrganizationId,
                    leadOrganizationId: task.leadOrganizationId,
                    completedAt: task.completedAt,
                    deletedAt: task.deletedAt,
                    collaboratorOrganizationIds: task.collaborators.map(({ organizationId }) => organizationId),
                    program: task.program,
                },
            },
            draftAttachments: row.draftAttachments.map(({ storedFile }) => storedFile),
            latestVersion: row.versions[0]
                ? {
                    id: row.versions[0].id,
                    versionNumber: row.versions[0].versionNumber,
                    content: row.versions[0].content,
                    status: row.versions[0].status,
                    submittedBy: row.versions[0].submittedBy,
                    submittedAt: row.versions[0].submittedAt,
                    reviewedBy: row.versions[0].reviewedBy,
                    reviewedAt: row.versions[0].reviewedAt,
                    rejectionReason: row.versions[0].rejectionReason,
                    files: row.versions[0].attachments.map(({ storedFile }) => storedFile),
                }
                : null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    toVersion(row) {
        return {
            id: row.id,
            workspaceId: row.workspaceId,
            versionNumber: row.versionNumber,
            content: row.content,
            status: row.status,
            submittedBy: row.submittedBy,
            submittedAt: row.submittedAt,
            reviewedBy: row.reviewedBy,
            reviewedAt: row.reviewedAt,
            rejectionReason: row.rejectionReason,
            files: row.attachments.map(({ storedFile }) => storedFile),
            workspace: {
                id: row.workspace.id,
                kind: row.workspace.kind,
                ownerOrganization: row.workspace.ownerOrganization,
                reportingPeriod: row.workspace.reportingPeriod,
            },
        };
    }
};
exports.ReportsRepository = ReportsRepository;
exports.ReportsRepository = ReportsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsRepository);
//# sourceMappingURL=reports.repository.js.map