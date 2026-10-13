import { AuditRepository } from './audit.repository';
import { AuthRepository } from './auth.repository';
import { DashboardRepository } from './dashboard.repository';
import { FilesRepository } from './files.repository';
import { NotificationsRepository } from './notifications.repository';
import { ReportsRepository } from './reports.repository';
import { SystemRepository } from './system.repository';
import { TasksRepository } from './tasks.repository';

export const appRepositories = [
  AuditRepository,
  AuthRepository,
  DashboardRepository,
  FilesRepository,
  NotificationsRepository,
  ReportsRepository,
  SystemRepository,
  TasksRepository,
];
