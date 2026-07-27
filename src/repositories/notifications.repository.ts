import { Injectable } from '@nestjs/common';
import { PeriodStatus, UserStatus } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationWrite {
  organizationIds: number[];
  eventKey: string;
  type: string;
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

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: {
    recipientId: number;
    page: number;
    limit: number;
    unreadOnly: boolean;
  }) {
    const where = {
      recipientId: input.recipientId,
      ...(input.unreadOnly ? { readAt: null } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { data, total };
  }

  async markRead(id: number, recipientId: number, readAt: Date) {
    const result = await this.prisma.notification.updateMany({
      where: { id, recipientId, readAt: null },
      data: { readAt },
    });
    if (result.count === 1) return true;
    return (
      (await this.prisma.notification.count({
        where: { id, recipientId },
      })) === 1
    );
  }

  async markAllRead(recipientId: number, readAt: Date) {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId, readAt: null },
      data: { readAt },
    });
    return result.count;
  }

  async createForActiveUsers(input: NotificationWrite) {
    const organizationIds = [...new Set(input.organizationIds)];
    if (organizationIds.length === 0) return 0;
    const recipients = await this.prisma.user.findMany({
      where: {
        organizationId: { in: organizationIds },
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (recipients.length === 0) return 0;
    const result = await this.prisma.notification.createMany({
      data: recipients.map(({ id }) => ({
        recipientId: id,
        eventKey: input.eventKey,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async findDeadlineTargets(
    now: Date,
    dueSoonThrough: Date,
  ): Promise<DeadlineNotificationTarget[]> {
    const periods = await this.prisma.reportingPeriod.findMany({
      where: {
        status: PeriodStatus.OPEN,
        dueAt: { lte: dueSoonThrough },
        task: { deletedAt: null, closedAt: null },
      },
      select: {
        id: true,
        dueAt: true,
        task: {
          select: {
            id: true,
            code: true,
            name: true,
            leadOrganizationId: true,
            collaborators: { select: { organizationId: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    void now;
    return periods.map(({ id, dueAt, task }) => ({
      periodId: id,
      taskId: task.id,
      taskCode: task.code,
      taskName: task.name,
      dueAt,
      organizationIds: [
        task.leadOrganizationId,
        ...task.collaborators.map(({ organizationId }) => organizationId),
      ],
    }));
  }
}
