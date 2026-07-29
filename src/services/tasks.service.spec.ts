import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { TasksRepository } from '../repositories/tasks.repository';
import { NotificationsService } from './notifications.service';
import { TasksService } from './tasks.service';

const thuongTruc = {
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
  isStaff: true,
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
  userGroupIds: [],
  userGroups: [],
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
    findUserGroupsByIds: jest
      .fn()
      .mockImplementation((ids: number[]) =>
        Promise.resolve(ids.map((id) => ({ id }))),
      ),
    listUserGroupLookups: jest
      .fn()
      .mockResolvedValue([{ id: 5, name: 'Tá»• A', organizationIds: [30] }]),
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

  it('soft deletes without removing reports', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    await service.remove(existingTask.id, thuongTruc);

    expect(repository.softDelete).toHaveBeenCalledWith(
      existingTask.id,
      expect.any(Date),
      thuongTruc.sub,
      { organizationId: thuongTruc.organizationId },
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

  it('does not treat a custom tasks.assign group as Thường trực', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.update(
        existingTask.id,
        { collaboratorOrganizationIds: [40] },
        {
          ...unitUser,
          permissions: ['tasks.read', 'tasks.update', 'tasks.assign'],
          isStaff: false,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not let custom task permissions bypass the Admin or Thường trực role', async () => {
    const service = new TasksService(
      repositoryMock() as unknown as TasksRepository,
    );
    const custom = {
      ...unitUser,
      permissions: [
        'tasks.read',
        'tasks.update',
        'tasks.delete',
        'tasks.close',
      ],
    };

    await expect(
      service.update(existingTask.id, { name: 'Tên mới' }, custom),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.remove(existingTask.id, custom),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.close(existingTask.id, 'Đóng', custom),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
        thuongTruc,
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
        thuongTruc,
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
      thuongTruc,
    );

    expect(notifications.createForOrganizations).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationIds: [20, 30],
        eventKey: `TASK_ASSIGNED:${existingTask.id}`,
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
        thuongTruc,
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
        thuongTruc,
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
        thuongTruc,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        { ...common, collaboratorOrganizationIds: [20] },
        thuongTruc,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a task that references a missing user group', async () => {
    const repository = repositoryMock();
    repository.findUserGroupsByIds.mockResolvedValue([]);
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.create(
        {
          code: 'NV-008',
          name: 'Nhiá»‡m vá»¥',
          type: 'DOT_XUAT',
          programId: 1,
          assigningOrganizationId: 10,
          leadOrganizationId: 20,
          collaboratorOrganizationIds: [30],
          userGroupIds: [999],
          dueAt: '2026-08-01T00:00:00.000Z',
        },
        thuongTruc,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns group lookups without changing collaborators', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);
    await expect(service.listUserGroupLookups(thuongTruc)).resolves.toEqual([
      { id: 5, name: 'Tá»• A', organizationIds: [30] },
    ]);
  });

  it('requires assignment authority for group edits without notifying organizations', async () => {
    const repository = repositoryMock();
    const notifications = {
      createForOrganizations: jest.fn().mockResolvedValue(2),
    };
    const service = new TasksService(
      repository as unknown as TasksRepository,
      notifications as unknown as NotificationsService,
    );

    await expect(
      service.update(
        existingTask.id,
        { userGroupIds: [5] },
        {
          ...thuongTruc,
          permissions: thuongTruc.permissions.filter(
            (permission) => permission !== 'tasks.assign',
          ),
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await service.update(existingTask.id, { userGroupIds: [5] }, thuongTruc);

    expect(repository.update).toHaveBeenCalledWith(
      existingTask.id,
      { userGroupIds: [5] },
      thuongTruc.sub,
      { organizationId: thuongTruc.organizationId },
    );
    expect(notifications.createForOrganizations).not.toHaveBeenCalled();
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
      service.create({ ...common, type: 'DOT_XUAT' }, thuongTruc),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        {
          ...common,
          type: 'DINH_KY',
          frequency: 'MONTHLY',
          periodicStartAt: '2026-07-14T00:00:00+07:00',
        },
        thuongTruc,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('closes only an open periodic task with no open periods', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    repository.countOpenPeriods.mockResolvedValue(1);
    await expect(
      service.close(existingTask.id, 'Kết thúc chương trình', thuongTruc),
    ).rejects.toBeInstanceOf(ConflictException);

    repository.findById.mockResolvedValue({
      ...existingTask,
      type: 'DOT_XUAT',
    });
    await expect(
      service.close(existingTask.id, 'Kết thúc chương trình', thuongTruc),
    ).rejects.toBeInstanceOf(BadRequestException);
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

    await service.complete(adHocTask.id, thuongTruc, {}, completedAt);

    expect(repository.complete).toHaveBeenCalledWith(
      adHocTask.id,
      completedAt,
      'HOAN_THANH_DUNG_HAN',
      thuongTruc.sub,
      { organizationId: thuongTruc.organizationId },
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
      service.complete(existingTask.id, thuongTruc),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.complete).not.toHaveBeenCalled();
  });
});
