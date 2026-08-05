import { AuditLogsController } from './audit-logs.controller';
import { AuthController } from './auth.controller';
import { ConsolidatedReportsController } from './consolidated-reports.controller';
import { DashboardController } from './dashboard.controller';
import { HealthController } from './health.controller';
import { NotificationsController } from './notifications.controller';
import { ProgressReportsController } from './progress-reports.controller';
import { ReportHistoryController } from './report-history.controller';
import { SubTasksController } from './subtask.controller';
import { SystemController } from './system.controller';
import { TasksController } from './tasks.controller';

export const appControllers = [
  AuditLogsController,
  AuthController,
  ConsolidatedReportsController,
  DashboardController,
  HealthController,
  NotificationsController,
  ProgressReportsController,
  ReportHistoryController,
  SystemController,
  SubTasksController,
  TasksController,
];
