import {
  Frequency,
  PeriodStatus,
  ReportStatus,
  TaskType,
} from '@prisma/client';
import type {
  DashboardRepository,
  DashboardTaskRow,
} from '../repositories/dashboard.repository';
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
    service = new DashboardService(repository as DashboardRepository);
  });

  it('counts unique tasks separately from reporting periods', async () => {
    repository.loadSummaryRows.mockResolvedValue([
      taskRow({
        id: 1,
        type: TaskType.DINH_KY,
        periods: [
          period(1, PeriodStatus.COMPLETED, '2026-07-01T00:00:00.000Z'),
          period(2, PeriodStatus.OPEN, '2026-08-10T00:00:00.000Z'),
          period(3, PeriodStatus.OPEN, '2026-07-25T00:00:00.000Z', [
            ReportStatus.SUBMITTED,
          ]),
        ],
      }),
      taskRow({
        id: 2,
        type: TaskType.DOT_XUAT,
        completedAt: new Date('2026-07-20T00:00:00.000Z'),
        periods: [
          period(4, PeriodStatus.OPEN, '2026-07-20T00:00:00.000Z'),
          period(5, PeriodStatus.OPEN, '2026-07-29T00:00:00.000Z'),
        ],
      }),
    ]);

    const result = await service.summary({}, principal, now);

    expect(result.totalTasks).toBe(2);
    expect(result.periodCounts.total).toBe(5);
    expect(result.taskCounts.typeCounts).toEqual({
      DINH_KY: 1,
      DOT_XUAT: 1,
    });
    expect(result.taskCounts.statusCounts).toMatchObject({
      DANG_CAP_NHAT: 1,
      HOAN_THANH: 1,
    });
    expect(result.periodCounts.statusCounts).toEqual({
      HOAN_THANH: 1,
      DANG_CAP_NHAT: 1,
      QUA_HAN: 1,
      SAP_DEN_HAN: 1,
      CHUA_HOAN_THANH: 1,
    });
  });

  it('uses completion, pending, overdue, due-soon, incomplete precedence', async () => {
    repository.loadSummaryRows.mockResolvedValue([
      taskRow({
        id: 1,
        periods: [
          period(1, PeriodStatus.COMPLETED, '2026-07-01T00:00:00.000Z', [
            ReportStatus.SUBMITTED,
          ]),
          period(2, PeriodStatus.OPEN, '2026-07-01T00:00:00.000Z', [
            ReportStatus.SUBMITTED,
          ]),
          period(3, PeriodStatus.OPEN, '2026-07-23T23:59:59.999Z'),
          period(4, PeriodStatus.OPEN, '2026-07-29T00:00:00.000Z'),
          period(5, PeriodStatus.OPEN, '2026-07-29T00:00:00.001Z'),
        ],
      }),
    ]);

    const result = await service.summary({}, principal, now);

    expect(result.periodCounts.statusCounts).toEqual({
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
      frequency: Frequency.QUARTERLY,
      year: 2026,
      sequence: 3,
      programId: 4,
      dueFrom: '2026-07-01T00:00:00.000Z',
      dueTo: '2026-09-30T23:59:59.999Z',
    };

    await service.summary(filters, principal, now);

    expect(repository.loadSummaryRows).toHaveBeenCalledWith({
      filters,
      organizationId: 20,
      globalScope: false,
    });
  });

  it('grants global dashboard scope only to Admin or Thường trực', async () => {
    repository.loadSummaryRows.mockResolvedValue([]);

    await service.summary(
      {},
      {
        ...principal,
        permissions: ['dashboard.read', 'tasks.assign'],
        isStaff: false,
      },
      now,
    );
    expect(repository.loadSummaryRows).toHaveBeenLastCalledWith(
      expect.objectContaining({ globalScope: false }),
    );

    await service.summary({}, { ...principal, isStaff: true }, now);
    expect(repository.loadSummaryRows).toHaveBeenLastCalledWith(
      expect.objectContaining({ globalScope: true }),
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
    periods: overrides.periods ?? [],
  };
}

function period(
  id: number,
  status: PeriodStatus,
  dueAt: string,
  workspaceStatuses: ReportStatus[] = [],
): DashboardTaskRow['periods'][number] {
  return {
    id,
    frequency: Frequency.MONTHLY,
    status,
    dueAt: new Date(dueAt),
    workspaceStatuses,
  };
}
