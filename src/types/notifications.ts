import { NotificationType } from '@prisma/client';

export interface NotificationWrite {
  organizationIds: number[];
  eventKey: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: number | null;
}

export interface DeadlineNotificationTarget {
  periodId: number;
  taskId: number;
  taskCode: string;
  taskName: string;
  dueAt: Date;
  organizationIds: number[];
}

export interface OrganizationNotification extends Omit<
  NotificationWrite,
  'organizationIds'
> {
  organizationId: number;
}
