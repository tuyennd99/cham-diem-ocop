import { AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { DashboardService } from './dashboard.service';
import { FilesService } from './files.service';
import { HealthService } from './health.service';
import { ImagesService } from './images.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { NotificationsService } from './notifications.service';
import { ReportsService } from './reports.service';
import { SystemService } from './system.service';
import { TasksService } from './tasks.service';

export const appServices = [
  AuditService,
  AuthService,
  DashboardService,
  FilesService,
  HealthService,
  ImagesService,
  NotificationsGateway,
  NotificationsService,
  ReportsService,
  SystemService,
  TasksService,
];
