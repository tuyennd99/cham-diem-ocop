import dayjs from 'dayjs';
import { Frequency } from '@prisma/client';

export function buildPeriod(frequency: Frequency, anchor: Date) {
  const date = dayjs(anchor);
  let dueMonth: number;
  let dueYear = date.year();

  switch (frequency) {
    case Frequency.MONTHLY:
      dueMonth = date.month() + (date.date() >= 15 ? 2 : 1);
      break;
    case Frequency.QUARTERLY:
      dueMonth = Math.ceil((date.month() + 1) / 3) * 3;
      if (date.month() + 1 === dueMonth && date.date() >= 15) dueMonth += 3;
      break;
    case Frequency.SEMI_ANNUAL:
      dueMonth =
        date.month() + 1 < 6 || (date.month() + 1 === 6 && date.date() < 15)
          ? 6
          : 12;
      if (date.month() + 1 === 12 && date.date() >= 15) dueMonth = 18;
      break;
    case Frequency.ANNUAL:
      dueMonth = 12;
      if (date.month() === 11 && date.date() >= 15) dueYear += 1;
      break;
  }

  while (dueMonth > 12) {
    dueMonth -= 12;
    dueYear += 1;
  }

  const dueAt = dayjs(new Date(dueYear, dueMonth - 1, 14)).endOf('day');
  const months =
    frequency === Frequency.MONTHLY
      ? 1
      : frequency === Frequency.QUARTERLY
        ? 3
        : frequency === Frequency.SEMI_ANNUAL
          ? 6
          : 12;
  const periodStartAt = dueAt.subtract(months, 'month').date(15).startOf('day');

  return {
    periodStartAt: periodStartAt.toDate(),
    dueAt: dueAt.toDate(),
    year: dueYear,
    sequence:
      frequency === Frequency.MONTHLY
        ? dueMonth
        : frequency === Frequency.QUARTERLY
          ? dueMonth / 3
          : frequency === Frequency.SEMI_ANNUAL
            ? dueMonth / 6
            : 1,
  };
}
