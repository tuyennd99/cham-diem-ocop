import { AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { DashboardService } from './dashboard.service';
import { FilesService } from './files.service';
import { HealthService } from './health.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { NotificationsService } from './notifications.service';
import { SubTasksService } from './subtask.service';
import { ReportsService } from './reports.service';
import { SystemService } from './system.service';
import { TasksService } from './tasks.service';

export const appServices = [
  AuditService,
  AuthService,
  DashboardService,
  FilesService,
  HealthService,
  NotificationsGateway,
  NotificationsService,
  SubTasksService,
  ReportsService,
  SystemService,
  TasksService,
];
