import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TasksRepository } from '../repositories/tasks.repository';
import { TasksService } from './tasks.service';
import { NotificationsService } from './notifications.service';

const assigning = {
  sub: 1,
  username: 'assigning',
  organizationId: 10,
};

const collaborator = {
  sub: 2,
  username: 'collaborator',
  organizationId: 30,
};

const program = {
  id: 1,
  assigningOrganizationId: 10,
  leadOrganizationId: 20,
  collaboratorOrganizationIds: [30],
};

const task = {
  id: 7,
  code: 'NV-007',
  name: 'Nhiệm vụ con',
  description: null,
  expectedOutput: null,
  type: 'DINH_KY' as const,
  programId: 1,
  assigningOrganizationId: 10,
  leadOrganizationId: 20,
  collaboratorOrganizationIds: [30],
  dueAt: new Date('2026-08-01T00:00:00.000Z'),
  deadlineStatus: null,
  startAt: new Date('2026-07-01T00:00:00.000Z'),
  closedAt: null,
  closeReason: null,
  completedAt: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  hasReports: false,
  program,
  workspaces: [],
};

function repositoryMock() {
  return {
    list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findById: jest.fn().mockResolvedValue(task),
    codeExists: jest.fn().mockResolvedValue(false),
    findActiveProgram: jest.fn().mockResolvedValue(program),
    findOrganizationsByIds: jest.fn().mockResolvedValue([
      { id: 10, status: 'ACTIVE', isAssigningAuthority: true, isExecutingUnit: false },
      { id: 20, status: 'ACTIVE', isAssigningAuthority: false, isExecutingUnit: true },
      { id: 30, status: 'ACTIVE', isAssigningAuthority: false, isExecutingUnit: true },
    ]),
    create: jest.fn().mockResolvedValue(task),
    update: jest.fn().mockResolvedValue(task),
    softDelete: jest.fn().mockResolvedValue(task),
    close: jest.fn().mockResolvedValue({ ...task, closedAt: new Date() }),
    complete: jest.fn(),
    listActiveOrganizations: jest.fn().mockResolvedValue([]),
    listActivePrograms: jest.fn().mockResolvedValue([]),
  };
}

describe('TasksService', () => {
  it('threads the acting user into task visibility and report badges', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    await service.list({ page: 1, limit: 20 }, collaborator);
    await service.get(task.id, collaborator);

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: collaborator.sub }),
    );
    expect(repository.findById).toHaveBeenCalledWith(
      task.id,
      collaborator.organizationId,
      collaborator.sub,
      false,
    );
  });

  it('creates a Task using its own organization assignment', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    await service.create(
      {
        code: 'NV-008',
        name: 'Nhiệm vụ con mới',
        type: 'DINH_KY',
        programId: program.id,
        assigningOrganizationId: 10,
        leadOrganizationId: 20,
        collaboratorOrganizationIds: [30],
        startAt: '2026-07-01T00:00:00.000Z',
        dueAt: '2026-08-01T00:00:00.000Z',
      } as never,
      assigning,
    );

    expect(repository.create).toHaveBeenCalledWith(
      {
        code: 'NV-008',
        name: 'Nhiệm vụ con mới',
        description: null,
        expectedOutput: null,
        type: 'DINH_KY',
        programId: program.id,
        assigningOrganizationId: 10,
        leadOrganizationId: 20,
        collaboratorOrganizationIds: [30],
        startAt: new Date('2026-07-01T00:00:00.000Z'),
        dueAt: new Date('2026-08-01T00:00:00.000Z'),
      },
      assigning.sub,
      expect.any(Date),
      { organizationId: assigning.organizationId },
    );
  });

  it('rejects Task creation outside the caller organization', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(
      service.create(
        {
          code: 'NV-008',
          name: 'Nhiệm vụ con mới',
          type: 'DINH_KY',
          programId: program.id,
          assigningOrganizationId: 10,
          leadOrganizationId: 20,
          collaboratorOrganizationIds: [30],
        } as never,
        collaborator,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects creating a task for another organization', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);
    repository.findOrganizationsByIds = jest.fn().mockResolvedValue([
      { id: 999, status: 'ACTIVE', isAssigningAuthority: true, isExecutingUnit: true },
      { id: 2, status: 'ACTIVE', isAssigningAuthority: false, isExecutingUnit: true },
      { id: 3, status: 'ACTIVE', isAssigningAuthority: false, isExecutingUnit: true },
    ]);
    await expect(
      service.create(
        {
          code: 'NV-1',
          name: 'Nhiệm vụ',
          type: 'DOT_XUAT',
          programId: 1,
          assigningOrganizationId: 999,
          leadOrganizationId: 2,
          collaboratorOrganizationIds: [3],
        } as never,
        { sub: 5, username: 'u', organizationId: 10 } as never,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets an admin assign on behalf of any organization', async () => {
    const repository = repositoryMock();
    const service = new TasksService(repository as unknown as TasksRepository);
    repository.findOrganizationsByIds = jest.fn().mockResolvedValue([
      { id: 999, status: 'ACTIVE', isAssigningAuthority: true, isExecutingUnit: true },
      { id: 2, status: 'ACTIVE', isAssigningAuthority: false, isExecutingUnit: true },
      { id: 3, status: 'ACTIVE', isAssigningAuthority: false, isExecutingUnit: true },
    ]);
    await expect(
      service.create(
        {
          code: 'NV-2',
          name: 'Nhiệm vụ',
          type: 'DOT_XUAT',
          programId: 1,
          assigningOrganizationId: 999,
          leadOrganizationId: 2,
          collaboratorOrganizationIds: [3],
        } as never,
        { sub: 1, username: 'admin', organizationId: 10, isAdmin: true } as never,
      ),
    ).resolves.toBeDefined();
  });

  it('notifies new recipients when only leadOrganizationId changes on update', async () => {
    const repository = repositoryMock();
    repository.findOrganizationsByIds = jest.fn().mockResolvedValue([
      { id: 10, status: 'ACTIVE', isAssigningAuthority: true, isExecutingUnit: false },
      { id: 30, status: 'ACTIVE', isAssigningAuthority: false, isExecutingUnit: true },
      { id: 99, status: 'ACTIVE', isAssigningAuthority: false, isExecutingUnit: true },
    ]);
    const notificationsService = {
      createForOrganizations: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TasksService(
      repository as unknown as TasksRepository,
      notificationsService as unknown as NotificationsService,
    );

    await service.update(
      task.id,
      { leadOrganizationId: 99 } as never,
      assigning,
    );

    expect(notificationsService.createForOrganizations).toHaveBeenCalled();
  });

  it('blocks deleting a Task with submitted reports', async () => {
    const repository = repositoryMock();
    repository.findById.mockResolvedValue({ ...task, hasReports: true });
    const service = new TasksService(repository as unknown as TasksRepository);

    await expect(service.remove(task.id, assigning)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.softDelete).not.toHaveBeenCalled();
  });
});
