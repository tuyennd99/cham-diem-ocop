import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Frequency, PeriodStatus } from '@prisma/client';
import type { PeriodDraft } from '../constants/task';
import { TasksRepository } from '../repositories/tasks.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import { buildPeriod } from '../utils/periods';
import { ErrorCode } from '../types/error-code';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ReportingPeriodsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ReportingPeriodsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly repository: TasksRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.DISABLE_SCHEDULER === 'true') return;
    await this.handleDailyGeneration(new Date());
    this.scheduleNextRun();
  }

  onApplicationShutdown() {
    if (this.timer) clearTimeout(this.timer);
  }

  async ensurePeriods(now = new Date()) {
    const tasks = await this.repository.listPeriodicTasksForGeneration();
    let created = 0;
    for (const task of tasks) {
      if (!task.frequency || !task.periodicStartAt) continue;
      const periods = this.periodsThrough(
        task.frequency,
        task.periodicStartAt,
        now,
      );
      const createdForTask = await this.repository.createReportingPeriods(
        task.id,
        periods,
      );
      created += createdForTask;
      if (createdForTask === 0) continue;
      for (const period of periods) {
        await this.safeNotify(
          {
            organizationIds: [
              task.leadOrganizationId,
              ...task.collaborators.map(({ organizationId }) => organizationId),
            ],
            eventKey: `REPORTING_PERIOD_OPENED:${task.id}:${period.year}:${period.sequence}`,
            type: 'MO_KY_BAO_CAO',
            title: 'Kỳ báo cáo mới được mở',
            body: `${task.code} - ${task.name}`,
            entityType: 'Task',
            entityId: task.id,
          },
          'reporting-period generation',
        );
      }
    }
    return created;
  }

  async list(taskId: number, principal: AccessTokenPayload) {
    const task = await this.repository.findById(
      taskId,
      principal.organizationId,
      principal.isAdmin === true,
    );
    if (!task) throw new NotFoundException('Task not found');
    return this.repository.listReportingPeriods(taskId);
  }

  async cancel(
    periodId: number,
    reason: string,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    const period = await this.repository.findReportingPeriod(periodId);
    if (!period) throw new NotFoundException('Reporting period not found');
    const task = await this.repository.findById(
      period.taskId,
      principal.organizationId,
      principal.isAdmin === true,
    );
    if (!task) throw new NotFoundException('Reporting period not found');
    if (
      principal.isAdmin !== true &&
      task.assigningOrganizationId !== principal.organizationId
    ) {
      throw new ForbiddenException(
        ErrorCode.TASK_CAN_ONLY_BE_ASSIGNED_BY_THE_CURRENT_ORGANIZATION,
      );
    }
    if (period.status !== PeriodStatus.OPEN) {
      throw new ConflictException(
        'Only open reporting periods can be canceled',
      );
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new ConflictException('Cancellation reason is required');
    }
    const canceled = await this.repository.cancelReportingPeriod(
      periodId,
      trimmedReason,
      new Date(),
      principal.sub,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!canceled) {
      throw new ConflictException('Reporting period could not be canceled');
    }
    return canceled;
  }

  // Called daily by the scheduler integration registered in AppModule.
  async handleDailyGeneration(now = new Date()) {
    const created = await this.ensurePeriods(now);
    try {
      await this.notificationsService.generateDailyDeadlineNotifications(now);
    } catch (error) {
      this.logger.error('Deadline notification generation failed', error);
    }
    return created;
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
      this.logger.error('Reporting period generation failed', error);
    } finally {
      this.scheduleNextRun();
    }
  }

  private periodsThrough(
    frequency: Frequency,
    startAt: Date,
    now: Date,
  ): PeriodDraft[] {
    const periods: PeriodDraft[] = [];
    let anchor = startAt;
    for (;;) {
      const period = buildPeriod(frequency, anchor);
      if (period.periodStartAt > now) break;
      periods.push({ frequency, ...period });
      anchor = new Date(period.dueAt.getTime() + 1);
    }
    return periods;
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
}
