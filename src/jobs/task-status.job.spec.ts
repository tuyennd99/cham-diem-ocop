import { TaskDeadlineStatus, TaskType } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateTaskDeadlineStatus, TaskStatusJob } from './task-status.job';

describe('calculateTaskDeadlineStatus', () => {
  const now = new Date('2026-07-26T00:00:00.000Z');
  const dueAt = new Date('2026-07-28T00:00:00.000Z');

  it.each([
    {
      name: 'completed on time',
      completedAt: new Date('2026-07-28T00:00:00.000Z'),
      dueAt,
      now,
      expected: TaskDeadlineStatus.HOAN_THANH_DUNG_HAN,
    },
    {
      name: 'completed late',
      completedAt: new Date('2026-07-28T00:00:00.001Z'),
      dueAt,
      now,
      expected: TaskDeadlineStatus.HOAN_THANH_QUA_HAN,
    },
    {
      name: 'overdue',
      completedAt: null,
      dueAt: new Date('2026-07-25T23:59:59.999Z'),
      now,
      expected: TaskDeadlineStatus.QUA_HAN,
    },
    {
      name: 'due in exactly five days',
      completedAt: null,
      dueAt: new Date('2026-07-31T00:00:00.000Z'),
      now,
      expected: TaskDeadlineStatus.SAP_DEN_HAN,
    },
    {
      name: 'in progress outside the five-day window',
      completedAt: null,
      dueAt: new Date('2026-07-31T00:00:00.001Z'),
      now,
      expected: TaskDeadlineStatus.DANG_THUC_HIEN,
    },
  ])('$name', ({ completedAt, dueAt: deadline, now: current, expected }) => {
    expect(
      calculateTaskDeadlineStatus({ completedAt, dueAt: deadline }, current),
    ).toBe(expected);
  });
});

describe('TaskStatusJob', () => {
  it('updates only changed ad-hoc task statuses', async () => {
    const now = new Date('2026-07-26T00:00:00.000Z');
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      task: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            dueAt: new Date('2026-07-28T00:00:00.000Z'),
            completedAt: null,
            deadlineStatus: TaskDeadlineStatus.DANG_THUC_HIEN,
          },
          {
            id: 2,
            dueAt: new Date('2026-08-10T00:00:00.000Z'),
            completedAt: null,
            deadlineStatus: TaskDeadlineStatus.DANG_THUC_HIEN,
          },
        ]),
        update,
      },
      $transaction: jest
        .fn()
        .mockImplementation((updates: Promise<unknown>[]) =>
          Promise.all(updates),
        ),
    };
    const job = new TaskStatusJob(prisma as unknown as PrismaService);

    await expect(job.refreshTaskStatuses(now)).resolves.toBe(1);

    expect(prisma.task.findMany).toHaveBeenCalledWith({
      where: {
        type: TaskType.DOT_XUAT,
        deletedAt: null,
        dueAt: { not: null },
      },
      select: {
        id: true,
        dueAt: true,
        completedAt: true,
        deadlineStatus: true,
      },
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deadlineStatus: TaskDeadlineStatus.SAP_DEN_HAN },
    });
  });
});
