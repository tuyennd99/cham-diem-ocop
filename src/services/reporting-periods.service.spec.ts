import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TasksRepository } from '../repositories/tasks.repository';
import { NotificationsService } from './notifications.service';
import { ReportingPeriodsService } from './reporting-periods.service';

const principal = {
  sub: 1,
  username: 'thuongtruc',
  organizationId: 10,
  permissions: ['tasks.read', 'tasks.close', 'tasks.assign'],
  isStaff: true,
};

function repositoryMock() {
  const seen = new Set<string>();
  return {
    listPeriodicTasksForGeneration: jest.fn().mockResolvedValue([
      {
        id: 1,
        code: 'NV-001',
        name: 'Nhiệm vụ định kỳ',
        frequency: 'MONTHLY',
        periodicStartAt: new Date('2026-05-15T00:00:00+07:00'),
        leadOrganizationId: 20,
        collaborators: [{ organizationId: 30 }],
      },
    ]),
    createReportingPeriods: jest.fn(
      (taskId: number, periods: { periodStartAt: Date; dueAt: Date }[]) => {
        let count = 0;
        for (const period of periods) {
          const key = `${taskId}:${period.periodStartAt.toISOString()}:${period.dueAt.toISOString()}`;
          if (!seen.has(key)) {
            seen.add(key);
            count += 1;
          }
        }
        return Promise.resolve(count);
      },
    ),
    findById: jest.fn().mockResolvedValue({ id: 1 }),
    listReportingPeriods: jest.fn().mockResolvedValue([]),
    findReportingPeriod: jest.fn().mockResolvedValue({
      id: 5,
      taskId: 1,
      status: 'OPEN',
      task: { id: 1 },
    }),
    cancelReportingPeriod: jest
      .fn()
      .mockResolvedValue({ id: 5, status: 'CANCELED' }),
  };
}

function notificationsMock() {
  return {
    createForOrganizations: jest.fn().mockResolvedValue(0),
    generateDailyDeadlineNotifications: jest.fn().mockResolvedValue({
      targets: 0,
      created: 0,
    }),
  };
}

describe('ReportingPeriodsService', () => {
  it('generates reached periods idempotently with buildPeriod', async () => {
    const repository = repositoryMock();
    const service = new ReportingPeriodsService(
      repository as unknown as TasksRepository,
      notificationsMock() as unknown as NotificationsService,
    );
    const now = new Date('2026-07-15T00:00:00+07:00');

    await expect(service.ensurePeriods(now)).resolves.toBe(3);
    await expect(service.ensurePeriods(now)).resolves.toBe(0);
    expect(repository.createReportingPeriods).toHaveBeenCalledTimes(2);
  });

  it('requires tasks.read to list periods', async () => {
    const repository = repositoryMock();
    const service = new ReportingPeriodsService(
      repository as unknown as TasksRepository,
      notificationsMock() as unknown as NotificationsService,
    );

    await expect(
      service.list(1, { ...principal, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancels only an open period', async () => {
    const repository = repositoryMock();
    const service = new ReportingPeriodsService(
      repository as unknown as TasksRepository,
      notificationsMock() as unknown as NotificationsService,
    );

    await service.cancel(5, 'Không còn yêu cầu báo cáo', principal);
    expect(repository.cancelReportingPeriod).toHaveBeenCalledWith(
      5,
      'Không còn yêu cầu báo cáo',
      expect.any(Date),
      principal.sub,
      { organizationId: principal.organizationId },
    );

    repository.findReportingPeriod.mockResolvedValue({
      id: 5,
      taskId: 1,
      status: 'COMPLETED',
      task: { id: 1 },
    });
    await expect(
      service.cancel(5, 'Không còn yêu cầu báo cáo', principal),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not let a custom tasks.close group cancel a reporting period', async () => {
    const service = new ReportingPeriodsService(
      repositoryMock() as unknown as TasksRepository,
      notificationsMock() as unknown as NotificationsService,
    );

    await expect(
      service.cancel(5, 'Không còn yêu cầu', {
        ...principal,
        isStaff: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses the same daily timestamp for period and notification generation', async () => {
    const repository = repositoryMock();
    const notifications = notificationsMock();
    const service = new ReportingPeriodsService(
      repository as unknown as TasksRepository,
      notifications as unknown as NotificationsService,
    );
    const now = new Date('2026-07-15T00:05:00+07:00');

    await service.handleDailyGeneration(now);

    expect(
      notifications.generateDailyDeadlineNotifications,
    ).toHaveBeenCalledWith(now);
    expect(notifications.createForOrganizations).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationIds: [20, 30],
        eventKey: expect.stringMatching(
          /^REPORTING_PERIOD_OPENED:1:/,
        ) as string,
      }),
    );
  });
});
