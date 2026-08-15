import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReportsRepository } from '../repositories/reports.repository';
import { NotificationsService } from './notifications.service';
import { ReportsService } from './reports.service';

const collaborator = {
  sub: 2,
  username: 'collaborator',
  organizationId: 30,
};

const secondCollaborator = {
  sub: 5,
  username: 'second-collaborator',
  organizationId: 30,
};

const lead = { sub: 3, username: 'lead', organizationId: 20 };
const assigning = { sub: 4, username: 'assigning', organizationId: 10 };
const admin = {
  sub: 1,
  username: 'admin',
  organizationId: 99,
  isAdmin: true,
};

const taskContext = {
  id: 7,
  code: 'NV-007',
  name: 'Nhiệm vụ con',
  type: 'DINH_KY' as const,
  programId: 5,
  startAt: new Date('2026-01-01T00:00:00.000Z'),
  dueAt: new Date('2026-12-31T00:00:00.000Z'),
  closedAt: null,
  completedAt: null,
  deletedAt: null,
  assigningOrganizationId: 10,
  leadOrganizationId: 20,
  collaboratorOrganizationIds: [30, 40],
  program: { id: 5, code: 'CT-005', name: 'Nhiệm vụ lớn' },
};

const progressWorkspace = {
  id: 11,
  kind: 'PROGRESS' as const,
  status: 'DRAFT' as const,
  content: null,
  ownerOrganizationId: 30,
  ownerUserId: collaborator.sub,
  ownerOrganization: { id: 30, code: 'DV30', name: 'Đơn vị 30' },
  ownerUser: {
    id: collaborator.sub,
    username: collaborator.username,
    fullName: 'User 2',
  },
  task: taskContext,
  draftAttachments: [],
  latestVersion: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function repositoryMock() {
  return {
    findWorkspace: jest.fn().mockResolvedValue(progressWorkspace),
    findTaskContext: jest.fn().mockResolvedValue(taskContext),
    resolveUserOrg: jest
      .fn()
      .mockImplementation((userId: number) =>
        Promise.resolve(
          userId === collaborator.sub || userId === secondCollaborator.sub
            ? { organizationId: 30 }
            : userId === 40
              ? { organizationId: 40 }
              : null,
        ),
      ),
    findOrCreateWorkspace: jest.fn().mockResolvedValue(progressWorkspace),
    saveDraft: jest.fn().mockResolvedValue(progressWorkspace),
    createVersionFromDraft: jest.fn().mockResolvedValue({
      id: 101,
      versionNumber: 1,
      status: 'SUBMITTED',
    }),
    approveLatest: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
    rejectLatest: jest.fn().mockResolvedValue({ status: 'REJECTED' }),
    returnLatest: jest.fn().mockResolvedValue({ status: 'REJECTED' }),
    listTaskWorkspaces: jest
      .fn()
      .mockResolvedValue([
        progressWorkspace,
        { ...progressWorkspace, id: 12, ownerUserId: secondCollaborator.sub },
      ]),
    listHistory: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  };
}

function serviceWith(repository = repositoryMock()) {
  return {
    repository,
    service: new ReportsService(repository as unknown as ReportsRepository),
  };
}

function submittedConsolidated() {
  return {
    ...progressWorkspace,
    kind: 'CONSOLIDATED' as const,
    status: 'SUBMITTED' as const,
    ownerOrganizationId: 20,
    ownerUserId: null,
    ownerUser: null,
    latestVersion: { id: 201, status: 'SUBMITTED' },
  };
}

describe('ReportsService', () => {
  it('opens one progress workspace for each collaborator user', async () => {
    const { service, repository } = serviceWith();

    await service.openProgress(7, collaborator);
    await service.openProgress(7, secondCollaborator);

    expect(repository.findOrCreateWorkspace).toHaveBeenNthCalledWith(
      1,
      7,
      'PROGRESS',
      { organizationId: 30, userId: collaborator.sub },
    );
    expect(repository.findOrCreateWorkspace).toHaveBeenNthCalledWith(
      2,
      7,
      'PROGRESS',
      { organizationId: 30, userId: secondCollaborator.sub },
    );
  });

  it('ignores requested progress owner for non-admin users', async () => {
    const { service, repository } = serviceWith();

    await service.openProgress(7, collaborator, secondCollaborator.sub);

    expect(repository.resolveUserOrg).toHaveBeenCalledWith(collaborator.sub);
  });

  it('lets admin select an active collaborator user and requires a selection', async () => {
    const { service, repository } = serviceWith();

    await service.openProgress(7, admin, secondCollaborator.sub);
    expect(repository.findOrCreateWorkspace).toHaveBeenCalledWith(
      7,
      'PROGRESS',
      { organizationId: 30, userId: secondCollaborator.sub },
    );
    await expect(service.openProgress(7, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an inactive, deleted, or unassigned progress owner', async () => {
    const { service } = serviceWith();

    await expect(service.openProgress(7, admin, 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('opens the single consolidated workspace for lead or admin', async () => {
    const { service, repository } = serviceWith();

    await service.openConsolidated(7, lead);
    await service.openConsolidated(7, admin);

    expect(repository.findOrCreateWorkspace).toHaveBeenCalledWith(
      7,
      'CONSOLIDATED',
      { organizationId: lead.organizationId, userId: null },
    );
    await expect(
      service.openConsolidated(7, collaborator),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets collaborators read and edit only their own progress workspace', async () => {
    const { service } = serviceWith();

    await expect(
      service.get(progressWorkspace.id, 'PROGRESS', collaborator),
    ).resolves.toBe(progressWorkspace);
    await expect(
      service.get(progressWorkspace.id, 'PROGRESS', secondCollaborator),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.saveDraft(
        progressWorkspace.id,
        'PROGRESS',
        'x',
        secondCollaborator,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets assigning, lead, and admin read every workspace', async () => {
    const { service } = serviceWith();

    await expect(service.get(11, 'PROGRESS', assigning)).resolves.toBe(
      progressWorkspace,
    );
    await expect(service.get(11, 'PROGRESS', lead)).resolves.toBe(
      progressWorkspace,
    );
    await expect(service.get(11, 'PROGRESS', admin)).resolves.toBe(
      progressWorkspace,
    );
  });

  it('lists all task progress workspaces only for lead or admin', async () => {
    const { service, repository } = serviceWith();

    await expect(service.listTaskWorkspaces(7, lead)).resolves.toHaveLength(2);
    await expect(service.listTaskWorkspaces(7, admin)).resolves.toHaveLength(2);
    await expect(
      service.listTaskWorkspaces(7, assigning),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.listTaskWorkspaces(7, collaborator),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.listTaskWorkspaces).toHaveBeenCalledWith(7);
  });

  it('passes user scope into report history', async () => {
    const { service, repository } = serviceWith();

    await service.history(
      { page: 1, limit: 20, taskCode: ' NV-01 ' },
      collaborator,
    );

    expect(repository.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        taskCode: 'NV-01',
        userId: collaborator.sub,
        organizationId: collaborator.organizationId,
        globalScope: false,
      }),
    );
  });

  it('uses global history scope for admin', async () => {
    const { service, repository } = serviceWith();

    await service.history({ page: 1, limit: 20 }, admin);

    expect(repository.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({ userId: admin.sub, globalScope: true }),
    );
  });

  it('rejects an inverted submitted history range', async () => {
    const { service } = serviceWith();

    await expect(
      service.history(
        {
          page: 1,
          limit: 20,
          submittedFrom: '2026-02-01T00:00:00.000Z',
          submittedTo: '2026-01-01T00:00:00.000Z',
        },
        collaborator,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps immutable submission and review notifications task-based', async () => {
    const repository = repositoryMock();
    const notifications = {
      createForOrganizations: jest.fn().mockResolvedValue(1),
    };
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
      notifications as unknown as NotificationsService,
    );

    await service.submit(progressWorkspace.id, 'PROGRESS', collaborator);
    expect(repository.createVersionFromDraft).toHaveBeenCalledWith(
      progressWorkspace.id,
      collaborator.sub,
      { organizationId: collaborator.organizationId },
    );
    expect(notifications.createForOrganizations).toHaveBeenLastCalledWith(
      expect.objectContaining({
        organizationIds: [lead.organizationId],
        entityType: 'Task',
        entityId: taskContext.id,
      }),
    );

    repository.findWorkspace.mockResolvedValue({
      ...progressWorkspace,
      status: 'SUBMITTED',
      latestVersion: { id: 101, status: 'SUBMITTED' },
    });
    await service.approve(progressWorkspace.id, 'PROGRESS', lead);
    expect(notifications.createForOrganizations).toHaveBeenLastCalledWith(
      expect.objectContaining({
        organizationIds: [collaborator.organizationId],
        entityType: 'Task',
        entityId: taskContext.id,
      }),
    );
  });

  it('only lets assigning organization review consolidated reports', async () => {
    const repository = repositoryMock();
    repository.findWorkspace.mockResolvedValue(submittedConsolidated());
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await expect(
      service.approve(12, 'CONSOLIDATED', lead),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.approve(12, 'CONSOLIDATED', assigning);
    expect(repository.approveLatest).toHaveBeenCalledWith(12, assigning.sub, {
      organizationId: assigning.organizationId,
    });
  });
});
