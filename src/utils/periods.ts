import { dayjs } from './dayjs';

export type PeriodFrequency =
  'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

export function buildPeriod(frequency: PeriodFrequency, anchor: Date) {
  const date = dayjs(anchor);
  let dueMonth: number;
  let dueYear = date.year();

  switch (frequency) {
    case 'MONTHLY':
      dueMonth = date.month() + (date.date() >= 15 ? 2 : 1);
      break;
    case 'QUARTERLY':
      dueMonth = Math.ceil((date.month() + 1) / 3) * 3;
      if (date.month() + 1 === dueMonth && date.date() >= 15) dueMonth += 3;
      break;
    case 'SEMI_ANNUAL':
      dueMonth =
        date.month() + 1 < 6 || (date.month() + 1 === 6 && date.date() < 15)
          ? 6
          : 12;
      if (date.month() + 1 === 12 && date.date() >= 15) dueMonth = 18;
      break;
    case 'ANNUAL':
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
    frequency === 'MONTHLY'
      ? 1
      : frequency === 'QUARTERLY'
        ? 3
        : frequency === 'SEMI_ANNUAL'
          ? 6
          : 12;
  const periodStartAt = dueAt.subtract(months, 'month').date(15).startOf('day');

  return {
    periodStartAt: periodStartAt.toDate(),
    dueAt: dueAt.toDate(),
    year: dueYear,
    sequence:
      frequency === 'MONTHLY'
        ? dueMonth
        : frequency === 'QUARTERLY'
          ? dueMonth / 3
          : frequency === 'SEMI_ANNUAL'
            ? dueMonth / 6
            : 1,
  };
}
