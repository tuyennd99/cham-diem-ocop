import type {
  AdminAnalyticsDashboardResponse,
  AdminProductQuery,
  AdminReportFilterQuery,
  AdminReportQuery,
  DashboardKpiItem,
  LocalityType,
  PeriodComparisonDelta,
  ProductRegistrationType,
  ProductStatus,
  RegistrationReportResponse,
  RegistrationReportRow,
  ReportDataQuality,
  ReportGroupBy,
  ReportPeriodMetadata,
  ResultsReportResponse,
  ResultsReportRow,
  StarBreakdown,
} from '@ocop/shared';
import { calculateStars } from './scoring';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatVnBoundaryIso(year: number, month: number, day = 1): string {
  return `${year}-${pad2(month)}-${pad2(day)}T00:00:00+07:00`;
}

export function vnBoundaryDate(year: number, month: number, day = 1): Date {
  return new Date(formatVnBoundaryIso(year, month, day));
}

export function toVietnamYearMonth(date: Date): { year: number; month: number } {
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
    groupId: string;
    groupCode: string;
    groupName: string;
    criterionIds?: string[];
  };
  locality: {
    id: string;
    code: string;
    name: string;
    type: LocalityType;
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
  if (query.groupId && product.category.groupId !== query.groupId) return false;
  if (query.categoryId && product.category.id !== query.categoryId)
    return false;
  if (query.localityId && product.locality?.id !== query.localityId)
    return false;
  if (query.localityType && product.locality?.type !== query.localityType)
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
      comparisonNote: 'INSUFFICIENT_HISTORY',
    };
  }
  if (previous === null || previous === 0) {
    return {
      current,
      previous: previous ?? 0,
      deltaAbsolute: current - (previous ?? 0),
      deltaPercent: null,
      comparisonNote: 'NO_PRIOR_DATA',
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
    comparisonNote: 'OK',
  };
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

    const eventStatus = statusAtAsOf(product.statusEvents, asOfDate);
    let resolvedStatus: ProductStatus | null = eventStatus;
    if (!resolvedStatus) {
      // If product has no status events before asOf:
      if (
        product.completedAt &&
        product.completedAt.getTime() < asOfDate.getTime()
      ) {
        resolvedStatus = 'COMPLETED';
      } else if (asOfDate.getTime() >= now.getTime()) {
        resolvedStatus = product.status;
      } else {
        resolvedStatus = null;
      }
    }

    if (!resolvedStatus || resolvedStatus === 'DRAFT') {
      missingDataCount++;
      continue;
    }

    if (resolvedStatus === 'SUBMITTED') {
      waitingCount++;
    } else if (resolvedStatus === 'SCORING') {
      scoringCount++;
    } else if (resolvedStatus === 'COMPLETED') {
      completedCount++;
      if (isValidCompletedResult(product)) {
        completedValidCount++;
        scoreSum += product.finalScore!;
        const star = product.starRating as 1 | 2 | 3 | 4 | 5;
        starCounts[star]++;
        if (product.finalScore! >= 50) passedCount++;
        else failedCount++;
      } else {
        missingDataCount++;
      }
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
  dateField: 'submittedAt' | 'completedAt',
  period: ReturnType<typeof resolveVietnamPeriod>,
  baseQuery: AdminReportFilterQuery,
  catalogs: {
    groups: Array<{ id: string; code: string; name: string }>;
    categories: Array<{ id: string; name: string; groupName: string }>;
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
    ...(baseQuery.groupId ? { groupId: baseQuery.groupId } : {}),
    ...(baseQuery.categoryId ? { categoryId: baseQuery.categoryId } : {}),
    ...(baseQuery.localityId ? { localityId: baseQuery.localityId } : {}),
    ...(baseQuery.registrationType
      ? { registrationType: baseQuery.registrationType }
      : {}),
    ...(baseQuery.assessmentYear !== undefined
      ? { assessmentYear: baseQuery.assessmentYear }
      : {}),
  };

  if (groupBy === 'year') {
    return [
      {
        key: String(period.year),
        label: `Năm ${period.year}`,
        drillDown: baseDrill,
        items: [...items],
      },
    ];
  }

  if (groupBy === 'month') {
    const months = period.month ? [period.month] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
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

  if (groupBy === 'group') {
    return catalogs.groups
      .filter((g) => !baseQuery.groupId || g.id === baseQuery.groupId)
      .map((g) => ({
        key: g.id,
        label: `${g.code} · ${g.name}`,
        drillDown: { ...baseDrill, groupId: g.id },
        items: items.filter((p) => p.category.groupId === g.id),
      }));
  }

  if (groupBy === 'category') {
    return catalogs.categories
      .filter((c) => !baseQuery.categoryId || c.id === baseQuery.categoryId)
      .map((c) => ({
        key: c.id,
        label: `${c.groupName} · ${c.name}`,
        drillDown: { ...baseDrill, categoryId: c.id },
        items: items.filter((p) => p.category.id === c.id),
      }));
  }

  // groupBy === 'locality'
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
    if (p.status !== 'DRAFT' && !p.submittedAt) missingSubmittedAtCount++;
    if (p.status === 'COMPLETED' && !p.completedAt) missingCompletedAtCount++;
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
      (evStatus === 'COMPLETED' ||
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
  groups: Array<{ id: string; code: string; name: string }>;
  categories: Array<{
    id: string;
    name: string;
    groupId: string;
    groupCode: string;
    groupName: string;
  }>;
  localities: Array<{
    id: string;
    code: string;
    name: string;
    type: LocalityType;
    provinceName: string;
  }>;
  now?: Date;
  historyAvailableFrom?: Date | null;
  assignmentHistoryAvailable?: boolean;
}): RegistrationReportResponse {
  const now = input.now ?? new Date();
  const groupBy: ReportGroupBy =
    input.query.groupBy ?? (input.query.month ? 'locality' : 'month');
  const period = resolveVietnamPeriod(
    { year: input.query.year, month: input.query.month },
    now,
    input.historyAvailableFrom ?? null,
  );

  // Deduplicate by product.id (REP-01)
  const uniqueProducts = [
    ...new Map(input.products.map((p) => [p.id, p])).values(),
  ];
  const dimensionFiltered = uniqueProducts.filter((p) =>
    matchesReportDimensionFilters(p, input.query),
  );

  const currentCohort = dimensionFiltered.filter(
    (p) =>
      p.status !== 'DRAFT' &&
      p.submittedAt !== null &&
      p.submittedAt.getTime() >= period.fromDate.getTime() &&
      p.submittedAt.getTime() < period.asOfDate.getTime(),
  );

  const prevCohort = dimensionFiltered.filter(
    (p) =>
      p.status !== 'DRAFT' &&
      p.submittedAt !== null &&
      p.submittedAt.getTime() >= period.prevFromDate.getTime() &&
      p.submittedAt.getTime() < period.prevComparisonToExclusiveDate.getTime(),
  );

  const baseDrill: Partial<AdminProductQuery> = {
    dateBasis: 'submittedAt',
    from: period.from,
    toExclusive: period.toExclusive,
    ...(input.query.groupId ? { groupId: input.query.groupId } : {}),
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
    'submittedAt',
    period,
    input.query,
    {
      groups: input.groups,
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
    kind: 'REGISTRATIONS',
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
  groups: Array<{ id: string; code: string; name: string }>;
  categories: Array<{
    id: string;
    name: string;
    groupId: string;
    groupCode: string;
    groupName: string;
  }>;
  localities: Array<{
    id: string;
    code: string;
    name: string;
    type: LocalityType;
    provinceName: string;
  }>;
  now?: Date;
  historyAvailableFrom?: Date | null;
  assignmentHistoryAvailable?: boolean;
}): ResultsReportResponse {
  const now = input.now ?? new Date();
  const groupBy: ReportGroupBy =
    input.query.groupBy ?? (input.query.month ? 'locality' : 'month');
  const period = resolveVietnamPeriod(
    { year: input.query.year, month: input.query.month },
    now,
    input.historyAvailableFrom ?? null,
  );

  const uniqueProducts = [
    ...new Map(input.products.map((p) => [p.id, p])).values(),
  ];
  const dimensionFiltered = uniqueProducts.filter((p) =>
    matchesReportDimensionFilters(p, input.query),
  );

  const currentCompleted = dimensionFiltered.filter(
    (p) =>
      p.status === 'COMPLETED' &&
      p.completedAt !== null &&
      p.completedAt.getTime() >= period.fromDate.getTime() &&
      p.completedAt.getTime() < period.asOfDate.getTime(),
  );

  const prevCompleted = dimensionFiltered.filter(
    (p) =>
      p.status === 'COMPLETED' &&
      p.completedAt !== null &&
      p.completedAt.getTime() >= period.prevFromDate.getTime() &&
      p.completedAt.getTime() < period.prevComparisonToExclusiveDate.getTime(),
  );

  const baseDrill: Partial<AdminProductQuery> = {
    dateBasis: 'completedAt',
    status: 'COMPLETED',
    from: period.from,
    toExclusive: period.toExclusive,
    ...(input.query.groupId ? { groupId: input.query.groupId } : {}),
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
    'completedAt',
    period,
    input.query,
    {
      groups: input.groups,
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
    kind: 'RESULTS',
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
  groups: Array<{ id: string; code: string; name: string }>;
  categories: Array<{
    id: string;
    name: string;
    groupId: string;
    groupCode: string;
    groupName: string;
  }>;
  localities: Array<{
    id: string;
    code: string;
    name: string;
    type: LocalityType;
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
    status: 'SUBMITTED' | 'SCORING';
    submittedAt: string | null;
    category: { id: string; name: string; groupName: string };
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

  const regReport = buildRegistrationReport({
    query: { ...input.query, groupBy: 'group' },
    products: input.products,
    groups: input.groups,
    categories: input.categories,
    localities: input.localities,
    now,
    historyAvailableFrom: input.historyAvailableFrom,
    assignmentHistoryAvailable: isCurrentAsOf,
  });

  const resReport = buildResultsReport({
    query: { ...input.query, groupBy: 'group' },
    products: input.products,
    groups: input.groups,
    categories: input.categories,
    localities: input.localities,
    now,
    historyAvailableFrom: input.historyAvailableFrom,
    assignmentHistoryAvailable: isCurrentAsOf,
  });

  const uniqueProducts = [
    ...new Map(input.products.map((p) => [p.id, p])).values(),
  ];
  const dimensionFiltered = uniqueProducts.filter((p) =>
    matchesReportDimensionFilters(p, input.query),
  );

  // KPI 7: Open backlog at asOf (submitted before asOf, not completed at asOf)
  let openBacklogAtAsOf: number | null = 0;
  let openBacklogMissingHistory = false;
  const openBacklogItems: ReportingProductRecord[] = [];

  for (const p of dimensionFiltered) {
    if (
      p.status === 'DRAFT' ||
      !p.submittedAt ||
      p.submittedAt.getTime() >= period.asOfDate.getTime()
    ) {
      continue;
    }
    const evStatus = statusAtAsOf(p.statusEvents, period.asOfDate);
    let resolved: ProductStatus | null = evStatus;
    if (!resolved) {
      if (
        p.completedAt &&
        p.completedAt.getTime() < period.asOfDate.getTime()
      ) {
        resolved = 'COMPLETED';
      } else if (isCurrentAsOf) {
        resolved = p.status;
      } else {
        resolved = null;
      }
    }
    if (!resolved) {
      openBacklogMissingHistory = true;
      continue;
    }
    if (resolved === 'SUBMITTED' || resolved === 'SCORING') {
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
      p.status === 'DRAFT' ||
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
    if (evStatus === 'SUBMITTED' || evStatus === 'SCORING') {
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
    unit: 'COUNT' | 'PERCENT';
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
        delta.comparisonNote === 'INSUFFICIENT_HISTORY'
          ? 'INSUFFICIENT_HISTORY'
          : delta.comparisonNote === 'NO_PRIOR_DATA'
            ? 'NO_PRIOR_DATA'
            : 'AVAILABLE',
      drillDown: args.drillDown,
    };
  }

  const baseRegDrill = regReport.totals.drillDown;
  const baseResDrill = resReport.totals.drillDown;

  const kpis: DashboardKpiItem[] = [
    makeKpi({
      id: 'registeredInPeriod',
      label: 'Hồ sơ đăng ký trong kỳ',
      basisLabel: `Nộp trong kỳ (${period.label})`,
      unit: 'COUNT',
      current: regReport.totals.registeredCount,
      previous: regReport.previousTotals.registeredCount,
      drillDown: baseRegDrill,
    }),
    makeKpi({
      id: 'completedInPeriod',
      label: 'Hồ sơ hoàn tất trong kỳ',
      basisLabel: `Hoàn tất trong kỳ (${period.label})`,
      unit: 'COUNT',
      current: resReport.totals.completedCount,
      previous: resReport.previousTotals.completedCount,
      drillDown: baseResDrill,
    }),
    makeKpi({
      id: 'passedInPeriod',
      label: 'Đạt ngưỡng từ 3 sao theo điểm',
      basisLabel: `Hoàn tất ≥ 50 điểm (${period.label})`,
      unit: 'COUNT',
      current: resReport.totals.passedCount,
      previous: resReport.previousTotals.passedCount,
      drillDown: baseResDrill,
    }),
    makeKpi({
      id: 'failedInPeriod',
      label: 'Chưa đạt ngưỡng 3 sao',
      basisLabel: `Hoàn tất < 50 điểm (${period.label})`,
      unit: 'COUNT',
      current: resReport.totals.failedCount,
      previous: resReport.previousTotals.failedCount,
      drillDown: baseResDrill,
    }),
    makeKpi({
      id: 'passRateInPeriod',
      label: 'Tỷ lệ đạt theo điểm',
      basisLabel: `Đạt / hoàn tất hợp lệ (${period.label})`,
      unit: 'PERCENT',
      current: resReport.totals.passRate,
      previous: resReport.previousTotals.passRate,
      insufficientHistory: resReport.totals.passRate === null,
      drillDown: baseResDrill,
    }),
    makeKpi({
      id: 'fiveStarInPeriod',
      label: 'Mức điểm 5 sao',
      basisLabel: `90–100 điểm · Đề nghị xem xét 5 sao (${period.label})`,
      unit: 'COUNT',
      current: resReport.totals.starCounts[5],
      previous: resReport.previousTotals.starCounts[5],
      drillDown: { ...baseResDrill, starRating: 5 },
    }),
    makeKpi({
      id: 'openBacklogAtAsOf',
      label: 'Hồ sơ còn chờ/đang chấm tại mốc chốt',
      basisLabel: `Tồn tại mốc chốt ${new Date(period.asOf).toLocaleString('vi-VN')}`,
      unit: 'COUNT',
      current: openBacklogAtAsOf,
      previous: prevOpenBacklogAtAsOf,
      insufficientHistory: openBacklogAtAsOf === null,
      drillDown: { status: 'SUBMITTED' },
    }),
    makeKpi({
      id: 'underAssignedBacklogAtAsOf',
      label: 'Hồ sơ chưa đủ phân công tại mốc chốt',
      basisLabel: `Tồn thiếu phủ tiêu chí tại mốc chốt ${new Date(period.asOf).toLocaleString('vi-VN')}`,
      unit: 'COUNT',
      current: underAssignedCount,
      previous: null,
      insufficientHistory: underAssignedCount === null,
      drillDown: { status: 'SUBMITTED' },
    }),
  ];

  // Chart 1: Monthly trend for the selected year (12 months)
  const monthlyTrend = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
    const mFrom = formatVnBoundaryIso(period.year, m, 1);
    const mTo =
      m === 12
        ? formatVnBoundaryIso(period.year + 1, 1, 1)
        : formatVnBoundaryIso(period.year, m + 1, 1);
    const mFromMs = new Date(mFrom).getTime();
    const mToMs = Math.min(new Date(mTo).getTime(), period.asOfDate.getTime());
    const registeredCount =
      mToMs <= mFromMs
        ? 0
        : dimensionFiltered.filter(
            (p) =>
              p.status !== 'DRAFT' &&
              p.submittedAt !== null &&
              p.submittedAt.getTime() >= mFromMs &&
              p.submittedAt.getTime() < mToMs,
          ).length;
    const completedCount =
      mToMs <= mFromMs
        ? 0
        : dimensionFiltered.filter(
            (p) =>
              p.status === 'COMPLETED' &&
              p.completedAt !== null &&
              p.completedAt.getTime() >= mFromMs &&
              p.completedAt.getTime() < mToMs,
          ).length;
    return {
      month: m,
      label: `T${m}`,
      registeredCount,
      completedCount,
      from: mFrom,
      toExclusive: mTo,
    };
  });

  // Chart 2: By product group + drill-down categories
  const regCohortIds = new Set(
    dimensionFiltered
      .filter(
        (p) =>
          p.status !== 'DRAFT' &&
          p.submittedAt !== null &&
          p.submittedAt.getTime() >= period.fromDate.getTime() &&
          p.submittedAt.getTime() < period.asOfDate.getTime(),
      )
      .map((p) => p.id),
  );
  const resCohortIds = new Set(
    dimensionFiltered
      .filter(
        (p) =>
          p.status === 'COMPLETED' &&
          p.completedAt !== null &&
          p.completedAt.getTime() >= period.fromDate.getTime() &&
          p.completedAt.getTime() < period.asOfDate.getTime(),
      )
      .map((p) => p.id),
  );

  const byProductGroup = input.groups.map((grp) => {
    const grpCategories = input.categories.filter((c) => c.groupId === grp.id);
    const categoryItems = grpCategories.map((cat) => {
      const catProds = dimensionFiltered.filter((p) => p.category.id === cat.id);
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        registeredCount: catProds.filter((p) => regCohortIds.has(p.id)).length,
        completedCount: catProds.filter((p) => resCohortIds.has(p.id)).length,
      };
    });
    return {
      groupId: grp.id,
      groupCode: grp.code,
      groupName: grp.name,
      registeredCount: categoryItems.reduce(
        (s, c) => s + c.registeredCount,
        0,
      ),
      completedCount: categoryItems.reduce((s, c) => s + c.completedCount, 0),
      categories: categoryItems,
    };
  });

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
      byProductGroup,
      cohortProgress,
      starDistribution,
    },
    comparisonTable: kpis,
    productsByStatus: input.productsByStatus,
    judges: input.judges,
    needsAttention: input.needsAttention,
  };
}
