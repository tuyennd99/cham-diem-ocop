import {
  COMPARISON_NOTE,
  DASHBOARD_KPI_ID,
  KPI_AVAILABILITY,
  KPI_UNIT,
  PRODUCT_DATE_BASIS,
  PRODUCT_STATUS,
  type AdminProductQuery,
  type AdminReportFilterQuery,
  type DashboardKpiId,
  type DashboardKpiItem,
  type PeriodComparisonDelta,
  type ReportPeriodMetadata,
} from '@ocop/shared';
import { DASHBOARD_CATEGORY_METRIC_MODE } from '../constants/consts';
import { formatExactScore } from './print-format';

export function dashboardKpiLinkLabel(id: DashboardKpiId): string | null {
  switch (id) {
    case DASHBOARD_KPI_ID.REGISTERED_IN_PERIOD:
      return 'Xem hồ sơ đăng ký trong kỳ';
    case DASHBOARD_KPI_ID.COMPLETED_IN_PERIOD:
      return 'Xem hồ sơ hoàn tất trong kỳ';
    case DASHBOARD_KPI_ID.FIVE_STAR_IN_PERIOD:
      return 'Xem hồ sơ có mức điểm 5 sao';
    case DASHBOARD_KPI_ID.PASSED_IN_PERIOD:
    case DASHBOARD_KPI_ID.FAILED_IN_PERIOD:
    case DASHBOARD_KPI_ID.PASS_RATE_IN_PERIOD:
    case DASHBOARD_KPI_ID.OPEN_BACKLOG_AT_AS_OF:
    case DASHBOARD_KPI_ID.UNDER_ASSIGNED_BACKLOG_AT_AS_OF:
    default:
      return null;
  }
}

export function formatComparisonDelta(delta: PeriodComparisonDelta): string {
  if (delta.comparisonNote === COMPARISON_NOTE.INSUFFICIENT_HISTORY || delta.current === null) {
    return 'Chưa đủ dữ liệu lịch sử';
  }
  const diff = delta.deltaAbsolute ?? 0;
  const sign = diff > 0 ? `+${diff}` : String(diff);
  if (delta.comparisonNote === COMPARISON_NOTE.NO_PRIOR_DATA) {
    return `${sign} (Mới phát sinh / Không có số kỳ trước)`;
  }
  const pct = delta.deltaPercent ?? 0;
  const pctSign = pct > 0 ? `+${pct}%` : `${pct}%`;
  return `${sign} (${pctSign} so với kỳ trước: ${delta.previous ?? 0})`;
}

export function formatKpiValue(kpi: DashboardKpiItem): string {
  if (kpi.availability === KPI_AVAILABILITY.INSUFFICIENT_HISTORY || kpi.value === null) {
    return 'Chưa đủ dữ liệu';
  }
  if (kpi.unit === KPI_UNIT.PERCENT) {
    return `${formatExactScore(kpi.value)}%`;
  }
  return String(kpi.value);
}

export function formatKpiDeltaText(kpi: DashboardKpiItem): string {
  if (kpi.availability === KPI_AVAILABILITY.INSUFFICIENT_HISTORY || kpi.value === null) {
    return 'Chưa đủ dữ liệu lịch sử';
  }
  return formatComparisonDelta({
    current: kpi.value,
    previous: kpi.previousValue,
    deltaAbsolute: kpi.deltaAbsolute,
    deltaPercent: kpi.deltaPercent,
    comparisonNote:
      kpi.availability === KPI_AVAILABILITY.NO_PRIOR_DATA
        ? COMPARISON_NOTE.NO_PRIOR_DATA
        : COMPARISON_NOTE.OK,
  });
}

export interface JudgeProgressDisplay {
  isAssigned: boolean;
  submittedText: string;
  pendingText: string;
  percent: number | null;
  progressLabel: string;
  ariaLabel: string;
}

export function formatJudgeProgress(judge: {
  fullName: string;
  assigned: number;
  submitted: number;
  pending: number;
}): JudgeProgressDisplay {
  if (judge.assigned <= 0) {
    return {
      isAssigned: false,
      submittedText: '—',
      pendingText: '—',
      percent: null,
      progressLabel: 'Chưa được giao',
      ariaLabel: `Tiến độ của ${judge.fullName}: Chưa được giao hồ sơ`,
    };
  }
  const percent = Math.min(100, Math.max(0, Math.round((judge.submitted / judge.assigned) * 100)));
  return {
    isAssigned: true,
    submittedText: `${judge.submitted} / ${judge.assigned}`,
    pendingText: String(judge.pending),
    percent,
    progressLabel: `${percent}%`,
    ariaLabel: `Tiến độ của ${judge.fullName}: ${judge.submitted} trên ${judge.assigned} phiếu (${percent}%)`,
  };
}

export function formatNeedsAttentionSubmittedAt(
  submittedAt: string | Date | null | undefined,
): string {
  if (!submittedAt) {
    return 'Chưa ghi nhận ngày nộp';
  }
  const date = submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
  if (Number.isNaN(date.getTime())) {
    return 'Chưa ghi nhận ngày nộp';
  }
  return `Ngày nộp: ${date.toLocaleDateString('vi-VN')}`;
}

export function sortNeedsAttentionByOldest<
  T extends { id: string; submittedAt?: string | Date | null },
>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : Number.NaN;
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : Number.NaN;
    const validA = Number.isFinite(timeA);
    const validB = Number.isFinite(timeB);
    if (validA && validB) {
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    }
    if (validA) return -1;
    if (validB) return 1;
    return a.id.localeCompare(b.id);
  });
}

export type DashboardCategoryMetricMode =
  | (typeof DASHBOARD_CATEGORY_METRIC_MODE)[keyof typeof DASHBOARD_CATEGORY_METRIC_MODE]
  | 'REGISTERED'
  | 'COMPLETED';

export function buildDashboardCategoryDrillDown(args: {
  categoryId: string;
  mode: DashboardCategoryMetricMode;
  period: Pick<ReportPeriodMetadata, 'from' | 'toExclusive'>;
  filtersApplied?: AdminReportFilterQuery;
}): Partial<AdminProductQuery> {
  const { categoryId, mode, period, filtersApplied } = args;
  const isRegistered = mode === DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED || mode === 'REGISTERED';
  return {
    categoryId,
    ...(isRegistered
      ? { dateBasis: PRODUCT_DATE_BASIS.SUBMITTED_AT }
      : {
          dateBasis: PRODUCT_DATE_BASIS.COMPLETED_AT,
          status: PRODUCT_STATUS.COMPLETED,
        }),
    from: period.from,
    toExclusive: period.toExclusive,
    ...(filtersApplied?.localityId ? { localityId: filtersApplied.localityId } : {}),
    ...(filtersApplied?.registrationType
      ? { registrationType: filtersApplied.registrationType }
      : {}),
    ...(filtersApplied?.assessmentYear !== undefined
      ? { assessmentYear: filtersApplied.assessmentYear }
      : {}),
  };
}

export function partitionZeroMonths<T extends { registeredCount: number; completedCount: number }>(
  items: readonly T[],
): {
  active: T[];
  zeroCount: number;
} {
  const active = items.filter((item) => item.registeredCount > 0 || item.completedCount > 0);
  return {
    active,
    zeroCount: items.length - active.length,
  };
}

export function partitionZeroCategories<
  T extends { registeredCount: number; completedCount: number },
>(
  items: readonly T[],
  mode: DashboardCategoryMetricMode,
): {
  active: T[];
  zeroCount: number;
} {
  const isRegistered = mode === DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED || mode === 'REGISTERED';
  const active = items.filter((item) =>
    isRegistered ? item.registeredCount > 0 : item.completedCount > 0,
  );
  return {
    active,
    zeroCount: items.length - active.length,
  };
}
