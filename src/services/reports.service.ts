import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, SubtaskStatus, ReportKind, ReportStatus } from '@prisma/client';
import { ReportHistoryQueryDto } from '../dtos/reports.dto';
import {
  ReportWorkspaceView,
  ReportsRepository,
} from '../repositories/reports.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import { NotificationsService } from './notifications.service';
import { ErrorCode } from '../types/error-code';
import { canAccessTask } from '../utils/task-access';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly repository: ReportsRepository,
    private readonly notificationsService?: NotificationsService,
  ) { }

  async openProgress(
    reportingSubtaskId: number,
    principal: AccessTokenPayload,
    requestedOwnerOrganizationId?: number,
  ) {
    const subtask = await this.requireSubtask(reportingSubtaskId);
    // Đơn vị báo cáo tiến độ luôn là đơn vị của người dùng; admin phải chọn
    // rõ một đơn vị phối hợp được phân công của nhiệm vụ.
    const ownerOrganizationId = principal.isAdmin
      ? requestedOwnerOrganizationId
      : principal.organizationId;
    if (
      !ownerOrganizationId ||
      !subtask.task.collaboratorOrganizationIds.includes(ownerOrganizationId)
    ) {
      throw new ForbiddenException({
        errorCode: ErrorCode.ONLY_AN_ASSIGNED_COLLABORATOR_MAY_REPORT,
        message: 'Chỉ đơn vị được phân công phối hợp mới được báo cáo',
      });
    }
    this.assertSubtaskEditable(subtask);
    const workspace = await this.repository.findOrCreateWorkspace(
      reportingSubtaskId,
      ReportKind.PROGRESS,
      ownerOrganizationId,
    );
    if (!workspace) {
      throw new ConflictException({
        errorCode: ErrorCode.REPORTING_SUBTASK_OR_ASSIGNMENT_HAS_CHANGED,
        message: 'Kỳ báo cáo hoặc phân công đã thay đổi',
      });
    }
    return workspace;
  }

  async openConsolidated(
    reportingSubtaskId: number,
    principal: AccessTokenPayload,
  ) {
    const subtask = await this.requireSubtask(reportingSubtaskId);
    // Cả nhiệm vụ đột xuất lẫn định kỳ đều có kỳ báo cáo (đột xuất được cấp 1
    // kỳ khi tạo), nên lead lập báo cáo tổng hợp gửi cơ quan giao cho cả hai.
    if (
      subtask.task.leadOrganizationId !== principal.organizationId &&
      !principal.isAdmin
    ) {
      throw new ForbiddenException({
        errorCode: ErrorCode.ONLY_THE_LEAD_ORGANIZATION_MAY_CONSOLIDATE,
        message: 'Chỉ cơ quan chủ trì được lập báo cáo tổng hợp',
      });
    }
    this.assertSubtaskEditable(subtask);
    // Lead được lập báo cáo tổng hợp bất kể báo cáo phối hợp đã duyệt hết chưa.
    const workspace = await this.repository.findOrCreateWorkspace(
      reportingSubtaskId,
      ReportKind.CONSOLIDATED,
      subtask.task.leadOrganizationId,
    );
    if (!workspace) {
      throw new ConflictException({
        errorCode: ErrorCode.REPORTING_SUBTASK_OR_ASSIGNMENT_HAS_CHANGED,
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
    const workspace = await this.requireWorkspace(workspaceId, kind);
    this.assertReadScope(workspace, principal);
    return workspace;
  }

  async listSubtaskWorkspaces(
    reportingSubtaskId: number,
    principal: AccessTokenPayload,
  ) {
    const subtask = await this.requireSubtask(reportingSubtaskId);
    if (!canAccessTask(principal, subtask.task)) {
      throw new ForbiddenException(ErrorCode.REPORT_IS_OUTSIDE_YOUR_SCOPE);
    }
    return this.repository.listSubtaskWorkspaces(reportingSubtaskId);
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
        ? workspace.subtask.task.leadOrganizationId
        : workspace.subtask.task.assigningOrganizationId;
    await this.safeNotify({
      organizationIds: [destination],
      eventKey: `REPORT_SUBMITTED:${version.id}`,
      type: NotificationType.GUI_BAO_CAO,
      title: 'Báo cáo mới chờ duyệt',
      body: `${workspace.subtask.task.code} - ${workspace.subtask.task.name}`,
      entityType: 'Task',
      entityId: workspace.subtask.task.id,
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

  private async requireSubtask(id: number) {
    const subtask = await this.repository.findSubtaskContext(id);
    if (!subtask || subtask.task.deletedAt) {
      throw new NotFoundException('Reporting subtask not found');
    }
    return subtask;
  }

  private assertSubtaskEditable(
    subtask: Awaited<ReturnType<ReportsService['requireSubtask']>>,
  ) {
    if (
      subtask.status !== SubtaskStatus.OPEN ||
      subtask.task.completedAt !== null
    ) {
      throw new ConflictException('Reporting subtask is not editable');
    }
  }

  private assertDraftEditable(workspace: ReportWorkspaceView) {
    this.assertSubtaskEditable({
      id: workspace.subtask.id,
      status: workspace.subtask.status,
      task: workspace.subtask.task,
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
    const task = workspace.subtask.task;
    // Trách nhiệm theo nhiệm vụ: PROGRESS do đơn vị phối hợp (collaborator) nộp,
    // CONSOLIDATED do đơn vị chủ trì (lead) nộp. Không phải role tài khoản.
    const validResponsibility =
      workspace.kind === ReportKind.PROGRESS
        ? task.collaboratorOrganizationIds.includes(principal.organizationId)
        : task.leadOrganizationId === principal.organizationId;
    if (!validResponsibility)
      throw new ForbiddenException(ErrorCode.INVALID_TASK_RESPONSIBILITY);
  }

  private assertReadScope(
    workspace: ReportWorkspaceView,
    principal: AccessTokenPayload,
  ) {
    // Mọi đơn vị tham gia nhiệm vụ (giao/chủ trì/phối hợp) đều đọc được báo cáo.
    if (canAccessTask(principal, workspace.subtask.task)) return;
    throw new ForbiddenException(ErrorCode.REPORT_IS_OUTSIDE_YOUR_SCOPE);
  }

  private assertReviewer(
    workspace: ReportWorkspaceView,
    principal: AccessTokenPayload,
  ) {
    // Duyệt theo trách nhiệm nhiệm vụ: chủ trì duyệt tiến độ, cơ quan giao duyệt
    // tổng hợp; admin bỏ qua cả hai.
    if (principal.isAdmin) return;
    const task = workspace.subtask.task;
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
      workspace.subtask.status !== SubtaskStatus.OPEN ||
      workspace.subtask.task.deletedAt
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
    // Trả lại tổng hợp: duyệt đã đóng kỳ (COMPLETED), nên chấp nhận kỳ COMPLETED
    // cho tổng hợp — repository sẽ mở lại. Progress vẫn yêu cầu kỳ OPEN.
    const subtask = workspace.subtask;
    const subtaskOk =
      subtask.status === SubtaskStatus.OPEN ||
      (workspace.kind === ReportKind.CONSOLIDATED &&
        subtask.status === SubtaskStatus.COMPLETED);
    if (!subtaskOk || subtask.task.deletedAt || subtask.task.completedAt) {
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
        ? `${workspace.subtask.task.code} - ${reason}`
        : `${workspace.subtask.task.code} - ${workspace.subtask.task.name}`,
      entityType: 'Task',
      entityId: workspace.subtask.task.id,
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
