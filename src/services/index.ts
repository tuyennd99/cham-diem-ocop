import { AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { DashboardService } from './dashboard.service';
import { FilesService } from './files.service';
import { HealthService } from './health.service';
import { NotificationsService } from './notifications.service';
import { ReportingPeriodsService } from './reporting-periods.service';
import { ReportsService } from './reports.service';
import { SystemService } from './system.service';
import { TasksService } from './tasks.service';

export const appServices = [
  AuditService,
  AuthService,
  DashboardService,
  FilesService,
  HealthService,
  NotificationsService,
  ReportingPeriodsService,
  ReportsService,
  SystemService,
  TasksService,
];
