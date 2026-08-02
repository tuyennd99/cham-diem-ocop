import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PeriodStatus, ReportKind, ReportStatus } from '@prisma/client';
import { ReportHistoryQueryDto } from '../dtos/reports.dto';
import {
  ReportWorkspaceView,
  ReportsRepository,
} from '../repositories/reports.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import { NotificationsService } from './notifications.service';
import { ErrorCode } from '../types/error-code';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly repository: ReportsRepository,
    private readonly notificationsService?: NotificationsService,
  ) { }

  async openProgress(reportingPeriodId: number, principal: AccessTokenPayload) {
    this.assertPermission(principal, 'progress.edit');
    const period = await this.requirePeriod(reportingPeriodId);
    if (
      !period.task.collaboratorOrganizationIds.includes(
        principal.organizationId,
      )
    ) {
      throw new ForbiddenException({
        errorCode: ErrorCode.ONLY_AN_ASSIGNED_COLLABORATOR_MAY_REPORT,
        message: 'Chỉ đơn vị được phân công phối hợp mới được báo cáo',
      });
    }
    this.assertPeriodEditable(period);
    const workspace = await this.repository.findOrCreateWorkspace(
      reportingPeriodId,
      ReportKind.PROGRESS,
      principal.organizationId,
    );
    if (!workspace) {
      throw new ConflictException({
        errorCode: ErrorCode.REPORTING_PERIOD_OR_ASSIGNMENT_HAS_CHANGED,
        message: 'Kỳ báo cáo hoặc phân công đã thay đổi',
      });
    }
    return workspace;
  }

  async openConsolidated(
    reportingPeriodId: number,
    principal: AccessTokenPayload,
  ) {
    this.assertPermission(principal, 'consolidated.edit');
    const period = await this.requirePeriod(reportingPeriodId);
    // Cả nhiệm vụ đột xuất lẫn định kỳ đều có kỳ báo cáo (đột xuất được cấp 1
    // kỳ khi tạo), nên lead lập báo cáo tổng hợp gửi cơ quan giao cho cả hai.
    if (
      period.task.leadOrganizationId !== principal.organizationId &&
      !principal.isAdmin
    ) {
      throw new ForbiddenException({
        errorCode: ErrorCode.ONLY_THE_LEAD_ORGANIZATION_MAY_CONSOLIDATE,
        message: 'Chỉ cơ quan chủ trì được lập báo cáo tổng hợp',
      });
    }
    this.assertPeriodEditable(period);
    // Lead được lập báo cáo tổng hợp bất kể báo cáo phối hợp đã duyệt hết chưa.
    const workspace = await this.repository.findOrCreateWorkspace(
      reportingPeriodId,
      ReportKind.CONSOLIDATED,
      period.task.leadOrganizationId,
    );
    if (!workspace) {
      throw new ConflictException({
        errorCode: ErrorCode.REPORTING_PERIOD_OR_ASSIGNMENT_HAS_CHANGED,
        message: 'Kỳ báo cáo hoặc phân công đã thay đổi',
      });
    }
    return workspace;
  }

  async get(
    workspaceId: number,
    kind: ReportKind,
    principal: AccessTokenPayload,
  ) {
    this.assertPermission(principal, 'tasks.read');
    const workspace = await this.requireWorkspace(workspaceId, kind);
    this.assertReadScope(workspace, principal);
    return workspace;
  }

  async listPeriodWorkspaces(
    reportingPeriodId: number,
    principal: AccessTokenPayload,
  ) {
    this.assertPermission(principal, 'tasks.read');
    const period = await this.requirePeriod(reportingPeriodId);
    const globalTaskScope =
      principal.isAdmin === true ||
      principal.permissions.includes('tasks.read.all');
    if (
      !globalTaskScope &&
      period.task.leadOrganizationId !== principal.organizationId
    ) {
      throw new ForbiddenException(
        'Only the lead organization may list reports',
      );
    }
    if (!principal.isAdmin) {
      this.assertPermission(principal, 'progress.review');
    }
    return this.repository.listPeriodWorkspaces(reportingPeriodId);
  }

  async saveDraft(
    workspaceId: number,
    kind: ReportKind,
    content: string,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    this.assertPermission(
      principal,
      kind === ReportKind.PROGRESS ? 'progress.edit' : 'consolidated.edit',
    );
    const workspace = await this.requireWorkspace(workspaceId, kind);
    this.assertOwner(workspace, principal);
    this.assertDraftEditable(workspace);
    const saved = await this.repository.saveDraft(
      workspaceId,
      content,
      principal.sub,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!saved) throw new ConflictException('Report draft is locked');
    return saved;
  }

  async submit(
    workspaceId: number,
    kind: ReportKind,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    this.assertPermission(
      principal,
      kind === ReportKind.PROGRESS ? 'progress.submit' : 'consolidated.submit',
    );
    const workspace = await this.requireWorkspace(workspaceId, kind);
    this.assertOwner(workspace, principal);
    this.assertDraftEditable(workspace);
    const version = await this.repository.createVersionFromDraft(
      workspaceId,
      principal.sub,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!version) throw new ConflictException('Report draft is locked');
    const destination =
      kind === ReportKind.PROGRESS
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

  async approve(
    workspaceId: number,
    kind: ReportKind,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    const workspace = await this.requireWorkspace(workspaceId, kind);
    this.assertReviewer(workspace, principal);
    this.assertSubmitted(workspace);
    const reviewed = await this.repository.approveLatest(
      workspaceId,
      principal.sub,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!reviewed) throw new ConflictException('Report is no longer pending');
    await this.notifyReview(workspace, ReportStatus.APPROVED);
    return reviewed;
  }

  async reject(
    workspaceId: number,
    kind: ReportKind,
    reason: string,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    const workspace = await this.requireWorkspace(workspaceId, kind);
    this.assertReviewer(workspace, principal);
    this.assertSubmitted(workspace);
    const trimmed = reason.trim();
    if (!trimmed) throw new BadRequestException('Rejection reason is required');
    const reviewed = await this.repository.rejectLatest(
      workspaceId,
      principal.sub,
      trimmed,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!reviewed) throw new ConflictException('Report is no longer pending');
    await this.notifyReview(workspace, ReportStatus.REJECTED, trimmed);
    return reviewed;
  }

  // Trả lại báo cáo ĐÃ DUYỆT về REJECTED để đơn vị làm lại. Chỉ áp dụng cho
  // báo cáo phối hợp (PROGRESS) — tổng hợp đã duyệt sẽ đóng kỳ, không trả ở đây.
  async returnApproved(
    workspaceId: number,
    kind: ReportKind,
    reason: string,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    if (kind !== ReportKind.PROGRESS) {
      throw new ConflictException({
        errorCode: ErrorCode.REPORTING_PERIOD_OR_ASSIGNMENT_HAS_CHANGED,
        message: 'Chỉ báo cáo phối hợp mới được trả lại sau khi duyệt',
      });
    }
    const workspace = await this.requireWorkspace(workspaceId, kind);
    this.assertReviewer(workspace, principal);
    this.assertApproved(workspace);
    const trimmed = reason.trim();
    if (!trimmed) throw new BadRequestException('Rejection reason is required');
    const reviewed = await this.repository.returnLatest(
      workspaceId,
      principal.sub,
      trimmed,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!reviewed) throw new ConflictException('Report is no longer approved');
    await this.notifyReview(workspace, ReportStatus.REJECTED, trimmed);
    return reviewed;
  }

  async history(query: ReportHistoryQueryDto, principal: AccessTokenPayload) {
    this.assertPermission(principal, 'report_history.read');
    if (
      query.submittedFrom &&
      query.submittedTo &&
      new Date(query.submittedFrom) > new Date(query.submittedTo)
    ) {
      throw new BadRequestException(
        'submittedFrom must not be after submittedTo',
      );
    }
    const globalTaskScope =
      principal.isAdmin === true ||
      principal.permissions.includes('tasks.read.all');
    const result = await this.repository.listHistory({
      ...query,
      taskCode: query.taskCode?.trim() || undefined,
      taskName: query.taskName?.trim() || undefined,
      organizationId: principal.organizationId,
      globalScope: globalTaskScope,
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

  private async requireWorkspace(id: number, kind: ReportKind) {
    const workspace = await this.repository.findWorkspace(id);
    if (!workspace || workspace.kind !== kind) {
      throw new NotFoundException('Report workspace not found');
    }
    return workspace;
  }

  private async requirePeriod(id: number) {
    const period = await this.repository.findPeriodContext(id);
    if (!period || period.task.deletedAt) {
      throw new NotFoundException('Reporting period not found');
    }
    return period;
  }

  private assertPeriodEditable(
    period: Awaited<ReturnType<ReportsService['requirePeriod']>>,
  ) {
    if (
      period.status !== PeriodStatus.OPEN ||
      period.task.completedAt !== null
    ) {
      throw new ConflictException('Reporting period is not editable');
    }
  }

  private assertDraftEditable(workspace: ReportWorkspaceView) {
    this.assertPeriodEditable({
      id: workspace.reportingPeriod.id,
      status: workspace.reportingPeriod.status,
      task: workspace.reportingPeriod.task,
      approvedProgressCount: 0,
    });
    if (
      workspace.status !== ReportStatus.DRAFT &&
      workspace.status !== ReportStatus.REJECTED
    ) {
      throw new ConflictException('Report draft is locked');
    }
  }

  private assertOwner(
    workspace: ReportWorkspaceView,
    principal: AccessTokenPayload,
  ) {
    if (principal.isAdmin) return;
    if (workspace.ownerOrganizationId !== principal.organizationId) {
      throw new ForbiddenException('Report belongs to another organization');
    }
    const task = workspace.reportingPeriod.task;
    const validRole =
      workspace.kind === ReportKind.PROGRESS
        ? task.collaboratorOrganizationIds.includes(principal.organizationId)
        : task.leadOrganizationId === principal.organizationId;
    if (!validRole) throw new ForbiddenException('Invalid task role');
  }

  private assertReadScope(
    workspace: ReportWorkspaceView,
    principal: AccessTokenPayload,
  ) {
    if (
      principal.isAdmin ||
      principal.permissions.includes('tasks.read.all') ||
      workspace.reportingPeriod.task.leadOrganizationId ===
      principal.organizationId ||
      (workspace.kind === ReportKind.PROGRESS &&
        workspace.ownerOrganizationId === principal.organizationId)
    ) {
      return;
    }
    throw new ForbiddenException('Report is outside your scope');
  }

  private assertReviewer(
    workspace: ReportWorkspaceView,
    principal: AccessTokenPayload,
  ) {
    const permission =
      workspace.kind === ReportKind.PROGRESS
        ? 'progress.review'
        : 'consolidated.review';
    this.assertPermission(principal, permission);
    if (
      workspace.kind === ReportKind.PROGRESS &&
      !principal.isAdmin &&
      workspace.reportingPeriod.task.leadOrganizationId !==
      principal.organizationId
    ) {
      throw new ForbiddenException(
        'Only the lead organization may review progress',
      );
    }
  }

  private assertSubmitted(workspace: ReportWorkspaceView) {
    if (
      workspace.reportingPeriod.status !== PeriodStatus.OPEN ||
      workspace.reportingPeriod.task.deletedAt
    ) {
      throw new ConflictException('Reporting period is not open');
    }
    if (
      workspace.status !== ReportStatus.SUBMITTED ||
      workspace.latestVersion?.status !== ReportStatus.SUBMITTED
    ) {
      throw new ConflictException('Report is not pending review');
    }
  }

  private assertApproved(workspace: ReportWorkspaceView) {
    if (
      workspace.reportingPeriod.status !== PeriodStatus.OPEN ||
      workspace.reportingPeriod.task.deletedAt
    ) {
      throw new ConflictException('Reporting period is not open');
    }
    if (
      workspace.status !== ReportStatus.APPROVED ||
      workspace.latestVersion?.status !== ReportStatus.APPROVED
    ) {
      throw new ConflictException('Report is not approved');
    }
  }

  private assertPermission(principal: AccessTokenPayload, permission: string) {
    if (!principal.isAdmin && !principal.permissions.includes(permission)) {
      throw new ForbiddenException(`${permission} is required`);
    }
  }

  private async notifyReview(
    workspace: ReportWorkspaceView,
    result: typeof ReportStatus.APPROVED | typeof ReportStatus.REJECTED,
    reason?: string,
  ) {
    const versionId = workspace.latestVersion.id;
    const approved = result === ReportStatus.APPROVED;
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

  private async safeNotify(
    input: Parameters<NotificationsService['createForOrganizations']>[0],
  ) {
    try {
      await this.notificationsService?.createForOrganizations(input);
    } catch (error) {
      this.logger.error(
        `Notification delivery failed for ${input.eventKey}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
