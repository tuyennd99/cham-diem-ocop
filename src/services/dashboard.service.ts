import { ForbiddenException, Injectable } from '@nestjs/common';
import { PeriodStatus, ReportStatus } from '@prisma/client';
import {
  DashboardFilters,
  DashboardRepository,
  DashboardTaskRow,
} from '../repositories/dashboard.repository';
import { AccessTokenPayload } from '../types/auth';
import type {
  DashboardStatus,
  DashboardStatusCounts,
} from '../types/dashboard';

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) { }

  async summary(
    filters: DashboardFilters,
    principal: AccessTokenPayload,
    now = new Date(),
  ) {
    this.assertPermission(principal);
    const tasks = await this.repository.loadSummaryRows({
      filters,
      organizationId: principal.organizationId,
      globalScope: principal.isAdmin === true || principal.isStaff === true,
    });
    const taskStatusCounts = this.emptyStatusCounts();
    const periodStatusCounts = this.emptyStatusCounts();
    const typeCounts = { DINH_KY: 0, DOT_XUAT: 0 };
    let periodicPeriods = 0;
    let periodTotal = 0;

    for (const task of tasks) {
      typeCounts[task.type] += 1;
      taskStatusCounts[this.taskStatus(task, now)] += 1;
      for (const period of task.periods) {
        periodTotal += 1;
        if (period.frequency) periodicPeriods += 1;
        periodStatusCounts[this.periodStatus(period, now)] += 1;
      }
    }

    return {
      totalTasks: tasks.length,
      taskCounts: {
        total: tasks.length,
        typeCounts,
        statusCounts: taskStatusCounts,
      },
      periodCounts: {
        total: periodTotal,
        periodic: periodicPeriods,
        statusCounts: periodStatusCounts,
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
    const statuses = task.periods.map((period) =>
      this.periodStatus(period, now),
    );
    if (statuses.includes('DANG_CAP_NHAT')) return 'DANG_CAP_NHAT';
    if (statuses.includes('QUA_HAN')) return 'QUA_HAN';
    if (statuses.includes('SAP_DEN_HAN')) return 'SAP_DEN_HAN';
    return 'CHUA_HOAN_THANH';
  }

  private periodStatus(
    period: DashboardTaskRow['periods'][number],
    now: Date,
  ): DashboardStatus {
    if (period.status === PeriodStatus.COMPLETED) return 'HOAN_THANH';
    if (period.workspaceStatuses.includes(ReportStatus.SUBMITTED)) {
      return 'DANG_CAP_NHAT';
    }
    if (period.dueAt.getTime() < now.getTime()) return 'QUA_HAN';
    if (period.dueAt.getTime() <= now.getTime() + 5 * 86_400_000) {
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

  private assertPermission(principal: AccessTokenPayload) {
    if (
      !principal.isAdmin &&
      !principal.permissions.includes('dashboard.read')
    ) {
      throw new ForbiddenException('dashboard.read is required');
    }
  }
}
