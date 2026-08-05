import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReportsRepository } from '../repositories/reports.repository';
import { NotificationsService } from './notifications.service';
import { ReportsService } from './reports.service';

const collaborator = {
  sub: 2,
  username: 'collaborator',
  organizationId: 30,
  permissions: [],
};

const lead = {
  sub: 3,
  username: 'lead',
  organizationId: 20,
  permissions: [],
};

// Cơ quan giao (assigning) duyệt báo cáo tổng hợp.
const assigning = {
  sub: 4,
  username: 'assigning',
  organizationId: 10,
  permissions: [],
};

const admin = {
  sub: 1,
  username: 'admin',
  organizationId: 99,
  permissions: [],
  isAdmin: true,
};

const progressWorkspace = {
  id: 11,
  kind: 'PROGRESS' as const,
  status: 'DRAFT' as const,
  ownerOrganizationId: 30,
  subtask: {
    id: 7,
    status: 'OPEN' as const,
    task: {
      id: 5,
      code: 'NV-005',
      name: 'Nhiệm vụ',
      type: 'DOT_XUAT' as const,
      assigningOrganizationId: 10,
      leadOrganizationId: 20,
      completedAt: null,
      collaboratorOrganizationIds: [30, 40],
    },
  },
  latestVersion: null,
};

const subtaskContext = {
  id: 7,
  status: 'OPEN' as const,
  task: {
    id: 5,
    type: 'DINH_KY' as const,
    assigningOrganizationId: 10,
    leadOrganizationId: 20,
    completedAt: null,
    deletedAt: null,
    collaboratorOrganizationIds: [30, 40],
  },
  approvedProgressCount: 0,
};

function repositoryMock() {
  return {
    findWorkspace: jest.fn().mockResolvedValue(progressWorkspace),
    findSubtaskContext: jest.fn().mockResolvedValue(subtaskContext),
    findOrCreateWorkspace: jest.fn().mockResolvedValue(progressWorkspace),
    saveDraft: jest.fn(),
    createVersionFromDraft: jest.fn().mockResolvedValue({
      id: 101,
      versionNumber: 1,
      status: 'SUBMITTED',
    }),
    approveLatest: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
    rejectLatest: jest.fn().mockResolvedValue({ status: 'REJECTED' }),
    listSubtaskWorkspaces: jest
      .fn()
      .mockResolvedValue([
        progressWorkspace,
        { ...progressWorkspace, id: 12, ownerOrganizationId: 40 },
      ]),
    listHistory: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  };
}

function submittedConsolidated() {
  return {
    ...progressWorkspace,
    kind: 'CONSOLIDATED' as const,
    status: 'SUBMITTED' as const,
    ownerOrganizationId: 20,
    latestVersion: { id: 201, status: 'SUBMITTED' },
  };
}

describe('ReportsService', () => {
  it('creates a new immutable version for each submission', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await service.submit(progressWorkspace.id, 'PROGRESS', collaborator);

    expect(repository.createVersionFromDraft).toHaveBeenCalledWith(
      progressWorkspace.id,
      collaborator.sub,
      { organizationId: collaborator.organizationId },
    );
  });

  it('lets a collaborator author a progress report for its own organization', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await service.openProgress(7, collaborator);

    expect(repository.findOrCreateWorkspace).toHaveBeenCalledWith(
      7,
      'PROGRESS',
      collaborator.organizationId,
    );
  });

  it('ignores a requested owner for a normal collaborator', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await service.openProgress(7, collaborator, 40);

    expect(repository.findOrCreateWorkspace).toHaveBeenCalledWith(
      7,
      'PROGRESS',
      collaborator.organizationId,
    );
  });

  it('lets an admin author a progress report for a selected collaborator', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await service.openProgress(7, admin, 40);

    expect(repository.findOrCreateWorkspace).toHaveBeenCalledWith(
      7,
      'PROGRESS',
      40,
    );
  });

  it('rejects an admin progress owner that is not a collaborator or missing', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await expect(service.openProgress(7, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.openProgress(7, admin, 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies report read to a non-participant organization', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await expect(
      service.get(progressWorkspace.id, 'PROGRESS', {
        ...collaborator,
        organizationId: 99,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets any task participant read a report but not save another org draft', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    // Đơn vị phối hợp khác (org 40) đọc được báo cáo của org 30 (cùng nhiệm vụ)...
    await expect(
      service.get(progressWorkspace.id, 'PROGRESS', {
        ...collaborator,
        organizationId: 40,
      }),
    ).resolves.toBe(progressWorkspace);
    // ...nhưng không được sửa bản nháp không thuộc đơn vị mình.
    await expect(
      service.saveDraft(progressWorkspace.id, 'PROGRESS', 'x', {
        ...collaborator,
        organizationId: 40,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only lets the lead organization review progress and requires a rejection reason', async () => {
    const repository = repositoryMock();
    repository.findWorkspace.mockResolvedValue({
      ...progressWorkspace,
      status: 'SUBMITTED',
      latestVersion: { id: 101, status: 'SUBMITTED' },
    });
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await expect(
      service.approve(progressWorkspace.id, 'PROGRESS', {
        ...lead,
        organizationId: 99,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.reject(progressWorkspace.id, 'PROGRESS', '   ', lead),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.reject(
      progressWorkspace.id,
      'PROGRESS',
      'Thiếu tài liệu',
      lead,
    );

    expect(repository.rejectLatest).toHaveBeenCalledWith(
      progressWorkspace.id,
      lead.sub,
      'Thiếu tài liệu',
      { organizationId: lead.organizationId },
    );
  });

  it('opens a consolidated workspace for both ad-hoc and periodic tasks without requiring approved progress', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );
    repository.findOrCreateWorkspace.mockResolvedValue({
      ...progressWorkspace,
      kind: 'CONSOLIDATED',
      ownerOrganizationId: 20,
    });

    // Cả đột xuất lẫn định kỳ đều mở được, kể cả khi chưa duyệt báo cáo phối hợp.
    for (const type of ['DOT_XUAT', 'DINH_KY']) {
      repository.findSubtaskContext.mockResolvedValue({
        ...subtaskContext,
        task: { ...subtaskContext.task, type },
      });

      await service.openConsolidated(7, lead);
    }

    expect(repository.findOrCreateWorkspace).toHaveBeenCalledWith(
      7,
      'CONSOLIDATED',
      lead.organizationId,
    );
    expect(repository.findOrCreateWorkspace).toHaveBeenCalledTimes(2);
  });

  it('lets the assigning organization review consolidated reports but not the lead', async () => {
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

  it('lets an admin review consolidated reports regardless of organization', async () => {
    const repository = repositoryMock();
    repository.findWorkspace.mockResolvedValue(submittedConsolidated());
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await service.approve(12, 'CONSOLIDATED', admin);
    expect(repository.approveLatest).toHaveBeenCalledWith(12, admin.sub, {
      organizationId: admin.organizationId,
    });
  });

  it('passes history filters with participant-only scope', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await service.history(
      { page: 1, limit: 20, taskCode: 'NV-01' },
      collaborator,
    );

    expect(repository.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        taskCode: 'NV-01',
        organizationId: collaborator.organizationId,
        globalScope: false,
      }),
    );
  });

  it('uses admin for global report history scope', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await service.history({ page: 1, limit: 20 }, admin);

    expect(repository.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({ globalScope: true }),
    );
  });

  it('lists every submitted collaborator workspace for the lead organization', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    const rows = await service.listSubtaskWorkspaces(7, lead);

    expect(rows).toHaveLength(2);
    expect(repository.listSubtaskWorkspaces).toHaveBeenCalledWith(7);
  });

  it('lets an admin list report workspaces outside its organization but denies outsiders', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await expect(service.listSubtaskWorkspaces(7, admin)).resolves.toHaveLength(
      2,
    );
    await expect(
      service.listSubtaskWorkspaces(7, { ...collaborator, organizationId: 99 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an inverted submitted history range', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

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

  it('uses canonical report types and navigable task targets', async () => {
    const repository = repositoryMock();
    const notifications = {
      createForOrganizations: jest.fn().mockResolvedValue(1),
    };
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
      notifications as unknown as NotificationsService,
    );

    await service.submit(progressWorkspace.id, 'PROGRESS', collaborator);
    expect(notifications.createForOrganizations).toHaveBeenLastCalledWith(
      expect.objectContaining({
        organizationIds: [lead.organizationId],
        eventKey: 'REPORT_SUBMITTED:101',
        type: 'GUI_BAO_CAO',
        entityType: 'Task',
        entityId: progressWorkspace.subtask.task.id,
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
        eventKey: 'REPORT_APPROVED:101',
        type: 'DUYET_BAO_CAO',
        entityType: 'Task',
        entityId: progressWorkspace.subtask.task.id,
      }),
    );

    await service.reject(
      progressWorkspace.id,
      'PROGRESS',
      'Missing attachment',
      lead,
    );
    expect(notifications.createForOrganizations).toHaveBeenLastCalledWith(
      expect.objectContaining({
        organizationIds: [collaborator.organizationId],
        eventKey: 'REPORT_REJECTED:101',
        type: 'TRA_BAO_CAO',
        entityType: 'Task',
        entityId: progressWorkspace.subtask.task.id,
      }),
    );
  });
});
