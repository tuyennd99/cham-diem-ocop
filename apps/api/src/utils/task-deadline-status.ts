import { TaskDeadlineStatus } from '@prisma/client';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export function calculateTaskDeadlineStatus(
  task: { dueAt: Date; completedAt: Date | null },
  now = new Date(),
): TaskDeadlineStatus {
  if (task.completedAt) {
    return task.completedAt.getTime() <= task.dueAt.getTime()
      ? TaskDeadlineStatus.HOAN_THANH_DUNG_HAN
      : TaskDeadlineStatus.HOAN_THANH_QUA_HAN;
  }
  if (now.getTime() > task.dueAt.getTime()) {
    return TaskDeadlineStatus.QUA_HAN;
  }
  return task.dueAt.getTime() <= now.getTime() + FIVE_DAYS_MS
    ? TaskDeadlineStatus.SAP_DEN_HAN
    : TaskDeadlineStatus.DANG_THUC_HIEN;
}
