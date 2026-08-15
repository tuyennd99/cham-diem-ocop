import { Injectable } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { AccessTokenPayload } from '../types/auth';
import type {
  DashboardFilters,
  DashboardStatus,
  DashboardStatusCounts,
  DashboardTaskRow,
} from '../types/dashboard';

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async summary(
    filters: DashboardFilters,
    principal: AccessTokenPayload,
    now = new Date(),
  ) {
    const tasks = await this.repository.loadSummaryRows({
      filters,
      organizationId: principal.organizationId,
      userId: principal.sub,
      globalScope: principal.isAdmin === true,
    });
    const taskStatusCounts = this.emptyStatusCounts();
    const legacyDetailStatusCounts = this.emptyStatusCounts();
    const typeCounts = { DINH_KY: 0, DOT_XUAT: 0 };
    let periodicRows = 0;
    let rowTotal = 0;

    for (const task of tasks) {
      typeCounts[task.type] += 1;
      taskStatusCounts[this.taskStatus(task, now)] += 1;
      rowTotal += 1;
      if (task.dueAt) periodicRows += 1;
      legacyDetailStatusCounts[this.taskStatus(task, now)] += 1;
    }

    return {
      totalTasks: tasks.length,
      taskCounts: {
        total: tasks.length,
        typeCounts,
        statusCounts: taskStatusCounts,
      },
      subtaskCounts: {
        total: rowTotal,
        periodic: periodicRows,
        statusCounts: legacyDetailStatusCounts,
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
    if (task.reportStatus.includes(ReportStatus.SUBMITTED)) {
      return 'DANG_CAP_NHAT';
    }
    if (!task.dueAt) return 'CHUA_HOAN_THANH';
    if (task.dueAt.getTime() < now.getTime()) return 'QUA_HAN';
    if (task.dueAt.getTime() <= now.getTime() + 5 * 86_400_000) {
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
