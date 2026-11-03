export type DateInputParts = { day: string; month: string; year: string };

export function parseDateInputParts({ day, month, year }: DateInputParts): Date | undefined {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) {
    return undefined;
  }

  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (yearNumber < 1000 || monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
    return undefined;
  }

  const date = new Date(yearNumber, monthNumber - 1, dayNumber);
  return date.getFullYear() === yearNumber &&
    date.getMonth() === monthNumber - 1 &&
    date.getDate() === dayNumber
    ? date
    : undefined;
}
