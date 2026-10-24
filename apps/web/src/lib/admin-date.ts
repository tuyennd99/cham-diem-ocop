const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_OFFSET_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2}):(\d{2}))$/i;

function parseYmdStrict(day: string): { year: number; month: number; date: number } {
  const match = DAY_RE.exec(day);
  if (!match) {
    throw new Error(`Ngày không hợp lệ: ${day}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, date));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== date
  ) {
    throw new Error(`Ngày không tồn tại trong lịch: ${day}`);
  }
  return { year, month, date };
}

export function isValidIsoWithOffset(value: string): boolean {
  const match = ISO_OFFSET_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (match[9] !== undefined && match[10] !== undefined) {
    const offH = Number(match[9]);
    const offM = Number(match[10]);
    if (offH > 23 || offM > 59) return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, date));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== date
  ) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

export function nextVietnameseDayIso(day: string): string {
  const { year, month, date } = parseYmdStrict(day);
  const next = new Date(Date.UTC(year, month - 1, date + 1));
  return `${next.toISOString().slice(0, 10)}T00:00:00+07:00`;
}

export function vietnameseDayStartIso(day: string): string {
  parseYmdStrict(day);
  return `${day}T00:00:00+07:00`;
}

export function vietnameseDayRange(
  fromDay: string,
  toDay: string,
): { from: string; toExclusive: string } {
  parseYmdStrict(fromDay);
  parseYmdStrict(toDay);
  if (fromDay > toDay) {
    throw new Error('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
  }
  return {
    from: `${fromDay}T00:00:00+07:00`,
    toExclusive: nextVietnameseDayIso(toDay),
  };
}

export function vietnameseDateInput(iso: string): string {
  if (!isValidIsoWithOffset(iso)) {
    throw new Error(`Mốc thời gian không hợp lệ: ${iso}`);
  }
  const shifted = new Date(Date.parse(iso) + VN_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

export function vietnameseInclusiveEndInput(toExclusiveIso: string): string {
  if (!isValidIsoWithOffset(toExclusiveIso)) {
    throw new Error(`Mốc thời gian không hợp lệ: ${toExclusiveIso}`);
  }
  const shiftedMs = Date.parse(toExclusiveIso) + VN_OFFSET_MS;
  const shifted = new Date(shiftedMs);
  const isMidnightVn =
    shifted.getUTCHours() === 0 &&
    shifted.getUTCMinutes() === 0 &&
    shifted.getUTCSeconds() === 0 &&
    shifted.getUTCMilliseconds() === 0;
  if (isMidnightVn) {
    return new Date(shiftedMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  return shifted.toISOString().slice(0, 10);
}
