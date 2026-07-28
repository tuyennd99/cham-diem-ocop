import { Injectable, NotFoundException } from '@nestjs/common';
import { uniq } from 'lodash';
import { NotificationsRepository } from '../repositories/notifications.repository';
import type {
  NotificationWrite,
  OrganizationNotification,
} from '../types/notifications';

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  async list(
    recipientId: number,
    query: { page: number; limit: number; unreadOnly: boolean },
  ) {
    const { data, total } = await this.repository.list({
      recipientId,
      ...query,
    });
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async markRead(id: number, recipientId: number) {
    if (!(await this.repository.markRead(id, recipientId, new Date()))) {
      throw new NotFoundException('Notification not found');
    }
    return { success: true };
  }

  async markAllRead(recipientId: number) {
    return {
      updated: await this.repository.markAllRead(recipientId, new Date()),
    };
  }

  createForOrganization(input: OrganizationNotification) {
    const { organizationId, ...notification } = input;
    return this.repository.createForActiveUsers({
      organizationIds: [organizationId],
      ...notification,
    });
  }

  createForOrganizations(input: NotificationWrite) {
    return this.repository.createForActiveUsers({
      ...input,
      organizationIds: uniq(input.organizationIds),
    });
  }

  async generateDailyDeadlineNotifications(now = new Date()) {
    const dueSoonThrough = new Date(now.getTime() + 5 * 86_400_000);
    const targets = await this.repository.findDeadlineTargets(
      now,
      dueSoonThrough,
    );
    let created = 0;
    for (const target of targets) {
      const overdue = target.dueAt.getTime() < now.getTime();
      created += await this.createForOrganizations({
        organizationIds: target.organizationIds,
        eventKey: overdue
          ? `REPORTING_PERIOD_OVERDUE:${target.periodId}`
          : `REPORTING_PERIOD_DUE_SOON:${target.periodId}`,
        type: overdue ? 'QUA_HAN' : 'SAP_DEN_HAN',
        title: overdue ? 'Nhiệm vụ đã quá hạn' : 'Nhiệm vụ sắp đến hạn',
        body: `${target.taskCode} - ${target.taskName}`,
        entityType: 'ReportingPeriod',
        entityId: target.periodId,
      });
    }
    return { targets: targets.length, created };
  }
}
