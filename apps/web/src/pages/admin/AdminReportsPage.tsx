import { useEffect, useMemo, useState } from 'react';
import type {
  AdminProductQuery,
  LocalityType,
  ProductRegistrationType,
  RegistrationReportRow,
  ReportDataQuality,
  ReportGroupBy,
  ReportPeriodMetadata,
  ResultsReportRow,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Filter, RotateCcw } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ALL } from '../../constants/consts';
import { currentVietnameseYear } from '../../lib/admin-date';
import {
  parseAdminReportsSearch,
  toAdminReportApiQuery,
  type AdminReportsSearch,
  type AdminReportTab,
} from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { formatExactScore } from '../../lib/print-format';
import { formatComparisonDelta } from '../../lib/report-format';
import { useAdminRegistrationsReport, useAdminResultsReport } from '../../queries/admin';
import { useAdminCategories, useAdminLocalities } from '../../queries/admin-catalogs';

interface AdminReportsPageProps {
  search?: AdminReportsSearch;
  onSearchChange?: (next: AdminReportsSearch) => void;
}

const GROUP_BY_LABELS: Record<ReportGroupBy, string> = {
  month: 'Theo tháng',
  year: 'Theo năm',
  locality: 'Theo địa bàn (Xã / Phường)',
  category: 'Theo danh mục sản phẩm',
};

const NUMERIC_CELL_META = {
  align: 'right' as const,
  cellClassName: 'print-num',
  cellStyle: { fontVariantNumeric: 'tabular-nums' } as const,
};

function formatViTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN');
}

function DrillDownLink({
  count,
  drillDown,
}: {
  count: number;
  drillDown: Partial<AdminProductQuery>;
}) {
  if (count <= 0) return <span>0</span>;
  return (
    <Link
      className='text-link'
      to='/admin/products'
      search={drillDown}
      title='Mở danh sách hồ sơ theo điều kiện lọc này'
    >
      <strong>{count}</strong>
    </Link>
  );
}

function DataQualityBanner({
  period,
  dataQuality,
}: {
  period: ReportPeriodMetadata;
  dataQuality: ReportDataQuality;
}) {
  const hasWarnings =
    dataQuality.unmappedLocalityCount > 0 ||
    dataQuality.missingSubmittedAtCount > 0 ||
    dataQuality.missingCompletedAtCount > 0 ||
    dataQuality.missingStatusHistoryCount > 0 ||
    dataQuality.invalidResultCount > 0;

  return (
    <aside className='report-meta-banner' aria-label='Thông tin mốc chốt và chất lượng dữ liệu'>
      <div className='report-period-summary text-sm'>
        <p>
          <strong>Kỳ báo cáo:</strong> {period.label} · <strong>Mốc chốt số liệu:</strong>{' '}
          {formatViTime(period.asOf)} · <strong>Thời điểm tổng hợp:</strong>{' '}
          {formatViTime(period.generatedAt)}
          {period.isPartialPeriod && (
            <Badge variant='secondary' className='ml-2'>
              Kỳ hiện tại chưa kết thúc (so sánh tương ứng cùng khoảng kỳ trước)
            </Badge>
          )}
        </p>
        <details className='text-muted mt-1 text-xs'>
          <summary className='cursor-pointer font-semibold'>Chi tiết kỳ báo cáo</summary>
          <p className='mt-1'>
            Múi giờ: <code>{period.timezone}</code> · Khoảng thời gian:{' '}
            <code>
              [{period.from}, {period.toExclusive})
            </code>
            {period.historyAvailableFrom
              ? ` · Nhật ký trạng thái khả dụng từ: ${formatViTime(period.historyAvailableFrom)}`
              : ''}
          </p>
        </details>
      </div>
      {hasWarnings && (
        <div className='print-warning-banner mt-2' role='status'>
          <strong>Cảnh báo chất lượng dữ liệu:</strong>{' '}
          {dataQuality.unmappedLocalityCount > 0 &&
            `${dataQuality.unmappedLocalityCount} hồ sơ chưa xác định địa bàn; `}
          {dataQuality.missingSubmittedAtCount > 0 &&
            `${dataQuality.missingSubmittedAtCount} hồ sơ thiếu ngày nộp; `}
          {dataQuality.missingCompletedAtCount > 0 &&
            `${dataQuality.missingCompletedAtCount} hồ sơ hoàn tất thiếu ngày hoàn tất; `}
          {dataQuality.missingStatusHistoryCount > 0 &&
            `${dataQuality.missingStatusHistoryCount} hồ sơ trước nâng cấp thiếu lịch sử trạng thái tại mốc chốt; `}
          {dataQuality.invalidResultCount > 0 &&
            `${dataQuality.invalidResultCount} kết quả điểm/sao không hợp lệ.`}
        </div>
      )}
    </aside>
  );
}

function RegistrationRowCells({ row }: { row: RegistrationReportRow }) {
  return (
    <>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink count={row.registeredCount} drillDown={row.drillDown} />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink
          count={row.waitingCount}
          drillDown={{ ...row.drillDown, status: 'SUBMITTED' }}
        />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink
          count={row.scoringCount}
          drillDown={{ ...row.drillDown, status: 'SCORING' }}
        />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink
          count={row.completedCount}
          drillDown={{ ...row.drillDown, status: 'COMPLETED' }}
        />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.passedCount}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.failedCount}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.passRate !== null ? `${formatExactScore(row.passRate)}%` : '—'}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {formatExactScore(row.averageScore)}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.starCounts[1]}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.starCounts[2]}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.starCounts[3]}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.starCounts[4]}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.starCounts[5]}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.distinctRegistrantCount}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.missingDataCount + row.unmappedLocalityCount}
      </td>
    </>
  );
}

function ResultsRowCells({ row }: { row: ResultsReportRow }) {
  return (
    <>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink count={row.completedCount} drillDown={row.drillDown} />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.passedCount}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.failedCount}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.passRate !== null ? `${formatExactScore(row.passRate)}%` : '—'}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {formatExactScore(row.averageScore)}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink count={row.starCounts[1]} drillDown={{ ...row.drillDown, starRating: 1 }} />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink count={row.starCounts[2]} drillDown={{ ...row.drillDown, starRating: 2 }} />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink count={row.starCounts[3]} drillDown={{ ...row.drillDown, starRating: 3 }} />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink count={row.starCounts[4]} drillDown={{ ...row.drillDown, starRating: 4 }} />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink count={row.starCounts[5]} drillDown={{ ...row.drillDown, starRating: 5 }} />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.distinctRegistrantCount}
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {row.unmappedLocalityCount + row.invalidResultCount}
      </td>
    </>
  );
}

export function AdminReportsPage({
  search: controlledSearch,
  onSearchChange,
}: AdminReportsPageProps) {
  const defaultYear = currentVietnameseYear();
  const [fallbackSearch, setFallbackSearch] = useState<AdminReportsSearch>({
    year: defaultYear,
    groupBy: 'month',
  });
  const appliedSearch = controlledSearch ?? fallbackSearch;
  const reportTab: AdminReportTab = appliedSearch.tab ?? 'registrations';

  function applySearch(next: AdminReportsSearch) {
    const normalized = parseAdminReportsSearch(next as Record<string, unknown>);
    if (onSearchChange) {
      onSearchChange(normalized);
    } else {
      setFallbackSearch(normalized);
    }
  }

  const [draftFilters, setDraftFilters] = useState<AdminReportsSearch>(appliedSearch);
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      appliedSearch.categoryId ||
      appliedSearch.localityType ||
      appliedSearch.localityId ||
      appliedSearch.registrationType ||
      appliedSearch.assessmentYear,
    ),
  );

  useEffect(() => {
    setDraftFilters(appliedSearch);
  }, [appliedSearch]);

  const apiQuery = toAdminReportApiQuery(appliedSearch);

  const categoriesQuery = useAdminCategories({
    page: 1,
    limit: 100,
  });
  const localitiesQuery = useAdminLocalities({
    page: 1,
    limit: 100,
    type: draftFilters.localityType,
  });

  const regQuery = useAdminRegistrationsReport(apiQuery, reportTab === 'registrations');
  const resQuery = useAdminResultsReport(apiQuery, reportTab === 'results');

  const categories = categoriesQuery.data?.data ?? [];
  const localities = localitiesQuery.data?.data ?? [];

  const activeError = errorText(reportTab === 'registrations' ? regQuery.error : resQuery.error);
  const activeLoading = reportTab === 'registrations' ? regQuery.isPending : resQuery.isPending;

  const regGroupBy = regQuery.data?.groupBy ?? appliedSearch.groupBy ?? 'month';
  const resGroupBy = resQuery.data?.groupBy ?? appliedSearch.groupBy ?? 'month';

  const registrationColumns = useMemo<DataTableColumnDef<RegistrationReportRow>[]>(
    () => [
      {
        accessorKey: 'label',
        header: GROUP_BY_LABELS[regGroupBy],
        meta: { isRowHeader: true },
      },
      {
        id: 'progress',
        header: 'Tiến độ hồ sơ',
        meta: { align: 'center' },
        columns: [
          {
            id: 'registeredCount',
            header: 'Đã đăng ký',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => (
              <DrillDownLink
                count={row.original.registeredCount}
                drillDown={row.original.drillDown}
              />
            ),
          },
          {
            id: 'waitingCount',
            header: 'Chờ chấm',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => (
              <DrillDownLink
                count={row.original.waitingCount}
                drillDown={{ ...row.original.drillDown, status: 'SUBMITTED' }}
              />
            ),
          },
          {
            id: 'scoringCount',
            header: 'Đang chấm',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => (
              <DrillDownLink
                count={row.original.scoringCount}
                drillDown={{ ...row.original.drillDown, status: 'SCORING' }}
              />
            ),
          },
          {
            id: 'completedCount',
            header: 'Hoàn tất',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => (
              <DrillDownLink
                count={row.original.completedCount}
                drillDown={{ ...row.original.drillDown, status: 'COMPLETED' }}
              />
            ),
          },
        ],
      },
      {
        id: 'results',
        header: 'Kết quả chấm',
        meta: { align: 'center' },
        columns: [
          {
            accessorKey: 'passedCount',
            header: 'Đạt (≥50đ)',
            meta: NUMERIC_CELL_META,
          },
          {
            accessorKey: 'failedCount',
            header: 'Chưa đạt (<50đ)',
            meta: NUMERIC_CELL_META,
          },
          {
            id: 'passRate',
            header: 'Tỷ lệ đạt',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) =>
              row.original.passRate !== null ? `${formatExactScore(row.original.passRate)}%` : '—',
          },
          {
            id: 'averageScore',
            header: 'Điểm TB',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => formatExactScore(row.original.averageScore),
          },
        ],
      },
      {
        id: 'stars',
        header: 'Mức sao theo điểm',
        meta: { align: 'center' },
        columns: [
          {
            id: 'star1',
            header: '1 sao',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => row.original.starCounts[1],
          },
          {
            id: 'star2',
            header: '2 sao',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => row.original.starCounts[2],
          },
          {
            id: 'star3',
            header: '3 sao',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => row.original.starCounts[3],
          },
          {
            id: 'star4',
            header: '4 sao',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => row.original.starCounts[4],
          },
          {
            id: 'star5',
            header: 'Mức 5 sao*',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => row.original.starCounts[5],
          },
        ],
      },
      {
        id: 'meta',
        header: 'Chủ thể & Dữ liệu',
        meta: { align: 'center' },
        columns: [
          {
            accessorKey: 'distinctRegistrantCount',
            header: 'Chủ thể',
            meta: NUMERIC_CELL_META,
          },
          {
            id: 'missing',
            header: 'Thiếu DL/ĐB',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => row.original.missingDataCount + row.original.unmappedLocalityCount,
          },
        ],
      },
    ],
    [regGroupBy],
  );

  const resultsColumns = useMemo<DataTableColumnDef<ResultsReportRow>[]>(
    () => [
      {
        accessorKey: 'label',
        header: GROUP_BY_LABELS[resGroupBy],
        meta: { isRowHeader: true },
      },
      {
        id: 'results',
        header: 'Kết quả chấm hoàn tất',
        meta: { align: 'center' },
        columns: [
          {
            id: 'completedCount',
            header: 'Số hoàn tất',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => (
              <DrillDownLink
                count={row.original.completedCount}
                drillDown={row.original.drillDown}
              />
            ),
          },
          {
            accessorKey: 'passedCount',
            header: 'Đạt (≥50đ)',
            meta: NUMERIC_CELL_META,
          },
          {
            accessorKey: 'failedCount',
            header: 'Chưa đạt (<50đ)',
            meta: NUMERIC_CELL_META,
          },
          {
            id: 'passRate',
            header: 'Tỷ lệ đạt',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) =>
              row.original.passRate !== null ? `${formatExactScore(row.original.passRate)}%` : '—',
          },
          {
            id: 'averageScore',
            header: 'Điểm TB',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => formatExactScore(row.original.averageScore),
          },
        ],
      },
      {
        id: 'stars',
        header: 'Mức sao theo điểm',
        meta: { align: 'center' },
        columns: [
          {
            id: 'star1',
            header: '1 sao',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => (
              <DrillDownLink
                count={row.original.starCounts[1]}
                drillDown={{ ...row.original.drillDown, starRating: 1 }}
              />
            ),
          },
          {
            id: 'star2',
            header: '2 sao',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => (
              <DrillDownLink
                count={row.original.starCounts[2]}
                drillDown={{ ...row.original.drillDown, starRating: 2 }}
              />
            ),
          },
          {
            id: 'star3',
            header: '3 sao',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => (
              <DrillDownLink
                count={row.original.starCounts[3]}
                drillDown={{ ...row.original.drillDown, starRating: 3 }}
              />
            ),
          },
          {
            id: 'star4',
            header: '4 sao',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => (
              <DrillDownLink
                count={row.original.starCounts[4]}
                drillDown={{ ...row.original.drillDown, starRating: 4 }}
              />
            ),
          },
          {
            id: 'star5',
            header: 'Mức 5 sao*',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => (
              <DrillDownLink
                count={row.original.starCounts[5]}
                drillDown={{ ...row.original.drillDown, starRating: 5 }}
              />
            ),
          },
        ],
      },
      {
        id: 'meta',
        header: 'Chủ thể & Dữ liệu',
        meta: { align: 'center' },
        columns: [
          {
            accessorKey: 'distinctRegistrantCount',
            header: 'Chủ thể',
            meta: NUMERIC_CELL_META,
          },
          {
            id: 'missing',
            header: 'Thiếu ĐB/Lỗi',
            meta: NUMERIC_CELL_META,
            cell: ({ row }) => row.original.unmappedLocalityCount + row.original.invalidResultCount,
          },
        ],
      },
    ],
    [resGroupBy],
  );

  function changeTab(val: string) {
    const nextTab: AdminReportTab = val === 'results' ? 'results' : 'registrations';
    applySearch({
      ...appliedSearch,
      tab: nextTab,
    });
  }

  const hasExtraFilters = Boolean(
    appliedSearch.month ||
    appliedSearch.categoryId ||
    appliedSearch.localityType ||
    appliedSearch.localityId ||
    appliedSearch.registrationType ||
    appliedSearch.assessmentYear ||
    (appliedSearch.groupBy && appliedSearch.groupBy !== 'month') ||
    (appliedSearch.year && appliedSearch.year !== defaultYear),
  );

  return (
    <section className='admin-page report-landscape-page'>
      <div className='admin-page-heading no-print'>
        <div>
          <h1>Báo cáo thống kê OCOP</h1>
          <p className='route-intro'>
            Tổng hợp hồ sơ đăng ký và kết quả đánh giá hoàn tất theo kỳ, địa bàn và danh mục sản
            phẩm.
          </p>
        </div>
        <div className='admin-actions'>
          <Button
            type='button'
            variant='secondary'
            loading={reportTab === 'registrations' ? regQuery.isFetching : resQuery.isFetching}
            onClick={() =>
              void (reportTab === 'registrations' ? regQuery.refetch() : resQuery.refetch())
            }
          >
            Tải lại số liệu
          </Button>
          <Button type='button' onClick={() => window.print()}>
            In / Lưu PDF A4 ngang
          </Button>
        </div>
      </div>

      <Tabs value={reportTab} onValueChange={changeTab}>
        <div className='no-print grid gap-2'>
          <TabsList aria-label='Chọn loại báo cáo theo căn cứ thời gian'>
            <TabsTrigger value='registrations'>Hồ sơ đăng ký</TabsTrigger>
            <TabsTrigger value='results'>Kết quả hoàn tất</TabsTrigger>
          </TabsList>
          <p className='text-muted text-xs'>
            {reportTab === 'registrations'
              ? 'Căn cứ: Tính các hồ sơ có Ngày nộp nằm trong kỳ báo cáo và đối chiếu trạng thái tại mốc chốt.'
              : 'Căn cứ: Tính các hồ sơ có Ngày hoàn tất chấm điểm nằm trong kỳ báo cáo.'}
          </p>
        </div>

        <form
          className='admin-form filter-card admin-filter-panel no-print mt-3'
          aria-label='Bộ lọc báo cáo thống kê'
          onSubmit={(event) => {
            event.preventDefault();
            applySearch({
              ...draftFilters,
              tab: reportTab,
            });
          }}
        >
          <div className='admin-filters'>
            <FormField
              label='Năm báo cáo'
              htmlFor='report-year'
              className='admin-filter-field'
              data-filter-width='year'
            >
              <Input
                id='report-year'
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
              htmlFor='report-month'
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
                <SelectTrigger id='report-month'>
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
            <FormField
              label='Nhóm dòng báo cáo theo'
              htmlFor='report-group-by'
              className='admin-filter-field'
              data-filter-width='group'
            >
              <Select
                value={draftFilters.groupBy ?? 'month'}
                onValueChange={(value) =>
                  setDraftFilters((old) => ({
                    ...old,
                    groupBy: value as ReportGroupBy,
                  }))
                }
              >
                <SelectTrigger id='report-group-by'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GROUP_BY_LABELS) as ReportGroupBy[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {GROUP_BY_LABELS[key]}
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
                aria-controls='report-advanced-filters'
                onClick={() => setShowAdvanced((open) => !open)}
              >
                <Filter className='size-4' aria-hidden='true' />
                <span>Bộ lọc khác</span>
              </Button>
              {hasExtraFilters && (
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() =>
                    applySearch({
                      tab: reportTab,
                      year: defaultYear,
                      groupBy: 'month',
                    })
                  }
                >
                  <RotateCcw className='size-4' aria-hidden='true' />
                  <span>Xóa bộ lọc</span>
                </Button>
              )}
            </div>
          </div>

          <div id='report-advanced-filters' hidden={!showAdvanced} className='advanced-filter-grid'>
            <FormField label='Danh mục sản phẩm' htmlFor='report-category-id'>
              <Select
                value={draftFilters.categoryId ?? ALL}
                onValueChange={(value) =>
                  setDraftFilters((old) => ({
                    ...old,
                    categoryId: value === ALL ? undefined : value,
                  }))
                }
              >
                <SelectTrigger id='report-category-id'>
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

            <FormField label='Loại địa bàn' htmlFor='report-locality-type'>
              <Select
                value={draftFilters.localityType ?? ALL}
                onValueChange={(value) => {
                  const nextType = (value === ALL ? undefined : value) as LocalityType | undefined;
                  const keepLoc =
                    !nextType ||
                    localities.some(
                      (loc) => loc.id === draftFilters.localityId && loc.type === nextType,
                    );
                  setDraftFilters((old) => ({
                    ...old,
                    localityType: nextType,
                    localityId: keepLoc ? old.localityId : undefined,
                  }));
                }}
              >
                <SelectTrigger id='report-locality-type'>
                  <SelectValue placeholder='Tất cả (Xã & Phường)' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả (Xã &amp; Phường)</SelectItem>
                  <SelectItem value='COMMUNE'>Xã</SelectItem>
                  <SelectItem value='WARD'>Phường</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label='Địa bàn cụ thể' htmlFor='report-locality-id'>
              <Select
                value={draftFilters.localityId ?? ALL}
                onValueChange={(value) =>
                  setDraftFilters((old) => ({
                    ...old,
                    localityId: value === ALL ? undefined : value,
                  }))
                }
              >
                <SelectTrigger id='report-locality-id'>
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

            <FormField label='Loại đăng ký' htmlFor='report-registration-type'>
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
                <SelectTrigger id='report-registration-type'>
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

            <FormField label='Năm đánh giá khai báo' htmlFor='report-assessment-year'>
              <Input
                id='report-assessment-year'
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

        {activeError && (
          <div className='mt-4'>
            <AlertError title='Không thể tải báo cáo' errors={[activeError]} />
          </div>
        )}
        {activeLoading && <PageSpin />}

        <TabsContent value='registrations'>
          {regQuery.data && (
            <article className='ocop-print-sheet report-print-landscape'>
              <header className='print-sheet-header'>
                <p className='print-gov-header'>
                  HỆ THỐNG ĐÁNH GIÁ, PHÂN HẠNG SẢN PHẨM OCOP — BÁO CÁO THỐNG KÊ ĐĂNG KÝ THEO KỲ
                </p>
                <h2>BÁO CÁO HỒ SƠ ĐĂNG KÝ THEO KỲ ({regQuery.data.period.label.toUpperCase()})</h2>
                <DataQualityBanner
                  period={regQuery.data.period}
                  dataQuality={regQuery.data.dataQuality}
                />
              </header>

              <div className='dashboard-status-grid'>
                <article className='dashboard-stat'>
                  <span>Tổng đã đăng ký trong kỳ</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {regQuery.data.totals.registeredCount}
                  </strong>
                  <small>{formatComparisonDelta(regQuery.data.comparison.registeredCount)}</small>
                </article>
                <article className='dashboard-stat'>
                  <span>Đã hoàn tất (tại mốc chốt)</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {regQuery.data.totals.completedCount}
                  </strong>
                  <small>{formatComparisonDelta(regQuery.data.comparison.completedCount)}</small>
                </article>
                <article className='dashboard-stat'>
                  <span>Đạt ngưỡng ≥ 3 sao theo điểm</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {regQuery.data.totals.passedCount}
                  </strong>
                  <small>{formatComparisonDelta(regQuery.data.comparison.passedCount)}</small>
                </article>
                <article className='dashboard-stat'>
                  <span>Chưa đạt ngưỡng (&lt; 50 điểm)</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {regQuery.data.totals.failedCount}
                  </strong>
                  <small>{formatComparisonDelta(regQuery.data.comparison.failedCount)}</small>
                </article>
              </div>

              <div
                className='admin-table-region table-wrap'
                role='region'
                aria-label='Bảng báo cáo hồ sơ đăng ký theo kỳ'
                tabIndex={0}
              >
                <DataTable
                  columns={registrationColumns}
                  data={regQuery.data.rows}
                  manual={false}
                  paginated={false}
                  getRowId={(row) => row.key}
                  tableClassName='print-table data-table admin-data-table'
                  footer={
                    <tr>
                      <th scope='row'>{regQuery.data.totals.label}</th>
                      <RegistrationRowCells row={regQuery.data.totals} />
                    </tr>
                  }
                />
              </div>

              <p className='print-footnote'>
                * Chú thích: Mức sao trong báo cáo là mức sao tính từ điểm hệ thống (50–&lt;70: 3
                sao; 70–&lt;90: 4 sao; 90–100: mức điểm 5 sao / đề nghị xem xét 5 sao), không đồng
                nghĩa đã có Quyết định công nhận chính thức.
              </p>
            </article>
          )}
        </TabsContent>

        <TabsContent value='results'>
          {resQuery.data && (
            <article className='ocop-print-sheet report-print-landscape'>
              <header className='print-sheet-header'>
                <p className='print-gov-header'>
                  HỆ THỐNG ĐÁNH GIÁ, PHÂN HẠNG SẢN PHẨM OCOP — BÁO CÁO KẾT QUẢ CHẤM THEO KỲ
                </p>
                <h2>
                  BÁO CÁO KẾT QUẢ CHẤM ĐIỂM HOÀN TẤT TRONG KỲ (
                  {resQuery.data.period.label.toUpperCase()})
                </h2>
                <DataQualityBanner
                  period={resQuery.data.period}
                  dataQuality={resQuery.data.dataQuality}
                />
              </header>

              <div className='dashboard-status-grid'>
                <article className='dashboard-stat'>
                  <span>Tổng hoàn tất trong kỳ</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {resQuery.data.totals.completedCount}
                  </strong>
                  <small>{formatComparisonDelta(resQuery.data.comparison.completedCount)}</small>
                </article>
                <article className='dashboard-stat'>
                  <span>Đạt ngưỡng ≥ 3 sao theo điểm</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {resQuery.data.totals.passedCount}
                  </strong>
                  <small>{formatComparisonDelta(resQuery.data.comparison.passedCount)}</small>
                </article>
                <article className='dashboard-stat'>
                  <span>Chưa đạt ngưỡng (&lt; 50 điểm)</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {resQuery.data.totals.failedCount}
                  </strong>
                  <small>{formatComparisonDelta(resQuery.data.comparison.failedCount)}</small>
                </article>
                <article className='dashboard-stat'>
                  <span>Mức điểm 5 sao (90–100 điểm)</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {resQuery.data.totals.starCounts[5]}
                  </strong>
                  <small>{formatComparisonDelta(resQuery.data.comparison.star5Count)}</small>
                </article>
              </div>

              <div
                className='admin-table-region table-wrap'
                role='region'
                aria-label='Bảng báo cáo kết quả hoàn tất theo kỳ'
                tabIndex={0}
              >
                <DataTable
                  columns={resultsColumns}
                  data={resQuery.data.rows}
                  manual={false}
                  paginated={false}
                  getRowId={(row) => row.key}
                  tableClassName='print-table data-table admin-data-table'
                  footer={
                    <tr>
                      <th scope='row'>{resQuery.data.totals.label}</th>
                      <ResultsRowCells row={resQuery.data.totals} />
                    </tr>
                  }
                />
              </div>

              <p className='print-footnote'>
                * Chú thích: Kết quả 90–100 điểm là mức điểm 5 sao / đề nghị xem xét 5 sao theo điểm
                hệ thống, không thay thế Quyết định công nhận OCOP chính thức.
              </p>
            </article>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
