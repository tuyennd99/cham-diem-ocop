import { useState } from 'react';
import type {
  AdminProductQuery,
  AdminReportQuery,
  LocalityType,
  ProductRegistrationType,
  RegistrationReportRow,
  ReportDataQuality,
  ReportGroupBy,
  ReportPeriodMetadata,
  ResultsReportRow,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorText } from '../../lib/api-error';
import { formatExactScore } from '../../lib/print-format';
import { formatComparisonDelta } from '../../lib/report-format';
import { useAdminRegistrationsReport, useAdminResultsReport } from '../../queries/admin';
import {
  useAdminCategories,
  useAdminLocalities,
  useAdminProductGroups,
} from '../../queries/admin-catalogs';

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
      search={drillDown as Record<string, unknown>}
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
      <div className='report-period-summary'>
        <p>
          <strong>Kỳ báo cáo:</strong> {period.label} · Múi giờ: <code>{period.timezone}</code> ·
          Khoảng nửa kín: <code>[{period.from}, {period.toExclusive})</code>
        </p>
        <p>
          <strong>Mốc chốt (asOf):</strong> {formatViTime(period.asOf)} ·{' '}
          <strong>Thời điểm tổng hợp:</strong> {formatViTime(period.generatedAt)}
          {period.isPartialPeriod && (
            <span className='badge'>Kỳ hiện tại chưa kết thúc (so sánh tương ứng kỳ trước)</span>
          )}
        </p>
        {period.historyAvailableFrom && (
          <p>
            <strong>Nhật ký trạng thái khả dụng từ:</strong>{' '}
            {formatViTime(period.historyAvailableFrom)}
          </p>
        )}
      </div>
      {hasWarnings && (
        <div className='print-warning-banner' role='status'>
          <strong>Cảnh báo chất lượng dữ liệu (Data Quality):</strong>{' '}
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
      <td className='print-num'>
        <DrillDownLink count={row.registeredCount} drillDown={row.drillDown} />
      </td>
      <td className='print-num'>
        <DrillDownLink
          count={row.waitingCount}
          drillDown={{ ...row.drillDown, status: 'SUBMITTED' }}
        />
      </td>
      <td className='print-num'>
        <DrillDownLink
          count={row.scoringCount}
          drillDown={{ ...row.drillDown, status: 'SCORING' }}
        />
      </td>
      <td className='print-num'>
        <DrillDownLink
          count={row.completedCount}
          drillDown={{ ...row.drillDown, status: 'COMPLETED' }}
        />
      </td>
      <td className='print-num'>{row.passedCount}</td>
      <td className='print-num'>{row.failedCount}</td>
      <td className='print-num'>
        {row.passRate !== null ? `${formatExactScore(row.passRate)}%` : '—'}
      </td>
      <td className='print-num'>{formatExactScore(row.averageScore)}</td>
      <td className='print-num'>{row.starCounts[1]}</td>
      <td className='print-num'>{row.starCounts[2]}</td>
      <td className='print-num'>{row.starCounts[3]}</td>
      <td className='print-num'>{row.starCounts[4]}</td>
      <td className='print-num'>{row.starCounts[5]}</td>
      <td className='print-num'>{row.distinctRegistrantCount}</td>
      <td className='print-num'>{row.missingDataCount + row.unmappedLocalityCount}</td>
    </>
  );
}

function ResultsRowCells({ row }: { row: ResultsReportRow }) {
  return (
    <>
      <td className='print-num'>
        <DrillDownLink count={row.completedCount} drillDown={row.drillDown} />
      </td>
      <td className='print-num'>{row.passedCount}</td>
      <td className='print-num'>{row.failedCount}</td>
      <td className='print-num'>
        {row.passRate !== null ? `${formatExactScore(row.passRate)}%` : '—'}
      </td>
      <td className='print-num'>{formatExactScore(row.averageScore)}</td>
      <td className='print-num'>
        <DrillDownLink
          count={row.starCounts[1]}
          drillDown={{ ...row.drillDown, starRating: 1 }}
        />
      </td>
      <td className='print-num'>
        <DrillDownLink
          count={row.starCounts[2]}
          drillDown={{ ...row.drillDown, starRating: 2 }}
        />
      </td>
      <td className='print-num'>
        <DrillDownLink
          count={row.starCounts[3]}
          drillDown={{ ...row.drillDown, starRating: 3 }}
        />
      </td>
      <td className='print-num'>
        <DrillDownLink
          count={row.starCounts[4]}
          drillDown={{ ...row.drillDown, starRating: 4 }}
        />
      </td>
      <td className='print-num'>
        <DrillDownLink
          count={row.starCounts[5]}
          drillDown={{ ...row.drillDown, starRating: 5 }}
        />
      </td>
      <td className='print-num'>{row.distinctRegistrantCount}</td>
      <td className='print-num'>{row.unmappedLocalityCount + row.invalidResultCount}</td>
    </>
  );
}

export function AdminReportsPage() {
  const [reportTab, setReportTab] = useState<'registrations' | 'results'>('registrations');
  const [query, setQuery] = useState<AdminReportQuery>({
    year: 2026,
    groupBy: 'month',
  });

  const groupsQuery = useAdminProductGroups({ page: 1, limit: 100 });
  const categoriesQuery = useAdminCategories({
    page: 1,
    limit: 100,
    groupId: query.groupId,
  });
  const localitiesQuery = useAdminLocalities({
    page: 1,
    limit: 100,
    type: query.localityType,
  });

  const regQuery = useAdminRegistrationsReport(query, reportTab === 'registrations');
  const resQuery = useAdminResultsReport(query, reportTab === 'results');

  const groups = groupsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const localities = localitiesQuery.data?.data ?? [];

  const activeError = errorText(
    reportTab === 'registrations' ? regQuery.error : resQuery.error,
  );
  const activeLoading =
    reportTab === 'registrations' ? regQuery.isPending : resQuery.isPending;

  function updateFilter<K extends keyof AdminReportQuery>(
    key: K,
    value: AdminReportQuery[K],
  ) {
    setQuery((current) => ({
      ...current,
      [key]: value || undefined,
      ...(key === 'groupId' ? { categoryId: undefined } : {}),
    }));
  }

  return (
    <section className='admin-users-page report-landscape-page'>
      <div className='section-heading no-print'>
        <div>
          <p className='eyebrow'>PHÂN HỆ 6 · BÁO CÁO THỐNG KÊ</p>
          <h1>Báo cáo thống kê OCOP</h1>
          <p className='section-intro'>
            Thống kê theo kỳ đăng ký và kỳ hoàn tất kết quả (múi giờ Asia/Ho_Chi_Minh, đếm duy nhất
            mỗi lần đăng ký sản phẩm).
          </p>
        </div>
        <div className='hero-actions'>
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

      <form
        className='admin-user-filters no-print'
        onSubmit={(event) => event.preventDefault()}
        aria-label='Bộ lọc báo cáo thống kê'
      >
        <label>
          Năm báo cáo
          <Input
            type='number'
            min={2020}
            max={2100}
            value={query.year ?? 2026}
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
            value={query.month ?? ''}
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
          Nhóm dòng báo cáo theo
          <select
            value={query.groupBy ?? 'month'}
            onChange={(event) =>
              updateFilter('groupBy', event.target.value as ReportGroupBy)
            }
          >
            {(Object.keys(GROUP_BY_LABELS) as ReportGroupBy[]).map((key) => (
              <option key={key} value={key}>
                {GROUP_BY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Loại địa bàn
          <select
            value={query.localityType ?? ''}
            onChange={(event) =>
              updateFilter(
                'localityType',
                (event.target.value || undefined) as LocalityType | undefined,
              )
            }
          >
            <option value=''>Tất cả (Xã &amp; Phường)</option>
            <option value='COMMUNE'>Xã</option>
            <option value='WARD'>Phường</option>
          </select>
        </label>
        <label>
          Địa bàn cụ thể
          <select
            value={query.localityId ?? ''}
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
          Nhóm sản phẩm lớn
          <select
            value={query.groupId ?? ''}
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
          Phân loại sản phẩm
          <select
            value={query.categoryId ?? ''}
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
            value={query.registrationType ?? ''}
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
        <label>
          Năm đánh giá khai báo
          <Input
            type='number'
            min={2020}
            max={2100}
            placeholder='Tất cả'
            value={query.assessmentYear ?? ''}
            onChange={(event) =>
              updateFilter(
                'assessmentYear',
                event.target.value ? Number(event.target.value) : undefined,
              )
            }
          />
        </label>
      </form>

      <Tabs
        value={reportTab}
        onValueChange={(val) => setReportTab(val as 'registrations' | 'results')}
      >
        <TabsList className='no-print' aria-label='Chọn loại báo cáo theo căn cứ thời gian'>
          <TabsTrigger value='registrations'>
            1. Báo cáo Đăng ký theo kỳ (theo ngày nộp submittedAt)
          </TabsTrigger>
          <TabsTrigger value='results'>
            2. Báo cáo Kết quả chấm theo kỳ (theo ngày hoàn tất completedAt)
          </TabsTrigger>
        </TabsList>

        {activeError && (
          <div className='form-note' role='alert'>
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
                  <strong>{regQuery.data.totals.registeredCount}</strong>
                  <small>
                    {formatComparisonDelta(regQuery.data.comparison.registeredCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Đã hoàn tất (tại mốc chốt)</span>
                  <strong>{regQuery.data.totals.completedCount}</strong>
                  <small>
                    {formatComparisonDelta(regQuery.data.comparison.completedCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Đạt ngưỡng ≥ 3 sao theo điểm</span>
                  <strong>{regQuery.data.totals.passedCount}</strong>
                  <small>
                    {formatComparisonDelta(regQuery.data.comparison.passedCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Chưa đạt ngưỡng (&lt; 50 điểm)</span>
                  <strong>{regQuery.data.totals.failedCount}</strong>
                  <small>
                    {formatComparisonDelta(regQuery.data.comparison.failedCount)}
                  </small>
                </article>
              </div>

              <div className='table-wrap'>
                <table className='print-table data-table'>
                  <thead>
                    <tr>
                      <th scope='col'>
                        {GROUP_BY_LABELS[regQuery.data.groupBy]}
                      </th>
                      <th scope='col'>Đã đăng ký</th>
                      <th scope='col'>Chờ chấm</th>
                      <th scope='col'>Đang chấm</th>
                      <th scope='col'>Hoàn tất</th>
                      <th scope='col'>Đạt (≥50đ)</th>
                      <th scope='col'>Chưa đạt (&lt;50đ)</th>
                      <th scope='col'>Tỷ lệ đạt</th>
                      <th scope='col'>Điểm TB</th>
                      <th scope='col'>1 sao</th>
                      <th scope='col'>2 sao</th>
                      <th scope='col'>3 sao</th>
                      <th scope='col'>4 sao</th>
                      <th scope='col'>Mức 5 sao*</th>
                      <th scope='col'>Chủ thể</th>
                      <th scope='col'>Thiếu DL/ĐB</th>
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
                  <strong>{resQuery.data.totals.completedCount}</strong>
                  <small>
                    {formatComparisonDelta(resQuery.data.comparison.completedCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Đạt ngưỡng ≥ 3 sao theo điểm</span>
                  <strong>{resQuery.data.totals.passedCount}</strong>
                  <small>
                    {formatComparisonDelta(resQuery.data.comparison.passedCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Chưa đạt ngưỡng (&lt; 50 điểm)</span>
                  <strong>{resQuery.data.totals.failedCount}</strong>
                  <small>
                    {formatComparisonDelta(resQuery.data.comparison.failedCount)}
                  </small>
                </article>
                <article className='dashboard-stat'>
                  <span>Mức điểm 5 sao (90–100 điểm)</span>
                  <strong>{resQuery.data.totals.starCounts[5]}</strong>
                  <small>
                    {formatComparisonDelta(resQuery.data.comparison.star5Count)}
                  </small>
                </article>
              </div>

              <div className='table-wrap'>
                <table className='print-table data-table'>
                  <thead>
                    <tr>
                      <th scope='col'>
                        {GROUP_BY_LABELS[resQuery.data.groupBy]}
                      </th>
                      <th scope='col'>Số hoàn tất</th>
                      <th scope='col'>Đạt (≥50đ)</th>
                      <th scope='col'>Chưa đạt (&lt;50đ)</th>
                      <th scope='col'>Tỷ lệ đạt</th>
                      <th scope='col'>Điểm TB</th>
                      <th scope='col'>1 sao</th>
                      <th scope='col'>2 sao</th>
                      <th scope='col'>3 sao</th>
                      <th scope='col'>4 sao</th>
                      <th scope='col'>Mức 5 sao*</th>
                      <th scope='col'>Chủ thể</th>
                      <th scope='col'>Thiếu ĐB/Lỗi</th>
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
