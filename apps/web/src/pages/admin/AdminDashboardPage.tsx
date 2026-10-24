import { useState } from 'react';
import type {
  AdminReportFilterQuery,
  LocalityType,
  ProductRegistrationType,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ADMIN_DASHBOARD_STATUS_LABEL } from '../../constants/product-status';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { formatExactScore } from '../../lib/print-format';
import { formatKpiDeltaText, formatKpiValue } from '../../lib/report-format';
import { hasStaffPermission } from '../../lib/session-contract';
import { useAdminDashboard } from '../../queries/admin';
import {
  useAdminCategories,
  useAdminLocalities,
  useAdminProductGroups,
} from '../../queries/admin-catalogs';

export function AdminDashboardPage() {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const [filters, setFilters] = useState<AdminReportFilterQuery>({
    year: 2026,
  });
  const [groupMetricMode, setGroupMetricMode] = useState<'registered' | 'completed'>(
    'registered',
  );
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const groupsQuery = useAdminProductGroups({ page: 1, limit: 100 });
  const categoriesQuery = useAdminCategories({
    page: 1,
    limit: 100,
    groupId: filters.groupId,
  });
  const localitiesQuery = useAdminLocalities({
    page: 1,
    limit: 100,
    type: filters.localityType,
  });

  const {
    data = null,
    isPending: loading,
    isFetching,
    error: loadError,
    refetch,
  } = useAdminDashboard(filters);
  const error = errorText(loadError);

  const groups = groupsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const localities = localitiesQuery.data?.data ?? [];

  function updateFilter<K extends keyof AdminReportFilterQuery>(
    key: K,
    value: AdminReportFilterQuery[K],
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value || undefined,
      ...(key === 'groupId' ? { categoryId: undefined } : {}),
    }));
  }

  return (
    <section className='admin-dashboard'>
      <div className='section-heading'>
        <div>
          <p className='eyebrow'>PHÂN HỆ 7 · ANALYTICS DASHBOARD OCOP</p>
          <h1>Tổng quan &amp; Phân tích</h1>
          <p className='section-intro'>
            8 chỉ tiêu KPI, 4 vùng biểu đồ và đối chiếu kỳ trước theo dữ liệu thực tế của hệ thống.
          </p>
        </div>
        <div className='hero-actions'>
          <Link className='button button-secondary' to='/admin/reports'>
            Mở Báo cáo thống kê
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

      <nav className='quick-links' aria-label='Lối tắt quản trị'>
        <Link to='/admin/products'>Tất cả hồ sơ</Link>
        <Link to='/admin/registrations'>Phiếu đăng ký</Link>
        <Link to='/admin/product-groups'>Nhóm sản phẩm &amp; Địa bàn</Link>
        <Link to='/admin/scoring-forms'>Phiếu chấm OCOP</Link>
        <Link to='/admin/reports'>Báo cáo thống kê</Link>
        {canManage && (
          <>
            <Link to='/admin/users' search={{ permission: undefined }}>
              Người dùng
            </Link>
            <Link to='/admin/assignments'>Phân công</Link>
          </>
        )}
      </nav>

      <form
        className='admin-user-filters'
        onSubmit={(event) => event.preventDefault()}
        aria-label='Bộ lọc Analytics Dashboard'
      >
        <label>
          Năm
          <Input
            type='number'
            min={2020}
            max={2100}
            value={filters.year ?? 2026}
            onChange={(event) =>
              updateFilter(
                'year',
                event.target.value ? Number(event.target.value) : 2026,
              )
            }
          />
        </label>
        <label>
          Tháng
          <select
            value={filters.month ?? ''}
            onChange={(event) =>
              updateFilter(
                'month',
                event.target.value ? Number(event.target.value) : undefined,
              )
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
        <label>
          Loại địa bàn
          <select
            value={filters.localityType ?? ''}
            onChange={(event) =>
              updateFilter(
                'localityType',
                (event.target.value || undefined) as LocalityType | undefined,
              )
            }
          >
            <option value=''>Tất cả</option>
            <option value='COMMUNE'>Xã</option>
            <option value='WARD'>Phường</option>
          </select>
        </label>
        <label>
          Địa bàn
          <select
            value={filters.localityId ?? ''}
            onChange={(event) =>
              updateFilter('localityId', event.target.value || undefined)
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
        <label>
          Nhóm sản phẩm
          <select
            value={filters.groupId ?? ''}
            onChange={(event) =>
              updateFilter('groupId', event.target.value || undefined)
            }
          >
            <option value=''>Tất cả nhóm</option>
            {groups.map((grp) => (
              <option key={grp.id} value={grp.id}>
                {grp.code} · {grp.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Phân loại
          <select
            value={filters.categoryId ?? ''}
            onChange={(event) =>
              updateFilter('categoryId', event.target.value || undefined)
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
        <label>
          Loại đăng ký
          <select
            value={filters.registrationType ?? ''}
            onChange={(event) =>
              updateFilter(
                'registrationType',
                (event.target.value || undefined) as
                  | ProductRegistrationType
                  | undefined,
              )
            }
          >
            <option value=''>Tất cả</option>
            <option value='FIRST'>Lần đầu</option>
            <option value='UPGRADE'>Nâng hạng</option>
            <option value='REASSESSMENT'>Đánh giá lại</option>
          </select>
        </label>
      </form>

      {loading && (
        <div className='dashboard-skeleton' aria-label='Đang tải tổng quan' aria-busy='true'>
          <div className='skeleton-block' />
          <div className='skeleton-block' />
          <div className='skeleton-block' />
          <div className='skeleton-table' />
        </div>
      )}
      {error && (
        <div className='empty-state' role='alert'>
          <h2>Chưa tải được tổng quan</h2>
          <p>{error}</p>
          <p>Hãy thử tải lại hoặc mở trực tiếp danh sách hồ sơ.</p>
          <Link to='/admin/products'>Mở danh sách hồ sơ</Link>
        </div>
      )}

      {data && (
        <>
          {data.period && (
            <p className='form-note' role='status'>
              <strong>Kỳ đang xem:</strong> {data.period.label} · Múi giờ:{' '}
              <code>{data.period.timezone}</code> · Mốc chốt:{' '}
              {new Date(data.period.asOf).toLocaleString('vi-VN')} · Cập nhật lúc:{' '}
              {new Date(data.period.generatedAt).toLocaleString('vi-VN')}
              {data.period.isPartialPeriod
                ? ' · Kỳ hiện tại chưa kết thúc (so sánh tương ứng kỳ trước).'
                : ''}
            </p>
          )}

          {data.dataQuality &&
            (data.dataQuality.unmappedLocalityCount > 0 ||
              data.dataQuality.missingStatusHistoryCount > 0 ||
              data.dataQuality.missingCompletedAtCount > 0) && (
              <div className='assignment-warning' role='status'>
                <strong>Chất lượng dữ liệu (Data Quality):</strong>{' '}
                {data.dataQuality.unmappedLocalityCount > 0 &&
                  `${data.dataQuality.unmappedLocalityCount} hồ sơ chưa gắn địa bàn; `}
                {data.dataQuality.missingCompletedAtCount > 0 &&
                  `${data.dataQuality.missingCompletedAtCount} hồ sơ hoàn tất thiếu ngày hoàn tất; `}
                {data.dataQuality.missingStatusHistoryCount > 0 &&
                  `${data.dataQuality.missingStatusHistoryCount} hồ sơ kỳ cũ thiếu lịch sử trạng thái.`}
              </div>
            )}

          {data.kpis && (
            <section className='dashboard-section' aria-label='8 chỉ tiêu KPI chính'>
              <div className='dashboard-status-grid'>
                {data.kpis.map((kpi) => (
                  <article className='dashboard-stat' key={kpi.id}>
                    <span>{kpi.label}</span>
                    <strong>{formatKpiValue(kpi)}</strong>
                    <small>{kpi.basisLabel}</small>
                    <small>{formatKpiDeltaText(kpi)}</small>
                    <Link
                      className='text-link'
                      to='/admin/products'
                      search={kpi.drillDown as Record<string, unknown>}
                    >
                      Xem danh sách hồ sơ →
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          {data.charts && (
            <section className='dashboard-charts-grid' aria-label='4 vùng biểu đồ phân tích'>
              {/* Vùng 1: Xu hướng đăng ký và hoàn tất theo tháng */}
              <article className='route-panel'>
                <h2>1. Xu hướng đăng ký và hoàn tất theo tháng ({data.period.year})</h2>
                <p className='form-note'>
                  Hai chuỗi độc lập: Đăng ký tính theo <code>submittedAt</code>, Hoàn tất tính theo{' '}
                  <code>completedAt</code> (không phải tỷ lệ chuyển đổi của cùng một tập).
                </p>
                <div className='table-wrap'>
                  <table className='data-table'>
                    <thead>
                      <tr>
                        <th scope='col'>Tháng</th>
                        <th scope='col'>Đăng ký mới</th>
                        <th scope='col'>Hoàn tất chấm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.charts.monthlyTrend.map((m) => (
                        <tr key={m.month}>
                          <th scope='row'>{m.label}</th>
                          <td>
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
                          <td>
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

              {/* Vùng 2: Hồ sơ theo nhóm sản phẩm */}
              <article className='route-panel'>
                <div className='section-heading'>
                  <div>
                    <h2>2. Hồ sơ theo nhóm sản phẩm</h2>
                    <p className='form-note'>
                      Bấm vào một nhóm để mở xem chi tiết các phân loại lá bên trong.
                    </p>
                  </div>
                  <div className='hero-actions'>
                    <Button
                      type='button'
                      variant={groupMetricMode === 'registered' ? 'default' : 'secondary'}
                      onClick={() => setGroupMetricMode('registered')}
                    >
                      Theo số đăng ký
                    </Button>
                    <Button
                      type='button'
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
                          <strong>
                            {count} hồ sơ (
                            {groupMetricMode === 'registered' ? 'đăng ký' : 'hoàn tất'})
                          </strong>
                        </div>
                        {isExpanded && (
                          <ul>
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

              {/* Vùng 3: Tiến độ của hồ sơ đăng ký trong kỳ (Cohort) */}
              <article className='route-panel'>
                <h2>3. Tiến độ của hồ sơ đăng ký trong kỳ (Cohort)</h2>
                <p className='form-note'>
                  Đối chiếu tổng với KPI 1 ({data.charts.cohortProgress.registeredCount} hồ sơ nộp
                  trong kỳ) xét tại mốc chốt.
                </p>
                <dl className='detail-facts'>
                  <div>
                    <dt>Tổng đăng ký trong kỳ</dt>
                    <dd>{data.charts.cohortProgress.registeredCount}</dd>
                  </div>
                  <div>
                    <dt>Chờ chấm (SUBMITTED)</dt>
                    <dd>{data.charts.cohortProgress.waitingCount}</dd>
                  </div>
                  <div>
                    <dt>Đang chấm (SCORING)</dt>
                    <dd>{data.charts.cohortProgress.scoringCount}</dd>
                  </div>
                  <div>
                    <dt>Đã hoàn tất (COMPLETED)</dt>
                    <dd>{data.charts.cohortProgress.completedCount}</dd>
                  </div>
                  {data.charts.cohortProgress.missingStatusHistoryCount > 0 && (
                    <div>
                      <dt>Thiếu lịch sử trạng thái</dt>
                      <dd>{data.charts.cohortProgress.missingStatusHistoryCount}</dd>
                    </div>
                  )}
                </dl>
              </article>

              {/* Vùng 4: Cơ cấu mức sao theo điểm */}
              <article className='route-panel'>
                <h2>4. Cơ cấu mức sao theo điểm (Kết quả hoàn tất trong kỳ)</h2>
                <p className='form-note'>
                  Phân bố 1–5 sao của các hồ sơ hoàn tất hợp lệ trong kỳ (loại hồ sơ chưa có kết
                  quả).
                </p>
                <div className='table-wrap'>
                  <table className='data-table'>
                    <thead>
                      <tr>
                        <th scope='col'>Mức sao tính từ điểm</th>
                        <th scope='col'>Số lượng</th>
                        <th scope='col'>Tỷ trọng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.charts.starDistribution.map((item) => (
                        <tr key={item.stars}>
                          <th scope='row'>{item.label}</th>
                          <td>
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
                          <td>
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
            </section>
          )}

          {/* Bảng đối chiếu KPI với kỳ trước */}
          {data.comparisonTable && (
            <section className='dashboard-section'>
              <div className='section-heading'>
                <div>
                  <h2>Bảng đối chiếu chỉ tiêu với kỳ trước</h2>
                  <p>
                    So sánh {data.period.label} với {data.period.previousPeriod.label}.
                  </p>
                </div>
                <Link className='text-link' to='/admin/reports'>
                  Xem báo cáo chi tiết →
                </Link>
              </div>
              <div className='table-wrap'>
                <table className='data-table'>
                  <thead>
                    <tr>
                      <th scope='col'>Chỉ tiêu KPI</th>
                      <th scope='col'>Căn cứ</th>
                      <th scope='col'>Kỳ này</th>
                      <th scope='col'>Kỳ trước</th>
                      <th scope='col'>Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.comparisonTable.map((row) => (
                      <tr key={row.id}>
                        <th scope='row'>{row.label}</th>
                        <td>{row.basisLabel}</td>
                        <td>
                          <strong>{formatKpiValue(row)}</strong>
                        </td>
                        <td>
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

          {/* Trạng thái toàn hệ thống hiện tại */}
          <section className='dashboard-section'>
            <h2>Tổng số hồ sơ hiện tại theo trạng thái</h2>
            <div className='dashboard-status-grid' aria-label='Hồ sơ theo trạng thái'>
              {(
                Object.keys(
                  ADMIN_DASHBOARD_STATUS_LABEL,
                ) as (keyof typeof ADMIN_DASHBOARD_STATUS_LABEL)[]
              ).map((status) => (
                <article className='dashboard-stat' key={status}>
                  <span>{ADMIN_DASHBOARD_STATUS_LABEL[status]}</span>
                  <strong>{data.productsByStatus[status]}</strong>
                </article>
              ))}
            </div>
          </section>

          {canManage && (
            <section className='dashboard-section'>
              <div className='section-heading'>
                <div>
                  <h2>Tiến độ giám khảo</h2>
                  <p>Phiếu đã nộp trên tổng số hồ sơ được giao.</p>
                </div>
              </div>
              {data.judges.length ? (
                <div className='table-wrap'>
                  <table className='data-table'>
                    <thead>
                      <tr>
                        <th scope='col'>Giám khảo</th>
                        <th scope='col'>Đã nộp</th>
                        <th scope='col'>Chưa hoàn tất</th>
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
                            <td>
                              {judge.submitted} / {judge.assigned}
                            </td>
                            <td>{judge.pending}</td>
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
                              <span>{percent}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className='empty-state'>
                  <h3>Chưa có giám khảo hoạt động</h3>
                  <p>Dữ liệu tiến độ sẽ xuất hiện sau khi có phân công.</p>
                  {canManage && (
                    <Link to='/admin/users' search={{ permission: 'SCORE' }}>
                      Quản lý giám khảo
                    </Link>
                  )}
                </div>
              )}
            </section>
          )}

          <section className='dashboard-section'>
            <div className='section-heading'>
              <div>
                <h2>Hồ sơ cần xử lý tiếp</h2>
                <p>
                  Hồ sơ đang chờ hoặc đang trong quá trình chấm, sắp theo ngày nộp lâu nhất.
                </p>
              </div>
            </div>
            {data.needsAttention.length ? (
              <div className='record-list'>
                {data.needsAttention.map((product) => (
                  <article className='record-row' key={product.id}>
                    <div className='record-main'>
                      <span className='badge badge-category'>
                        {product.category.groupName} · {product.category.name}
                      </span>
                      <h3>{product.name}</h3>
                      <p>
                        {product.status === 'SUBMITTED' ? 'Đã nộp' : 'Đang chấm'} ·{' '}
                        {product.assignedJudgeCount === 0 || product.missingCriteriaCount > 0
                          ? 'Thiếu phân công phủ tiêu chí'
                          : `${product.pendingEvaluationCount} phiếu chưa hoàn tất`}
                      </p>
                    </div>
                    <div className='record-result'>
                      <span>
                        {product.submittedEvaluationCount} / {product.assignedJudgeCount} phiếu
                      </span>
                      <Link
                        className='button button-secondary'
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
              <div className='empty-state'>
                <h3>Không có hồ sơ chờ xử lý</h3>
                <p>Danh sách này sẽ cập nhật khi có hồ sơ đã nộp hoặc đang chấm.</p>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
