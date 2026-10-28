import { useEffect, useMemo, useState } from 'react';
import type {
  AdminAnalyticsDashboardResponse,
  AdminReportFilterQuery,
  DashboardKpiId,
  DashboardKpiItem,
  LocalityType,
  ProductRegistrationType,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Filter, RotateCcw } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type DataTableColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL } from '../../constants/consts';
import { ADMIN_DASHBOARD_STATUS_LABEL } from '../../constants/product-status';
import { currentVietnameseYear } from '../../lib/admin-date';
import { parseAdminDashboardSearch } from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { formatExactScore } from '../../lib/print-format';
import { dashboardKpiLinkLabel, formatKpiDeltaText, formatKpiValue } from '../../lib/report-format';
import { hasStaffPermission } from '../../lib/session-contract';
import { useAdminDashboard } from '../../queries/admin';
import { useAdminCategories, useAdminLocalities } from '../../queries/admin-catalogs';

interface AdminDashboardPageProps {
  search?: AdminReportFilterQuery;
  onSearchChange?: (next: AdminReportFilterQuery) => void;
}

const operationalIds: DashboardKpiId[] = [
  'registeredInPeriod',
  'completedInPeriod',
  'openBacklogAtAsOf',
  'underAssignedBacklogAtAsOf',
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
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
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
      appliedSearch.localityType ||
      appliedSearch.localityId ||
      appliedSearch.registrationType ||
      appliedSearch.assessmentYear,
    ),
  );
  const [categoryMetricMode, setCategoryMetricMode] = useState<'registered' | 'completed'>(
    'registered',
  );

  useEffect(() => {
    setDraftFilters(appliedSearch);
  }, [appliedSearch]);

  const categoriesQuery = useAdminCategories({
    page: 1,
    limit: 100,
  });
  const localitiesQuery = useAdminLocalities({
    page: 1,
    limit: 100,
    type: draftFilters.localityType,
  });

  const {
    data = null,
    isPending: loading,
    isFetching,
    error: loadError,
    refetch,
  } = useAdminDashboard(appliedSearch);
  const error = errorText(loadError);

  const categories = categoriesQuery.data?.data ?? [];
  const localities = localitiesQuery.data?.data ?? [];

  const operationalKpis = data ? data.kpis.filter((item) => operationalIds.includes(item.id)) : [];
  const analyticalKpis = data ? data.kpis.filter((item) => !operationalIds.includes(item.id)) : [];

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
        cell: ({ row }) => `${row.original.submitted} / ${row.original.assigned}`,
      },
      {
        accessorKey: 'pending',
        header: 'Chưa hoàn tất',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
      },
      {
        id: 'progress',
        header: 'Tiến độ',
        cell: ({ row }) => {
          const judge = row.original;
          const percent = judge.assigned ? Math.round((judge.submitted / judge.assigned) * 100) : 0;
          return (
            <div>
              <div
                className='progress-track'
                role='progressbar'
                aria-label={`Tiến độ của ${judge.fullName}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
              <span className='text-xs'>{percent}%</span>
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
                dateBasis: 'completedAt',
                status: 'COMPLETED',
                from: m.from,
                toExclusive: m.toExclusive,
              }}
            >
              {m.completedCount} hồ sơ
            </Link>
          );
        },
      },
    ],
    [],
  );

  const starDistributionColumns = useMemo<DataTableColumnDef<DashboardStarDistributionItem>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Mức sao theo điểm',
        meta: { isRowHeader: true },
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
                status: 'COMPLETED',
                starRating: item.stars,
                dateBasis: 'completedAt',
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
            ? item.unit === 'PERCENT'
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

  const hasExtraFilters = Boolean(
    appliedSearch.month ||
    appliedSearch.categoryId ||
    appliedSearch.localityType ||
    appliedSearch.localityId ||
    appliedSearch.registrationType ||
    appliedSearch.assessmentYear ||
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
            <Select
              value={draftFilters.month ? String(draftFilters.month) : ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  month: value === ALL ? undefined : Number(value),
                }))
              }
            >
              <SelectTrigger id='dashboard-month'>
                <SelectValue placeholder='Cả năm' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Cả năm</SelectItem>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    Tháng {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select
              value={draftFilters.categoryId ?? ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  categoryId: value === ALL ? undefined : value,
                }))
              }
            >
              <SelectTrigger id='dashboard-category'>
                <SelectValue placeholder='Tất cả danh mục' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả danh mục</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label='Loại địa bàn' htmlFor='dashboard-locality-type'>
            <Select
              value={draftFilters.localityType ?? ALL}
              onValueChange={(value) => {
                const nextType = (value === ALL ? undefined : value) as LocalityType | undefined;
                const keepLocality =
                  !nextType ||
                  localities.some(
                    (loc) => loc.id === draftFilters.localityId && loc.type === nextType,
                  );
                setDraftFilters((old) => ({
                  ...old,
                  localityType: nextType,
                  localityId: keepLocality ? old.localityId : undefined,
                }));
              }}
            >
              <SelectTrigger id='dashboard-locality-type'>
                <SelectValue placeholder='Tất cả loại địa bàn' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả loại địa bàn</SelectItem>
                <SelectItem value='COMMUNE'>Xã</SelectItem>
                <SelectItem value='WARD'>Phường</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label='Địa bàn hành chính' htmlFor='dashboard-locality-id'>
            <Select
              value={draftFilters.localityId ?? ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  localityId: value === ALL ? undefined : value,
                }))
              }
            >
              <SelectTrigger id='dashboard-locality-id'>
                <SelectValue placeholder='Tất cả địa bàn' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả địa bàn</SelectItem>
                {localities.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} · {loc.provinceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label='Loại đăng ký' htmlFor='dashboard-registration-type'>
            <Select
              value={draftFilters.registrationType ?? ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  registrationType: (value === ALL ? undefined : value) as
                    ProductRegistrationType | undefined,
                }))
              }
            >
              <SelectTrigger id='dashboard-registration-type'>
                <SelectValue placeholder='Tất cả' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả</SelectItem>
                <SelectItem value='FIRST'>Lần đầu</SelectItem>
                <SelectItem value='UPGRADE'>Nâng hạng</SelectItem>
                <SelectItem value='REASSESSMENT'>Đánh giá lại</SelectItem>
              </SelectContent>
            </Select>
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
          {data.period && (
            <Card className='admin-table-region p-4 text-sm' role='status'>
              <strong>Kỳ đang xem:</strong> {data.period.label} · Mốc chốt số liệu:{' '}
              {new Date(data.period.asOf).toLocaleString('vi-VN')} · Cập nhật lúc:{' '}
              {new Date(data.period.generatedAt).toLocaleString('vi-VN')}
              {data.period.isPartialPeriod
                ? ' · Kỳ hiện tại chưa kết thúc (so sánh tương ứng cùng khoảng thời gian kỳ trước).'
                : ''}
            </Card>
          )}

          {data.dataQuality &&
            (data.dataQuality.unmappedLocalityCount > 0 ||
              data.dataQuality.missingStatusHistoryCount > 0 ||
              data.dataQuality.missingCompletedAtCount > 0) && (
              <div className='assignment-warning' role='status'>
                <strong>Lưu ý chất lượng dữ liệu:</strong>{' '}
                {data.dataQuality.unmappedLocalityCount > 0 &&
                  `${data.dataQuality.unmappedLocalityCount} hồ sơ chưa gắn địa bàn; `}
                {data.dataQuality.missingCompletedAtCount > 0 &&
                  `${data.dataQuality.missingCompletedAtCount} hồ sơ hoàn tất thiếu ngày hoàn tất; `}
                {data.dataQuality.missingStatusHistoryCount > 0 &&
                  `${data.dataQuality.missingStatusHistoryCount} hồ sơ kỳ cũ thiếu lịch sử trạng thái.`}
              </div>
            )}

          {operationalKpis.length > 0 && (
            <section className='dashboard-section' aria-label='Chỉ tiêu vận hành ưu tiên'>
              <h2 className='mb-3'>Chỉ tiêu vận hành trong kỳ</h2>
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
            </section>
          )}

          <div className='admin-step-grid'>
            <Card className='admin-table-region p-5'>
              <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
                <div>
                  <h2>Hồ sơ cần xử lý tiếp</h2>
                  <p className='text-muted text-xs'>
                    Hồ sơ đang chờ hoặc đang trong quá trình chấm, sắp theo ngày nộp lâu nhất.
                  </p>
                </div>
                <Link
                  className='text-link text-sm'
                  to='/admin/products'
                  search={{ status: 'SUBMITTED' }}
                >
                  Mở hồ sơ đã nộp
                </Link>
              </div>
              {data.needsAttention.length ? (
                <div className='record-list'>
                  {data.needsAttention.map((product) => (
                    <article className='record-row' key={product.id}>
                      <div className='record-main'>
                        <Badge variant='secondary'>{product.category.name}</Badge>
                        <h3 className='mt-1'>{product.name}</h3>
                        <p className='text-muted text-xs'>
                          {product.status === 'SUBMITTED' ? 'Đã nộp' : 'Đang chấm'} ·{' '}
                          {product.assignedJudgeCount === 0 || product.missingCriteriaCount > 0
                            ? 'Thiếu phân công phủ tiêu chí'
                            : `${product.pendingEvaluationCount} phiếu chưa hoàn tất`}
                        </p>
                      </div>
                      <div className='record-result'>
                        <span className='text-muted text-xs'>
                          {product.submittedEvaluationCount} / {product.assignedJudgeCount} phiếu
                        </span>
                        <Button asChild variant='secondary' size='sm'>
                          <Link to='/admin/products/$id' params={{ id: product.id }}>
                            Mở hồ sơ
                          </Link>
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className='text-muted py-6 text-center'>
                  <h3 className='text-fg text-base font-semibold'>Không có hồ sơ chờ xử lý</h3>
                  <p className='mt-1 text-xs'>
                    Danh sách này sẽ cập nhật khi có hồ sơ đã nộp hoặc đang chấm.
                  </p>
                </div>
              )}
            </Card>

            {canManage && (
              <Card className='admin-table-region p-5'>
                <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
                  <div>
                    <h2>Tiến độ giám khảo</h2>
                    <p className='text-muted text-xs'>Phiếu đã nộp trên tổng số hồ sơ được giao.</p>
                  </div>
                  <Link className='text-link text-sm' to='/admin/assignments'>
                    Phân công
                  </Link>
                </div>
                {data.judges.length ? (
                  <DataTable
                    columns={judgeColumns}
                    data={data.judges}
                    manual={false}
                    paginated={false}
                    getRowId={(row) => row.judgeId}
                  />
                ) : (
                  <div className='text-muted py-6 text-center'>
                    <h3 className='text-fg text-base font-semibold'>Chưa có giám khảo hoạt động</h3>
                    <p className='mt-1 mb-3 text-xs'>
                      Dữ liệu tiến độ sẽ xuất hiện sau khi có phân công.
                    </p>
                    <Button asChild variant='secondary' size='sm'>
                      <Link to='/admin/users' search={{ permission: 'SCORE' }}>
                        Quản lý giám khảo
                      </Link>
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>

          <section className='admin-page' aria-label='Phân tích kết quả trong kỳ'>
            <div>
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
                <Card className='admin-table-region p-5'>
                  <h2>Xu hướng đăng ký và hoàn tất theo tháng ({data.period.year})</h2>
                  <p className='form-note'>
                    Hai chuỗi độc lập: Đăng ký tính theo Ngày nộp, Hoàn tất tính theo Ngày hoàn tất
                    (không phải tỷ lệ chuyển đổi của cùng một tập).
                  </p>
                  {data.charts.monthlyTrend.every(
                    (m) => m.registeredCount === 0 && m.completedCount === 0,
                  ) && (
                    <p className='text-muted mb-2 text-xs' role='status'>
                      Chưa phát sinh hồ sơ đăng ký hoặc hoàn tất trong kỳ đang chọn.
                    </p>
                  )}
                  <DataTable
                    columns={monthlyTrendColumns}
                    data={data.charts.monthlyTrend}
                    manual={false}
                    paginated={false}
                    getRowId={(row) => String(row.month)}
                  />
                </Card>

                <Card className='admin-table-region p-5'>
                  <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
                    <div>
                      <h2>Hồ sơ theo danh mục sản phẩm</h2>
                      <p className='text-muted text-xs'>Chọn danh mục để xem các hồ sơ sản phẩm.</p>
                    </div>
                    <div className='admin-actions'>
                      <Button
                        type='button'
                        size='sm'
                        variant={categoryMetricMode === 'registered' ? 'default' : 'secondary'}
                        onClick={() => setCategoryMetricMode('registered')}
                      >
                        Theo số đăng ký
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant={categoryMetricMode === 'completed' ? 'default' : 'secondary'}
                        onClick={() => setCategoryMetricMode('completed')}
                      >
                        Theo số hoàn tất
                      </Button>
                    </div>
                  </div>
                  <div className='record-list'>
                    {data.charts.byCategory.map((category) => (
                      <div className='record-row' key={category.categoryId}>
                        <Link
                          className='text-link'
                          to='/admin/products'
                          search={{ categoryId: category.categoryId }}
                        >
                          {category.categoryName}
                        </Link>
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {categoryMetricMode === 'registered'
                            ? category.registeredCount
                            : category.completedCount}{' '}
                          hồ sơ
                        </strong>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className='admin-table-region p-5'>
                  <h2>Tiến độ của hồ sơ đăng ký trong kỳ</h2>
                  <p className='form-note'>
                    Đối chiếu tổng với chỉ tiêu Đăng ký trong kỳ (
                    {data.charts.cohortProgress.registeredCount} hồ sơ nộp trong kỳ) xét tại mốc
                    chốt.
                  </p>
                  <dl className='detail-facts'>
                    <div>
                      <dt>Tổng đăng ký trong kỳ</dt>
                      <dd style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {data.charts.cohortProgress.registeredCount}
                      </dd>
                    </div>
                    <div>
                      <dt>Đã nộp, chờ chấm</dt>
                      <dd style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {data.charts.cohortProgress.waitingCount}
                      </dd>
                    </div>
                    <div>
                      <dt>Đang chấm</dt>
                      <dd style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {data.charts.cohortProgress.scoringCount}
                      </dd>
                    </div>
                    <div>
                      <dt>Hoàn tất</dt>
                      <dd style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {data.charts.cohortProgress.completedCount}
                      </dd>
                    </div>
                    {data.charts.cohortProgress.missingStatusHistoryCount > 0 && (
                      <div>
                        <dt>Thiếu lịch sử trạng thái</dt>
                        <dd style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {data.charts.cohortProgress.missingStatusHistoryCount}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Card>

                <Card className='admin-table-region p-5'>
                  <h2>Cơ cấu mức sao theo điểm (Kết quả hoàn tất trong kỳ)</h2>
                  <p className='form-note'>
                    Phân bố 1–5 sao theo điểm của các hồ sơ hoàn tất hợp lệ trong kỳ (chưa đồng
                    nghĩa quyết định công nhận chính thức).
                  </p>
                  <DataTable
                    columns={starDistributionColumns}
                    data={data.charts.starDistribution}
                    manual={false}
                    paginated={false}
                    getRowId={(row) => String(row.stars)}
                  />
                </Card>
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
                <DataTable
                  columns={comparisonColumns}
                  data={data.comparisonTable}
                  manual={false}
                  paginated={false}
                  getRowId={(row) => row.id}
                />
              </Card>
            )}

            <section className='dashboard-section'>
              <h2 className='mb-3'>Tổng số hồ sơ hiện tại theo trạng thái</h2>
              <div className='dashboard-status-grid' aria-label='Hồ sơ theo trạng thái'>
                {(
                  Object.keys(
                    ADMIN_DASHBOARD_STATUS_LABEL,
                  ) as (keyof typeof ADMIN_DASHBOARD_STATUS_LABEL)[]
                ).map((status) => (
                  <article className='dashboard-stat' key={status}>
                    <span>{ADMIN_DASHBOARD_STATUS_LABEL[status]}</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {data.productsByStatus[status]}
                    </strong>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </>
      )}
    </section>
  );
}
