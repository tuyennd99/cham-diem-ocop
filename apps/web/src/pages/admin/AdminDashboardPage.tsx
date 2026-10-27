import { useEffect, useState } from 'react';
import type {
  AdminReportFilterQuery,
  DashboardKpiId,
  LocalityType,
  ProductRegistrationType,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ADMIN_DASHBOARD_STATUS_LABEL } from '../../constants/product-status';
import { currentVietnameseYear } from '../../lib/admin-date';
import { parseAdminDashboardSearch } from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { formatExactScore } from '../../lib/print-format';
import {
  dashboardKpiLinkLabel,
  formatKpiDeltaText,
  formatKpiValue,
} from '../../lib/report-format';
import { hasStaffPermission } from '../../lib/session-contract';
import { useAdminDashboard } from '../../queries/admin';
import {
  useAdminCategories,
  useAdminLocalities,
  useAdminProductGroups,
} from '../../queries/admin-catalogs';

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
  const [groupMetricMode, setGroupMetricMode] = useState<'registered' | 'completed'>(
    'registered',
  );
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  useEffect(() => {
    setDraftFilters(appliedSearch);
  }, [appliedSearch]);

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

  const {
    data = null,
    isPending: loading,
    isFetching,
    error: loadError,
    refetch,
  } = useAdminDashboard(appliedSearch);
  const error = errorText(loadError);

  const groups = groupsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const localities = localitiesQuery.data?.data ?? [];

  const operationalKpis = data
    ? data.kpis.filter((item) => operationalIds.includes(item.id))
    : [];
  const analyticalKpis = data
    ? data.kpis.filter((item) => !operationalIds.includes(item.id))
    : [];

  const hasExtraFilters = Boolean(
    appliedSearch.month ||
      appliedSearch.groupId ||
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
          <Link className='button button-secondary' to='/admin/reports' search={appliedSearch}>
            Báo cáo thống kê
          </Link>
          <Button
            type='button'
            variant='secondary'
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
          <label
            className='admin-filter-field'
            data-filter-width='year'
            htmlFor='dashboard-year'
          >
            Năm báo cáo
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
          </label>
          <label
            className='admin-filter-field'
            data-filter-width='month'
            htmlFor='dashboard-month'
          >
            Tháng
            <select
              id='dashboard-month'
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
            htmlFor='dashboard-group'
          >
            Nhóm sản phẩm lớn
            <select
              id='dashboard-group'
              value={draftFilters.groupId ?? ''}
              onChange={(event) => {
                const nextGroupId = event.target.value || undefined;
                const keepCategory =
                  !nextGroupId ||
                  categories.some(
                    (cat) => cat.id === draftFilters.categoryId && cat.groupId === nextGroupId,
                  );
                setDraftFilters((old) => ({
                  ...old,
                  groupId: nextGroupId,
                  categoryId: keepCategory ? old.categoryId : undefined,
                }));
              }}
            >
              <option value=''>Tất cả nhóm lớn</option>
              {groups.map((grp) => (
                <option key={grp.id} value={grp.id}>
                  {grp.code} · {grp.name}
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
          <label htmlFor='dashboard-category'>
            Phân loại sản phẩm
            <select
              id='dashboard-category'
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

          <label htmlFor='dashboard-locality-type'>
            Loại địa bàn
            <select
              id='dashboard-locality-type'
              value={draftFilters.localityType ?? ''}
              onChange={(event) => {
                const nextType = (event.target.value || undefined) as LocalityType | undefined;
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
              <option value=''>Tất cả loại địa bàn</option>
              <option value='COMMUNE'>Xã</option>
              <option value='WARD'>Phường</option>
            </select>
          </label>

          <label htmlFor='dashboard-locality-id'>
            Địa bàn hành chính
            <select
              id='dashboard-locality-id'
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

          <label htmlFor='dashboard-registration-type'>
            Loại đăng ký
            <select
              id='dashboard-registration-type'
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

          <label htmlFor='dashboard-assessment-year'>
            Năm đánh giá hồ sơ
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
          </label>
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
        <div className='admin-table-region empty-card' role='alert'>
          <h2>Chưa tải được dữ liệu tổng quan</h2>
          <p className='text-sm text-muted mt-1'>{error}</p>
          <div className='admin-actions justify-center mt-4'>
            <Button type='button' variant='secondary' onClick={() => void refetch()}>
              Thử lại
            </Button>
            <Link className='button button-secondary' to='/admin/products' search={{}}>
              Mở danh sách sản phẩm
            </Link>
          </div>
        </div>
      )}

      {data && (
        <>
          {data.period && (
            <div className='admin-table-region p-4 text-sm' role='status'>
              <strong>Kỳ đang xem:</strong> {data.period.label} · Mốc chốt số liệu:{' '}
              {new Date(data.period.asOf).toLocaleString('vi-VN')} · Cập nhật lúc:{' '}
              {new Date(data.period.generatedAt).toLocaleString('vi-VN')}
              {data.period.isPartialPeriod
                ? ' · Kỳ hiện tại chưa kết thúc (so sánh tương ứng cùng khoảng thời gian kỳ trước).'
                : ''}
            </div>
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
            <section className='admin-table-region p-5'>
              <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
                <div>
                  <h2>Hồ sơ cần xử lý tiếp</h2>
                  <p className='text-xs text-muted'>
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
                        <span className='cat-tag'>
                          {product.category.groupName} · {product.category.name}
                        </span>
                        <h3 className='mt-1'>{product.name}</h3>
                        <p className='text-xs text-muted'>
                          {product.status === 'SUBMITTED' ? 'Đã nộp' : 'Đang chấm'} ·{' '}
                          {product.assignedJudgeCount === 0 || product.missingCriteriaCount > 0
                            ? 'Thiếu phân công phủ tiêu chí'
                            : `${product.pendingEvaluationCount} phiếu chưa hoàn tất`}
                        </p>
                      </div>
                      <div className='record-result'>
                        <span className='text-xs text-muted'>
                          {product.submittedEvaluationCount} / {product.assignedJudgeCount} phiếu
                        </span>
                        <Link
                          className='button button-secondary button-sm'
                          to='/admin/products/$id'
                          params={{ id: product.id }}
                        >
                          Mở hồ sơ
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className='py-6 text-center text-muted'>
                  <h3 className='text-base font-semibold text-fg'>Không có hồ sơ chờ xử lý</h3>
                  <p className='text-xs mt-1'>
                    Danh sách này sẽ cập nhật khi có hồ sơ đã nộp hoặc đang chấm.
                  </p>
                </div>
              )}
            </section>

            {canManage && (
              <section className='admin-table-region p-5'>
                <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
                  <div>
                    <h2>Tiến độ giám khảo</h2>
                    <p className='text-xs text-muted'>
                      Phiếu đã nộp trên tổng số hồ sơ được giao.
                    </p>
                  </div>
                  <Link className='text-link text-sm' to='/admin/assignments'>
                    Phân công
                  </Link>
                </div>
                {data.judges.length ? (
                  <div className='table-container'>
                    <table className='admin-data-table'>
                      <thead>
                        <tr>
                          <th scope='col'>Giám khảo</th>
                          <th scope='col' style={{ textAlign: 'right' }}>
                            Đã nộp
                          </th>
                          <th scope='col' style={{ textAlign: 'right' }}>
                            Chưa hoàn tất
                          </th>
                          <th scope='col'>Tiến độ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.judges.map((judge) => {
                          const percent = judge.assigned
                            ? Math.round((judge.submitted / judge.assigned) * 100)
                            : 0;
                          return (
                            <tr key={judge.judgeId}>
                              <th scope='row'>{judge.fullName}</th>
                              <td
                                style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                              >
                                {judge.submitted} / {judge.assigned}
                              </td>
                              <td
                                style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                              >
                                {judge.pending}
                              </td>
                              <td>
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
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className='py-6 text-center text-muted'>
                    <h3 className='text-base font-semibold text-fg'>
                      Chưa có giám khảo hoạt động
                    </h3>
                    <p className='text-xs mt-1 mb-3'>
                      Dữ liệu tiến độ sẽ xuất hiện sau khi có phân công.
                    </p>
                    <Link
                      className='button button-secondary button-sm'
                      to='/admin/users'
                      search={{ permission: 'SCORE' }}
                    >
                      Quản lý giám khảo
                    </Link>
                  </div>
                )}
              </section>
            )}
          </div>

          <section className='admin-page' aria-label='Phân tích kết quả trong kỳ'>
            <div>
              <h2>Phân tích trong kỳ</h2>
              <p className='route-intro'>
                Các chỉ tiêu chất lượng kết quả, xu hướng theo tháng, cơ cấu nhóm sản phẩm và mức
                sao theo điểm.
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
                <article className='admin-table-region p-5'>
                  <h2>Xu hướng đăng ký và hoàn tất theo tháng ({data.period.year})</h2>
                  <p className='form-note'>
                    Hai chuỗi độc lập: Đăng ký tính theo Ngày nộp, Hoàn tất tính theo Ngày hoàn tất
                    (không phải tỷ lệ chuyển đổi của cùng một tập).
                  </p>
                  {data.charts.monthlyTrend.every(
                    (m) => m.registeredCount === 0 && m.completedCount === 0,
                  ) && (
                    <p className='text-xs text-muted mb-2' role='status'>
                      Chưa phát sinh hồ sơ đăng ký hoặc hoàn tất trong kỳ đang chọn.
                    </p>
                  )}
                  <div className='table-container'>
                    <table className='admin-data-table'>
                      <thead>
                        <tr>
                          <th scope='col'>Tháng</th>
                          <th scope='col' style={{ textAlign: 'right' }}>
                            Đăng ký mới
                          </th>
                          <th scope='col' style={{ textAlign: 'right' }}>
                            Hoàn tất chấm
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.charts.monthlyTrend.map((m) => (
                          <tr key={m.month}>
                            <th scope='row'>{m.label}</th>
                            <td
                              style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                            >
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
                            </td>
                            <td
                              style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                            >
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className='admin-table-region p-5'>
                  <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
                    <div>
                      <h2>Hồ sơ theo nhóm sản phẩm</h2>
                      <p className='text-xs text-muted'>
                        Chọn một nhóm để xem số lượng theo từng phân loại sản phẩm.
                      </p>
                    </div>
                    <div className='admin-actions'>
                      <Button
                        type='button'
                        size='sm'
                        variant={groupMetricMode === 'registered' ? 'default' : 'secondary'}
                        onClick={() => setGroupMetricMode('registered')}
                      >
                        Theo số đăng ký
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant={groupMetricMode === 'completed' ? 'default' : 'secondary'}
                        onClick={() => setGroupMetricMode('completed')}
                      >
                        Theo số hoàn tất
                      </Button>
                    </div>
                  </div>
                  <div className='record-list'>
                    {data.charts.byProductGroup.map((grp) => {
                      const count =
                        groupMetricMode === 'registered'
                          ? grp.registeredCount
                          : grp.completedCount;
                      const isExpanded = expandedGroupId === grp.groupId;
                      return (
                        <div className='assignment-category' key={grp.groupId}>
                          <div className='assignment-category-heading'>
                            <button
                              type='button'
                              className='text-link'
                              aria-expanded={isExpanded}
                              onClick={() =>
                                setExpandedGroupId(isExpanded ? null : grp.groupId)
                              }
                            >
                              <strong>
                                {grp.groupCode} · {grp.groupName}
                              </strong>
                            </button>
                            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {count} hồ sơ (
                              {groupMetricMode === 'registered' ? 'đăng ký' : 'hoàn tất'})
                            </strong>
                          </div>
                          {isExpanded && (
                            <ul className='mt-2 pl-5 text-sm'>
                              {grp.categories.map((cat) => (
                                <li key={cat.categoryId}>
                                  <Link
                                    className='text-link'
                                    to='/admin/products'
                                    search={{ categoryId: cat.categoryId }}
                                  >
                                    {cat.categoryName}
                                  </Link>
                                  : {cat.registeredCount} đăng ký · {cat.completedCount} hoàn tất
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>

                <article className='admin-table-region p-5'>
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
                </article>

                <article className='admin-table-region p-5'>
                  <h2>Cơ cấu mức sao theo điểm (Kết quả hoàn tất trong kỳ)</h2>
                  <p className='form-note'>
                    Phân bố 1–5 sao theo điểm của các hồ sơ hoàn tất hợp lệ trong kỳ (chưa đồng
                    nghĩa quyết định công nhận chính thức).
                  </p>
                  <div className='table-container'>
                    <table className='admin-data-table'>
                      <thead>
                        <tr>
                          <th scope='col'>Mức sao theo điểm</th>
                          <th scope='col' style={{ textAlign: 'right' }}>
                            Số lượng
                          </th>
                          <th scope='col' style={{ textAlign: 'right' }}>
                            Tỷ trọng
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.charts.starDistribution.map((item) => (
                          <tr key={item.stars}>
                            <th scope='row'>{item.label}</th>
                            <td
                              style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                            >
                              <Link
                                className='text-link'
                                to='/admin/products'
                                search={{
                                  status: 'COMPLETED',
                                  starRating: item.stars,
                                  dateBasis: 'completedAt',
                                  from: data.period.from,
                                  toExclusive: data.period.toExclusive,
                                }}
                              >
                                {item.count}
                              </Link>
                            </td>
                            <td
                              style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                            >
                              {item.percentage !== null
                                ? `${formatExactScore(item.percentage)}%`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            )}

            {data.comparisonTable && (
              <section className='admin-table-region p-5'>
                <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
                  <div>
                    <h2>Bảng đối chiếu chỉ tiêu với kỳ trước</h2>
                    <p className='text-xs text-muted'>
                      So sánh {data.period.label} với {data.period.previousPeriod.label}.
                    </p>
                  </div>
                  <Link className='text-link text-sm' to='/admin/reports' search={appliedSearch}>
                    Xem báo cáo chi tiết
                  </Link>
                </div>
                <div className='table-container'>
                  <table className='admin-data-table'>
                    <thead>
                      <tr>
                        <th scope='col'>Chỉ tiêu KPI</th>
                        <th scope='col'>Căn cứ</th>
                        <th scope='col' style={{ textAlign: 'right' }}>
                          Kỳ này
                        </th>
                        <th scope='col' style={{ textAlign: 'right' }}>
                          Kỳ trước
                        </th>
                        <th scope='col'>Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparisonTable.map((row) => (
                        <tr key={row.id}>
                          <th scope='row'>{row.label}</th>
                          <td>{row.basisLabel}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <strong>{formatKpiValue(row)}</strong>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {row.previousValue !== null
                              ? row.unit === 'PERCENT'
                                ? `${formatExactScore(row.previousValue)}%`
                                : row.previousValue
                              : '—'}
                          </td>
                          <td>{formatKpiDeltaText(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
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
