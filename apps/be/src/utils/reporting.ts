import { ProductStatus } from '@prisma/client';
import type {
  AdminAnalyticsDashboardResponse,
  AdminProductQuery,
  AdminReportFilterQuery,
  AdminReportQuery,
  DashboardKpiItem,
  PeriodComparisonDelta,
  ProductDateBasis,
  ProductRegistrationType,
  RegistrationReportResponse,
  RegistrationReportRow,
  ReportDataQuality,
  ReportGroupBy,
  ReportPeriodMetadata,
  ResultsReportResponse,
  ResultsReportRow,
  StarBreakdown,
} from '@ocop/shared';
import { formatDateTime } from '@ocop/shared';
import {
  COMPARISON_NOTE,
  DASHBOARD_KPI_ID,
  KPI_AVAILABILITY,
  KPI_UNIT,
  PRODUCT_DATE_BASIS,
  REPORT_GROUP_BY,
  REPORT_KIND,
} from '../constants/products';
import { calculateStars } from './scoring';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatVnBoundaryIso(
  year: number,
  month: number,
  day = 1,
): string {
  return `${year}-${pad2(month)}-${pad2(day)}T00:00:00+07:00`;
}

export function vnBoundaryDate(year: number, month: number, day = 1): Date {
  return new Date(formatVnBoundaryIso(year, month, day));
}

export function toVietnamYearMonth(date: Date): {
  year: number;
  month: number;
} {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

export function resolveVietnamPeriod(
  input: { year?: number; month?: number | null },
  generatedAt = new Date(),
  historyAvailableFrom: Date | null = null,
): ReportPeriodMetadata & {
  fromDate: Date;
  toExclusiveDate: Date;
  asOfDate: Date;
  prevFromDate: Date;
  prevToExclusiveDate: Date;
  prevComparisonToExclusiveDate: Date;
  prevAsOfDate: Date;
} {
  const currentVn = toVietnamYearMonth(generatedAt);
  const year = input.year ?? currentVn.year;
  const month = input.month ?? null;

  const fromIso = month
    ? formatVnBoundaryIso(year, month, 1)
    : formatVnBoundaryIso(year, 1, 1);
  const toExclusiveIso = month
    ? month === 12
      ? formatVnBoundaryIso(year + 1, 1, 1)
      : formatVnBoundaryIso(year, month + 1, 1)
    : formatVnBoundaryIso(year + 1, 1, 1);

  const fromDate = new Date(fromIso);
  const toExclusiveDate = new Date(toExclusiveIso);
  const isPartialPeriod =
    generatedAt.getTime() > fromDate.getTime() &&
    generatedAt.getTime() < toExclusiveDate.getTime();
  const asOfDate =
    generatedAt.getTime() < toExclusiveDate.getTime()
      ? generatedAt
      : toExclusiveDate;

  const prevYear = month ? (month === 1 ? year - 1 : year) : year - 1;
  const prevMonth = month ? (month === 1 ? 12 : month - 1) : null;
  const prevFromIso = prevMonth
    ? formatVnBoundaryIso(prevYear, prevMonth, 1)
    : formatVnBoundaryIso(prevYear, 1, 1);
  const prevToExclusiveIso = prevMonth
    ? prevMonth === 12
      ? formatVnBoundaryIso(prevYear + 1, 1, 1)
      : formatVnBoundaryIso(prevYear, prevMonth + 1, 1)
    : formatVnBoundaryIso(prevYear + 1, 1, 1);

  const prevFromDate = new Date(prevFromIso);
  const prevToExclusiveDate = new Date(prevToExclusiveIso);
  const elapsedMs = Math.max(0, asOfDate.getTime() - fromDate.getTime());
  const prevComparisonToExclusiveDate = isPartialPeriod
    ? new Date(
        Math.min(
          prevToExclusiveDate.getTime(),
          prevFromDate.getTime() + elapsedMs,
        ),
      )
    : prevToExclusiveDate;
  const prevAsOfDate = prevComparisonToExclusiveDate;

  return {
    timezone: 'Asia/Ho_Chi_Minh',
    year,
    month,
    label: month ? `Tháng ${pad2(month)}/${year}` : `Năm ${year}`,
    from: fromIso,
    toExclusive: toExclusiveIso,
    asOf: asOfDate.toISOString(),
    generatedAt: generatedAt.toISOString(),
    isPartialPeriod,
    previousPeriod: {
      label: prevMonth
        ? `Tháng ${pad2(prevMonth)}/${prevYear}`
        : `Năm ${prevYear}`,
      from: prevFromIso,
      toExclusive: prevToExclusiveIso,
      comparisonToExclusive: isPartialPeriod
        ? prevComparisonToExclusiveDate.toISOString()
        : prevToExclusiveIso,
      asOf: prevAsOfDate.toISOString(),
    },
    historyAvailableFrom: historyAvailableFrom
      ? historyAvailableFrom.toISOString()
      : null,
    fromDate,
    toExclusiveDate,
    asOfDate,
    prevFromDate,
    prevToExclusiveDate,
    prevComparisonToExclusiveDate,
    prevAsOfDate,
  };
}

export interface ReportingStatusEvent {
  sequence: number;
  toStatus: ProductStatus;
  createdAt: Date;
}

export interface ReportingProductRecord {
  id: string;
  name: string;
  registrantId: string;
  status: ProductStatus;
  submittedAt: Date | null;
  completedAt: Date | null;
  finalScore: number | null;
  starRating: number | null;
  registrationType: ProductRegistrationType | null;
  assessmentYear: number | null;
  category: {
    id: string;
    name: string;

    criterionIds?: string[];
  };
  locality: {
    id: string;
    code: string;
    name: string;
    provinceName: string;
  } | null;
  statusEvents: ReportingStatusEvent[];
}

export function statusAtAsOf(
  events: readonly ReportingStatusEvent[],
  asOf: Date,
): ProductStatus | null {
  let latest: ReportingStatusEvent | null = null;
  for (const event of events) {
    if (event.createdAt.getTime() < asOf.getTime()) {
      if (
        !latest ||
        event.createdAt.getTime() > latest.createdAt.getTime() ||
        (event.createdAt.getTime() === latest.createdAt.getTime() &&
          event.sequence > latest.sequence)
      ) {
        latest = event;
      }
    }
  }
  return latest ? latest.toStatus : null;
}

function isValidCompletedResult(product: ReportingProductRecord): boolean {
  if (
    typeof product.finalScore !== 'number' ||
    !Number.isFinite(product.finalScore) ||
    product.finalScore < 0 ||
    product.finalScore > 100 ||
    typeof product.starRating !== 'number' ||
    product.starRating < 1 ||
    product.starRating > 5
  ) {
    return false;
  }
  return calculateStars(product.finalScore) === product.starRating;
}

export function matchesReportDimensionFilters(
  product: ReportingProductRecord,
  query: AdminReportFilterQuery,
): boolean {
  if (query.categoryId && product.category.id !== query.categoryId)
    return false;
  if (query.localityId && product.locality?.id !== query.localityId)
    return false;
  if (
    query.registrationType &&
    product.registrationType !== query.registrationType
  )
    return false;
  if (
    query.assessmentYear !== undefined &&
    product.assessmentYear !== query.assessmentYear
  )
    return false;
  return true;
}

function emptyStars(): StarBreakdown {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

export function computeComparisonDelta(
  current: number | null,
  previous: number | null,
  insufficientHistory = false,
): PeriodComparisonDelta {
  if (insufficientHistory || current === null) {
    return {
      current,
      previous: null,
      deltaAbsolute: null,
      deltaPercent: null,
      comparisonNote: COMPARISON_NOTE.INSUFFICIENT_HISTORY,
    };
  }
  if (previous === null) {
    return {
      current,
      previous: null,
      deltaAbsolute: null,
      deltaPercent: null,
      comparisonNote: COMPARISON_NOTE.NO_PRIOR_DATA,
    };
  }
  if (previous === 0) {
    return {
      current,
      previous: 0,
      deltaAbsolute: current,
      deltaPercent: null,
      comparisonNote: COMPARISON_NOTE.NO_PRIOR_DATA,
    };
  }
  const deltaAbsolute = current - previous;
  const deltaPercent =
    Math.round(((current - previous) / previous) * 10000) / 100;
  return {
    current,
    previous,
    deltaAbsolute,
    deltaPercent,
    comparisonNote: COMPARISON_NOTE.OK,
  };
}

const WAITING_REPORT_STATUSES = new Set<ProductStatus>([
  ProductStatus.SUBMITTED,
  ProductStatus.RETURNED,
  ProductStatus.APPROVED,
]);

const OPEN_BACKLOG_STATUSES = new Set<ProductStatus>([
  ...WAITING_REPORT_STATUSES,
  ProductStatus.SCORING,
]);

export function resolveProductStatusAtAsOf(
  product: Pick<
    ReportingProductRecord,
    'status' | 'completedAt' | 'statusEvents'
  >,
  asOfDate: Date,
  now: Date,
): ProductStatus | null {
  const eventStatus = statusAtAsOf(product.statusEvents, asOfDate);
  if (eventStatus) return eventStatus;
  if (
    product.completedAt &&
    product.completedAt.getTime() < asOfDate.getTime()
  ) {
    return ProductStatus.COMPLETED;
  }
  if (asOfDate.getTime() >= now.getTime()) {
    return product.status;
  }
  return null;
}

function aggregateRegistrationRows(
  items: readonly ReportingProductRecord[],
  asOfDate: Date,
  now: Date,
  key: string,
  label: string,
  drillDown: Partial<AdminProductQuery>,
): RegistrationReportRow {
  const starCounts = emptyStars();
  const registrants = new Set<string>();
  let waitingCount = 0;
  let scoringCount = 0;
  let completedCount = 0;
  let completedValidCount = 0;
  let passedCount = 0;
  let failedCount = 0;
  let scoreSum = 0;
  let unmappedLocalityCount = 0;
  let missingDataCount = 0;

  for (const product of items) {
    registrants.add(product.registrantId);
    if (!product.locality) unmappedLocalityCount++;

    const resolvedStatus = resolveProductStatusAtAsOf(product, asOfDate, now);
    if (!resolvedStatus || resolvedStatus === ProductStatus.DRAFT) {
      missingDataCount++;
      continue;
    }
    if (WAITING_REPORT_STATUSES.has(resolvedStatus)) {
      waitingCount++;
      continue;
    }
    if (resolvedStatus === ProductStatus.SCORING) {
      scoringCount++;
      continue;
    }
    if (resolvedStatus !== ProductStatus.COMPLETED) {
      continue;
    }
    completedCount++;
    if (!isValidCompletedResult(product)) {
      missingDataCount++;
      continue;
    }
    completedValidCount++;
    scoreSum += product.finalScore!;
    const star = product.starRating as 1 | 2 | 3 | 4 | 5;
    starCounts[star]++;
    if (product.finalScore! >= 50) passedCount++;
    else failedCount++;
  }

  const passRate =
    completedValidCount > 0
      ? Math.round((passedCount / completedValidCount) * 10000) / 100
      : null;
  const averageScore =
    completedValidCount > 0
      ? Math.round((scoreSum / completedValidCount) * 100) / 100
      : null;

  return {
    key,
    label,
    drillDown,
    registeredCount: items.length,
    waitingCount,
    scoringCount,
    completedCount,
    completedValidCount,
    passedCount,
    failedCount,
    passRate,
    averageScore,
    starCounts,
    distinctRegistrantCount: registrants.size,
    unmappedLocalityCount,
    missingDataCount,
  };
}

function aggregateResultsRows(
  items: readonly ReportingProductRecord[],
  key: string,
  label: string,
  drillDown: Partial<AdminProductQuery>,
): ResultsReportRow {
  const starCounts = emptyStars();
  const registrants = new Set<string>();
  let completedValidCount = 0;
  let passedCount = 0;
  let failedCount = 0;
  let scoreSum = 0;
  let unmappedLocalityCount = 0;
  let invalidResultCount = 0;

  for (const product of items) {
    registrants.add(product.registrantId);
    if (!product.locality) unmappedLocalityCount++;
    if (isValidCompletedResult(product)) {
      completedValidCount++;
      scoreSum += product.finalScore!;
      const star = product.starRating as 1 | 2 | 3 | 4 | 5;
      starCounts[star]++;
      if (product.finalScore! >= 50) passedCount++;
      else failedCount++;
    } else {
      invalidResultCount++;
    }
  }

  const passRate =
    completedValidCount > 0
      ? Math.round((passedCount / completedValidCount) * 10000) / 100
      : null;
  const averageScore =
    completedValidCount > 0
      ? Math.round((scoreSum / completedValidCount) * 100) / 100
      : null;

  return {
    key,
    label,
    drillDown,
    completedCount: items.length,
    completedValidCount,
    passedCount,
    failedCount,
    passRate,
    averageScore,
    starCounts,
    distinctRegistrantCount: registrants.size,
    unmappedLocalityCount,
    invalidResultCount,
  };
}

function resolveGroupingBuckets(
  items: readonly ReportingProductRecord[],
  groupBy: ReportGroupBy,
  dateField: ProductDateBasis,
  period: ReturnType<typeof resolveVietnamPeriod>,
  baseQuery: AdminReportFilterQuery,
  catalogs: {
    categories: Array<{ id: string; name: string }>;
    localities: Array<{
      id: string;
      code: string;
      name: string;
      provinceName: string;
    }>;
  },
): Array<{
  key: string;
  label: string;
  drillDown: Partial<AdminProductQuery>;
  items: ReportingProductRecord[];
}> {
  const baseDrill: Partial<AdminProductQuery> = {
    dateBasis: dateField,
    from: period.from,
    toExclusive: period.toExclusive,

    ...(baseQuery.categoryId ? { categoryId: baseQuery.categoryId } : {}),
    ...(baseQuery.localityId ? { localityId: baseQuery.localityId } : {}),
    ...(baseQuery.registrationType
      ? { registrationType: baseQuery.registrationType }
      : {}),
    ...(baseQuery.assessmentYear !== undefined
      ? { assessmentYear: baseQuery.assessmentYear }
      : {}),
  };

  if (groupBy === REPORT_GROUP_BY.YEAR) {
    return [
      {
        key: String(period.year),
        label: `Năm ${period.year}`,
        drillDown: baseDrill,
        items: [...items],
      },
    ];
  }

  if (groupBy === REPORT_GROUP_BY.MONTH) {
    const months = period.month
      ? [period.month]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    return months.map((m) => {
      const mFrom = formatVnBoundaryIso(period.year, m, 1);
      const mTo =
        m === 12
          ? formatVnBoundaryIso(period.year + 1, 1, 1)
          : formatVnBoundaryIso(period.year, m + 1, 1);
      const mFromMs = new Date(mFrom).getTime();
      const mToMs = new Date(mTo).getTime();
      const bucketItems = items.filter((p) => {
        const dt = p[dateField];
        return dt !== null && dt.getTime() >= mFromMs && dt.getTime() < mToMs;
      });
      return {
        key: `${period.year}-${pad2(m)}`,
        label: `Tháng ${pad2(m)}/${period.year}`,
        drillDown: { ...baseDrill, from: mFrom, toExclusive: mTo },
        items: bucketItems,
      };
    });
  }

  if (groupBy === REPORT_GROUP_BY.CATEGORY) {
    return catalogs.categories
      .filter((c) => !baseQuery.categoryId || c.id === baseQuery.categoryId)
      .map((c) => ({
        key: c.id,
        label: c.name,
        drillDown: { ...baseDrill, categoryId: c.id },
        items: items.filter((p) => p.category.id === c.id),
      }));
  }

  // groupBy === REPORT_GROUP_BY.LOCALITY
  const byLoc = new Map<string, ReportingProductRecord[]>();
  const unmapped: ReportingProductRecord[] = [];
  for (const item of items) {
    if (!item.locality) {
      unmapped.push(item);
    } else {
      const list = byLoc.get(item.locality.id) ?? [];
      list.push(item);
      byLoc.set(item.locality.id, list);
    }
  }
  const knownLocalities = new Map(
    catalogs.localities.map((loc) => [loc.id, loc]),
  );
  for (const item of items) {
    if (item.locality && !knownLocalities.has(item.locality.id)) {
      knownLocalities.set(item.locality.id, item.locality);
    }
  }
  const rows: Array<{
    key: string;
    label: string;
    drillDown: Partial<AdminProductQuery>;
    items: ReportingProductRecord[];
  }> = [];
  for (const loc of knownLocalities.values()) {
    if (baseQuery.localityId && loc.id !== baseQuery.localityId) continue;
    const locItems = byLoc.get(loc.id) ?? [];
    if (locItems.length > 0 || baseQuery.localityId === loc.id) {
      rows.push({
        key: loc.id,
        label: `${loc.name} (${loc.code}) · ${loc.provinceName}`,
        drillDown: { ...baseDrill, localityId: loc.id },
        items: locItems,
      });
    }
  }
  if (!baseQuery.localityId && (unmapped.length > 0 || rows.length === 0)) {
    rows.push({
      key: 'UNMAPPED_LOCALITY',
      label: 'Chưa xác định địa bàn',
      drillDown: { ...baseDrill, unmappedLocality: true },
      items: unmapped,
    });
  }
  return rows;
}

function computeDataQuality(
  dimensionFilteredProducts: readonly ReportingProductRecord[],
  cohortProducts: readonly ReportingProductRecord[],
  asOfDate: Date,
  now: Date,
  assignmentHistoryAvailable: boolean,
): ReportDataQuality {
  let missingSubmittedAtCount = 0;
  let missingCompletedAtCount = 0;
  for (const p of dimensionFilteredProducts) {
    if (p.status !== ProductStatus.DRAFT && !p.submittedAt)
      missingSubmittedAtCount++;
    if (p.status === ProductStatus.COMPLETED && !p.completedAt)
      missingCompletedAtCount++;
  }

  let unmappedLocalityCount = 0;
  let missingStatusHistoryCount = 0;
  let invalidResultCount = 0;
  for (const p of cohortProducts) {
    if (!p.locality) unmappedLocalityCount++;
    const evStatus = statusAtAsOf(p.statusEvents, asOfDate);
    if (
      !evStatus &&
      !(p.completedAt && p.completedAt.getTime() < asOfDate.getTime()) &&
      asOfDate.getTime() < now.getTime()
    ) {
      missingStatusHistoryCount++;
    }
    if (
      (evStatus === ProductStatus.COMPLETED ||
        (p.completedAt && p.completedAt.getTime() < asOfDate.getTime())) &&
      !isValidCompletedResult(p)
    ) {
      invalidResultCount++;
    }
  }

  return {
    unmappedLocalityCount,
    missingSubmittedAtCount,
    missingCompletedAtCount,
    missingStatusHistoryCount,
    invalidResultCount,
    assignmentHistoryAvailable,
  };
}

export function buildRegistrationReport(input: {
  query: AdminReportQuery;
  products: readonly ReportingProductRecord[];

  categories: Array<{
    id: string;
    name: string;
  }>;
  localities: Array<{
    id: string;
    code: string;
    name: string;
    provinceName: string;
  }>;
  now?: Date;
  historyAvailableFrom?: Date | null;
  assignmentHistoryAvailable?: boolean;
  preFilteredProducts?: readonly ReportingProductRecord[];
}): RegistrationReportResponse {
  const now = input.now ?? new Date();
  const groupBy: ReportGroupBy =
    input.query.groupBy ??
    (input.query.month ? REPORT_GROUP_BY.LOCALITY : REPORT_GROUP_BY.MONTH);
  const period = resolveVietnamPeriod(
    { year: input.query.year, month: input.query.month },
    now,
    input.historyAvailableFrom ?? null,
  );

  // Deduplicate by product.id (REP-01)
  const dimensionFiltered = input.preFilteredProducts
    ? [...input.preFilteredProducts]
    : [...new Map(input.products.map((p) => [p.id, p])).values()].filter((p) =>
        matchesReportDimensionFilters(p, input.query),
      );

  const currentCohort = dimensionFiltered.filter(
    (p) =>
      p.status !== ProductStatus.DRAFT &&
      p.submittedAt !== null &&
      p.submittedAt.getTime() >= period.fromDate.getTime() &&
      p.submittedAt.getTime() < period.asOfDate.getTime(),
  );

  const prevCohort = dimensionFiltered.filter(
    (p) =>
      p.status !== ProductStatus.DRAFT &&
      p.submittedAt !== null &&
      p.submittedAt.getTime() >= period.prevFromDate.getTime() &&
      p.submittedAt.getTime() < period.prevComparisonToExclusiveDate.getTime(),
  );

  const baseDrill: Partial<AdminProductQuery> = {
    dateBasis: PRODUCT_DATE_BASIS.SUBMITTED_AT,
    from: period.from,
    toExclusive: period.toExclusive,

    ...(input.query.categoryId ? { categoryId: input.query.categoryId } : {}),
    ...(input.query.localityId ? { localityId: input.query.localityId } : {}),
    ...(input.query.registrationType
      ? { registrationType: input.query.registrationType }
      : {}),
    ...(input.query.assessmentYear !== undefined
      ? { assessmentYear: input.query.assessmentYear }
      : {}),
  };

  const totals = aggregateRegistrationRows(
    currentCohort,
    period.asOfDate,
    now,
    'TOTAL',
    'Tổng toàn hệ thống',
    baseDrill,
  );
  const previousTotals = aggregateRegistrationRows(
    prevCohort,
    period.prevAsOfDate,
    now,
    'PREVIOUS_TOTAL',
    period.previousPeriod.label,
    {
      ...baseDrill,
      from: period.previousPeriod.from,
      toExclusive: period.previousPeriod.comparisonToExclusive,
    },
  );

  const buckets = resolveGroupingBuckets(
    currentCohort,
    groupBy,
    PRODUCT_DATE_BASIS.SUBMITTED_AT,
    period,
    input.query,
    {
      categories: input.categories,
      localities: input.localities,
    },
  );
  const rows = buckets.map((b) =>
    aggregateRegistrationRows(
      b.items,
      period.asOfDate,
      now,
      b.key,
      b.label,
      b.drillDown,
    ),
  );

  const dataQuality = computeDataQuality(
    dimensionFiltered,
    currentCohort,
    period.asOfDate,
    now,
    Boolean(input.assignmentHistoryAvailable),
  );

  const {
    fromDate: _f,
    toExclusiveDate: _t,
    asOfDate: _a,
    prevFromDate: _pf,
    prevToExclusiveDate: _pt,
    prevComparisonToExclusiveDate: _pct,
    prevAsOfDate: _pa,
    ...periodMeta
  } = period;

  return {
    kind: REPORT_KIND.REGISTRATIONS,
    period: periodMeta,
    filtersApplied: { ...input.query, year: period.year, groupBy },
    groupBy,
    totals,
    previousTotals,
    comparison: {
      registeredCount: computeComparisonDelta(
        totals.registeredCount,
        previousTotals.registeredCount,
      ),
      completedCount: computeComparisonDelta(
        totals.completedCount,
        previousTotals.completedCount,
      ),
      passedCount: computeComparisonDelta(
        totals.passedCount,
        previousTotals.passedCount,
      ),
      failedCount: computeComparisonDelta(
        totals.failedCount,
        previousTotals.failedCount,
      ),
    },
    rows,
    dataQuality,
  };
}

export function buildResultsReport(input: {
  query: AdminReportQuery;
  products: readonly ReportingProductRecord[];

  categories: Array<{
    id: string;
    name: string;
  }>;
  localities: Array<{
    id: string;
    code: string;
    name: string;
    provinceName: string;
  }>;
  now?: Date;
  historyAvailableFrom?: Date | null;
  assignmentHistoryAvailable?: boolean;
  preFilteredProducts?: readonly ReportingProductRecord[];
}): ResultsReportResponse {
  const now = input.now ?? new Date();
  const groupBy: ReportGroupBy =
    input.query.groupBy ??
    (input.query.month ? REPORT_GROUP_BY.LOCALITY : REPORT_GROUP_BY.MONTH);
  const period = resolveVietnamPeriod(
    { year: input.query.year, month: input.query.month },
    now,
    input.historyAvailableFrom ?? null,
  );

  const dimensionFiltered = input.preFilteredProducts
    ? [...input.preFilteredProducts]
    : [...new Map(input.products.map((p) => [p.id, p])).values()].filter((p) =>
        matchesReportDimensionFilters(p, input.query),
      );

  const currentCompleted = dimensionFiltered.filter(
    (p) =>
      p.status === ProductStatus.COMPLETED &&
      p.completedAt !== null &&
      p.completedAt.getTime() >= period.fromDate.getTime() &&
      p.completedAt.getTime() < period.asOfDate.getTime(),
  );

  const prevCompleted = dimensionFiltered.filter(
    (p) =>
      p.status === ProductStatus.COMPLETED &&
      p.completedAt !== null &&
      p.completedAt.getTime() >= period.prevFromDate.getTime() &&
      p.completedAt.getTime() < period.prevComparisonToExclusiveDate.getTime(),
  );

  const baseDrill: Partial<AdminProductQuery> = {
    dateBasis: PRODUCT_DATE_BASIS.COMPLETED_AT,
    status: ProductStatus.COMPLETED,
    from: period.from,
    toExclusive: period.toExclusive,

    ...(input.query.categoryId ? { categoryId: input.query.categoryId } : {}),
    ...(input.query.localityId ? { localityId: input.query.localityId } : {}),
    ...(input.query.registrationType
      ? { registrationType: input.query.registrationType }
      : {}),
    ...(input.query.assessmentYear !== undefined
      ? { assessmentYear: input.query.assessmentYear }
      : {}),
  };

  const totals = aggregateResultsRows(
    currentCompleted,
    'TOTAL',
    'Tổng toàn hệ thống',
    baseDrill,
  );
  const previousTotals = aggregateResultsRows(
    prevCompleted,
    'PREVIOUS_TOTAL',
    period.previousPeriod.label,
    {
      ...baseDrill,
      from: period.previousPeriod.from,
      toExclusive: period.previousPeriod.comparisonToExclusive,
    },
  );

  const buckets = resolveGroupingBuckets(
    currentCompleted,
    groupBy,
    PRODUCT_DATE_BASIS.COMPLETED_AT,
    period,
    input.query,
    {
      categories: input.categories,
      localities: input.localities,
    },
  );
  const rows = buckets.map((b) =>
    aggregateResultsRows(b.items, b.key, b.label, b.drillDown),
  );

  const dataQuality = computeDataQuality(
    dimensionFiltered,
    currentCompleted,
    period.asOfDate,
    now,
    Boolean(input.assignmentHistoryAvailable),
  );

  const {
    fromDate: _f,
    toExclusiveDate: _t,
    asOfDate: _a,
    prevFromDate: _pf,
    prevToExclusiveDate: _pt,
    prevComparisonToExclusiveDate: _pct,
    prevAsOfDate: _pa,
    ...periodMeta
  } = period;

  return {
    kind: REPORT_KIND.RESULTS,
    period: periodMeta,
    filtersApplied: { ...input.query, year: period.year, groupBy },
    groupBy,
    totals,
    previousTotals,
    comparison: {
      completedCount: computeComparisonDelta(
        totals.completedCount,
        previousTotals.completedCount,
      ),
      passedCount: computeComparisonDelta(
        totals.passedCount,
        previousTotals.passedCount,
      ),
      failedCount: computeComparisonDelta(
        totals.failedCount,
        previousTotals.failedCount,
      ),
      star5Count: computeComparisonDelta(
        totals.starCounts[5],
        previousTotals.starCounts[5],
      ),
    },
    rows,
    dataQuality,
  };
}

export function buildAnalyticsDashboard(input: {
  query: AdminReportFilterQuery;
  products: readonly ReportingProductRecord[];

  categories: Array<{
    id: string;
    name: string;
  }>;
  localities: Array<{
    id: string;
    code: string;
    name: string;
    provinceName: string;
  }>;
  coveredCategoryIdsAtNow: ReadonlySet<string>;
  now?: Date;
  historyAvailableFrom?: Date | null;
  productsByStatus: Record<ProductStatus, number>;
  judges: Array<{
    judgeId: string;
    fullName: string;
    assigned: number;
    submitted: number;
    pending: number;
  }>;
  needsAttention: Array<{
    id: string;
    name: string;
    status: 'SUBMITTED' | 'APPROVED' | 'SCORING';
    submittedAt: string | null;
    category: { id: string; name: string };
    assignedJudgeCount: number;
    submittedEvaluationCount: number;
    pendingEvaluationCount: number;
    missingCriteriaCount: number;
  }>;
}): AdminAnalyticsDashboardResponse {
  const now = input.now ?? new Date();
  const period = resolveVietnamPeriod(
    { year: input.query.year, month: input.query.month },
    now,
    input.historyAvailableFrom ?? null,
  );
  const isCurrentAsOf = period.asOfDate.getTime() >= now.getTime();

  const uniqueProducts = [
    ...new Map(input.products.map((p) => [p.id, p])).values(),
  ];
  const dimensionFiltered = uniqueProducts.filter((p) =>
    matchesReportDimensionFilters(p, input.query),
  );

  const regReport = buildRegistrationReport({
    query: { ...input.query, groupBy: REPORT_GROUP_BY.CATEGORY },
    products: dimensionFiltered,
    preFilteredProducts: dimensionFiltered,

    categories: input.categories,
    localities: input.localities,
    now,
    historyAvailableFrom: input.historyAvailableFrom,
    assignmentHistoryAvailable: isCurrentAsOf,
  });

  const resReport = buildResultsReport({
    query: { ...input.query, groupBy: REPORT_GROUP_BY.CATEGORY },
    products: dimensionFiltered,
    preFilteredProducts: dimensionFiltered,

    categories: input.categories,
    localities: input.localities,
    now,
    historyAvailableFrom: input.historyAvailableFrom,
    assignmentHistoryAvailable: isCurrentAsOf,
  });

  // KPI 7: Open backlog at asOf (submitted before asOf, not completed at asOf)
  let openBacklogAtAsOf: number | null = 0;
  let openBacklogMissingHistory = false;
  const openBacklogItems: ReportingProductRecord[] = [];

  for (const p of dimensionFiltered) {
    if (
      p.status === ProductStatus.DRAFT ||
      !p.submittedAt ||
      p.submittedAt.getTime() >= period.asOfDate.getTime()
    ) {
      continue;
    }
    const resolved = resolveProductStatusAtAsOf(p, period.asOfDate, now);
    if (!resolved) {
      openBacklogMissingHistory = true;
      continue;
    }
    if (OPEN_BACKLOG_STATUSES.has(resolved)) {
      openBacklogItems.push(p);
    }
  }
  openBacklogAtAsOf = openBacklogMissingHistory
    ? null
    : openBacklogItems.length;

  // Previous period open backlog at prevAsOf
  let prevOpenBacklogAtAsOf: number | null = 0;
  let prevBacklogMissingHistory = false;
  for (const p of dimensionFiltered) {
    if (
      p.status === ProductStatus.DRAFT ||
      !p.submittedAt ||
      p.submittedAt.getTime() >= period.prevAsOfDate.getTime()
    ) {
      continue;
    }
    const evStatus = statusAtAsOf(p.statusEvents, period.prevAsOfDate);
    if (!evStatus) {
      if (
        p.completedAt &&
        p.completedAt.getTime() < period.prevAsOfDate.getTime()
      ) {
        continue;
      }
      prevBacklogMissingHistory = true;
      continue;
    }
    if (OPEN_BACKLOG_STATUSES.has(evStatus)) {
      prevOpenBacklogAtAsOf++;
    }
  }
  if (prevBacklogMissingHistory) prevOpenBacklogAtAsOf = null;

  // KPI 8: Under-assigned backlog at asOf (only available when asOf is current snapshot; historical assignment scope is not inferred from current assignments per Spec 10.2)
  const underAssignedCount = isCurrentAsOf
    ? openBacklogItems.filter(
        (p) => !input.coveredCategoryIdsAtNow.has(p.category.id),
      ).length
    : null;

  function makeKpi(args: {
    id: DashboardKpiItem['id'];
    label: string;
    basisLabel: string;
    unit: DashboardKpiItem['unit'];
    current: number | null;
    previous: number | null;
    insufficientHistory?: boolean;
    drillDown: Partial<AdminProductQuery>;
  }): DashboardKpiItem {
    const delta = computeComparisonDelta(
      args.current,
      args.previous,
      args.insufficientHistory,
    );
    return {
      id: args.id,
      label: args.label,
      basisLabel: args.basisLabel,
      unit: args.unit,
      value: args.current,
      previousValue: delta.previous,
      deltaAbsolute: delta.deltaAbsolute,
      deltaPercent: delta.deltaPercent,
      availability:
        delta.comparisonNote === COMPARISON_NOTE.INSUFFICIENT_HISTORY
          ? KPI_AVAILABILITY.INSUFFICIENT_HISTORY
          : delta.comparisonNote === COMPARISON_NOTE.NO_PRIOR_DATA
            ? KPI_AVAILABILITY.NO_PRIOR_DATA
            : KPI_AVAILABILITY.AVAILABLE,
      drillDown: args.drillDown,
    };
  }

  const baseRegDrill = regReport.totals.drillDown;
  const baseResDrill = resReport.totals.drillDown;

  const kpis: DashboardKpiItem[] = [
    makeKpi({
      id: DASHBOARD_KPI_ID.REGISTERED_IN_PERIOD,
      label: 'Hồ sơ đăng ký trong kỳ',
      basisLabel: `Nộp trong kỳ (${period.label})`,
      unit: KPI_UNIT.COUNT,
      current: regReport.totals.registeredCount,
      previous: regReport.previousTotals.registeredCount,
      drillDown: baseRegDrill,
    }),
    makeKpi({
      id: DASHBOARD_KPI_ID.COMPLETED_IN_PERIOD,
      label: 'Hồ sơ hoàn tất trong kỳ',
      basisLabel: `Hoàn tất trong kỳ (${period.label})`,
      unit: KPI_UNIT.COUNT,
      current: resReport.totals.completedCount,
      previous: resReport.previousTotals.completedCount,
      drillDown: baseResDrill,
    }),
    makeKpi({
      id: DASHBOARD_KPI_ID.PASSED_IN_PERIOD,
      label: 'Đạt ngưỡng từ 3 sao theo điểm',
      basisLabel: `Hoàn tất ≥ 50 điểm (${period.label})`,
      unit: KPI_UNIT.COUNT,
      current: resReport.totals.passedCount,
      previous: resReport.previousTotals.passedCount,
      drillDown: baseResDrill,
    }),
    makeKpi({
      id: DASHBOARD_KPI_ID.FAILED_IN_PERIOD,
      label: 'Chưa đạt ngưỡng 3 sao',
      basisLabel: `Hoàn tất < 50 điểm (${period.label})`,
      unit: KPI_UNIT.COUNT,
      current: resReport.totals.failedCount,
      previous: resReport.previousTotals.failedCount,
      drillDown: baseResDrill,
    }),
    makeKpi({
      id: DASHBOARD_KPI_ID.PASS_RATE_IN_PERIOD,
      label: 'Tỷ lệ đạt theo điểm',
      basisLabel: `Đạt / hoàn tất hợp lệ (${period.label})`,
      unit: KPI_UNIT.PERCENT,
      current: resReport.totals.passRate,
      previous: resReport.previousTotals.passRate,
      insufficientHistory: resReport.totals.passRate === null,
      drillDown: baseResDrill,
    }),
    makeKpi({
      id: DASHBOARD_KPI_ID.FIVE_STAR_IN_PERIOD,
      label: 'Mức điểm 5 sao',
      basisLabel: `90–100 điểm · Đề nghị xem xét 5 sao (${period.label})`,
      unit: KPI_UNIT.COUNT,
      current: resReport.totals.starCounts[5],
      previous: resReport.previousTotals.starCounts[5],
      drillDown: { ...baseResDrill, starRating: 5 },
    }),
    makeKpi({
      id: DASHBOARD_KPI_ID.OPEN_BACKLOG_AT_AS_OF,
      label: 'Hồ sơ còn chờ/đang chấm tại mốc chốt',
      basisLabel: `Tồn tại mốc chốt ${formatDateTime(period.asOf)}`,
      unit: KPI_UNIT.COUNT,
      current: openBacklogAtAsOf,
      previous: prevOpenBacklogAtAsOf,
      insufficientHistory: openBacklogAtAsOf === null,
      drillDown: { status: ProductStatus.SUBMITTED },
    }),
    makeKpi({
      id: DASHBOARD_KPI_ID.UNDER_ASSIGNED_BACKLOG_AT_AS_OF,
      label: 'Hồ sơ chưa đủ phân công tại mốc chốt',
      basisLabel: `Tồn thiếu phủ tiêu chí tại mốc chốt ${formatDateTime(period.asOf)}`,
      unit: KPI_UNIT.COUNT,
      current: underAssignedCount,
      previous: null,
      insufficientHistory: underAssignedCount === null,
      drillDown: { status: ProductStatus.SUBMITTED },
    }),
  ];

  // Chart 1: Monthly trend for the selected year (12 months) in a single O(N) pass
  const monthBounds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
    const mFrom = formatVnBoundaryIso(period.year, m, 1);
    const mTo =
      m === 12
        ? formatVnBoundaryIso(period.year + 1, 1, 1)
        : formatVnBoundaryIso(period.year, m + 1, 1);
    const mFromMs = new Date(mFrom).getTime();
    const mToMs = Math.min(new Date(mTo).getTime(), period.asOfDate.getTime());
    return {
      month: m,
      label: `T${m}`,
      from: mFrom,
      toExclusive: mTo,
      fromMs: mFromMs,
      toMs: mToMs,
      registeredCount: 0,
      completedCount: 0,
    };
  });
  const yearStartMs = monthBounds[0].fromMs;
  const asOfMs = period.asOfDate.getTime();
  for (const p of dimensionFiltered) {
    if (p.status !== ProductStatus.DRAFT && p.submittedAt !== null) {
      const subMs = p.submittedAt.getTime();
      if (subMs >= yearStartMs && subMs < asOfMs) {
        const { year, month } = toVietnamYearMonth(p.submittedAt);
        if (year === period.year) {
          const bucket = monthBounds[month - 1];
          if (bucket && subMs >= bucket.fromMs && subMs < bucket.toMs) {
            bucket.registeredCount += 1;
          }
        }
      }
    }
    if (p.status === ProductStatus.COMPLETED && p.completedAt !== null) {
      const compMs = p.completedAt.getTime();
      if (compMs >= yearStartMs && compMs < asOfMs) {
        const { year, month } = toVietnamYearMonth(p.completedAt);
        if (year === period.year) {
          const bucket = monthBounds[month - 1];
          if (bucket && compMs >= bucket.fromMs && compMs < bucket.toMs) {
            bucket.completedCount += 1;
          }
        }
      }
    }
  }
  const monthlyTrend = monthBounds.map(
    ({ month, label, registeredCount, completedCount, from, toExclusive }) => ({
      month,
      label,
      registeredCount,
      completedCount,
      from,
      toExclusive,
    }),
  );

  // Chart 2: By product group + drill-down categories (reuses regReport/resReport CATEGORY aggregates)
  const regByCategory = new Map(
    regReport.rows.map((row) => [row.key, row.registeredCount]),
  );
  const resByCategory = new Map(
    resReport.rows.map((row) => [row.key, row.completedCount]),
  );
  const byCategory = input.categories.map((cat) => ({
    categoryId: cat.id,
    categoryName: cat.name,
    registeredCount: regByCategory.get(cat.id) ?? 0,
    completedCount: resByCategory.get(cat.id) ?? 0,
  }));

  // Chart 3: Cohort progress of registrations in period
  const cohortProgress = {
    registeredCount: regReport.totals.registeredCount,
    waitingCount: regReport.totals.waitingCount,
    scoringCount: regReport.totals.scoringCount,
    completedCount: regReport.totals.completedCount,
    missingStatusHistoryCount: regReport.totals.missingDataCount,
  };

  // Chart 4: Star distribution of valid completed results in period
  const validTotal = resReport.totals.completedValidCount;
  const starLabels: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: '1 sao (< 30 điểm)',
    2: '2 sao (30 – < 50 điểm)',
    3: '3 sao (50 – < 70 điểm)',
    4: '4 sao (70 – < 90 điểm)',
    5: 'Mức điểm 5 sao (90 – 100 điểm)',
  };
  const starDistribution = ([1, 2, 3, 4, 5] as const).map((stars) => {
    const count = resReport.totals.starCounts[stars];
    return {
      stars,
      label: starLabels[stars],
      count,
      percentage:
        validTotal > 0 ? Math.round((count / validTotal) * 10000) / 100 : null,
    };
  });

  const combinedDataQuality: ReportDataQuality = {
    unmappedLocalityCount: Math.max(
      regReport.dataQuality.unmappedLocalityCount,
      resReport.dataQuality.unmappedLocalityCount,
    ),
    missingSubmittedAtCount: regReport.dataQuality.missingSubmittedAtCount,
    missingCompletedAtCount: resReport.dataQuality.missingCompletedAtCount,
    missingStatusHistoryCount: regReport.dataQuality.missingStatusHistoryCount,
    invalidResultCount: resReport.dataQuality.invalidResultCount,
    assignmentHistoryAvailable: isCurrentAsOf,
  };

  return {
    period: regReport.period,
    filtersApplied: { ...input.query, year: period.year },
    dataQuality: combinedDataQuality,
    kpis,
    charts: {
      monthlyTrend,
      byCategory,
      cohortProgress,
      starDistribution,
    },
    comparisonTable: kpis,
    productsByStatus: input.productsByStatus,
    judges: input.judges,
    needsAttention: input.needsAttention,
  };
}
