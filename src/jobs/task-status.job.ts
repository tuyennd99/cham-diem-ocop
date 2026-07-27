import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TaskType } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateTaskDeadlineStatus } from '../utils/task-deadline-status';

export { calculateTaskDeadlineStatus } from '../utils/task-deadline-status';

@Injectable()
export class TaskStatusJob {
  private readonly logger = new Logger(TaskStatusJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    disabled: process.env.DISABLE_SCHEDULER === 'true',
    waitForCompletion: true,
  })
  async handleTaskStatus() {
    try {
      const updated = await this.refreshTaskStatuses();
      if (updated > 0) {
        this.logger.log(`Updated deadline status for ${updated} task(s)`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to update task deadline statuses',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async refreshTaskStatuses(now = new Date()) {
    const tasks = await this.prisma.task.findMany({
      where: {
        type: TaskType.DOT_XUAT,
        deletedAt: null,
        dueAt: { not: null },
      },
      select: {
        id: true,
        dueAt: true,
        completedAt: true,
        deadlineStatus: true,
      },
    });

    const updates = tasks.flatMap((task) => {
      if (!task.dueAt) return [];
      const deadlineStatus = calculateTaskDeadlineStatus(
        { dueAt: task.dueAt, completedAt: task.completedAt },
        now,
      );
      return deadlineStatus === task.deadlineStatus
        ? []
        : [
            this.prisma.task.update({
              where: { id: task.id },
              data: { deadlineStatus },
            }),
          ];
    });

    if (updates.length > 0) {
      await this.prisma.$transaction(updates);
    }
    return updates.length;
  }
}
