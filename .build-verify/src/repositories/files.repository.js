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
exports.FilesRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const fileContextInclude = client_1.Prisma.validator()({
    reportingPeriod: {
        include: {
            task: {
                include: { collaborators: { select: { organizationId: true } } },
            },
        },
    },
});
let FilesRepository = class FilesRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findDraftContext(workspaceId) {
        const row = await this.prisma.reportWorkspace.findUnique({
            where: { id: workspaceId },
            include: fileContextInclude,
        });
        return row ? this.toContext(row) : null;
    }
    async draftSize(workspaceId) {
        const result = await this.prisma.storedFile.aggregate({
            where: { drafts: { some: { workspaceId } } },
            _sum: { sizeBytes: true },
        });
        return result._sum.sizeBytes ?? 0;
    }
    async addDraftFile(workspaceId, file, actorId, maxDraftBytes, meta = {}) {
        return this.prisma.$transaction(async (transaction) => {
            await this.lockWorkspaceContext(transaction, workspaceId);
            const workspace = await transaction.reportWorkspace.findUnique({
                where: { id: workspaceId },
                include: fileContextInclude,
            });
            if (!workspace || !this.isEditable(this.toContext(workspace))) {
                throw new common_1.ConflictException('Report draft is locked');
            }
            const size = await transaction.storedFile.aggregate({
                where: { drafts: { some: { workspaceId } } },
                _sum: { sizeBytes: true },
            });
            if ((size._sum.sizeBytes ?? 0) + file.sizeBytes > maxDraftBytes) {
                return null;
            }
            const stored = await transaction.storedFile.create({
                data: { ...file, uploadedById: actorId },
                select: {
                    id: true,
                    originalName: true,
                    mimeType: true,
                    sizeBytes: true,
                    checksum: true,
                    createdAt: true,
                },
            });
            await transaction.draftAttachment.create({
                data: { workspaceId, storedFileId: stored.id },
            });
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: 'REPORT_FILE_UPLOADED',
                    entityType: 'StoredFile',
                    entityId: stored.id,
                    afterData: {
                        workspaceId,
                        originalName: stored.originalName,
                        mimeType: stored.mimeType,
                        sizeBytes: stored.sizeBytes,
                    },
                    ...this.auditMeta(meta),
                },
            });
            return stored;
        });
    }
    async removeDraftFile(workspaceId, storedFileId, actorId, meta = {}) {
        return this.prisma.$transaction(async (transaction) => {
            await this.lockWorkspaceContext(transaction, workspaceId);
            const workspace = await transaction.reportWorkspace.findUnique({
                where: { id: workspaceId },
                include: fileContextInclude,
            });
            if (!workspace || !this.isEditable(this.toContext(workspace))) {
                throw new common_1.ConflictException('Report draft is locked');
            }
            await transaction.$queryRaw(client_1.Prisma.sql `SELECT "id" FROM "stored_files" WHERE "id" = ${storedFileId} FOR UPDATE`);
            const attachment = await transaction.draftAttachment.findUnique({
                where: { workspaceId_storedFileId: { workspaceId, storedFileId } },
                include: { storedFile: { select: { storageKey: true } } },
            });
            if (!attachment)
                return null;
            await transaction.draftAttachment.delete({
                where: { workspaceId_storedFileId: { workspaceId, storedFileId } },
            });
            const [draftReferences, versionReferences] = await Promise.all([
                transaction.draftAttachment.count({ where: { storedFileId } }),
                transaction.versionAttachment.count({ where: { storedFileId } }),
            ]);
            const orphaned = draftReferences + versionReferences === 0;
            if (orphaned) {
                await transaction.storedFile.delete({ where: { id: storedFileId } });
            }
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: 'REPORT_FILE_REMOVED',
                    entityType: 'StoredFile',
                    entityId: storedFileId,
                    beforeData: { workspaceId, storedFileId },
                    afterData: { removed: true, orphaned },
                    ...this.auditMeta(meta),
                },
            });
            return { storageKey: attachment.storedFile.storageKey, orphaned };
        });
    }
    async findWorkspaceDownload(workspaceId, storedFileId) {
        const row = await this.prisma.storedFile.findFirst({
            where: {
                id: storedFileId,
                OR: [
                    { drafts: { some: { workspaceId } } },
                    {
                        versions: {
                            some: { reportVersion: { workspaceId } },
                        },
                    },
                ],
            },
            include: {
                drafts: {
                    where: { workspaceId },
                    include: {
                        workspace: { include: fileContextInclude },
                    },
                    take: 1,
                },
                versions: {
                    where: { reportVersion: { workspaceId } },
                    include: {
                        reportVersion: {
                            include: {
                                workspace: { include: fileContextInclude },
                            },
                        },
                    },
                    take: 1,
                },
            },
        });
        if (!row)
            return null;
        const workspace = row.drafts[0]?.workspace ??
            row.versions[0]?.reportVersion.workspace ??
            null;
        if (!workspace)
            return null;
        return {
            id: row.id,
            originalName: row.originalName,
            storageKey: row.storageKey,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
            context: this.toContext(workspace),
        };
    }
    async findVersionDownload(versionId, storedFileId) {
        const row = await this.prisma.storedFile.findFirst({
            where: {
                id: storedFileId,
                versions: { some: { reportVersionId: versionId } },
            },
            include: {
                versions: {
                    where: { reportVersionId: versionId },
                    include: {
                        reportVersion: {
                            include: {
                                workspace: { include: fileContextInclude },
                            },
                        },
                    },
                },
            },
        });
        const workspace = row?.versions[0]?.reportVersion.workspace;
        if (!row || !workspace)
            return null;
        return {
            id: row.id,
            originalName: row.originalName,
            storageKey: row.storageKey,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
            context: this.toContext(workspace),
        };
    }
    recordDownload(storedFileId, actorId, meta = {}) {
        return this.prisma.auditLog.create({
            data: {
                actorId,
                action: 'REPORT_FILE_DOWNLOADED',
                entityType: 'StoredFile',
                entityId: storedFileId,
                ...this.auditMeta(meta),
            },
        });
    }
    toContext(row) {
        return {
            id: row.id,
            kind: row.kind,
            status: row.status,
            ownerOrganizationId: row.ownerOrganizationId,
            reportingPeriod: {
                status: row.reportingPeriod.status,
                task: {
                    leadOrganizationId: row.reportingPeriod.task.leadOrganizationId,
                    completedAt: row.reportingPeriod.task.completedAt,
                    deletedAt: row.reportingPeriod.task.deletedAt,
                    collaboratorOrganizationIds: row.reportingPeriod.task.collaborators.map(({ organizationId }) => organizationId),
                },
            },
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
    isEditable(context) {
        return ((context.status === 'DRAFT' || context.status === 'REJECTED') &&
            context.reportingPeriod.status === 'OPEN' &&
            context.reportingPeriod.task.completedAt === null &&
            context.reportingPeriod.task.deletedAt === null);
    }
};
exports.FilesRepository = FilesRepository;
exports.FilesRepository = FilesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FilesRepository);
//# sourceMappingURL=files.repository.js.map