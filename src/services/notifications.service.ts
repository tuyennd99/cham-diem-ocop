import { Injectable, NotFoundException } from '@nestjs/common';
import { uniq } from 'lodash';
import { NotificationsRepository } from '../repositories/notifications.repository';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import type {
  NotificationWrite,
  OrganizationNotification,
} from '../types/notifications';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository,
    private readonly gateway: NotificationsGateway,
  ) { }

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

  async createForOrganization(input: OrganizationNotification) {
    const { organizationId, ...notification } = input;
    const created = await this.repository.createForActiveUsers({
      organizationIds: [organizationId],
      ...notification,
    });
    if (created > 0) this.gateway.notifyOrganizations([organizationId]);
    return created;
  }

  async createForOrganizations(input: NotificationWrite) {
    const organizationIds = uniq(input.organizationIds);
    const created = await this.repository.createForActiveUsers({
      ...input,
      organizationIds,
    });
    if (created > 0) this.gateway.notifyOrganizations(organizationIds);
    return created;
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
          ? `REPORTING_SUBTASK_OVERDUE:${target.subtaskId}`
          : `REPORTING_SUBTASK_DUE_SOON:${target.subtaskId}`,
        type: overdue ? 'QUA_HAN' : 'SAP_DEN_HAN',
        title: overdue ? 'Nhiệm vụ đã quá hạn' : 'Nhiệm vụ sắp đến hạn',
        body: `${target.taskCode} - ${target.taskName}`,
        entityType: 'Task',
        entityId: target.taskId,
      });
    }
    return { targets: targets.length, created };
  }
}
