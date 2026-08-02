import { NotFoundException } from '@nestjs/common';
import type { NotificationsRepository } from '../repositories/notifications.repository';
import type { NotificationsGateway } from '../gateways/notifications.gateway';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let repository: jest.Mocked<
    Pick<
      NotificationsRepository,
      | 'list'
      | 'markRead'
      | 'markAllRead'
      | 'createForActiveUsers'
      | 'findDeadlineTargets'
    >
  >;
  let service: NotificationsService;

  beforeEach(() => {
    repository = {
      list: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      createForActiveUsers: jest.fn(),
      findDeadlineTargets: jest.fn(),
    };
    service = new NotificationsService(
      repository as NotificationsRepository,
      { notifyOrganizations: jest.fn() } as unknown as NotificationsGateway,
    );
  });

  it('creates an event for every ACTIVE user in the destination organization', async () => {
    repository.createForActiveUsers.mockResolvedValue(3);

    const count = await service.createForOrganization({
      organizationId: 12,
      eventKey: 'TASK_ASSIGNED:44',
      type: 'GIAO',
      title: 'Nhiệm vụ mới',
      body: 'NV-44',
      entityType: 'Task',
      entityId: 44,
    });

    expect(count).toBe(3);
    expect(repository.createForActiveUsers).toHaveBeenCalledWith({
      organizationIds: [12],
      eventKey: 'TASK_ASSIGNED:44',
      type: 'GIAO',
      title: 'Nhiệm vụ mới',
      body: 'NV-44',
      entityType: 'Task',
      entityId: 44,
    });
  });

  it('uses stable event keys for one-time near-due and overdue generation', async () => {
    const now = new Date('2026-07-24T00:00:00.000Z');
    repository.findDeadlineTargets.mockResolvedValue([
      {
        periodId: 10,
        taskId: 1,
        taskCode: 'NV-1',
        taskName: 'Sắp đến hạn',
        dueAt: new Date('2026-07-29T00:00:00.000Z'),
        organizationIds: [2, 3, 3],
      },
      {
        periodId: 11,
        taskId: 2,
        taskCode: 'NV-2',
        taskName: 'Quá hạn',
        dueAt: new Date('2026-07-23T23:59:59.999Z'),
        organizationIds: [4],
      },
    ]);
    repository.createForActiveUsers
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    const result = await service.generateDailyDeadlineNotifications(now);

    expect(result).toEqual({ targets: 2, created: 3 });
    expect(repository.findDeadlineTargets).toHaveBeenCalledWith(
      now,
      new Date('2026-07-29T00:00:00.000Z'),
    );
    expect(repository.createForActiveUsers).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        organizationIds: [2, 3],
        eventKey: 'REPORTING_PERIOD_DUE_SOON:10',
        type: 'SAP_DEN_HAN',
      }),
    );
    expect(repository.createForActiveUsers).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        organizationIds: [4],
        eventKey: 'REPORTING_PERIOD_OVERDUE:11',
        type: 'QUA_HAN',
      }),
    );
  });

  it('only marks a notification owned by the current user', async () => {
    repository.markRead.mockResolvedValue(false);

    await expect(service.markRead(99, 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.markRead).toHaveBeenCalledWith(99, 7, expect.any(Date));
  });
});
