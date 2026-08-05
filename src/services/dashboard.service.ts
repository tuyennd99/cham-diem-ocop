import { Injectable } from '@nestjs/common';
import { SubtaskStatus, ReportStatus } from '@prisma/client';
import {
  DashboardRepository,
} from '../repositories/dashboard.repository';
import { AccessTokenPayload } from '../types/auth';
import type {
  DashboardFilters,
  DashboardStatus,
  DashboardStatusCounts,
  DashboardTaskRow,
} from '../types/dashboard';

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) { }

  async summary(
    filters: DashboardFilters,
    principal: AccessTokenPayload,
    now = new Date(),
  ) {
    const tasks = await this.repository.loadSummaryRows({
      filters,
      organizationId: principal.organizationId,
      globalScope: principal.isAdmin === true,
    });
    const taskStatusCounts = this.emptyStatusCounts();
    const subtaskStatusCounts = this.emptyStatusCounts();
    const typeCounts = { DINH_KY: 0, DOT_XUAT: 0 };
    let periodicSubtasks = 0;
    let subtaskTotal = 0;

    for (const task of tasks) {
      typeCounts[task.type] += 1;
      taskStatusCounts[this.taskStatus(task, now)] += 1;
      for (const subtask of task.subtasks) {
        subtaskTotal += 1;
        if (subtask.dueAt) periodicSubtasks += 1;
        subtaskStatusCounts[this.subtaskStatus(subtask, now)] += 1;
      }
    }

    return {
      totalTasks: tasks.length,
      taskCounts: {
        total: tasks.length,
        typeCounts,
        statusCounts: taskStatusCounts,
      },
      subtaskCounts: {
        total: subtaskTotal,
        periodic: periodicSubtasks,
        statusCounts: subtaskStatusCounts,
      },
    };
  }

  statistics(
    filters: DashboardFilters,
    principal: AccessTokenPayload,
    now = new Date(),
  ) {
    return this.summary(filters, principal, now);
  }

  private taskStatus(task: DashboardTaskRow, now: Date): DashboardStatus {
    if (task.completedAt || task.closedAt) return 'HOAN_THANH';
    const statuses = task.subtasks.map((subtask) =>
      this.subtaskStatus(subtask, now),
    );
    if (statuses.includes('DANG_CAP_NHAT')) return 'DANG_CAP_NHAT';
    if (statuses.includes('QUA_HAN')) return 'QUA_HAN';
    if (statuses.includes('SAP_DEN_HAN')) return 'SAP_DEN_HAN';
    return 'CHUA_HOAN_THANH';
  }

  private subtaskStatus(
    subtask: DashboardTaskRow['subtasks'][number],
    now: Date,
  ): DashboardStatus {
    if (subtask.status === SubtaskStatus.COMPLETED) return 'HOAN_THANH';
    if (subtask.reportStatus.includes(ReportStatus.SUBMITTED)) {
      return 'DANG_CAP_NHAT';
    }
    if (subtask.dueAt.getTime() < now.getTime()) return 'QUA_HAN';
    if (subtask.dueAt.getTime() <= now.getTime() + 5 * 86_400_000) {
      return 'SAP_DEN_HAN';
    }
    return 'CHUA_HOAN_THANH';
  }

  private emptyStatusCounts(): DashboardStatusCounts {
    return {
      HOAN_THANH: 0,
      DANG_CAP_NHAT: 0,
      QUA_HAN: 0,
      SAP_DEN_HAN: 0,
      CHUA_HOAN_THANH: 0,
    };
  }
}
