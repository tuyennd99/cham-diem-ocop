import { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { currentVietnameseYear } from '../../lib/admin-date';
import {
  parseAdminReportsSearch,
  toAdminReportApiQuery,
  type AdminReportTab,
  type AdminReportsSearch,
} from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { formatExactScore } from '../../lib/print-format';
import { formatComparisonDelta } from '../../lib/report-format';
import { useAdminRegistrationsReport, useAdminResultsReport } from '../../queries/admin';
import {
  useAdminCategories,
  useAdminLocalities,
  useAdminProductGroups,
} from '../../queries/admin-catalogs';

interface AdminReportsPageProps {
  search?: AdminReportsSearch;
  onSearchChange?: (next: AdminReportsSearch) => void;
}

const GROUP_BY_LABELS: Record<ReportGroupBy, string> = {
  month: 'Theo tháng',
  year: 'Theo năm',
  locality: 'Theo địa bàn (Xã / Phường)',
  group: 'Theo nhóm sản phẩm lớn',
  category: 'Theo phân loại sản phẩm',
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
            <span className='status-badge scoring ml-2'>
              Kỳ hiện tại chưa kết thúc (so sánh tương ứng cùng khoảng kỳ trước)
            </span>
          )}
        </p>
        <details className='mt-1 text-xs text-muted'>
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
        <DrillDownLink
          count={row.starCounts[1]}
          drillDown={{ ...row.drillDown, starRating: 1 }}
        />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink
          count={row.starCounts[2]}
          drillDown={{ ...row.drillDown, starRating: 2 }}
        />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink
          count={row.starCounts[3]}
          drillDown={{ ...row.drillDown, starRating: 3 }}
        />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink
          count={row.starCounts[4]}
          drillDown={{ ...row.drillDown, starRating: 4 }}
        />
      </td>
      <td className='print-num' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <DrillDownLink
          count={row.starCounts[5]}
          drillDown={{ ...row.drillDown, starRating: 5 }}
        />
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
      appliedSearch.groupId ||
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

  const groupsQuery = useAdminProductGroups({ page: 1, limit: 100 });
  const categoriesQuery = useAdminCategories({
    page: 1,
    limit: 100,
    groupId: draftFilters.groupId,
  });
  const localitiesQuery = useAdminLocalities({
    page: 1,
    limit: 100,
    type: draftFilters.localityType,
  });

  const regQuery = useAdminRegistrationsReport(apiQuery, reportTab === 'registrations');
  const resQuery = useAdminResultsReport(apiQuery, reportTab === 'results');

  const groups = groupsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const localities = localitiesQuery.data?.data ?? [];

  const activeError = errorText(
    reportTab === 'registrations' ? regQuery.error : resQuery.error,
  );
  const activeLoading =
    reportTab === 'registrations' ? regQuery.isPending : resQuery.isPending;

  function changeTab(val: string) {
    const nextTab: AdminReportTab = val === 'results' ? 'results' : 'registrations';
    applySearch({
      ...appliedSearch,
      tab: nextTab,
    });
  }

  const hasExtraFilters = Boolean(
    appliedSearch.month ||
      appliedSearch.groupId ||
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
            Tổng hợp hồ sơ đăng ký và kết quả đánh giá hoàn tất theo kỳ, địa bàn và nhóm sản phẩm.
          </p>
        </div>
        <div className='admin-actions'>
          <Button
            type='button'
            variant='secondary'
            onClick={() =>
              void (reportTab === 'registrations'
                ? regQuery.refetch()
                : resQuery.refetch())
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
          <p className='text-xs text-muted'>
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
            <label
              className='admin-filter-field'
              data-filter-width='year'
              htmlFor='report-year'
            >
              Năm báo cáo
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
            </label>
            <label
              className='admin-filter-field'
              data-filter-width='month'
              htmlFor='report-month'
            >
              Tháng
              <select
                id='report-month'
                value={draftFilters.month ?? ''}
                onChange={(event) =>
                  setDraftFilters((old) => ({
                    ...old,
                    month: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
              >
                <option value=''>Cả năm</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            </label>
            <label
              className='admin-filter-field'
              data-filter-width='group'
              htmlFor='report-group-by'
            >
              Nhóm dòng báo cáo theo
              <select
                id='report-group-by'
                value={draftFilters.groupBy ?? 'month'}
                onChange={(event) =>
                  setDraftFilters((old) => ({
                    ...old,
                    groupBy: event.target.value as ReportGroupBy,
                  }))
                }
              >
                {(Object.keys(GROUP_BY_LABELS) as ReportGroupBy[]).map((key) => (
                  <option key={key} value={key}>
                    {GROUP_BY_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>

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

          <div
            id='report-advanced-filters'
            hidden={!showAdvanced}
            className='advanced-filter-grid'
          >
            <label htmlFor='report-group-id'>
              Nhóm sản phẩm lớn
              <select
                id='report-group-id'
                value={draftFilters.groupId ?? ''}
                onChange={(event) => {
                  const nextGroupId = event.target.value || undefined;
                  const keepCat =
                    !nextGroupId ||
                    categories.some(
                      (cat) => cat.id === draftFilters.categoryId && cat.groupId === nextGroupId,
                    );
                  setDraftFilters((old) => ({
                    ...old,
                    groupId: nextGroupId,
                    categoryId: keepCat ? old.categoryId : undefined,
                  }));
                }}
              >
                <option value=''>Tất cả nhóm</option>
                {groups.map((grp) => (
                  <option key={grp.id} value={grp.id}>
                    {grp.code} · {grp.name}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor='report-category-id'>
              Phân loại sản phẩm
              <select
                id='report-category-id'
                value={draftFilters.categoryId ?? ''}
                onChange={(event) =>
                  setDraftFilters((old) => ({
                    ...old,
                    categoryId: event.target.value || undefined,
                  }))
                }
              >
                <option value=''>Tất cả phân loại</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor='report-locality-type'>
              Loại địa bàn
              <select
                id='report-locality-type'
                value={draftFilters.localityType ?? ''}
                onChange={(event) => {
                  const nextType = (event.target.value || undefined) as LocalityType | undefined;
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
                <option value=''>Tất cả (Xã &amp; Phường)</option>
                <option value='COMMUNE'>Xã</option>
                <option value='WARD'>Phường</option>
              </select>
            </label>

            <label htmlFor='report-locality-id'>
              Địa bàn cụ thể
              <select
                id='report-locality-id'
                value={draftFilters.localityId ?? ''}
                onChange={(event) =>
                  setDraftFilters((old) => ({
                    ...old,
                    localityId: event.target.value || undefined,
                  }))
                }
              >
                <option value=''>Tất cả địa bàn</option>
                {localities.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} · {loc.provinceName}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor='report-registration-type'>
              Loại đăng ký
              <select
                id='report-registration-type'
                value={draftFilters.registrationType ?? ''}
                onChange={(event) =>
                  setDraftFilters((old) => ({
                    ...old,
                    registrationType: (event.target.value || undefined) as
                      | ProductRegistrationType
                      | undefined,
                  }))
                }
              >
                <option value=''>Tất cả</option>
                <option value='FIRST'>Lần đầu</option>
                <option value='UPGRADE'>Nâng hạng</option>
                <option value='REASSESSMENT'>Đánh giá lại</option>
              </select>
            </label>

            <label htmlFor='report-assessment-year'>
              Năm đánh giá khai báo
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
            </label>
          </div>
        </form>

        {activeError && (
          <div className='form-note mt-4' role='alert'>
            <p>{activeError}</p>
          </div>
        )}
        {activeLoading && <p aria-live='polite'>Đang tổng hợp báo cáo…</p>}

        <TabsContent value='registrations'>
          {regQuery.data && (
            <article className='ocop-print-sheet report-print-landscape'>
              <header className='print-sheet-header'>
                <p className='print-gov-header'>
                  HỆ THỐNG ĐÁNH GIÁ, PHÂN HẠNG SẢN PHẨM OCOP — BÁO CÁO THỐNG KÊ ĐĂNG KÝ THEO KỲ
                </p>
                <h2>
                  BÁO CÁO HỒ SƠ ĐĂNG KÝ THEO KỲ ({regQuery.data.period.label.toUpperCase()})
                </h2>
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
                  <small>
                    {formatComparisonDelta(regQuery.data.comparison.registeredCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Đã hoàn tất (tại mốc chốt)</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {regQuery.data.totals.completedCount}
                  </strong>
                  <small>
                    {formatComparisonDelta(regQuery.data.comparison.completedCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Đạt ngưỡng ≥ 3 sao theo điểm</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {regQuery.data.totals.passedCount}
                  </strong>
                  <small>
                    {formatComparisonDelta(regQuery.data.comparison.passedCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Chưa đạt ngưỡng (&lt; 50 điểm)</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {regQuery.data.totals.failedCount}
                  </strong>
                  <small>
                    {formatComparisonDelta(regQuery.data.comparison.failedCount)}
                  </small>
                </article>
              </div>

              <div
                className='admin-table-region table-wrap'
                role='region'
                aria-label='Bảng báo cáo hồ sơ đăng ký theo kỳ'
                tabIndex={0}
              >
                <table className='print-table data-table admin-data-table'>
                  <thead>
                    <tr>
                      <th scope='col' rowSpan={2}>
                        {GROUP_BY_LABELS[regQuery.data.groupBy]}
                      </th>
                      <th scope='colgroup' colSpan={4} style={{ textAlign: 'center' }}>
                        Tiến độ hồ sơ
                      </th>
                      <th scope='colgroup' colSpan={4} style={{ textAlign: 'center' }}>
                        Kết quả chấm
                      </th>
                      <th scope='colgroup' colSpan={5} style={{ textAlign: 'center' }}>
                        Mức sao theo điểm
                      </th>
                      <th scope='colgroup' colSpan={2} style={{ textAlign: 'center' }}>
                        Chủ thể &amp; Dữ liệu
                      </th>
                    </tr>
                    <tr>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Đã đăng ký
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Chờ chấm
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Đang chấm
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Hoàn tất
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Đạt (≥50đ)
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Chưa đạt (&lt;50đ)
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Tỷ lệ đạt
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Điểm TB
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        1 sao
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        2 sao
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        3 sao
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        4 sao
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Mức 5 sao*
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Chủ thể
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Thiếu DL/ĐB
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {regQuery.data.rows.map((row) => (
                      <tr key={row.key}>
                        <th scope='row'>{row.label}</th>
                        <RegistrationRowCells row={row} />
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope='row'>{regQuery.data.totals.label}</th>
                      <RegistrationRowCells row={regQuery.data.totals} />
                    </tr>
                  </tfoot>
                </table>
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
                  <small>
                    {formatComparisonDelta(resQuery.data.comparison.completedCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Đạt ngưỡng ≥ 3 sao theo điểm</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {resQuery.data.totals.passedCount}
                  </strong>
                  <small>
                    {formatComparisonDelta(resQuery.data.comparison.passedCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Chưa đạt ngưỡng (&lt; 50 điểm)</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {resQuery.data.totals.failedCount}
                  </strong>
                  <small>
                    {formatComparisonDelta(resQuery.data.comparison.failedCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Mức điểm 5 sao (90–100 điểm)</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {resQuery.data.totals.starCounts[5]}
                  </strong>
                  <small>
                    {formatComparisonDelta(resQuery.data.comparison.star5Count)}
                  </small>
                </article>
              </div>

              <div
                className='admin-table-region table-wrap'
                role='region'
                aria-label='Bảng báo cáo kết quả hoàn tất theo kỳ'
                tabIndex={0}
              >
                <table className='print-table data-table admin-data-table'>
                  <thead>
                    <tr>
                      <th scope='col' rowSpan={2}>
                        {GROUP_BY_LABELS[resQuery.data.groupBy]}
                      </th>
                      <th scope='colgroup' colSpan={5} style={{ textAlign: 'center' }}>
                        Kết quả chấm hoàn tất
                      </th>
                      <th scope='colgroup' colSpan={5} style={{ textAlign: 'center' }}>
                        Mức sao theo điểm
                      </th>
                      <th scope='colgroup' colSpan={2} style={{ textAlign: 'center' }}>
                        Chủ thể &amp; Dữ liệu
                      </th>
                    </tr>
                    <tr>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Số hoàn tất
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Đạt (≥50đ)
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Chưa đạt (&lt;50đ)
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Tỷ lệ đạt
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Điểm TB
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        1 sao
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        2 sao
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        3 sao
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        4 sao
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Mức 5 sao*
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Chủ thể
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Thiếu ĐB/Lỗi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resQuery.data.rows.map((row) => (
                      <tr key={row.key}>
                        <th scope='row'>{row.label}</th>
                        <ResultsRowCells row={row} />
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope='row'>{resQuery.data.totals.label}</th>
                      <ResultsRowCells row={resQuery.data.totals} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className='print-footnote'>
                * Chú thích: Kết quả 90–100 điểm là mức điểm 5 sao / đề nghị xem xét 5 sao theo
                điểm hệ thống, không thay thế Quyết định công nhận OCOP chính thức.
              </p>
            </article>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
