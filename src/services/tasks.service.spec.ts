import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { TasksRepository } from '../repositories/tasks.repository';
import { NotificationsService } from './notifications.service';
import { TasksService } from './tasks.service';

const taskManager = {
  sub: 1,
  username: 'thuongtruc',
  organizationId: 10,
  permissions: [
    'tasks.read',
    'tasks.create',
    'tasks.update',
    'tasks.delete',
    'tasks.assign',
    'tasks.close',
    'tasks.complete',
  ],
};

const unitUser = {
  sub: 2,
  username: 'unit',
  organizationId: 20,
  permissions: ['tasks.read', 'tasks.update'],
};

const delegatedCreator = {
  ...unitUser,
  permissions: ['tasks.read', 'tasks.create', 'tasks.update'],
};

const existingTask = {
  id: 7,
  code: 'NV-007',
  name: 'Nhiệm vụ',
  type: 'DINH_KY' as const,
  programId: 1,
  assigningOrganizationId: 10,
  leadOrganizationId: 20,
  collaboratorOrganizationIds: [30],
  dueAt: null,
  frequency: 'MONTHLY' as const,
  periodicStartAt: new Date('2026-07-15T00:00:00+07:00'),
  closedAt: null,
};

function repositoryMock() {
  return {
    list: jest.fn(),
    findById: jest.fn().mockResolvedValue(existingTask),
    codeExists: jest.fn().mockResolvedValue(false),
    findActiveProgram: jest.fn().mockResolvedValue({ id: 1 }),
    findActiveOrganizations: jest.fn().mockImplementation((ids: number[]) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          isAssigningAuthority: id === 10,
          isExecutingUnit: id !== 10,
        })),
      ),
    ),
    create: jest.fn().mockResolvedValue(existingTask),
    update: jest.fn().mockResolvedValue(existingTask),
    softDelete: jest.fn().mockResolvedValue(existingTask),
    countOpenPeriods: jest.fn().mockResolvedValue(0),
    close: jest
      .fn()
      .mockResolvedValue({ ...existingTask, closedAt: new Date() }),
    complete: jest.fn(),
  };
}

describe('TasksService', () => {
  it('scopes a unit list to the current organization', async () => {
    const repository = repositoryMock();
    repository.list.mockResolvedValue({ data: [], total: 0 });
    const service = new TasksService(repository as unknown as TasksRepository);

    await service.list({ page: 1, limit: 20 }, unitUser);

    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      organizationId: unitUser.organizationId,
      globalScope: false,
    });
  });

  it('uses global scope when tasks.read.all is granted', async () => {
    const repository = repositoryMock();
    repository.list.mockResolvedValue({ data: [], total: 0 });
    const service = new TasksService(repository as unknown as TasksRepository);

    await service.list(
      { page: 1, limit: 20 },
      { ...taskManager, permissions: ['tasks.read', 'tasks.read.all'] },
    );

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ globalScope: true }),
    );
  });

  it('soft deletes without removing reports', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    await service.remove(existingTask.id, taskManager);

    expect(repository.softDelete).toHaveBeenCalledWith(
      existingTask.id,
      expect.any(Date),
      taskManager.sub,
      { organizationId: taskManager.organizationId },
    );
  });

  it('does not let a unit assign collaborators', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.update(
        existingTask.id,
        { collaboratorOrganizationIds: [40] },
        unitUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires assignment authority to create a task', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.create(
        {
          code: 'NV-008',
          name: 'Nhiệm vụ',
          type: 'DOT_XUAT',
          programId: 1,
          assigningOrganizationId: 10,
          leadOrganizationId: 20,
          collaboratorOrganizationIds: [30],
          dueAt: '2026-08-01T00:00:00.000Z',
        },
        delegatedCreator,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets any principal with task permissions manage tasks in scope', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);
    const custom = {
      ...taskManager,
      isAdmin: false,
      permissions: [
        'tasks.read',
        'tasks.read.all',
        'tasks.create',
        'tasks.update',
        'tasks.delete',
        'tasks.assign',
        'tasks.close',
      ],
    };

    await expect(
      service.create(
        {
          code: 'NV-008',
          name: 'Nhiệm vụ',
          type: 'DOT_XUAT',
          programId: 1,
          assigningOrganizationId: 10,
          leadOrganizationId: 20,
          collaboratorOrganizationIds: [30],
          dueAt: '2026-08-01T00:00:00.000Z',
        },
        custom,
      ),
    ).resolves.toMatchObject({ id: 7 });
    await expect(
      service.update(existingTask.id, { name: 'Đổi tên' }, custom),
    ).resolves.toBeDefined();
    await expect(
      service.remove(existingTask.id, custom),
    ).resolves.toBeDefined();
  });

  it('requires assignment authority for every organization assignment field', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    for (const input of [
      { assigningOrganizationId: 11 },
      { leadOrganizationId: 21 },
      { collaboratorOrganizationIds: [40] },
    ]) {
      await expect(
        service.update(existingTask.id, input, unitUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('limits a non-admin assigning authority to its own organization', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.create(
        {
          code: 'NV-008',
          name: 'Nhiệm vụ',
          type: 'DOT_XUAT',
          programId: 1,
          assigningOrganizationId: 99,
          leadOrganizationId: 20,
          collaboratorOrganizationIds: [30],
          dueAt: '2026-08-01T00:00:00.000Z',
        },
        taskManager,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps a concurrent unique-code violation to conflict', async () => {
    const repository = repositoryMock();
    repository.create.mockRejectedValue({ code: 'P2002' });
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.create(
        {
          code: 'NV-008',
          name: 'Nhiệm vụ',
          type: 'DOT_XUAT',
          programId: 1,
          assigningOrganizationId: 10,
          leadOrganizationId: 20,
          collaboratorOrganizationIds: [30],
          dueAt: '2026-08-01T00:00:00.000Z',
        },
        taskManager,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('notifies every assigned organization after task creation', async () => {
    const repository = repositoryMock();
    const notifications = {
      createForOrganizations: jest.fn().mockResolvedValue(2),
    };
    const service = new TasksService(
      repository as unknown as TasksRepository,
      notifications as unknown as NotificationsService,
    );

    await service.create(
      {
        code: 'NV-008',
        name: 'Nhiệm vụ mới',
        type: 'DOT_XUAT',
        programId: 1,
        assigningOrganizationId: 10,
        leadOrganizationId: 20,
        collaboratorOrganizationIds: [30],
        dueAt: '2026-08-01T00:00:00.000Z',
      },
      taskManager,
    );

    expect(notifications.createForOrganizations).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationIds: [20, 30],
        eventKey: `TASK_ASSIGNED:${existingTask.id}`,
        type: 'GIAO_NHIEM_VU',
        entityType: 'Task',
        entityId: existingTask.id,
      }),
    );
  });

  it('rejects a duplicate task code', async () => {
    const repository = repositoryMock();
    repository.codeExists.mockResolvedValue(true);
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.create(
        {
          code: 'NV-007',
          name: 'Nhiệm vụ',
          type: 'DOT_XUAT',
          programId: 1,
          assigningOrganizationId: 10,
          leadOrganizationId: 20,
          collaboratorOrganizationIds: [30],
          dueAt: '2026-08-01T00:00:00.000Z',
        },
        taskManager,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires an active program and every referenced organization', async () => {
    const repository = repositoryMock();
    repository.findActiveProgram.mockResolvedValue(null);
    repository.findActiveOrganizations.mockResolvedValue([{ id: 10 }]);
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.create(
        {
          code: 'NV-008',
          name: 'Nhiệm vụ',
          type: 'DOT_XUAT',
          programId: 999,
          assigningOrganizationId: 10,
          leadOrganizationId: 20,
          collaboratorOrganizationIds: [30],
          dueAt: '2026-08-01T00:00:00.000Z',
        },
        taskManager,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires at least one collaborator different from the lead', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);
    const common = {
      code: 'NV-008',
      name: 'Nhiệm vụ',
      type: 'DOT_XUAT' as const,
      programId: 1,
      assigningOrganizationId: 10,
      leadOrganizationId: 20,
      dueAt: '2026-08-01T00:00:00.000Z',
    };

    await expect(
      service.create(
        { ...common, collaboratorOrganizationIds: [] },
        taskManager,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        { ...common, collaboratorOrganizationIds: [20] },
        taskManager,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates type-specific fields', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);
    const common = {
      code: 'NV-008',
      name: 'Nhiệm vụ',
      programId: 1,
      assigningOrganizationId: 10,
      leadOrganizationId: 20,
      collaboratorOrganizationIds: [30],
    };

    await expect(
      service.create({ ...common, type: 'DOT_XUAT' }, taskManager),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        {
          ...common,
          type: 'DINH_KY',
          frequency: 'MONTHLY',
          periodicStartAt: '2026-07-14T00:00:00+07:00',
          dueAt: '2026-08-01T00:00:00.000Z',
        },
        taskManager,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('closes only an open periodic task with no open periods', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    repository.countOpenPeriods.mockResolvedValue(1);
    await expect(
      service.close(existingTask.id, 'Kết thúc chương trình', taskManager),
    ).rejects.toBeInstanceOf(ConflictException);

    repository.findById.mockResolvedValue({
      ...existingTask,
      type: 'DOT_XUAT',
    });
    await expect(
      service.close(existingTask.id, 'Kết thúc chương trình', taskManager),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses the canonical task-closed notification type', async () => {
    const repository = repositoryMock();
    const notifications = {
      createForOrganizations: jest.fn().mockResolvedValue(3),
    };
    const service = new TasksService(
      repository as unknown as TasksRepository,
      notifications as unknown as NotificationsService,
    );

    await service.close(existingTask.id, 'Finished program', taskManager);

    expect(notifications.createForOrganizations).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: `TASK_CLOSED:${existingTask.id}`,
        type: 'DONG_NHIEM_VU',
        entityType: 'Task',
        entityId: existingTask.id,
      }),
    );
  });

  it('lets the assigning organization complete an ad-hoc task at any time', async () => {
    const completedAt = new Date('2026-07-26T00:00:00.000Z');
    const repository = repositoryMock();
    const adHocTask = {
      ...existingTask,
      type: 'DOT_XUAT' as const,
      dueAt: new Date('2026-07-28T00:00:00.000Z'),
      frequency: null,
      periodicStartAt: null,
    };
    repository.findById.mockResolvedValue(adHocTask);
    repository.complete.mockResolvedValue({
      ...adHocTask,
      completedAt,
      deadlineStatus: 'HOAN_THANH_DUNG_HAN',
    });
    const service = new TasksService(repository as unknown as TasksRepository);

    await service.complete(adHocTask.id, taskManager, {}, completedAt);

    expect(repository.complete).toHaveBeenCalledWith(
      adHocTask.id,
      completedAt,
      'HOAN_THANH_DUNG_HAN',
      taskManager.sub,
      { organizationId: taskManager.organizationId },
    );
  });

  it('does not let another organization complete an ad-hoc task', async () => {
    const repository = repositoryMock();
    repository.findById.mockResolvedValue({
      ...existingTask,
      type: 'DOT_XUAT',
      assigningOrganizationId: 10,
      dueAt: new Date('2026-07-28T00:00:00.000Z'),
    });
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.complete(existingTask.id, {
        ...unitUser,
        permissions: [...unitUser.permissions, 'tasks.complete'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it('does not complete a periodic task', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.complete(existingTask.id, taskManager),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.complete).not.toHaveBeenCalled();
  });
});
