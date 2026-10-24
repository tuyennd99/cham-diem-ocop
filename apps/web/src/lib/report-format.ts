import type {
  DashboardKpiId,
  DashboardKpiItem,
  PeriodComparisonDelta,
} from '@ocop/shared';
import { formatExactScore } from './print-format';

export function dashboardKpiLinkLabel(id: DashboardKpiId): string | null {
  switch (id) {
    case 'registeredInPeriod':
      return 'Xem hồ sơ đăng ký trong kỳ';
    case 'completedInPeriod':
      return 'Xem hồ sơ hoàn tất trong kỳ';
    case 'fiveStarInPeriod':
      return 'Xem hồ sơ có mức điểm 5 sao';
    case 'passedInPeriod':
    case 'failedInPeriod':
    case 'passRateInPeriod':
    case 'openBacklogAtAsOf':
    case 'underAssignedBacklogAtAsOf':
    default:
      return null;
  }
}

export function formatComparisonDelta(delta: PeriodComparisonDelta): string {
  if (delta.comparisonNote === 'INSUFFICIENT_HISTORY' || delta.current === null) {
    return 'Chưa đủ dữ liệu lịch sử';
  }
  const diff = delta.deltaAbsolute ?? 0;
  const sign = diff > 0 ? `+${diff}` : String(diff);
  if (delta.comparisonNote === 'NO_PRIOR_DATA') {
    return `${sign} (Mới phát sinh / Không có số kỳ trước)`;
  }
  const pct = delta.deltaPercent ?? 0;
  const pctSign = pct > 0 ? `+${pct}%` : `${pct}%`;
  return `${sign} (${pctSign} so với kỳ trước: ${delta.previous ?? 0})`;
}

export function formatKpiValue(kpi: DashboardKpiItem): string {
  if (kpi.availability === 'INSUFFICIENT_HISTORY' || kpi.value === null) {
    return 'Chưa đủ dữ liệu';
  }
  if (kpi.unit === 'PERCENT') {
    return `${formatExactScore(kpi.value)}%`;
  }
  return String(kpi.value);
}

export function formatKpiDeltaText(kpi: DashboardKpiItem): string {
  if (kpi.availability === 'INSUFFICIENT_HISTORY' || kpi.value === null) {
    return 'Chưa đủ dữ liệu lịch sử';
  }
  return formatComparisonDelta({
    current: kpi.value,
    previous: kpi.previousValue,
    deltaAbsolute: kpi.deltaAbsolute,
    deltaPercent: kpi.deltaPercent,
    comparisonNote:
      kpi.availability === 'NO_PRIOR_DATA' ? 'NO_PRIOR_DATA' : 'OK',
  });
}
