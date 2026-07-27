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
var ReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const reports_repository_1 = require("../repositories/reports.repository");
const notifications_service_1 = require("./notifications.service");
let ReportsService = ReportsService_1 = class ReportsService {
    repository;
    notificationsService;
    logger = new common_1.Logger(ReportsService_1.name);
    constructor(repository, notificationsService) {
        this.repository = repository;
        this.notificationsService = notificationsService;
    }
    async openProgress(reportingPeriodId, principal) {
        this.assertPermission(principal, 'progress.edit');
        const period = await this.requirePeriod(reportingPeriodId);
        if (!period.task.collaboratorOrganizationIds.includes(principal.organizationId)) {
            throw new common_1.ForbiddenException('Only an assigned collaborator may report');
        }
        this.assertPeriodEditable(period);
        const workspace = await this.repository.findOrCreateWorkspace(reportingPeriodId, client_1.ReportKind.PROGRESS, principal.organizationId);
        if (!workspace) {
            throw new common_1.ConflictException('Reporting period or assignment has changed');
        }
        return workspace;
    }
    async openConsolidated(reportingPeriodId, principal) {
        this.assertPermission(principal, 'consolidated.edit');
        const period = await this.requirePeriod(reportingPeriodId);
        if (period.task.type !== client_1.TaskType.DINH_KY) {
            throw new common_1.UnprocessableEntityException('Ad-hoc tasks do not have consolidated reports');
        }
        if (period.task.leadOrganizationId !== principal.organizationId &&
            !principal.isAdmin) {
            throw new common_1.ForbiddenException('Only the lead organization may consolidate');
        }
        this.assertPeriodEditable(period);
        if (period.approvedProgressCount !==
            period.task.collaboratorOrganizationIds.length) {
            throw new common_1.UnprocessableEntityException('Every progress report must be approved first');
        }
        const workspace = await this.repository.findOrCreateWorkspace(reportingPeriodId, client_1.ReportKind.CONSOLIDATED, period.task.leadOrganizationId);
        if (!workspace) {
            throw new common_1.ConflictException('Reporting period or assignment has changed');
        }
        return workspace;
    }
    async get(workspaceId, kind, principal) {
        this.assertPermission(principal, 'tasks.read');
        const workspace = await this.requireWorkspace(workspaceId, kind);
        this.assertReadScope(workspace, principal);
        return workspace;
    }
    async listPeriodWorkspaces(reportingPeriodId, principal) {
        this.assertPermission(principal, 'tasks.read');
        const period = await this.requirePeriod(reportingPeriodId);
        if (!principal.isAdmin &&
            !principal.isStaff &&
            period.task.leadOrganizationId !== principal.organizationId) {
            throw new common_1.ForbiddenException('Only the lead organization or Thường trực may list reports');
        }
        if (!principal.isAdmin && !principal.isStaff) {
            this.assertPermission(principal, 'progress.review');
        }
        return this.repository.listPeriodWorkspaces(reportingPeriodId);
    }
    async saveDraft(workspaceId, kind, content, principal, meta = {}) {
        this.assertPermission(principal, kind === client_1.ReportKind.PROGRESS ? 'progress.edit' : 'consolidated.edit');
        const workspace = await this.requireWorkspace(workspaceId, kind);
        this.assertOwner(workspace, principal);
        this.assertDraftEditable(workspace);
        const saved = await this.repository.saveDraft(workspaceId, content, principal.sub, { ...meta, organizationId: principal.organizationId });
        if (!saved)
            throw new common_1.ConflictException('Report draft is locked');
        return saved;
    }
    async submit(workspaceId, kind, principal, meta = {}) {
        this.assertPermission(principal, kind === client_1.ReportKind.PROGRESS ? 'progress.submit' : 'consolidated.submit');
        const workspace = await this.requireWorkspace(workspaceId, kind);
        this.assertOwner(workspace, principal);
        this.assertDraftEditable(workspace);
        if (kind === client_1.ReportKind.CONSOLIDATED) {
            const period = await this.requirePeriod(workspace.reportingPeriod.id);
            if (period.approvedProgressCount !==
                period.task.collaboratorOrganizationIds.length) {
                throw new common_1.UnprocessableEntityException('Every progress report must be approved first');
            }
        }
        const version = await this.repository.createVersionFromDraft(workspaceId, principal.sub, { ...meta, organizationId: principal.organizationId });
        if (!version)
            throw new common_1.ConflictException('Report draft is locked');
        const destination = kind === client_1.ReportKind.PROGRESS
            ? workspace.reportingPeriod.task.leadOrganizationId
            : workspace.reportingPeriod.task.assigningOrganizationId;
        await this.safeNotify({
            organizationIds: [destination],
            eventKey: `REPORT_SUBMITTED:${version.id}`,
            type: 'BAO_CAO_GUI',
            title: 'Báo cáo mới chờ duyệt',
            body: `${workspace.reportingPeriod.task.code} - ${workspace.reportingPeriod.task.name}`,
            entityType: 'ReportVersion',
            entityId: version.id,
        });
        return version;
    }
    async approve(workspaceId, kind, principal, meta = {}) {
        const workspace = await this.requireWorkspace(workspaceId, kind);
        this.assertReviewer(workspace, principal);
        this.assertSubmitted(workspace);
        const reviewed = await this.repository.approveLatest(workspaceId, principal.sub, { ...meta, organizationId: principal.organizationId });
        if (!reviewed)
            throw new common_1.ConflictException('Report is no longer pending');
        await this.notifyReview(workspace, 'APPROVED');
        return reviewed;
    }
    async reject(workspaceId, kind, reason, principal, meta = {}) {
        const workspace = await this.requireWorkspace(workspaceId, kind);
        this.assertReviewer(workspace, principal);
        this.assertSubmitted(workspace);
        const trimmed = reason.trim();
        if (!trimmed)
            throw new common_1.BadRequestException('Rejection reason is required');
        const reviewed = await this.repository.rejectLatest(workspaceId, principal.sub, trimmed, { ...meta, organizationId: principal.organizationId });
        if (!reviewed)
            throw new common_1.ConflictException('Report is no longer pending');
        await this.notifyReview(workspace, 'REJECTED', trimmed);
        return reviewed;
    }
    async history(query, principal) {
        this.assertPermission(principal, 'report_history.read');
        if (query.submittedFrom &&
            query.submittedTo &&
            new Date(query.submittedFrom) > new Date(query.submittedTo)) {
            throw new common_1.BadRequestException('submittedFrom must not be after submittedTo');
        }
        const result = await this.repository.listHistory({
            ...query,
            taskCode: query.taskCode?.trim() || undefined,
            taskName: query.taskName?.trim() || undefined,
            organizationId: principal.organizationId,
            globalScope: Boolean(principal.isAdmin) || Boolean(principal.isStaff),
        });
        return {
            data: result.data,
            meta: {
                page: query.page,
                limit: query.limit,
                total: result.total,
                totalPages: Math.ceil(result.total / query.limit),
            },
        };
    }
    async requireWorkspace(id, kind) {
        const workspace = await this.repository.findWorkspace(id);
        if (!workspace || workspace.kind !== kind) {
            throw new common_1.NotFoundException('Report workspace not found');
        }
        return workspace;
    }
    async requirePeriod(id) {
        const period = await this.repository.findPeriodContext(id);
        if (!period || period.task.deletedAt) {
            throw new common_1.NotFoundException('Reporting period not found');
        }
        return period;
    }
    assertPeriodEditable(period) {
        if (period.status !== client_1.PeriodStatus.OPEN ||
            period.task.completedAt !== null) {
            throw new common_1.ConflictException('Reporting period is not editable');
        }
    }
    assertDraftEditable(workspace) {
        this.assertPeriodEditable({
            id: workspace.reportingPeriod.id,
            status: workspace.reportingPeriod.status,
            task: workspace.reportingPeriod.task,
            approvedProgressCount: 0,
        });
        if (workspace.status !== client_1.ReportStatus.DRAFT &&
            workspace.status !== client_1.ReportStatus.REJECTED) {
            throw new common_1.ConflictException('Report draft is locked');
        }
    }
    assertOwner(workspace, principal) {
        if (principal.isAdmin)
            return;
        if (workspace.ownerOrganizationId !== principal.organizationId) {
            throw new common_1.ForbiddenException('Report belongs to another organization');
        }
        const task = workspace.reportingPeriod.task;
        const validRole = workspace.kind === client_1.ReportKind.PROGRESS
            ? task.collaboratorOrganizationIds.includes(principal.organizationId)
            : task.leadOrganizationId === principal.organizationId;
        if (!validRole)
            throw new common_1.ForbiddenException('Invalid task role');
    }
    assertReadScope(workspace, principal) {
        if (principal.isAdmin ||
            principal.isStaff ||
            workspace.reportingPeriod.task.leadOrganizationId ===
                principal.organizationId ||
            (workspace.kind === client_1.ReportKind.PROGRESS &&
                workspace.ownerOrganizationId === principal.organizationId)) {
            return;
        }
        throw new common_1.ForbiddenException('Report is outside your scope');
    }
    assertReviewer(workspace, principal) {
        const permission = workspace.kind === client_1.ReportKind.PROGRESS
            ? 'progress.review'
            : 'consolidated.review';
        this.assertPermission(principal, permission);
        if (workspace.kind === client_1.ReportKind.CONSOLIDATED &&
            !principal.isAdmin &&
            !principal.isStaff) {
            throw new common_1.ForbiddenException('Only Admin or Thường trực may review consolidated reports');
        }
        if (workspace.kind === client_1.ReportKind.PROGRESS &&
            !principal.isAdmin &&
            workspace.reportingPeriod.task.leadOrganizationId !==
                principal.organizationId) {
            throw new common_1.ForbiddenException('Only the lead organization may review progress');
        }
    }
    assertSubmitted(workspace) {
        if (workspace.reportingPeriod.status !== client_1.PeriodStatus.OPEN ||
            workspace.reportingPeriod.task.deletedAt) {
            throw new common_1.ConflictException('Reporting period is not open');
        }
        if (workspace.status !== client_1.ReportStatus.SUBMITTED ||
            workspace.latestVersion?.status !== client_1.ReportStatus.SUBMITTED) {
            throw new common_1.ConflictException('Report is not pending review');
        }
    }
    assertPermission(principal, permission) {
        if (!principal.isAdmin && !principal.permissions.includes(permission)) {
            throw new common_1.ForbiddenException(`${permission} is required`);
        }
    }
    async notifyReview(workspace, result, reason) {
        const versionId = workspace.latestVersion.id;
        const approved = result === 'APPROVED';
        await this.safeNotify({
            organizationIds: [workspace.ownerOrganizationId],
            eventKey: `REPORT_${result}:${versionId}`,
            type: approved ? 'BAO_CAO_DUYET' : 'BAO_CAO_TRA',
            title: approved ? 'Báo cáo đã được duyệt' : 'Báo cáo chưa đạt yêu cầu',
            body: reason
                ? `${workspace.reportingPeriod.task.code} - ${reason}`
                : `${workspace.reportingPeriod.task.code} - ${workspace.reportingPeriod.task.name}`,
            entityType: 'ReportVersion',
            entityId: versionId,
        });
    }
    async safeNotify(input) {
        try {
            await this.notificationsService?.createForOrganizations(input);
        }
        catch (error) {
            this.logger.error(`Notification delivery failed for ${input.eventKey}`, error instanceof Error ? error.stack : String(error));
        }
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reports_repository_1.ReportsRepository,
        notifications_service_1.NotificationsService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map