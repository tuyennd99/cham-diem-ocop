import { useEffect, useMemo, useState } from 'react';
import type {
  AdminAnalyticsDashboardResponse,
  AdminReportFilterQuery,
  DashboardKpiId,
  DashboardKpiItem,
  ProductRegistrationType,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Filter, RotateCcw } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { DashboardList } from '@/components/dashboard-list';
import { FormField } from '@/components/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { DataTable, type DataTableColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import {
  ALL,
  DASHBOARD_CATEGORY_METRIC_MODE,
  DASHBOARD_KPI_ID,
  KPI_UNIT,
  PRODUCT_DATE_BASIS,
  PRODUCT_REGISTRATION_TYPE,
  PRODUCT_STATUS,
  STAFF_PERMISSION,
} from '../../constants/consts';
import { ADMIN_DASHBOARD_STATUS_LABEL, PRODUCT_STATUS_TONE } from '../../constants/product-status';
import { currentVietnameseYear } from '../../lib/admin-date';
import { parseAdminDashboardSearch } from '../../lib/admin-search';
import { ADMINISTRATIVE_PROVINCES } from '../../lib/administrative-divisions';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { formatExactScore } from '../../lib/print-format';
import {
  buildDashboardCategoryDrillDown,
  dashboardKpiLinkLabel,
  formatJudgeProgress,
  formatKpiDeltaText,
  formatKpiValue,
  formatNeedsAttentionSubmittedAt,
  partitionZeroCategories,
  partitionZeroMonths,
  sortNeedsAttentionByOldest,
} from '../../lib/report-format';
import { hasStaffPermission } from '../../lib/session-contract';
import { useAdminDashboard } from '../../queries/admin';
import { useAdminCategories, useAdminLocalities } from '../../queries/admin-catalogs';

interface AdminDashboardPageProps {
  search?: AdminReportFilterQuery;
  onSearchChange?: (next: AdminReportFilterQuery) => void;
}

const operationalIds: DashboardKpiId[] = [
  DASHBOARD_KPI_ID.REGISTERED_IN_PERIOD,
  DASHBOARD_KPI_ID.COMPLETED_IN_PERIOD,
  DASHBOARD_KPI_ID.OPEN_BACKLOG_AT_AS_OF,
  DASHBOARD_KPI_ID.UNDER_ASSIGNED_BACKLOG_AT_AS_OF,
];

type DashboardJudgeItem = AdminAnalyticsDashboardResponse['judges'][number];
type DashboardMonthlyTrendPoint = AdminAnalyticsDashboardResponse['charts']['monthlyTrend'][number];
type DashboardStarDistributionItem =
  AdminAnalyticsDashboardResponse['charts']['starDistribution'][number];

export function AdminDashboardPage({
  search: controlledSearch,
  onSearchChange,
}: AdminDashboardPageProps) {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, STAFF_PERMISSION.MANAGE);
  const defaultYear = currentVietnameseYear();

  const [fallbackSearch, setFallbackSearch] = useState<AdminReportFilterQuery>({
    year: defaultYear,
  });
  const appliedSearch = controlledSearch ?? fallbackSearch;

  function applySearch(next: AdminReportFilterQuery) {
    const normalized = parseAdminDashboardSearch(next as Record<string, unknown>);
    if (onSearchChange) {
      onSearchChange(normalized);
    } else {
      setFallbackSearch(normalized);
    }
  }

  const [draftFilters, setDraftFilters] = useState<AdminReportFilterQuery>(appliedSearch);
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      appliedSearch.categoryId ||
      appliedSearch.localityId ||
      appliedSearch.registrationType ||
      appliedSearch.assessmentYear,
    ),
  );
  const [categoryMetricMode, setCategoryMetricMode] = useState<
    (typeof DASHBOARD_CATEGORY_METRIC_MODE)[keyof typeof DASHBOARD_CATEGORY_METRIC_MODE]
  >(DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED);

  useEffect(() => {
    setDraftFilters(appliedSearch);
  }, [appliedSearch]);

  const [localityProvince, setLocalityProvince] = useState('');
  const [queuePage, setQueuePage] = useState(1);
  const [queueSearch, setQueueSearch] = useState('');
  const categoriesQuery = useAdminCategories({
    page: 1,
    limit: 100,
  });
  const localitiesQuery = useAdminLocalities({
    page: 1,
    limit: 100,
    provinceName: localityProvince || undefined,
  });

  const {
    data = null,
    isPending: loading,
    isFetching,
    error: loadError,
    refetch,
  } = useAdminDashboard({ ...appliedSearch, queuePage, queueSearch: queueSearch || undefined });
  const error = errorText(loadError);

  useEffect(() => {
    const total = data?.needsAttentionTotal;
    if (isFetching || total === undefined) return;
    setQueuePage((page) => Math.min(page, Math.max(1, Math.ceil(total / 5))));
  }, [data?.needsAttentionTotal, isFetching]);

  const categories = categoriesQuery.data?.data ?? [];
  const localities = localitiesQuery.data?.data ?? [];

  const operationalKpis = data ? data.kpis.filter((item) => operationalIds.includes(item.id)) : [];
  const analyticalKpis = data ? data.kpis.filter((item) => !operationalIds.includes(item.id)) : [];

  const maxMonthlyCount = useMemo(() => {
    if (!data?.charts.monthlyTrend.length) return 1;
    const maxVal = Math.max(
      ...data.charts.monthlyTrend.flatMap((m) => [m.registeredCount, m.completedCount]),
    );
    return maxVal > 0 ? maxVal : 1;
  }, [data?.charts.monthlyTrend]);

  const maxCategoryCount = useMemo(() => {
    if (!data?.charts.byCategory.length) return 1;
    const maxVal = Math.max(
      ...data.charts.byCategory.map((c) =>
        categoryMetricMode === DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED
          ? c.registeredCount
          : c.completedCount,
      ),
    );
    return maxVal > 0 ? maxVal : 1;
  }, [categoryMetricMode, data?.charts.byCategory]);

  const [showAllMonths, setShowAllMonths] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const monthPartition = useMemo(
    () => partitionZeroMonths(data?.charts.monthlyTrend ?? []),
    [data?.charts.monthlyTrend],
  );

  const categoryPartition = useMemo(
    () => partitionZeroCategories(data?.charts.byCategory ?? [], categoryMetricMode),
    [categoryMetricMode, data?.charts.byCategory],
  );

  const judgeColumns = useMemo<DataTableColumnDef<DashboardJudgeItem>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Giám khảo',
        meta: { isRowHeader: true },
      },
      {
        id: 'submitted',
        header: 'Đã nộp',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => formatJudgeProgress(row.original).submittedText,
      },
      {
        accessorKey: 'pending',
        header: 'Chưa hoàn tất',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => formatJudgeProgress(row.original).pendingText,
      },
      {
        id: 'progress',
        header: 'Tiến độ',
        cell: ({ row }) => {
          const display = formatJudgeProgress(row.original);
          if (!display.isAssigned || display.percent === null) {
            return (
              <span className='text-muted text-xs' aria-label={display.ariaLabel}>
                {display.progressLabel}
              </span>
            );
          }
          return (
            <div className='judge-progress-inline'>
              <div
                className='progress-track'
                role='progressbar'
                aria-label={display.ariaLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={display.percent}
              >
                <span style={{ width: `${display.percent}%` }} />
              </div>
              <strong>{display.progressLabel}</strong>
            </div>
          );
        },
      },
    ],
    [],
  );

  const monthlyTrendColumns = useMemo<DataTableColumnDef<DashboardMonthlyTrendPoint>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Tháng',
        meta: { isRowHeader: true },
      },
      {
        accessorKey: 'registeredCount',
        header: 'Đăng ký mới',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => {
          const m = row.original;
          return (
            <Link
              className='text-link'
              to='/admin/products'
              search={{
                dateBasis: 'submittedAt',
                from: m.from,
                toExclusive: m.toExclusive,
              }}
            >
              {m.registeredCount} hồ sơ
            </Link>
          );
        },
      },
      {
        accessorKey: 'completedCount',
        header: 'Hoàn tất chấm',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => {
          const m = row.original;
          return (
            <Link
              className='text-link'
              to='/admin/products'
              search={{
                dateBasis: PRODUCT_DATE_BASIS.COMPLETED_AT,
                status: PRODUCT_STATUS.COMPLETED,
                from: m.from,
                toExclusive: m.toExclusive,
              }}
            >
              {m.completedCount} hồ sơ
            </Link>
          );
        },
      },
      {
        id: 'visual',
        header: 'Tỷ lệ trực quan',
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.original;
          const regPct = Math.round((m.registeredCount / maxMonthlyCount) * 100);
          const compPct = Math.round((m.completedCount / maxMonthlyCount) * 100);
          return (
            <div className='trend-bar-cell' aria-hidden='true'>
              <div className='trend-dual-bars'>
                <div className='trend-bar-track' title={`Đăng ký mới: ${m.registeredCount}`}>
                  <div className='trend-bar-fill-reg' style={{ width: `${regPct}%` }} />
                </div>
                <div className='trend-bar-track' title={`Hoàn tất chấm: ${m.completedCount}`}>
                  <div className='trend-bar-fill-comp' style={{ width: `${compPct}%` }} />
                </div>
              </div>
            </div>
          );
        },
      },
    ],
    [maxMonthlyCount],
  );

  const starDistributionColumns = useMemo<DataTableColumnDef<DashboardStarDistributionItem>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Mức sao theo điểm',
        meta: { isRowHeader: true },
      },
      {
        id: 'bar',
        header: 'Phân bố',
        enableSorting: false,
        cell: ({ row }) => {
          const pct = row.original.percentage ?? 0;
          return (
            <div className='star-dist-track' aria-hidden='true'>
              <div
                className='star-dist-fill'
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
          );
        },
      },
      {
        accessorKey: 'count',
        header: 'Số lượng',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => {
          const item = row.original;
          return (
            <Link
              className='text-link'
              to='/admin/products'
              search={{
                status: PRODUCT_STATUS.COMPLETED,
                starRating: item.stars,
                dateBasis: PRODUCT_DATE_BASIS.COMPLETED_AT,
                from: data?.period.from,
                toExclusive: data?.period.toExclusive,
              }}
            >
              {item.count}
            </Link>
          );
        },
      },
      {
        accessorKey: 'percentage',
        header: 'Tỷ trọng',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) =>
          row.original.percentage !== null ? `${formatExactScore(row.original.percentage)}%` : '—',
      },
    ],
    [data?.period.from, data?.period.toExclusive],
  );

  const comparisonColumns = useMemo<DataTableColumnDef<DashboardKpiItem>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Chỉ tiêu KPI',
        meta: { isRowHeader: true },
      },
      {
        accessorKey: 'basisLabel',
        header: 'Căn cứ',
      },
      {
        id: 'current',
        header: 'Kỳ này',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => <strong>{formatKpiValue(row.original)}</strong>,
      },
      {
        id: 'previous',
        header: 'Kỳ trước',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => {
          const item = row.original;
          return item.previousValue !== null
            ? item.unit === KPI_UNIT.PERCENT
              ? `${formatExactScore(item.previousValue)}%`
              : item.previousValue
            : '—';
        },
      },
      {
        id: 'delta',
        header: 'Chênh lệch',
        cell: ({ row }) => formatKpiDeltaText(row.original),
      },
    ],
    [],
  );

  const appliedChips: Array<{ key: string; label: string }> = [];
  if (appliedSearch.categoryId) {
    const catName =
      categories.find((c) => c.id === appliedSearch.categoryId)?.name ?? appliedSearch.categoryId;
    appliedChips.push({ key: 'categoryId', label: `Danh mục: ${catName}` });
  }
  if (appliedSearch.localityId) {
    const locName =
      localities.find((l) => l.id === appliedSearch.localityId)?.name ?? appliedSearch.localityId;
    appliedChips.push({ key: 'localityId', label: `Địa bàn: ${locName}` });
  }
  if (appliedSearch.registrationType) {
    const regLabel =
      appliedSearch.registrationType === PRODUCT_REGISTRATION_TYPE.FIRST
        ? 'Lần đầu'
        : appliedSearch.registrationType === PRODUCT_REGISTRATION_TYPE.UPGRADE
          ? 'Nâng hạng'
          : 'Đánh giá lại';
    appliedChips.push({ key: 'registrationType', label: `Loại đăng ký: ${regLabel}` });
  }
  if (appliedSearch.assessmentYear) {
    appliedChips.push({
      key: 'assessmentYear',
      label: `Năm hồ sơ: ${appliedSearch.assessmentYear}`,
    });
  }

  const hasExtraFilters = Boolean(
    appliedChips.length > 0 ||
    appliedSearch.month ||
    (appliedSearch.year && appliedSearch.year !== defaultYear),
  );

  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div>
          <h1>Tổng quan OCOP</h1>
          <p className='route-intro'>
            Theo dõi hồ sơ cần xử lý, tiến độ giám khảo và các chỉ tiêu thống kê trong kỳ.
          </p>
        </div>
        <div className='admin-actions'>
          <Button asChild variant='secondary'>
            <Link to='/admin/reports' search={appliedSearch}>
              Báo cáo thống kê
            </Link>
          </Button>
          <Button
            type='button'
            variant='secondary'
            loading={isFetching}
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? 'Đang tải…' : 'Tải lại'}
          </Button>
        </div>
      </div>

      <form
        className='admin-form filter-card admin-filter-panel'
        aria-label='Bộ lọc Tổng quan OCOP'
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(draftFilters);
        }}
      >
        <div className='admin-filters'>
          <FormField
            label='Năm báo cáo'
            htmlFor='dashboard-year'
            className='admin-filter-field'
            data-filter-width='year'
          >
            <Input
              id='dashboard-year'
              type='number'
              min={2020}
              max={2100}
              value={draftFilters.year ?? defaultYear}
              onChange={(event) =>
                setDraftFilters((old) => ({
                  ...old,
                  year: event.target.value ? Number(event.target.value) : defaultYear,
                }))
              }
            />
          </FormField>
          <FormField
            label='Tháng'
            htmlFor='dashboard-month'
            className='admin-filter-field'
            data-filter-width='month'
          >
            <Combobox
              value={draftFilters.month ? String(draftFilters.month) : ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  month: value === ALL ? undefined : Number(value),
                }))
              }
            >
              <ComboboxAnchor>
                <ComboboxInput id='dashboard-month' placeholder='Cả năm' />
                <ComboboxTrigger aria-label='Mở danh sách tháng' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy tháng phù hợp.</ComboboxEmpty>
                <ComboboxItem value={ALL}>Cả năm</ComboboxItem>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <ComboboxItem key={m} value={String(m)}>
                    Tháng {m}
                  </ComboboxItem>
                ))}
              </ComboboxContent>
            </Combobox>
          </FormField>

          <div className='admin-actions admin-filter-actions'>
            <Button type='submit'>Áp dụng</Button>
            <Button
              type='button'
              variant='secondary'
              aria-expanded={showAdvanced}
              aria-controls='dashboard-advanced-filters'
              onClick={() => setShowAdvanced((open) => !open)}
            >
              <Filter className='size-4' aria-hidden='true' />
              <span>Bộ lọc khác</span>
              {appliedChips.length > 0 && (
                <span className='admin-filter-count'>{appliedChips.length}</span>
              )}
            </Button>
            {hasExtraFilters && (
              <Button
                type='button'
                variant='secondary'
                onClick={() => applySearch({ year: defaultYear })}
              >
                <RotateCcw className='size-4' aria-hidden='true' />
                <span>Xóa bộ lọc</span>
              </Button>
            )}
          </div>
        </div>

        <div
          id='dashboard-advanced-filters'
          hidden={!showAdvanced}
          className='advanced-filter-grid'
        >
          <FormField label='Danh mục sản phẩm' htmlFor='dashboard-category'>
            <Combobox
              value={draftFilters.categoryId ?? ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  categoryId: value === ALL ? undefined : value,
                }))
              }
            >
              <ComboboxAnchor>
                <ComboboxInput id='dashboard-category' placeholder='Tất cả danh mục' />
                <ComboboxTrigger aria-label='Mở danh sách danh mục' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy danh mục phù hợp.</ComboboxEmpty>
                <ComboboxItem value={ALL}>Tất cả danh mục</ComboboxItem>
                {categories.map((cat) => (
                  <ComboboxItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </ComboboxItem>
                ))}
              </ComboboxContent>
            </Combobox>
          </FormField>

          <FormField label='Tỉnh / Thành phố' htmlFor='dashboard-locality-province'>
            <Combobox
              value={localityProvince || ALL}
              onValueChange={(value) => {
                const nextProvince = value === ALL ? '' : value;
                setLocalityProvince(nextProvince);
                setDraftFilters((old) => ({
                  ...old,
                  localityId: undefined,
                }));
              }}
            >
              <ComboboxAnchor>
                <ComboboxInput
                  id='dashboard-locality-province'
                  placeholder='Tất cả tỉnh / thành phố'
                />
                <ComboboxTrigger aria-label='Mở danh sách tỉnh / thành phố' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy tỉnh / thành phố.</ComboboxEmpty>
                <ComboboxItem value={ALL}>Tất cả tỉnh / thành phố</ComboboxItem>
                {ADMINISTRATIVE_PROVINCES.map((province) => (
                  <ComboboxItem key={province.code} value={province.name_with_type}>
                    {province.name_with_type}
                  </ComboboxItem>
                ))}
              </ComboboxContent>
            </Combobox>
          </FormField>

          <FormField label='Địa bàn hành chính (xã / phường)' htmlFor='dashboard-locality-id'>
            <Combobox
              value={draftFilters.localityId ?? ALL}
              disabled={!localityProvince && !draftFilters.localityId}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  localityId: value === ALL ? undefined : value,
                }))
              }
            >
              <ComboboxAnchor>
                <ComboboxInput
                  id='dashboard-locality-id'
                  placeholder={
                    localityProvince
                      ? 'Tất cả xã / phường trong tỉnh'
                      : 'Chọn tỉnh / thành phố trước'
                  }
                />
                <ComboboxTrigger aria-label='Mở danh sách địa bàn' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy địa bàn phù hợp.</ComboboxEmpty>
                <ComboboxItem value={ALL}>Tất cả địa bàn</ComboboxItem>
                {localities.map((loc) => (
                  <ComboboxItem key={loc.id} value={loc.id}>
                    {loc.name} · {loc.provinceName}
                  </ComboboxItem>
                ))}
              </ComboboxContent>
            </Combobox>
          </FormField>

          <FormField label='Loại đăng ký' htmlFor='dashboard-registration-type'>
            <Combobox
              value={draftFilters.registrationType ?? ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  registrationType: (value === ALL ? undefined : value) as
                    ProductRegistrationType | undefined,
                }))
              }
            >
              <ComboboxAnchor>
                <ComboboxInput id='dashboard-registration-type' placeholder='Tất cả' />
                <ComboboxTrigger aria-label='Mở danh sách loại đăng ký' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy loại đăng ký.</ComboboxEmpty>
                <ComboboxItem value={ALL}>Tất cả</ComboboxItem>
                <ComboboxItem value={PRODUCT_REGISTRATION_TYPE.FIRST}>Lần đầu</ComboboxItem>
                <ComboboxItem value={PRODUCT_REGISTRATION_TYPE.UPGRADE}>Nâng hạng</ComboboxItem>
                <ComboboxItem value={PRODUCT_REGISTRATION_TYPE.REASSESSMENT}>
                  Đánh giá lại
                </ComboboxItem>
              </ComboboxContent>
            </Combobox>
          </FormField>

          <FormField label='Năm đánh giá hồ sơ' htmlFor='dashboard-assessment-year'>
            <Input
              id='dashboard-assessment-year'
              type='number'
              min={2020}
              max={2100}
              placeholder='Tất cả'
              value={draftFilters.assessmentYear ?? ''}
              onChange={(event) =>
                setDraftFilters((old) => ({
                  ...old,
                  assessmentYear: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
            />
          </FormField>
        </div>

        {!showAdvanced && appliedChips.length > 0 && (
          <div className='admin-applied-filters' aria-label='Điều kiện đang áp dụng'>
            <span className='text-muted text-xs font-semibold'>Đang lọc:</span>
            {appliedChips.map((chip) => (
              <Badge key={chip.key} variant='secondary'>
                {chip.label}
              </Badge>
            ))}
          </div>
        )}

        {data?.period && (
          <div className='admin-filter-period-footer' role='status'>
            <div className='admin-filter-period-meta'>
              <span>
                <strong>Kỳ đang xem:</strong> {data.period.label}
              </span>
              <span>
                <strong>Mốc chốt số liệu:</strong>{' '}
                {new Date(data.period.asOf).toLocaleString('vi-VN')}
              </span>
              <span>
                <strong>Cập nhật lúc:</strong>{' '}
                {new Date(data.period.generatedAt).toLocaleString('vi-VN')}
              </span>
            </div>
            {data.period.isPartialPeriod && (
              <span>
                Kỳ hiện tại chưa kết thúc (so sánh tương ứng cùng khoảng thời gian kỳ trước).
              </span>
            )}
          </div>
        )}

        {data?.dataQuality &&
          (data.dataQuality.unmappedLocalityCount > 0 ||
            data.dataQuality.missingStatusHistoryCount > 0 ||
            data.dataQuality.missingCompletedAtCount > 0) && (
            <div className='admin-data-quality-banner' role='status'>
              <div>
                <strong>Lưu ý chất lượng dữ liệu:</strong>{' '}
                {data.dataQuality.unmappedLocalityCount > 0 &&
                  `${data.dataQuality.unmappedLocalityCount} hồ sơ chưa gắn địa bàn; `}
                {data.dataQuality.missingCompletedAtCount > 0 &&
                  `${data.dataQuality.missingCompletedAtCount} hồ sơ hoàn tất thiếu ngày hoàn tất; `}
                {data.dataQuality.missingStatusHistoryCount > 0 &&
                  `${data.dataQuality.missingStatusHistoryCount} hồ sơ kỳ cũ thiếu lịch sử trạng thái.`}
              </div>
              {data.dataQuality.unmappedLocalityCount > 0 && (
                <Link
                  className='text-link text-xs'
                  to='/admin/products'
                  search={{ unmappedLocality: true }}
                >
                  Xem hồ sơ chưa gắn địa bàn
                </Link>
              )}
            </div>
          )}
      </form>

      {isFetching && !loading && (
        <p className='form-note' role='status'>
          Đang cập nhật dữ liệu tổng quan…
        </p>
      )}

      {loading && (
        <div className='dashboard-skeleton' aria-label='Đang tải tổng quan' aria-busy='true'>
          <div className='skeleton-block' />
          <div className='skeleton-block' />
          <div className='skeleton-block' />
          <div className='skeleton-table' />
        </div>
      )}

      {error && (
        <div className='space-y-2'>
          <AlertError title='Chưa tải được dữ liệu tổng quan' errors={[error]} />
          <div className='admin-actions'>
            <Button type='button' variant='secondary' onClick={() => void refetch()}>
              Thử lại
            </Button>
            <Button asChild variant='secondary'>
              <Link to='/admin/products' search={{}}>
                Mở danh sách sản phẩm
              </Link>
            </Button>
          </div>
        </div>
      )}

      {data && (
        <>
          <section className='dashboard-section' aria-label='Chỉ tiêu vận hành và trạng thái hồ sơ'>
            <div className='dashboard-section-heading'>
              <h2>Chỉ tiêu vận hành trong kỳ</h2>
            </div>
            {operationalKpis.length > 0 && (
              <div className='dashboard-status-grid'>
                {operationalKpis.map((kpi) => {
                  const linkLabel = dashboardKpiLinkLabel(kpi.id);
                  return (
                    <article className='dashboard-stat' key={kpi.id}>
                      <span>{kpi.label}</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatKpiValue(kpi)}
                      </strong>
                      <small>{kpi.basisLabel}</small>
                      <small>{formatKpiDeltaText(kpi)}</small>
                      {linkLabel && (
                        <Link
                          className='text-link text-sm'
                          to='/admin/products'
                          search={kpi.drillDown}
                        >
                          {linkLabel}
                        </Link>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div
              className='dashboard-status-strip-6'
              aria-label='Tổng số hồ sơ hiện tại theo trạng thái'
            >
              {(
                Object.keys(
                  ADMIN_DASHBOARD_STATUS_LABEL,
                ) as (keyof typeof ADMIN_DASHBOARD_STATUS_LABEL)[]
              ).map((status) => (
                <Link
                  key={status}
                  to='/admin/products'
                  search={{ status }}
                  className='dashboard-status-pill'
                  aria-label={`Lọc hồ sơ trạng thái ${ADMIN_DASHBOARD_STATUS_LABEL[status]}: ${data.productsByStatus[status]}`}
                >
                  <div className='dashboard-status-pill-top'>
                    <Badge variant='outline' className={PRODUCT_STATUS_TONE[status]}>
                      {ADMIN_DASHBOARD_STATUS_LABEL[status]}
                    </Badge>
                  </div>
                  <strong>{data.productsByStatus[status]}</strong>
                </Link>
              ))}
            </div>
          </section>

          <div className='dashboard-desk-grid' aria-label='Bàn điều phối hồ sơ và giám khảo'>
            <section className='dashboard-desk-card' aria-label='Hồ sơ cần xử lý tiếp'>
              <div className='dashboard-desk-head'>
                <div>
                  <h2>Hồ sơ cần xử lý tiếp</h2>
                  <p>Hồ sơ đang chờ hoặc đang trong quá trình chấm, sắp theo ngày nộp lâu nhất.</p>
                </div>
                <Link
                  className='text-link text-sm'
                  to='/admin/products'
                  search={{ status: PRODUCT_STATUS.SUBMITTED }}
                >
                  Mở hồ sơ đã nộp
                </Link>
              </div>
              <div className='dashboard-desk-body'>
                {data.needsAttention.length || queueSearch || isFetching ? (
                  <DashboardList
                    label='hồ sơ cần xử lý'
                    items={sortNeedsAttentionByOldest(data.needsAttention)}
                    searchLabel='Tìm tên hồ sơ hoặc danh mục'
                    searchText={(product) => `${product.name} ${product.category.name}`}
                    server={{
                      page: queuePage,
                      total: data.needsAttentionTotal ?? data.needsAttention.length,
                      query: queueSearch,
                      loading: isFetching,
                      onPage: setQueuePage,
                      onSearch: (value) => {
                        setQueueSearch(value);
                        setQueuePage(1);
                      },
                    }}
                  >
                    {(products) => (
                      <div className='record-list'>
                        {products.map((product) => (
                          <article className='record-row' key={product.id}>
                            <div className='record-main'>
                              <div className='record-badges'>
                                <Badge variant='secondary'>{product.category.name}</Badge>
                                <Badge
                                  variant='outline'
                                  className={PRODUCT_STATUS_TONE[product.status]}
                                >
                                  {ADMIN_DASHBOARD_STATUS_LABEL[product.status]}
                                </Badge>
                              </div>
                              <h3 className='mt-1'>{product.name}</h3>
                              <p className='text-muted text-xs'>
                                <span>{formatNeedsAttentionSubmittedAt(product.submittedAt)}</span>
                                <span aria-hidden='true'> · </span>
                                <span>
                                  {product.assignedJudgeCount === 0 ||
                                  product.missingCriteriaCount > 0
                                    ? 'Thiếu phân công phủ tiêu chí'
                                    : `${product.pendingEvaluationCount} phiếu chưa hoàn tất`}
                                </span>
                              </p>
                            </div>
                            <div className='record-result'>
                              <span
                                className='text-muted text-xs'
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                              >
                                {product.submittedEvaluationCount} / {product.assignedJudgeCount}{' '}
                                phiếu
                              </span>
                              <Button asChild variant='secondary' size='sm'>
                                <Link
                                  to='/admin/products/$id'
                                  params={{ id: product.id }}
                                  aria-label={`Mở hồ sơ ${product.name}`}
                                >
                                  Mở hồ sơ
                                </Link>
                              </Button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </DashboardList>
                ) : (
                  <div className='text-muted py-6 text-center'>
                    <h3 className='text-fg text-base font-semibold'>Không có hồ sơ chờ xử lý</h3>
                    <p className='mt-1 text-xs'>
                      Danh sách này sẽ cập nhật khi có hồ sơ đã nộp hoặc đang chấm.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {(canManage || hasStaffPermission(session?.user, STAFF_PERMISSION.VIEW)) && (
              <section className='dashboard-desk-card' aria-label='Tiến độ giám khảo'>
                <div className='dashboard-desk-head'>
                  <div>
                    <h2>Tiến độ giám khảo</h2>
                    <p>Phiếu đã nộp trên tổng số hồ sơ được giao.</p>
                  </div>
                  <Link
                    className='text-link text-sm'
                    to='/admin/users'
                    search={{ permission: STAFF_PERMISSION.SCORE }}
                  >
                    Quản lý giám khảo
                  </Link>
                </div>
                <div className='dashboard-desk-body'>
                  {data.judges.length ? (
                    <DashboardList
                      label='giám khảo'
                      items={data.judges}
                      searchText={(judge) => judge.fullName}
                    >
                      {(judges) => (
                        <DataTable
                          columns={judgeColumns}
                          data={judges}
                          manual={false}
                          paginated={false}
                          getRowId={(row) => row.judgeId}
                        />
                      )}
                    </DashboardList>
                  ) : (
                    <div className='text-muted py-6 text-center'>
                      <h3 className='text-fg text-base font-semibold'>
                        Chưa có giám khảo hoạt động
                      </h3>
                      <p className='mt-1 mb-3 text-xs'>
                        Dữ liệu tiến độ sẽ xuất hiện sau khi có phân công.
                      </p>
                      <Button asChild variant='secondary' size='sm'>
                        <Link to='/admin/users' search={{ permission: STAFF_PERMISSION.SCORE }}>
                          Quản lý giám khảo
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <section className='dashboard-section' aria-label='Phân tích kết quả trong kỳ'>
            <div className='dashboard-section-heading'>
              <h2>Phân tích trong kỳ</h2>
              <p className='route-intro'>
                Các chỉ tiêu chất lượng kết quả, xu hướng theo tháng, cơ cấu danh mục sản phẩm và
                mức sao theo điểm.
              </p>
            </div>

            {analyticalKpis.length > 0 && (
              <div className='dashboard-status-grid'>
                {analyticalKpis.map((kpi) => {
                  const linkLabel = dashboardKpiLinkLabel(kpi.id);
                  return (
                    <article className='dashboard-stat' key={kpi.id}>
                      <span>{kpi.label}</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatKpiValue(kpi)}
                      </strong>
                      <small>{kpi.basisLabel}</small>
                      <small>{formatKpiDeltaText(kpi)}</small>
                      {linkLabel && (
                        <Link
                          className='text-link text-sm'
                          to='/admin/products'
                          search={kpi.drillDown}
                        >
                          {linkLabel}
                        </Link>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {data.charts && (
              <div className='dashboard-charts-grid' aria-label='4 vùng phân tích'>
                <section className='dashboard-chart-card'>
                  <div className='dashboard-chart-head'>
                    <div>
                      <h3>Xu hướng đăng ký và hoàn tất theo tháng ({data.period.year})</h3>
                      <p>
                        Hai chuỗi độc lập: Đăng ký tính theo Ngày nộp, Hoàn tất tính theo Ngày hoàn
                        tất (không phải tỷ lệ chuyển đổi của cùng một tập).
                      </p>
                    </div>
                  </div>
                  <div className='dashboard-chart-body'>
                    {monthPartition.active.length === 0 ? (
                      <div className='py-6 text-center' role='status'>
                        <p className='text-muted text-xs'>
                          Chưa phát sinh hồ sơ đăng ký hoặc hoàn tất trong kỳ đang chọn (tất cả 12
                          tháng đều bằng 0).
                        </p>
                        {!showAllMonths ? (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='mt-3 h-7 text-xs'
                            aria-expanded={false}
                            aria-controls='monthly-trend-table'
                            onClick={() => setShowAllMonths(true)}
                          >
                            Xem chi tiết 12 tháng (tất cả bằng 0)
                          </Button>
                        ) : (
                          <>
                            <div id='monthly-trend-table' className='mt-3 text-left'>
                              <DashboardList
                                label='tháng'
                                items={data.charts.monthlyTrend}
                                resetKey={JSON.stringify(appliedSearch)}
                                searchText={(month) => `${month.label} ${month.month}`}
                              >
                                {(months) => (
                                  <DataTable
                                    columns={monthlyTrendColumns}
                                    data={months}
                                    manual={false}
                                    paginated={false}
                                    getRowId={(row) => String(row.month)}
                                  />
                                )}
                              </DashboardList>
                            </div>
                            <div className='mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-2'>
                              <span className='text-muted text-xs'>
                                Dữ liệu gồm 12 tháng (tất cả đều bằng 0).
                              </span>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                className='h-7 text-xs'
                                aria-expanded={true}
                                aria-controls='monthly-trend-table'
                                onClick={() => setShowAllMonths(false)}
                              >
                                Thu gọn danh sách tháng
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <div id='monthly-trend-table'>
                          <DashboardList
                            label='tháng'
                            items={showAllMonths ? data.charts.monthlyTrend : monthPartition.active}
                            searchItems={data.charts.monthlyTrend}
                            resetKey={`${JSON.stringify(appliedSearch)}:${showAllMonths}`}
                            searchText={(month) => `${month.label} ${month.month}`}
                          >
                            {(months) => (
                              <DataTable
                                columns={monthlyTrendColumns}
                                data={months}
                                manual={false}
                                paginated={false}
                                getRowId={(row) => String(row.month)}
                              />
                            )}
                          </DashboardList>
                        </div>
                        {monthPartition.zeroCount > 0 && (
                          <div className='mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-2'>
                            <span className='text-muted text-xs'>
                              {showAllMonths
                                ? `Dữ liệu gồm 12 tháng (${monthPartition.active.length} tháng phát sinh, ${monthPartition.zeroCount} tháng bằng 0).`
                                : `Mặc định ẩn ${monthPartition.zeroCount} tháng không phát sinh; tìm kiếm áp dụng cho cả 12 tháng.`}
                            </span>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              className='h-7 text-xs'
                              aria-expanded={showAllMonths}
                              aria-controls='monthly-trend-table'
                              onClick={() => setShowAllMonths(!showAllMonths)}
                            >
                              {showAllMonths
                                ? `Thu gọn ${monthPartition.zeroCount} tháng bằng 0`
                                : 'Xem đầy đủ 12 tháng'}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>

                <section className='dashboard-chart-card'>
                  <div className='dashboard-chart-head'>
                    <div>
                      <h3>Hồ sơ theo danh mục sản phẩm</h3>
                      <p>Chọn danh mục để xem danh sách hồ sơ sản phẩm tương ứng.</p>
                    </div>
                    <div
                      className='dashboard-chart-toggle'
                      role='group'
                      aria-label='Chọn chỉ số danh mục'
                    >
                      <button
                        type='button'
                        aria-pressed={
                          categoryMetricMode === DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED
                        }
                        onClick={() =>
                          setCategoryMetricMode(DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED)
                        }
                      >
                        Theo số đăng ký
                      </button>
                      <button
                        type='button'
                        aria-pressed={
                          categoryMetricMode === DASHBOARD_CATEGORY_METRIC_MODE.COMPLETED
                        }
                        onClick={() =>
                          setCategoryMetricMode(DASHBOARD_CATEGORY_METRIC_MODE.COMPLETED)
                        }
                      >
                        Theo số hoàn tất
                      </button>
                    </div>
                  </div>
                  <div className='dashboard-chart-body'>
                    {categoryPartition.active.length === 0 ? (
                      <div className='py-6 text-center' role='status'>
                        <p className='text-muted text-xs'>
                          Chưa phát sinh hồ sơ{' '}
                          {categoryMetricMode === DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED
                            ? 'đăng ký'
                            : 'hoàn tất'}{' '}
                          trong kỳ đang chọn (tất cả {data.charts.byCategory.length} danh mục đều
                          bằng 0).
                        </p>
                        {!showAllCategories ? (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='mt-3 h-7 text-xs'
                            aria-expanded={false}
                            aria-controls='category-metrics-list'
                            onClick={() => setShowAllCategories(true)}
                          >
                            Xem chi tiết {data.charts.byCategory.length} danh mục (tất cả bằng 0)
                          </Button>
                        ) : (
                          <>
                            <div id='category-metrics-list' className='mt-3 text-left'>
                              <DashboardList
                                label='danh mục'
                                items={data.charts.byCategory}
                                resetKey={`${JSON.stringify(appliedSearch)}:${categoryMetricMode}`}
                                searchText={(category) => category.categoryName}
                              >
                                {(categories) => (
                                  <div className='record-list'>
                                    {categories.map((category) => {
                                      const count =
                                        categoryMetricMode ===
                                        DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED
                                          ? category.registeredCount
                                          : category.completedCount;
                                      const pct = Math.round((count / maxCategoryCount) * 100);
                                      const categoryDrillDown = buildDashboardCategoryDrillDown({
                                        categoryId: category.categoryId,
                                        mode: categoryMetricMode,
                                        period: data.period,
                                        filtersApplied: data.filtersApplied,
                                      });
                                      return (
                                        <div className='record-row' key={category.categoryId}>
                                          <div className='record-main' style={{ width: '100%' }}>
                                            <div className='flex items-center justify-between gap-3'>
                                              <Link
                                                className='text-link'
                                                to='/admin/products'
                                                search={categoryDrillDown}
                                                aria-label={`Xem danh sách hồ sơ ${category.categoryName} (${count} hồ sơ ${
                                                  categoryMetricMode ===
                                                  DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED
                                                    ? 'đăng ký'
                                                    : 'hoàn tất'
                                                })`}
                                              >
                                                {category.categoryName}
                                              </Link>
                                              <strong
                                                style={{ fontVariantNumeric: 'tabular-nums' }}
                                              >
                                                {count} hồ sơ
                                              </strong>
                                            </div>
                                            <div
                                              className='category-ratio-track'
                                              aria-hidden='true'
                                            >
                                              <div
                                                className='category-ratio-fill'
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </DashboardList>
                            </div>
                            <div className='mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-2'>
                              <span className='text-muted text-xs'>
                                Dữ liệu gồm {data.charts.byCategory.length} danh mục (tất cả đều
                                bằng 0).
                              </span>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                className='h-7 text-xs'
                                aria-expanded={true}
                                aria-controls='category-metrics-list'
                                onClick={() => setShowAllCategories(false)}
                              >
                                Thu gọn danh sách danh mục
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <div id='category-metrics-list'>
                          <DashboardList
                            label='danh mục'
                            items={
                              showAllCategories ? data.charts.byCategory : categoryPartition.active
                            }
                            searchItems={data.charts.byCategory}
                            resetKey={`${JSON.stringify(appliedSearch)}:${categoryMetricMode}:${showAllCategories}`}
                            searchText={(category) => category.categoryName}
                          >
                            {(categories) => (
                              <div className='record-list'>
                                {categories.map((category) => {
                                  const count =
                                    categoryMetricMode === DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED
                                      ? category.registeredCount
                                      : category.completedCount;
                                  const pct = Math.round((count / maxCategoryCount) * 100);
                                  const categoryDrillDown = buildDashboardCategoryDrillDown({
                                    categoryId: category.categoryId,
                                    mode: categoryMetricMode,
                                    period: data.period,
                                    filtersApplied: data.filtersApplied,
                                  });
                                  return (
                                    <div className='record-row' key={category.categoryId}>
                                      <div className='record-main' style={{ width: '100%' }}>
                                        <div className='flex items-center justify-between gap-3'>
                                          <Link
                                            className='text-link'
                                            to='/admin/products'
                                            search={categoryDrillDown}
                                            aria-label={`Xem danh sách hồ sơ ${category.categoryName} (${count} hồ sơ ${
                                              categoryMetricMode ===
                                              DASHBOARD_CATEGORY_METRIC_MODE.REGISTERED
                                                ? 'đăng ký'
                                                : 'hoàn tất'
                                            })`}
                                          >
                                            {category.categoryName}
                                          </Link>
                                          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {count} hồ sơ
                                          </strong>
                                        </div>
                                        <div className='category-ratio-track' aria-hidden='true'>
                                          <div
                                            className='category-ratio-fill'
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </DashboardList>
                        </div>
                        {categoryPartition.zeroCount > 0 && (
                          <div className='mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-2'>
                            <span className='text-muted text-xs'>
                              {showAllCategories
                                ? `Dữ liệu gồm ${data.charts.byCategory.length} danh mục (${categoryPartition.active.length} phát sinh, ${categoryPartition.zeroCount} bằng 0).`
                                : `Mặc định ẩn ${categoryPartition.zeroCount} danh mục không phát sinh; tìm kiếm áp dụng cho toàn bộ danh mục.`}
                            </span>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              className='h-7 text-xs'
                              aria-expanded={showAllCategories}
                              aria-controls='category-metrics-list'
                              onClick={() => setShowAllCategories(!showAllCategories)}
                            >
                              {showAllCategories
                                ? `Thu gọn ${categoryPartition.zeroCount} danh mục bằng 0`
                                : `Xem toàn bộ (${data.charts.byCategory.length} danh mục)`}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>

                <section className='dashboard-chart-card'>
                  <div className='dashboard-chart-head'>
                    <div>
                      <h3>Tiến độ của hồ sơ đăng ký trong kỳ</h3>
                      <p>
                        Đối chiếu tổng với chỉ tiêu Đăng ký trong kỳ (
                        {data.charts.cohortProgress.registeredCount} hồ sơ nộp trong kỳ) xét tại mốc
                        chốt.
                      </p>
                    </div>
                  </div>
                  <div className='dashboard-chart-body'>
                    {(() => {
                      const cohort = data.charts.cohortProgress;
                      const total = Math.max(1, cohort.registeredCount);
                      const waitingPct = Math.round((cohort.waitingCount / total) * 100);
                      const scoringPct = Math.round((cohort.scoringCount / total) * 100);
                      const completedPct = Math.round((cohort.completedCount / total) * 100);
                      const missingPct = Math.round(
                        (cohort.missingStatusHistoryCount / total) * 100,
                      );
                      return (
                        <>
                          {cohort.registeredCount > 0 && (
                            <div
                              className='cohort-stacked-bar'
                              aria-label='Tỷ lệ trạng thái của tập hồ sơ đăng ký trong kỳ'
                            >
                              {cohort.waitingCount > 0 && (
                                <div
                                  className='cohort-segment-pending'
                                  style={{ width: `${waitingPct}%` }}
                                  title={`Đã nộp, chờ chấm: ${cohort.waitingCount}`}
                                />
                              )}
                              {cohort.scoringCount > 0 && (
                                <div
                                  className='cohort-segment-scoring'
                                  style={{ width: `${scoringPct}%` }}
                                  title={`Đang chấm: ${cohort.scoringCount}`}
                                />
                              )}
                              {cohort.completedCount > 0 && (
                                <div
                                  className='cohort-segment-completed'
                                  style={{ width: `${completedPct}%` }}
                                  title={`Hoàn tất: ${cohort.completedCount}`}
                                />
                              )}
                              {cohort.missingStatusHistoryCount > 0 && (
                                <div
                                  className='cohort-segment-missing'
                                  style={{ width: `${missingPct}%` }}
                                  title={`Thiếu lịch sử trạng thái: ${cohort.missingStatusHistoryCount}`}
                                />
                              )}
                            </div>
                          )}
                          <div className='cohort-breakdown-grid'>
                            <div className='cohort-breakdown-item'>
                              <span>Tổng đăng ký trong kỳ</span>
                              <strong>{cohort.registeredCount}</strong>
                            </div>
                            <div className='cohort-breakdown-item'>
                              <span>Đã nộp, chờ chấm</span>
                              <strong>{cohort.waitingCount}</strong>
                            </div>
                            <div className='cohort-breakdown-item'>
                              <span>Đang chấm</span>
                              <strong>{cohort.scoringCount}</strong>
                            </div>
                            <div className='cohort-breakdown-item'>
                              <span>Hoàn tất</span>
                              <strong>{cohort.completedCount}</strong>
                            </div>
                            {cohort.missingStatusHistoryCount > 0 && (
                              <div className='cohort-breakdown-item'>
                                <span>Thiếu lịch sử trạng thái</span>
                                <strong>{cohort.missingStatusHistoryCount}</strong>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </section>

                <section className='dashboard-chart-card'>
                  <div className='dashboard-chart-head'>
                    <div>
                      <h3>Cơ cấu mức sao theo điểm (Kết quả hoàn tất trong kỳ)</h3>
                      <p>
                        Phân bố 1–5 sao theo điểm của các hồ sơ hoàn tất hợp lệ trong kỳ (Mức sao
                        theo điểm chưa đồng nghĩa quyết định công nhận OCOP chính thức).
                      </p>
                    </div>
                  </div>
                  <div className='dashboard-chart-body'>
                    <DashboardList
                      label='mức sao'
                      items={data.charts.starDistribution}
                      resetKey={JSON.stringify(appliedSearch)}
                      searchText={(item) => `${item.label} ${item.stars}`}
                    >
                      {(stars) => (
                        <DataTable
                          columns={starDistributionColumns}
                          data={stars}
                          manual={false}
                          paginated={false}
                          getRowId={(row) => String(row.stars)}
                        />
                      )}
                    </DashboardList>
                  </div>
                </section>
              </div>
            )}

            {data.comparisonTable && (
              <Card className='admin-table-region p-5'>
                <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
                  <div>
                    <h2>Bảng đối chiếu chỉ tiêu với kỳ trước</h2>
                    <p className='text-muted text-xs'>
                      So sánh {data.period.label} với {data.period.previousPeriod.label}.
                    </p>
                  </div>
                  <Link className='text-link text-sm' to='/admin/reports' search={appliedSearch}>
                    Xem báo cáo chi tiết
                  </Link>
                </div>
                <DashboardList
                  label='chỉ tiêu'
                  items={data.comparisonTable}
                  resetKey={JSON.stringify(appliedSearch)}
                  searchText={(item) => `${item.label} ${item.basisLabel}`}
                >
                  {(items) => (
                    <DataTable
                      columns={comparisonColumns}
                      data={items}
                      manual={false}
                      paginated={false}
                      getRowId={(row) => row.id}
                    />
                  )}
                </DashboardList>
              </Card>
            )}
          </section>
        </>
      )}
    </section>
  );
}
