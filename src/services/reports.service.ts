import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, ReportKind, ReportStatus } from '@prisma/client';
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
  ) {}

  async openProgress(
    taskId: number,
    principal: AccessTokenPayload,
    requestedOwnerUserId?: number,
  ) {
    const task = await this.requireTask(taskId);
    const ownerUserId = principal.isAdmin
      ? requestedOwnerUserId
      : principal.sub;
    if (!ownerUserId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.ONLY_AN_ASSIGNED_COLLABORATOR_MAY_REPORT,
        message: 'Cần chọn người báo cáo',
      });
    }
    const owner = await this.repository.resolveUserOrg(ownerUserId);
    if (
      !owner ||
      !task.collaboratorOrganizationIds.includes(owner.organizationId)
    ) {
      throw new ForbiddenException({
        errorCode: ErrorCode.ONLY_AN_ASSIGNED_COLLABORATOR_MAY_REPORT,
        message: 'Chỉ đơn vị được phân công phối hợp mới được báo cáo',
      });
    }
    this.assertTaskEditable(task);
    const workspace = await this.repository.findOrCreateWorkspace(
      taskId,
      ReportKind.PROGRESS,
      { organizationId: owner.organizationId, userId: ownerUserId },
    );
    if (!workspace) {
      throw new ConflictException({
        errorCode: ErrorCode.REPORTING_SUBTASK_OR_ASSIGNMENT_HAS_CHANGED,
        message: 'Nhiệm vụ hoặc phân công đã thay đổi',
      });
    }
    return workspace;
  }

  async openConsolidated(taskId: number, principal: AccessTokenPayload) {
    const task = await this.requireTask(taskId);
    if (
      task.leadOrganizationId !== principal.organizationId &&
      !principal.isAdmin
    ) {
      throw new ForbiddenException({
        errorCode: ErrorCode.ONLY_THE_LEAD_ORGANIZATION_MAY_CONSOLIDATE,
        message: 'Chỉ cơ quan chủ trì được lập báo cáo tổng hợp',
      });
    }
    this.assertTaskEditable(task);
    const workspace = await this.repository.findOrCreateWorkspace(
      taskId,
      ReportKind.CONSOLIDATED,
      { organizationId: task.leadOrganizationId, userId: null },
    );
    if (!workspace) {
      throw new ConflictException({
        errorCode: ErrorCode.REPORTING_SUBTASK_OR_ASSIGNMENT_HAS_CHANGED,
        message: 'Nhiệm vụ hoặc phân công đã thay đổi',
      });
    }
    return workspace;
  }

  async get(
    workspaceId: number,
    kind: ReportKind,
    principal: AccessTokenPayload,
  ) {
    const workspace = await this.requireWorkspace(workspaceId, kind);
    this.assertReadScope(workspace, principal);
    return workspace;
  }

  async listTaskWorkspaces(taskId: number, principal: AccessTokenPayload) {
    const task = await this.requireTask(taskId);
    if (
      !principal.isAdmin &&
      task.leadOrganizationId !== principal.organizationId
    ) {
      throw new ForbiddenException(ErrorCode.REPORT_IS_OUTSIDE_YOUR_SCOPE);
    }
    return this.repository.listTaskWorkspaces(taskId);
  }

  async saveDraft(
    workspaceId: number,
    kind: ReportKind,
    content: string,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
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
        ? workspace.task.leadOrganizationId
        : workspace.task.assigningOrganizationId;
    await this.safeNotify({
      organizationIds: [destination],
      eventKey: `REPORT_SUBMITTED:${version.id}`,
      type: NotificationType.GUI_BAO_CAO,
      title: 'Báo cáo mới chờ duyệt',
      body: `${workspace.task.code} - ${workspace.task.name}`,
      entityType: 'Task',
      entityId: workspace.task.id,
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

  // Trả lại báo cáo ĐÃ DUYỆT về REJECTED để đơn vị làm lại. Với tổng hợp,
  // duyệt đã đóng kỳ nên trả lại sẽ mở lại kỳ (đảo side-effect) — xử lý trong
  // repository.returnLatest.
  async returnApproved(
    workspaceId: number,
    kind: ReportKind,
    reason: string,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
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
    if (
      query.submittedFrom &&
      query.submittedTo &&
      new Date(query.submittedFrom) > new Date(query.submittedTo)
    ) {
      throw new BadRequestException(
        'submittedFrom must not be after submittedTo',
      );
    }
    const result = await this.repository.listHistory({
      ...query,
      taskCode: query.taskCode?.trim() || undefined,
      taskName: query.taskName?.trim() || undefined,
      organizationId: principal.organizationId,
      userId: principal.sub,
      globalScope: principal.isAdmin === true,
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

  private async requireTask(id: number) {
    const task = await this.repository.findTaskContext(id);
    if (!task || task.deletedAt) {
      throw new NotFoundException('Reporting task not found');
    }
    return task;
  }

  private assertTaskEditable(
    task: Awaited<ReturnType<ReportsService['requireTask']>>,
  ) {
    if (task.closedAt || task.completedAt || task.deletedAt) {
      throw new ConflictException('Reporting task is not editable');
    }
  }

  private assertDraftEditable(workspace: ReportWorkspaceView) {
    this.assertTaskEditable(workspace.task);
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
    const task = workspace.task;
    const validResponsibility =
      workspace.kind === ReportKind.PROGRESS
        ? workspace.ownerUserId === principal.sub &&
          task.collaboratorOrganizationIds.includes(principal.organizationId)
        : workspace.ownerOrganizationId === principal.organizationId &&
          task.leadOrganizationId === principal.organizationId;
    if (!validResponsibility)
      throw new ForbiddenException(ErrorCode.INVALID_TASK_RESPONSIBILITY);
  }

  private assertReadScope(
    workspace: ReportWorkspaceView,
    principal: AccessTokenPayload,
  ) {
    if (principal.isAdmin) return;
    const task = workspace.task;
    if (
      task.assigningOrganizationId === principal.organizationId ||
      task.leadOrganizationId === principal.organizationId ||
      workspace.ownerUserId === principal.sub
    ) {
      return;
    }
    throw new ForbiddenException(ErrorCode.REPORT_IS_OUTSIDE_YOUR_SCOPE);
  }

  private assertReviewer(
    workspace: ReportWorkspaceView,
    principal: AccessTokenPayload,
  ) {
    // Duyệt theo trách nhiệm nhiệm vụ: chủ trì duyệt tiến độ, cơ quan giao duyệt
    // tổng hợp; admin bỏ qua cả hai.
    if (principal.isAdmin) return;
    const task = workspace.task;
    const reviewerOrganizationId =
      workspace.kind === ReportKind.PROGRESS
        ? task.leadOrganizationId
        : task.assigningOrganizationId;
    if (reviewerOrganizationId !== principal.organizationId) {
      throw new ForbiddenException(ErrorCode.INVALID_TASK_RESPONSIBILITY);
    }
  }

  private assertSubmitted(workspace: ReportWorkspaceView) {
    if (
      workspace.task.deletedAt ||
      workspace.task.closedAt ||
      workspace.task.completedAt
    ) {
      throw new ConflictException(ErrorCode.REPORTING_SUBTASK_IS_NOT_OPEN);
    }
    if (
      workspace.status !== ReportStatus.SUBMITTED ||
      workspace.latestVersion?.status !== ReportStatus.SUBMITTED
    ) {
      throw new ConflictException(ErrorCode.REPORT_IS_NOT_PENDING_REVIEW);
    }
  }

  private assertApproved(workspace: ReportWorkspaceView) {
    const task = workspace.task;
    const taskEditable =
      !task.completedAt || workspace.kind === ReportKind.CONSOLIDATED;
    if (!taskEditable || task.deletedAt || task.closedAt) {
      throw new ConflictException(ErrorCode.REPORTING_SUBTASK_IS_NOT_OPEN);
    }
    if (
      workspace.status !== ReportStatus.APPROVED ||
      workspace.latestVersion?.status !== ReportStatus.APPROVED
    ) {
      throw new ConflictException(ErrorCode.REPORT_IS_NOT_APPROVED);
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
      type: approved ? 'DUYET_BAO_CAO' : 'TRA_BAO_CAO',
      title: approved ? 'Báo cáo đã được duyệt' : 'Báo cáo chưa đạt yêu cầu',
      body: reason
        ? `${workspace.task.code} - ${reason}`
        : `${workspace.task.code} - ${workspace.task.name}`,
      entityType: 'Task',
      entityId: workspace.task.id,
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
