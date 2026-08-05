import { ConflictException } from '@nestjs/common';
import { TasksRepository } from '../repositories/tasks.repository';
import { NotificationsService } from './notifications.service';
import { SubTasksService } from './subtask.service';

const principal = {
  sub: 1,
  username: 'manager',
  organizationId: 10,
  permissions: ['tasks.read', 'tasks.close', 'tasks.assign'],
};

function repositoryMock() {
  return {
    findById: jest.fn().mockResolvedValue({
      id: 1,
      code: 'NV-001',
      name: 'Nhiệm vụ',
      assigningOrganizationId: 10,
      leadOrganizationId: 20,
      collaboratorOrganizationIds: [30],
      frequency: 'MONTHLY',
      closedAt: null,
      deletedAt: null,
      subtasks: [],
    }),
    listSubTasks: jest.fn().mockResolvedValue([]),
    findSubTask: jest.fn().mockResolvedValue({
      id: 5,
      taskId: 1,
      status: 'OPEN',
      task: { id: 1 },
    }),
    cancelSubTask: jest
      .fn()
      .mockResolvedValue({ id: 5, status: 'CANCELED' }),
    createSubTask: jest
      .fn()
      .mockResolvedValue({ id: 7, taskId: 1, year: 2026, sequence: 1 }),
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

describe('SubTasksService', () => {
  it('uses admin global scope to list subtasks', async () => {
    const repository = repositoryMock();
    const service = new SubTasksService(
      repository as unknown as TasksRepository,
      notificationsMock() as unknown as NotificationsService,
    );

    await service.list(1, { ...principal, isAdmin: true });

    expect(repository.findById).toHaveBeenCalledWith(1, 10, true);
  });

  it('uses admin global scope to cancel subtasks', async () => {
    const repository = repositoryMock();
    const service = new SubTasksService(
      repository as unknown as TasksRepository,
      notificationsMock() as unknown as NotificationsService,
    );

    await service.cancel(5, 'Không còn áp dụng', {
      ...principal,
      isAdmin: true,
    });

    expect(repository.findById).toHaveBeenCalledWith(1, 10, true);
  });

  it('rejects reporting-subtask cancel from a related non-assigning organization', async () => {
    const repository = repositoryMock();
    repository.findById.mockResolvedValue({ id: 1, assigningOrganizationId: 10 });
    const service = new SubTasksService(
      repository as unknown as TasksRepository,
      notificationsMock() as unknown as NotificationsService,
    );

    await expect(
      service.cancel(5, 'Không còn áp dụng', {
        ...principal,
        isAdmin: false,
        organizationId: 20,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('cancels only an open subtask', async () => {
    const repository = repositoryMock();
    const service = new SubTasksService(
      repository as unknown as TasksRepository,
      notificationsMock() as unknown as NotificationsService,
    );

    await service.cancel(5, 'Không còn yêu cầu báo cáo', principal);
    expect(repository.cancelSubTask).toHaveBeenCalledWith(
      5,
      'Không còn yêu cầu báo cáo',
      expect.any(Date),
      principal.sub,
      { organizationId: principal.organizationId },
    );

    repository.findSubTask.mockResolvedValue({
      id: 5,
      taskId: 1,
      status: 'COMPLETED',
      task: { id: 1 },
    });
    await expect(
      service.cancel(5, 'Không còn yêu cầu báo cáo', principal),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets tasks.close cancel an in-scope reporting subtask', async () => {
    const repository = repositoryMock();
    repository.cancelSubTask.mockResolvedValue({
      id: 9,
      status: 'CANCELED',
    });
    const service = new SubTasksService(
      repository as unknown as TasksRepository,
      notificationsMock() as unknown as NotificationsService,
    );

    await expect(
      service.cancel(9, 'Không còn áp dụng', {
        ...principal,
        isAdmin: false,
      }),
    ).resolves.toMatchObject({ id: 9, status: 'CANCELED' });
  });

  it('runs only deadline notifications during daily generation', async () => {
    const repository = repositoryMock();
    const notifications = notificationsMock();
    const service = new SubTasksService(
      repository as unknown as TasksRepository,
      notifications as unknown as NotificationsService,
    );
    const now = new Date('2026-07-15T00:05:00+07:00');

    await service.handleDailyGeneration(now);

    expect(
      notifications.generateDailyDeadlineNotifications,
    ).toHaveBeenCalledWith(now);
    expect(notifications.createForOrganizations).not.toHaveBeenCalled();
  });

  describe('create', () => {
    it('creates a manual subtask and notifies reporters', async () => {
      const repository = repositoryMock();
      const notifications = notificationsMock();
      const service = new SubTasksService(
        repository as unknown as TasksRepository,
        notifications as unknown as NotificationsService,
      );

      await service.create(
        1,
        {
          startAt: '2026-08-15T00:00:00+07:00',
          dueAt: '2026-09-14T23:59:59+07:00',
        },
        { ...principal, isAdmin: false },
      );

      expect(repository.createSubTask).toHaveBeenCalledWith(1, {
        frequency: 'MONTHLY',
        year: 2026,
        sequence: 1,
        startAt: new Date('2026-08-15T00:00:00+07:00'),
        dueAt: new Date('2026-09-14T23:59:59+07:00'),
      });
      expect(notifications.createForOrganizations).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationIds: [20, 30],
          type: 'MO_KY_BAO_CAO',
        }),
      );
    });

    it('rejects create from a non-assigning organization', async () => {
      const repository = repositoryMock();
      const service = new SubTasksService(
        repository as unknown as TasksRepository,
        notificationsMock() as unknown as NotificationsService,
      );

      await expect(
        service.create(
          1,
          { startAt: '2026-08-15T00:00:00+07:00', dueAt: '2026-09-14T23:59:59+07:00' },
          { ...principal, isAdmin: false, organizationId: 20 },
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(repository.createSubTask).not.toHaveBeenCalled();
    });

    it('rejects when dueAt is not after startAt', async () => {
      const repository = repositoryMock();
      const service = new SubTasksService(
        repository as unknown as TasksRepository,
        notificationsMock() as unknown as NotificationsService,
      );

      await expect(
        service.create(
          1,
          { startAt: '2026-09-14T00:00:00+07:00', dueAt: '2026-08-15T00:00:00+07:00' },
          principal,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(repository.createSubTask).not.toHaveBeenCalled();
    });

    it('rejects create on a closed task', async () => {
      const repository = repositoryMock();
      repository.findById.mockResolvedValue({
        id: 1,
        code: 'NV-001',
        name: 'Nhiệm vụ',
        assigningOrganizationId: 10,
        leadOrganizationId: 20,
        collaboratorOrganizationIds: [30],
        frequency: 'MONTHLY',
        closedAt: new Date('2026-07-01T00:00:00+07:00'),
        deletedAt: null,
        subtasks: [],
      });
      const service = new SubTasksService(
        repository as unknown as TasksRepository,
        notificationsMock() as unknown as NotificationsService,
      );

      await expect(
        service.create(
          1,
          { startAt: '2026-08-15T00:00:00+07:00', dueAt: '2026-09-14T23:59:59+07:00' },
          principal,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(repository.createSubTask).not.toHaveBeenCalled();
    });

    it('computes sequence from existing subtask count', async () => {
      const repository = repositoryMock();
      repository.findById.mockResolvedValue({
        id: 1,
        code: 'NV-001',
        name: 'Nhiệm vụ',
        assigningOrganizationId: 10,
        leadOrganizationId: 20,
        collaboratorOrganizationIds: [30],
        frequency: 'MONTHLY',
        closedAt: null,
        deletedAt: null,
        subtasks: [{ id: 1 }, { id: 2 }],
      });
      const service = new SubTasksService(
        repository as unknown as TasksRepository,
        notificationsMock() as unknown as NotificationsService,
      );

      await service.create(
        1,
        { startAt: '2026-08-15T00:00:00+07:00', dueAt: '2026-09-14T23:59:59+07:00' },
        principal,
      );

      expect(repository.createSubTask).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ sequence: 3 }),
      );
    });
  });
});
