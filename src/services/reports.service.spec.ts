import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReportsRepository } from '../repositories/reports.repository';
import { NotificationsService } from './notifications.service';
import { ReportsService } from './reports.service';

const collaborator = {
  sub: 2,
  username: 'collaborator',
  organizationId: 30,
  permissions: [
    'tasks.read',
    'progress.edit',
    'progress.submit',
    'report_history.read',
  ],
};

const lead = {
  sub: 3,
  username: 'lead',
  organizationId: 20,
  permissions: [
    'tasks.read',
    'progress.review',
    'consolidated.edit',
    'consolidated.submit',
    'report_history.read',
  ],
};

const reviewer = {
  sub: 1,
  username: 'custom-reviewer',
  organizationId: 10,
  permissions: [
    'tasks.read',
    'tasks.read.all',
    'consolidated.review',
    'report_history.read',
  ],
};

const progressWorkspace = {
  id: 11,
  kind: 'PROGRESS' as const,
  status: 'DRAFT' as const,
  ownerOrganizationId: 30,
  reportingPeriod: {
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

function repositoryMock() {
  return {
    findWorkspace: jest.fn().mockResolvedValue(progressWorkspace),
    findPeriodContext: jest.fn(),
    findOrCreateWorkspace: jest.fn(),
    saveDraft: jest.fn(),
    createVersionFromDraft: jest.fn().mockResolvedValue({
      id: 101,
      versionNumber: 1,
      status: 'SUBMITTED',
    }),
    approveLatest: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
    rejectLatest: jest.fn().mockResolvedValue({ status: 'REJECTED' }),
    listPeriodWorkspaces: jest
      .fn()
      .mockResolvedValue([
        progressWorkspace,
        { ...progressWorkspace, id: 12, ownerOrganizationId: 40 },
      ]),
    listHistory: jest.fn().mockResolvedValue({ data: [], total: 0 }),
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

  it('does not let one collaborator access another collaborator report', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await expect(
      service.get(progressWorkspace.id, 'PROGRESS', {
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
      repository.findPeriodContext.mockResolvedValue({
        id: 7,
        status: 'OPEN',
        task: {
          id: 5,
          type,
          leadOrganizationId: 20,
          completedAt: null,
          collaboratorOrganizationIds: [30, 40],
        },
        approvedProgressCount: 0,
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

  it('passes history filters with collaborator-only scope', async () => {
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

  it('uses tasks.read.all for global report history scope', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await service.history({ page: 1, limit: 20 }, reviewer);

    expect(repository.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({ globalScope: true }),
    );
  });

  it('lists every submitted collaborator workspace for the lead organization', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );
    repository.findPeriodContext.mockResolvedValue({
      id: 7,
      status: 'OPEN',
      task: {
        id: 5,
        type: 'DINH_KY',
        leadOrganizationId: 20,
        completedAt: null,
        deletedAt: null,
        collaboratorOrganizationIds: [30, 40],
      },
      approvedProgressCount: 0,
    });

    const rows = await service.listPeriodWorkspaces(7, lead);

    expect(rows).toHaveLength(2);
    expect(repository.listPeriodWorkspaces).toHaveBeenCalledWith(7);
  });

  it('lets tasks.read.all list report workspaces outside the lead organization', async () => {
    const repository = repositoryMock();
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );
    repository.findPeriodContext.mockResolvedValue({
      id: 7,
      status: 'OPEN',
      task: {
        id: 5,
        type: 'DINH_KY',
        leadOrganizationId: 20,
        completedAt: null,
        deletedAt: null,
        collaboratorOrganizationIds: [30, 40],
      },
      approvedProgressCount: 0,
    });

    await expect(
      service.listPeriodWorkspaces(7, {
        ...reviewer,
        organizationId: 99,
        permissions: ['tasks.read', 'tasks.read.all', 'progress.review'],
      }),
    ).resolves.toHaveLength(2);
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

  it('lets a custom group with consolidated.review review globally', async () => {
    const repository = repositoryMock();
    repository.findWorkspace.mockResolvedValue({
      ...progressWorkspace,
      kind: 'CONSOLIDATED',
      status: 'SUBMITTED',
      ownerOrganizationId: 20,
      reportingPeriod: {
        ...progressWorkspace.reportingPeriod,
        task: {
          ...progressWorkspace.reportingPeriod.task,
          type: 'DINH_KY',
        },
      },
      latestVersion: { id: 201, status: 'SUBMITTED' },
    });
    const service = new ReportsService(
      repository as unknown as ReportsRepository,
    );

    await service.approve(12, 'CONSOLIDATED', reviewer);

    expect(repository.approveLatest).toHaveBeenCalledWith(12, reviewer.sub, {
      organizationId: reviewer.organizationId,
    });
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
        entityId: progressWorkspace.reportingPeriod.task.id,
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
        entityId: progressWorkspace.reportingPeriod.task.id,
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
        entityId: progressWorkspace.reportingPeriod.task.id,
      }),
    );
  });
});
