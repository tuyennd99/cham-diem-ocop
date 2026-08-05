import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { SubtaskStatus } from '@prisma/client';
import { TasksRepository } from '../repositories/tasks.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import { ErrorCode } from '../types/error-code';
import { NotificationsService } from './notifications.service';
import dayjs from 'dayjs';

// Chủ trì hoặc đơn vị giao được quản lý nhiệm vụ con (admin check riêng ở caller).
function canManageSubtasks(
  task: { leadOrganizationId: number; assigningOrganizationId: number },
  principal: AccessTokenPayload,
): boolean {
  return (
    principal.organizationId === task.leadOrganizationId ||
    principal.organizationId === task.assigningOrganizationId
  );
}

@Injectable()
export class SubTasksService
  implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SubTasksService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly repository: TasksRepository,
    private readonly notificationsService: NotificationsService,
  ) { }

  async onApplicationBootstrap() {
    if (process.env.DISABLE_SCHEDULER === 'true') return;
    await this.handleDailyGeneration(new Date());
    this.scheduleNextRun();
  }

  onApplicationShutdown() {
    if (this.timer) clearTimeout(this.timer);
  }

  async list(taskId: number, principal: AccessTokenPayload) {
    const task = await this.repository.findById(
      taskId,
      principal.organizationId,
      principal.isAdmin === true,
    );
    if (!task) throw new NotFoundException('Task not found');
    return this.repository.listSubTasks(taskId);
  }

  async create(
    taskId: number,
    input: { title: string; description?: string; startAt: string; dueAt: string },
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    const task = await this.repository.findById(
      taskId,
      principal.organizationId,
      principal.isAdmin === true,
    );
    if (!task) throw new NotFoundException('Task not found');
    if (principal.isAdmin !== true && !canManageSubtasks(task, principal)) {
      throw new ForbiddenException(
        ErrorCode.TASK_CAN_ONLY_BE_ASSIGNED_BY_THE_CURRENT_ORGANIZATION,
      );
    }
    if (task.closedAt || task.deletedAt) {
      throw new ConflictException(
        'Không thể tạo nhiệm vụ con cho nhiệm vụ đã đóng hoặc đã xóa',
      );
    }
    const startAt = new Date(input.startAt);
    const dueAt = new Date(input.dueAt);
    if (dueAt <= startAt) {
      throw new BadRequestException('Hạn nộp phải sau ngày bắt đầu');
    }
    // unique [taskId, name] chặn trùng tên nhiệm vụ con trong cùng nhiệm vụ chính.
    const subtask = await this.repository.createSubTask(taskId, {
      dueAt,
      title: input.title,
      description: input.description,
      startAt,
      createdById: principal.sub,
      createdByOrganizationId: principal.organizationId,
    });
    // ponytail: không audit-log tạo kỳ thủ công — auto-gen cũ cũng không audit.
    await this.safeNotify(
      {
        organizationIds: [
          task.leadOrganizationId,
          ...task.collaboratorOrganizationIds,
        ],
        eventKey: `SUBTASK_OPENED:${task.id}:${subtask.id}`,
        type: 'MO_KY_BAO_CAO',
        title: 'Kỳ báo cáo mới được mở',
        body: `${task.code} - ${task.name}`,
        entityType: 'Task',
        entityId: task.id,
      },
      'manual reporting-subtask creation',
    );
    return subtask;
  }

  private async safeNotify(
    input: Parameters<NotificationsService['createForOrganizations']>[0],
    context: string,
  ) {
    try {
      await this.notificationsService.createForOrganizations(input);
    } catch (error) {
      this.logger.error(`Notification failed during ${context}`, error);
    }
  }

  async cancel(
    subtaskId: number,
    reason: string,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    const subtask = await this.repository.findSubTask(subtaskId);
    if (!subtask) throw new NotFoundException('Reporting subtask not found');
    const task = await this.repository.findById(
      subtask.taskId,
      principal.organizationId,
      principal.isAdmin === true,
    );
    if (!task) throw new NotFoundException('Reporting subtask not found');
    if (principal.isAdmin !== true && !canManageSubtasks(task, principal)) {
      throw new ForbiddenException(
        ErrorCode.TASK_CAN_ONLY_BE_ASSIGNED_BY_THE_CURRENT_ORGANIZATION,
      );
    }
    if (subtask.status !== SubtaskStatus.OPEN) {
      throw new ConflictException(
        'Only open reporting subtasks can be canceled',
      );
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new ConflictException('Cancellation reason is required');
    }
    const canceled = await this.repository.cancelSubTask(
      subtaskId,
      trimmedReason,
      new Date(),
      principal.sub,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!canceled) {
      throw new ConflictException('Reporting subtask could not be canceled');
    }
    return canceled;
  }

  // Called daily by the scheduler integration registered in AppModule.
  async handleDailyGeneration(now = new Date()) {
    try {
      await this.notificationsService.generateDailyDeadlineNotifications(now);
    } catch (error) {
      this.logger.error('Deadline notification generation failed', error);
    }
  }

  private scheduleNextRun() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(0, 5, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    this.timer = setTimeout(
      () => void this.runScheduled(),
      next.getTime() - now.getTime(),
    );
    this.timer.unref();
  }

  private async runScheduled() {
    try {
      await this.handleDailyGeneration();
    } catch (error) {
      this.logger.error('Reporting subtask generation failed', error);
    } finally {
      this.scheduleNextRun();
    }
  }
}
