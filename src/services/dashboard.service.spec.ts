import { ReportStatus, TaskType } from '@prisma/client';
import type { DashboardRepository } from '../repositories/dashboard.repository';
import type { DashboardTaskRow } from '../types/dashboard';
import { DashboardService } from './dashboard.service';

const principal = {
  sub: 7,
  username: 'unit-user',
  organizationId: 20,
  permissions: ['dashboard.read'],
  isAdmin: false,
};

describe('DashboardService', () => {
  const now = new Date('2026-07-24T00:00:00.000Z');
  let repository: jest.Mocked<Pick<DashboardRepository, 'loadSummaryRows'>>;
  let service: DashboardService;

  beforeEach(() => {
    repository = {
      loadSummaryRows: jest.fn(),
    };
    service = new DashboardService(
      repository as unknown as DashboardRepository,
    );
  });

  it('counts task rows directly while preserving the response contract', async () => {
    repository.loadSummaryRows.mockResolvedValue([
      taskRow({
        id: 1,
        type: TaskType.DINH_KY,
        dueAt: new Date('2026-07-25T00:00:00.000Z'),
        reportStatus: [ReportStatus.SUBMITTED],
      }),
      taskRow({
        id: 2,
        type: TaskType.DOT_XUAT,
        completedAt: new Date('2026-07-20T00:00:00.000Z'),
        dueAt: new Date('2026-07-20T00:00:00.000Z'),
      }),
    ]);

    const result = await service.summary({}, principal, now);

    expect(result.totalTasks).toBe(2);
    expect(result.subtaskCounts.total).toBe(2);
    expect(result.taskCounts.typeCounts).toEqual({
      DINH_KY: 1,
      DOT_XUAT: 1,
    });
    expect(result.taskCounts.statusCounts).toMatchObject({
      DANG_CAP_NHAT: 1,
      HOAN_THANH: 1,
    });
    expect(result.subtaskCounts.statusCounts).toEqual({
      HOAN_THANH: 1,
      DANG_CAP_NHAT: 1,
      QUA_HAN: 0,
      SAP_DEN_HAN: 0,
      CHUA_HOAN_THANH: 0,
    });
  });

  it('uses completion, pending, overdue, due-soon, incomplete precedence', async () => {
    repository.loadSummaryRows.mockResolvedValue([
      taskRow({
        id: 1,
        completedAt: new Date(),
        dueAt: new Date('2026-07-01'),
      }),
      taskRow({
        id: 2,
        reportStatus: [ReportStatus.SUBMITTED],
        dueAt: new Date('2026-07-01'),
      }),
      taskRow({ id: 3, dueAt: new Date('2026-07-23T23:59:59.999Z') }),
      taskRow({ id: 4, dueAt: new Date('2026-07-29T00:00:00.000Z') }),
      taskRow({ id: 5, dueAt: new Date('2026-07-29T00:00:00.001Z') }),
    ]);

    const result = await service.summary({}, principal, now);

    expect(result.subtaskCounts.statusCounts).toEqual({
      HOAN_THANH: 1,
      DANG_CAP_NHAT: 1,
      QUA_HAN: 1,
      SAP_DEN_HAN: 1,
      CHUA_HOAN_THANH: 1,
    });
  });

  it('passes organization scope and filters into the database repository', async () => {
    repository.loadSummaryRows.mockResolvedValue([]);
    const filters = {
      taskCode: 'NV-',
      taskName: 'Chuyển đổi số',
      year: 2026,
      programId: 4,
      dueFrom: '2026-07-01T00:00:00.000Z',
      dueTo: '2026-09-30T23:59:59.999Z',
    };

    await service.summary(filters, principal, now);

    expect(repository.loadSummaryRows).toHaveBeenCalledWith({
      filters,
      organizationId: 20,
      userId: 7,
      globalScope: false,
    });
  });

  it('uses admin for global dashboard scope', async () => {
    repository.loadSummaryRows.mockResolvedValue([]);

    await service.summary({}, { ...principal, isAdmin: false }, now);
    expect(repository.loadSummaryRows).toHaveBeenLastCalledWith(
      expect.objectContaining({ globalScope: false, userId: 7 }),
    );

    await service.summary({}, { ...principal, isAdmin: true }, now);
    expect(repository.loadSummaryRows).toHaveBeenLastCalledWith(
      expect.objectContaining({ globalScope: true, userId: 7 }),
    );
  });
});

function taskRow(
  overrides: Partial<DashboardTaskRow> & Pick<DashboardTaskRow, 'id'>,
): DashboardTaskRow {
  return {
    id: overrides.id,
    type: overrides.type ?? TaskType.DINH_KY,
    completedAt: overrides.completedAt ?? null,
    closedAt: overrides.closedAt ?? null,
    startAt: overrides.startAt ?? null,
    dueAt: overrides.dueAt ?? null,
    reportStatus: overrides.reportStatus ?? [],
  };
}
