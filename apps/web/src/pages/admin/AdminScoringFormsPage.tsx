import { useState } from 'react';
import type {
  AdminCriteriaSetQuery,
  AdminEvaluationQuery,
  EvaluationRecordStatus,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_PAGE_SIZE } from '../../constants/consts';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { formatExactScore } from '../../lib/print-format';
import { hasStaffPermission } from '../../lib/session-contract';
import { useAdminProductGroups } from '../../queries/admin-catalogs';
import {
  useAdminCriteriaSetDetail,
  useAdminCriteriaSets,
  useAdminEvaluations,
} from '../../queries/scoring-print';

export function AdminScoringFormsPage() {
  const session = useSession();
  const canView = hasStaffPermission(session?.user, 'VIEW');
  const canManage = hasStaffPermission(session?.user, 'MANAGE');

  const [setFilters, setSetFilters] = useState<AdminCriteriaSetQuery>({
    page: 1,
    limit: 30,
  });
  const [setSearchText, setSetSearchText] = useState('');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const [evalFilters, setEvalFilters] = useState<AdminEvaluationQuery>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const [evalSearchText, setEvalSearchText] = useState('');
  const [productFilterText, setProductFilterText] = useState('');
  const [judgeFilterText, setJudgeFilterText] = useState('');

  const groupsQuery = useAdminProductGroups({ page: 1, limit: 100 });
  const setsQuery = useAdminCriteriaSets(setFilters);
  const setDetailQuery = useAdminCriteriaSetDetail(selectedSetId);
  const evaluationsQuery = useAdminEvaluations(evalFilters);

  const groups = groupsQuery.data?.data ?? [];
  const sets = setsQuery.data?.data ?? [];
  const selectedSet = setDetailQuery.data?.data ?? null;
  const evaluations = evaluationsQuery.data?.data ?? [];

  const setsError = errorText(setsQuery.error);
  const setDetailError = errorText(setDetailQuery.error);
  const evaluationsError = errorText(evaluationsQuery.error);

  return (
    <section className='admin-users-page'>
      <div className='section-heading'>
        <div>
          <p className='eyebrow'>PHÂN HỆ 4 · PHIẾU CHẤM &amp; IN KẾT QUẢ</p>
          <h1>Phiếu chấm OCOP</h1>
          <p className='section-intro'>
            Danh mục 26 mẫu bộ phiếu theo Quyết định 26/2026/QĐ-TTg, tra cứu phiếu đã chấm và in A4.
          </p>
        </div>
        {canView && (
          <Link className='button button-secondary' to='/admin/assignments'>
            Quản lý phân công giám khảo
          </Link>
        )}
      </div>

      <Tabs defaultValue='sets'>
        <TabsList aria-label='Các tab phân hệ phiếu chấm OCOP'>
          <TabsTrigger value='sets'>Bộ phiếu (26 mẫu)</TabsTrigger>
          <TabsTrigger value='evaluations'>Phiếu chấm thực tế</TabsTrigger>
        </TabsList>

        <TabsContent value='sets'>
          <form
            className='admin-user-filters'
            onSubmit={(event) => {
              event.preventDefault();
              setSetFilters((current) => ({
                ...current,
                page: 1,
                q: setSearchText.trim() || undefined,
              }));
            }}
          >
            <label>
              Tìm theo tên phân loại, mã bộ hoặc nguồn
              <Input
                value={setSearchText}
                onChange={(event) => setSetSearchText(event.target.value)}
              />
            </label>
            <label>
              Nhóm sản phẩm lớn
              <select
                value={setFilters.groupId ?? ''}
                onChange={(event) =>
                  setSetFilters((current) => ({
                    ...current,
                    page: 1,
                    groupId: event.target.value || undefined,
                  }))
                }
              >
                <option value=''>Tất cả nhóm</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.code} · {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select
                value={setFilters.isActive === undefined ? '' : String(setFilters.isActive)}
                onChange={(event) =>
                  setSetFilters((current) => ({
                    ...current,
                    page: 1,
                    isActive:
                      event.target.value === ''
                        ? undefined
                        : event.target.value === 'true',
                  }))
                }
              >
                <option value=''>Tất cả</option>
                <option value='true'>Đang áp dụng</option>
                <option value='false'>Ngừng áp dụng</option>
              </select>
            </label>
            <Button type='submit' variant='secondary'>
              Tìm kiếm
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={setsQuery.isFetching}
              onClick={() => void setsQuery.refetch()}
            >
              Tải lại
            </Button>
          </form>

          {setsError && (
            <p className='form-note' role='alert'>
              {setsError}
            </p>
          )}
          {setsQuery.isPending && <p>Đang tải danh mục bộ phiếu…</p>}
          {!setsQuery.isPending && !setsError && sets.length === 0 && (
            <div className='empty-state'>
              <h2>Không có bộ phiếu phù hợp</h2>
              <p>Kiểm tra bộ lọc hoặc phạm vi phân công hiện tại.</p>
            </div>
          )}

          {!setsQuery.isPending && !setsError && sets.length > 0 && (
            <>
              <p>
                Tổng số: <strong>{setsQuery.data?.meta?.total ?? sets.length}</strong> bộ phiếu
              </p>
              <div className='table-wrap'>
                <table className='data-table'>
                  <thead>
                    <tr>
                      <th scope='col'>Nhóm lớn</th>
                      <th scope='col'>Phân loại sản phẩm</th>
                      <th scope='col'>Nguồn / Phiên bản</th>
                      <th scope='col'>Số tiêu chí</th>
                      <th scope='col'>Tổng điểm tối đa</th>
                      <th scope='col'>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((set) => (
                      <tr key={set.id}>
                        <td>
                          {set.groupCode} · {set.groupName}
                        </td>
                        <th scope='row'>
                          {set.categoryName}
                          <br />
                          <small>
                            <code>{set.categoryId}</code> · {set.classificationGroup}
                            {set.classificationSubgroup
                              ? ` / ${set.classificationSubgroup}`
                              : ''}
                          </small>
                        </th>
                        <td>
                          {set.source ?? 'Quyết định 26/2026/QĐ-TTg'} · v{set.version}
                          <br />
                          <small>
                            Mã bộ: <code>{set.id}</code>
                          </small>
                        </td>
                        <td>{set.criterionCount} tiêu chí</td>
                        <td>
                          <strong>{set.maxScore} điểm</strong>
                        </td>
                        <td>
                          <div className='hero-actions'>
                            <Button
                              type='button'
                              variant='secondary'
                              onClick={() => setSelectedSetId(set.id)}
                            >
                              Xem cấu trúc
                            </Button>
                            <Link
                              className='button button-secondary'
                              to='/print/criteria-sets/$id'
                              params={{ id: set.id }}
                            >
                              In mẫu trắng
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {selectedSetId && (
            <section className='route-panel' aria-label='Cấu trúc chi tiết bộ phiếu'>
              {setDetailQuery.isPending && <p>Đang tải cấu trúc bộ phiếu…</p>}
              {setDetailError && (
                <p className='form-note' role='alert'>
                  {setDetailError}
                </p>
              )}
              {selectedSet && (
                <>
                  <div className='section-heading'>
                    <div>
                      <p className='eyebrow'>
                        {selectedSet.groupCode} · {selectedSet.groupName}
                      </p>
                      <h2>{selectedSet.categoryName}</h2>
                      <p>
                        {selectedSet.source ?? 'Quyết định 26/2026/QĐ-TTg'} · Phiên bản v
                        {selectedSet.version} · {selectedSet.criterionCount} tiêu chí · Tổng tối đa{' '}
                        {selectedSet.maxScore} điểm
                      </p>
                    </div>
                    <div className='hero-actions'>
                      <Link
                        className='button button-primary'
                        to='/print/criteria-sets/$id'
                        params={{ id: selectedSet.id }}
                      >
                        In mẫu trắng A4
                      </Link>
                      <Button
                        type='button'
                        variant='secondary'
                        onClick={() => setSelectedSetId(null)}
                      >
                        Đóng
                      </Button>
                    </div>
                  </div>
                  {selectedSet.criteria.map((criterion) => (
                    <article className='score-card' key={criterion.id}>
                      <h3>
                        Phần {criterion.sectionCode} ({criterion.sectionName}) — {criterion.code}.{' '}
                        {criterion.name} (Tối đa {criterion.maxScore} điểm)
                      </h3>
                      {criterion.subCriteria.map((sub) => (
                        <div key={sub.id}>
                          <strong>
                            {sub.code}. {sub.content}
                          </strong>
                          <ul>
                            {sub.options.map((opt) => (
                              <li key={opt.id}>
                                {opt.label} — <strong>{opt.points} điểm</strong>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </article>
                  ))}
                </>
              )}
            </section>
          )}
        </TabsContent>

        <TabsContent value='evaluations'>
          <form
            className='admin-user-filters'
            onSubmit={(event) => {
              event.preventDefault();
              setEvalFilters((current) => ({
                ...current,
                page: 1,
                q: evalSearchText.trim() || undefined,
                productId: productFilterText.trim() || undefined,
                judgeId: judgeFilterText.trim() || undefined,
              }));
            }}
          >
            <label>
              Từ khóa (sản phẩm, người chấm, mã phiếu)
              <Input
                value={evalSearchText}
                onChange={(event) => setEvalSearchText(event.target.value)}
              />
            </label>
            <label>
              Mã sản phẩm
              <Input
                value={productFilterText}
                onChange={(event) => setProductFilterText(event.target.value)}
              />
            </label>
            <label>
              Mã người chấm
              <Input
                value={judgeFilterText}
                onChange={(event) => setJudgeFilterText(event.target.value)}
              />
            </label>
            <label>
              Nhóm sản phẩm
              <select
                value={evalFilters.groupId ?? ''}
                onChange={(event) =>
                  setEvalFilters((current) => ({
                    ...current,
                    page: 1,
                    groupId: event.target.value || undefined,
                  }))
                }
              >
                <option value=''>Tất cả nhóm</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.code} · {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái phiếu
              <select
                value={evalFilters.status ?? ''}
                onChange={(event) =>
                  setEvalFilters((current) => ({
                    ...current,
                    page: 1,
                    status: (event.target.value || undefined) as
                      | EvaluationRecordStatus
                      | undefined,
                  }))
                }
              >
                <option value=''>Tất cả</option>
                <option value='SUBMITTED'>Đã nộp</option>
                {canManage && <option value='IN_PROGRESS'>Đang chấm nháp</option>}
              </select>
            </label>
            <Button type='submit' variant='secondary'>
              Lọc phiếu chấm
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={evaluationsQuery.isFetching}
              onClick={() => void evaluationsQuery.refetch()}
            >
              Tải lại
            </Button>
          </form>

          {evaluationsError && (
            <p className='form-note' role='alert'>
              {evaluationsError}
            </p>
          )}
          {evaluationsQuery.isPending && <p>Đang tải danh sách phiếu chấm…</p>}
          {!evaluationsQuery.isPending && !evaluationsError && evaluations.length === 0 && (
            <div className='empty-state'>
              <h2>Chưa có phiếu chấm phù hợp</h2>
              <p>Chưa có phiếu chấm nào khớp với điều kiện lọc hiện tại.</p>
            </div>
          )}

          {!evaluationsQuery.isPending && !evaluationsError && evaluations.length > 0 && (
            <>
              <div className='table-wrap'>
                <table className='data-table'>
                  <thead>
                    <tr>
                      <th scope='col'>Sản phẩm / Nhóm</th>
                      <th scope='col'>Người chấm &amp; Đơn vị (khi nộp)</th>
                      <th scope='col'>Phạm vi phân công</th>
                      <th scope='col'>Trạng thái</th>
                      <th scope='col'>Ngày nộp</th>
                      <th scope='col'>Tổng điểm trong phạm vi</th>
                      <th scope='col'>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map((ev) => (
                      <tr key={ev.id}>
                        <th scope='row'>
                          {ev.product.name}
                          <br />
                          <small>
                            <code>{ev.product.id}</code> · {ev.product.groupName} ·{' '}
                            {ev.product.categoryName}
                          </small>
                        </th>
                        <td>
                          <strong>{ev.judge.fullName}</strong>
                          <br />
                          <small>
                            {ev.judge.organizationUnitName ?? 'Chưa gán đơn vị'} · {ev.judge.email}
                          </small>
                        </td>
                        <td>
                          {ev.isPartialScope
                            ? `${ev.assignedCriterionCount}/${ev.totalCriterionCount} tiêu chí (Tối đa ${ev.scopeMaxScore} điểm)`
                            : `Toàn bộ (${ev.totalCriterionCount} tiêu chí · ${ev.scopeMaxScore} điểm)`}
                        </td>
                        <td>
                          <span className='badge'>
                            {ev.status === 'SUBMITTED' ? 'Đã nộp' : 'Bản nháp'}
                          </span>
                        </td>
                        <td>
                          {ev.submittedAt
                            ? new Date(ev.submittedAt).toLocaleString('vi-VN')
                            : 'Chưa nộp'}
                        </td>
                        <td>
                          <strong>
                            {ev.total !== null
                              ? `${formatExactScore(ev.total)} / ${ev.scopeMaxScore} điểm`
                              : '—'}
                          </strong>
                          {ev.isPartialScope && (
                            <>
                              <br />
                              <small>Tổng phạm vi một phần</small>
                            </>
                          )}
                        </td>
                        <td>
                          <div className='hero-actions'>
                            <Link
                              className='button button-secondary'
                              to='/print/evaluations/$id'
                              params={{ id: ev.id }}
                            >
                              In phiếu chấm
                            </Link>
                            {canView && (
                              <Link
                                className='button button-secondary'
                                to='/print/products/$id/results'
                                params={{ id: ev.product.id }}
                              >
                                In tổng hợp
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className='hero-actions'>
                <span>
                  {evaluationsQuery.data?.meta?.total ?? evaluations.length} phiếu chấm · Trang{' '}
                  {evalFilters.page ?? 1} / {evaluationsQuery.data?.meta?.totalPages ?? 1}
                </span>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={(evalFilters.page ?? 1) <= 1}
                  onClick={() =>
                    setEvalFilters((current) => ({
                      ...current,
                      page: (current.page ?? 1) - 1,
                    }))
                  }
                >
                  Trước
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={
                    (evalFilters.page ?? 1) >=
                    (evaluationsQuery.data?.meta?.totalPages ?? 1)
                  }
                  onClick={() =>
                    setEvalFilters((current) => ({
                      ...current,
                      page: (current.page ?? 1) + 1,
                    }))
                  }
                >
                  Sau
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
