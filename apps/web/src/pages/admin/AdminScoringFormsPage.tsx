import { useEffect, useState } from 'react';
import type { EvaluationRecordStatus } from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_PAGE_SIZE } from '../../constants/consts';
import {
  parseAdminScoringSearch,
  toAdminCriteriaSetsApiQuery,
  toAdminEvaluationsApiQuery,
  type AdminScoringSearch,
  type AdminScoringTab,
} from '../../lib/admin-search';
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

interface AdminScoringFormsPageProps {
  search?: AdminScoringSearch;
  onSearchChange?: (next: AdminScoringSearch) => void;
}

export function AdminScoringFormsPage({
  search: controlledSearch,
  onSearchChange,
}: AdminScoringFormsPageProps) {
  const session = useSession();
  const canView = hasStaffPermission(session?.user, 'VIEW');
  const canManage = hasStaffPermission(session?.user, 'MANAGE');

  const [fallbackSearch, setFallbackSearch] = useState<AdminScoringSearch>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const appliedSearch = controlledSearch ?? fallbackSearch;
  const selectedTab: AdminScoringTab = appliedSearch.tab ?? 'sets';

  function applySearch(next: AdminScoringSearch) {
    const normalized = parseAdminScoringSearch(next as Record<string, unknown>);
    if (onSearchChange) {
      onSearchChange(normalized);
    } else {
      setFallbackSearch(normalized);
    }
  }

  const [draftFilters, setDraftFilters] = useState<AdminScoringSearch>(appliedSearch);
  const [showEvalAdvanced, setShowEvalAdvanced] = useState(
    Boolean(appliedSearch.productId || appliedSearch.judgeId),
  );
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  useEffect(() => {
    setDraftFilters(appliedSearch);
  }, [appliedSearch]);

  const criteriaDialogOpen = selectedSetId !== null;
  function changeCriteriaDialogOpen(open: boolean) {
    if (!open) setSelectedSetId(null);
  }

  const setsApiQuery = toAdminCriteriaSetsApiQuery(appliedSearch);
  const evalsApiQuery = toAdminEvaluationsApiQuery(appliedSearch);

  const groupsQuery = useAdminProductGroups({ page: 1, limit: 100 });
  const setsQuery = useAdminCriteriaSets(setsApiQuery);
  const setDetailQuery = useAdminCriteriaSetDetail(selectedSetId);
  const evaluationsQuery = useAdminEvaluations(evalsApiQuery);

  const groups = groupsQuery.data?.data ?? [];
  const sets = setsQuery.data?.data ?? [];
  const setsMeta = setsQuery.data?.meta;
  const selectedSet = setDetailQuery.data?.data ?? null;
  const evaluations = evaluationsQuery.data?.data ?? [];
  const evalsMeta = evaluationsQuery.data?.meta;

  const setsError = errorText(setsQuery.error);
  const setDetailError = errorText(setDetailQuery.error);
  const evaluationsError = errorText(evaluationsQuery.error);

  function changeTab(value: string) {
    const nextTab: AdminScoringTab = value === 'evaluations' ? 'evaluations' : 'sets';
    applySearch({
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
      tab: nextTab,
    });
  }

  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div>
          <h1>Phiếu chấm OCOP</h1>
          <p className='route-intro'>
            Danh mục bộ phiếu tiêu chí theo Quyết định 26/2026/QĐ-TTg, tra cứu phiếu chấm thực tế và
            in biểu mẫu A4.
          </p>
        </div>
        {canView && (
          <div className='admin-actions'>
            <Link className='button button-secondary' to='/admin/assignments'>
              Quản lý phân công giám khảo
            </Link>
          </div>
        )}
      </div>

      <Tabs value={selectedTab} onValueChange={changeTab}>
        <TabsList aria-label='Các tab phân hệ phiếu chấm OCOP'>
          <TabsTrigger value='sets'>Bộ phiếu</TabsTrigger>
          <TabsTrigger value='evaluations'>Phiếu chấm thực tế</TabsTrigger>
        </TabsList>

        <TabsContent value='sets'>
          <div className='admin-page'>
            <form
              className='admin-form filter-card admin-filter-panel'
              onSubmit={(event) => {
                event.preventDefault();
                applySearch({
                  tab: 'sets',
                  page: 1,
                  limit: appliedSearch.limit ?? DEFAULT_PAGE_SIZE,
                  q: draftFilters.q,
                  groupId: draftFilters.groupId,
                  isActive: draftFilters.isActive,
                });
              }}
            >
              <div className='admin-filters'>
                <label
                  className='admin-filter-field'
                  data-filter-width='search'
                  htmlFor='scoring-sets-q'
                >
                  Tìm theo tên phân loại, mã bộ hoặc nguồn
                  <Input
                    id='scoring-sets-q'
                    value={draftFilters.q ?? ''}
                    placeholder='Nhập tên phân loại, mã bộ phiếu hoặc nguồn…'
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
                        q: event.target.value || undefined,
                      }))
                    }
                  />
                </label>
                <label
                  className='admin-filter-field'
                  data-filter-width='group'
                  htmlFor='scoring-sets-group'
                >
                  Nhóm sản phẩm lớn
                  <select
                    id='scoring-sets-group'
                    value={draftFilters.groupId ?? ''}
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
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
                <label
                  className='admin-filter-field'
                  data-filter-width='status'
                  htmlFor='scoring-sets-status'
                >
                  Trạng thái
                  <select
                    id='scoring-sets-status'
                    value={
                      draftFilters.isActive === undefined ? '' : String(draftFilters.isActive)
                    }
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
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

                <div className='admin-actions admin-filter-actions'>
                  <Button type='submit'>Áp dụng</Button>
                  {(appliedSearch.q !== undefined ||
                    appliedSearch.groupId !== undefined ||
                    appliedSearch.isActive !== undefined) && (
                    <Button
                      type='button'
                      variant='secondary'
                      onClick={() =>
                        applySearch({
                          tab: 'sets',
                          page: 1,
                          limit: appliedSearch.limit ?? DEFAULT_PAGE_SIZE,
                        })
                      }
                    >
                      <RotateCcw className='size-4' aria-hidden='true' />
                      <span>Xóa bộ lọc</span>
                    </Button>
                  )}
                  <Button
                    type='button'
                    variant='secondary'
                    disabled={setsQuery.isFetching}
                    onClick={() => void setsQuery.refetch()}
                  >
                    Tải lại
                  </Button>
                </div>
              </div>
            </form>

            {setsError && (
              <p className='form-note' role='alert'>
                {setsError}
              </p>
            )}
            {setsQuery.isPending && <p>Đang tải danh mục bộ phiếu…</p>}
            {!setsQuery.isPending && !setsError && sets.length === 0 && (
              <div className='admin-table-region empty-card'>
                <h2>Không có bộ phiếu phù hợp</h2>
                <p className='text-sm text-muted'>
                  Kiểm tra bộ lọc hoặc phạm vi phân công hiện tại.
                </p>
              </div>
            )}

            {!setsQuery.isPending && !setsError && sets.length > 0 && (
              <div
                className='admin-table-region'
                role='region'
                aria-label='Bảng danh mục bộ phiếu tiêu chí'
                tabIndex={0}
              >
                <table className='admin-data-table'>
                  <thead>
                    <tr>
                      <th scope='col'>Nhóm lớn</th>
                      <th scope='col'>Phân loại sản phẩm</th>
                      <th scope='col'>Nguồn / Phiên bản</th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Số tiêu chí
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Tổng điểm tối đa
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((set) => (
                      <tr key={set.id}>
                        <td>
                          {set.groupCode} · {set.groupName}
                        </td>
                        <th scope='row'>
                          <div className='font-semibold text-fg'>{set.categoryName}</div>
                          <div className='text-xs text-muted mt-0.5'>
                            <code className='font-mono'>{set.categoryId}</code> ·{' '}
                            {set.classificationGroup}
                            {set.classificationSubgroup
                              ? ` / ${set.classificationSubgroup}`
                              : ''}
                          </div>
                        </th>
                        <td>
                          <div>
                            {set.source ?? 'Quyết định 26/2026/QĐ-TTg'} · v{set.version}
                          </div>
                          <div className='text-xs text-muted'>
                            Mã bộ: <code className='font-mono'>{set.id}</code>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {set.criterionCount} tiêu chí
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <strong>{set.maxScore} điểm</strong>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className='admin-actions justify-end'>
                            <Button
                              type='button'
                              variant='secondary'
                              size='sm'
                              onClick={() => setSelectedSetId(set.id)}
                            >
                              Xem cấu trúc
                            </Button>
                            <Link
                              className='button button-secondary button-sm'
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

                <div className='table-footer'>
                  <div className='page-info'>
                    Tổng số: <strong>{setsMeta?.total ?? sets.length}</strong> bộ phiếu
                  </div>
                  <div className='pagination-actions'>
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      disabled={(appliedSearch.page ?? 1) <= 1}
                      onClick={() =>
                        applySearch({
                          ...appliedSearch,
                          page: (appliedSearch.page ?? 1) - 1,
                        })
                      }
                    >
                      Trước
                    </Button>
                    <span className='text-xs font-semibold px-2'>
                      Trang {setsMeta?.page ?? appliedSearch.page ?? 1} /{' '}
                      {Math.max(1, setsMeta?.totalPages ?? 1)}
                    </span>
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      disabled={
                        (appliedSearch.page ?? 1) >= (setsMeta?.totalPages ?? 1)
                      }
                      onClick={() =>
                        applySearch({
                          ...appliedSearch,
                          page: (appliedSearch.page ?? 1) + 1,
                        })
                      }
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value='evaluations'>
          <div className='admin-page'>
            <form
              className='admin-form filter-card admin-filter-panel'
              onSubmit={(event) => {
                event.preventDefault();
                applySearch({
                  tab: 'evaluations',
                  page: 1,
                  limit: appliedSearch.limit ?? DEFAULT_PAGE_SIZE,
                  q: draftFilters.q,
                  groupId: draftFilters.groupId,
                  status: draftFilters.status,
                  productId: draftFilters.productId,
                  judgeId: draftFilters.judgeId,
                });
              }}
            >
              <div className='admin-filters'>
                <label
                  className='admin-filter-field'
                  data-filter-width='search'
                  htmlFor='scoring-evals-q'
                >
                  Từ khóa (sản phẩm, người chấm, mã phiếu)
                  <Input
                    id='scoring-evals-q'
                    value={draftFilters.q ?? ''}
                    placeholder='Nhập tên sản phẩm, tên giám khảo hoặc mã phiếu…'
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
                        q: event.target.value || undefined,
                      }))
                    }
                  />
                </label>

                <label
                  className='admin-filter-field'
                  data-filter-width='group'
                  htmlFor='scoring-evals-group'
                >
                  Nhóm sản phẩm
                  <select
                    id='scoring-evals-group'
                    value={draftFilters.groupId ?? ''}
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
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

                <label
                  className='admin-filter-field'
                  data-filter-width='status'
                  htmlFor='scoring-evals-status'
                >
                  Trạng thái phiếu
                  <select
                    id='scoring-evals-status'
                    value={draftFilters.status ?? ''}
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
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

                <div className='admin-actions admin-filter-actions'>
                  <Button type='submit'>Áp dụng</Button>
                  <Button
                    type='button'
                    variant='secondary'
                    aria-expanded={showEvalAdvanced}
                    aria-controls='admin-evaluations-advanced'
                    onClick={() => setShowEvalAdvanced((open) => !open)}
                  >
                    <Filter className='size-4' aria-hidden='true' />
                    <span>Bộ lọc khác</span>
                  </Button>
                  {(appliedSearch.q !== undefined ||
                    appliedSearch.groupId !== undefined ||
                    appliedSearch.status !== undefined ||
                    appliedSearch.productId !== undefined ||
                    appliedSearch.judgeId !== undefined) && (
                    <Button
                      type='button'
                      variant='secondary'
                      onClick={() =>
                        applySearch({
                          tab: 'evaluations',
                          page: 1,
                          limit: appliedSearch.limit ?? DEFAULT_PAGE_SIZE,
                        })
                      }
                    >
                      <RotateCcw className='size-4' aria-hidden='true' />
                      <span>Xóa bộ lọc</span>
                    </Button>
                  )}
                  <Button
                    type='button'
                    variant='secondary'
                    disabled={evaluationsQuery.isFetching}
                    onClick={() => void evaluationsQuery.refetch()}
                  >
                    Tải lại
                  </Button>
                </div>
              </div>

              <div
                id='admin-evaluations-advanced'
                hidden={!showEvalAdvanced}
                className='advanced-filter-grid'
              >
                <label htmlFor='scoring-evals-product-id'>
                  Mã sản phẩm
                  <Input
                    id='scoring-evals-product-id'
                    value={draftFilters.productId ?? ''}
                    placeholder='Nhập mã sản phẩm…'
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
                        productId: event.target.value || undefined,
                      }))
                    }
                  />
                </label>
                <label htmlFor='scoring-evals-judge-id'>
                  Mã người chấm
                  <Input
                    id='scoring-evals-judge-id'
                    value={draftFilters.judgeId ?? ''}
                    placeholder='Nhập mã giám khảo…'
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
                        judgeId: event.target.value || undefined,
                      }))
                    }
                  />
                </label>
              </div>
            </form>

            {evaluationsError && (
              <p className='form-note' role='alert'>
                {evaluationsError}
              </p>
            )}
            {evaluationsQuery.isPending && <p>Đang tải danh sách phiếu chấm…</p>}
            {!evaluationsQuery.isPending && !evaluationsError && evaluations.length === 0 && (
              <div className='admin-table-region empty-card'>
                <h2>Chưa có phiếu chấm phù hợp</h2>
                <p className='text-sm text-muted'>
                  Chưa có phiếu chấm nào khớp với điều kiện lọc hiện tại.
                </p>
              </div>
            )}

            {!evaluationsQuery.isPending && !evaluationsError && evaluations.length > 0 && (
              <div
                className='admin-table-region'
                role='region'
                aria-label='Bảng danh sách phiếu chấm thực tế'
                tabIndex={0}
              >
                <table className='admin-data-table'>
                  <thead>
                    <tr>
                      <th scope='col'>Sản phẩm / Nhóm</th>
                      <th scope='col'>Người chấm &amp; Đơn vị (khi nộp)</th>
                      <th scope='col'>Phạm vi phân công</th>
                      <th scope='col'>Trạng thái</th>
                      <th scope='col'>Ngày nộp</th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Tổng điểm trong phạm vi
                      </th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map((ev) => (
                      <tr key={ev.id}>
                        <th scope='row'>
                          <div className='font-semibold text-fg'>{ev.product.name}</div>
                          <div className='text-xs text-muted mt-0.5'>
                            <code className='font-mono'>{ev.product.id}</code> ·{' '}
                            {ev.product.groupName} · {ev.product.categoryName}
                          </div>
                        </th>
                        <td>
                          <div className='font-semibold'>{ev.judge.fullName}</div>
                          <div className='text-xs text-muted'>
                            {ev.judge.organizationUnitName ?? 'Chưa gán đơn vị'} · {ev.judge.email}
                          </div>
                        </td>
                        <td>
                          {ev.isPartialScope
                            ? `${ev.assignedCriterionCount}/${ev.totalCriterionCount} tiêu chí (Tối đa ${ev.scopeMaxScore} điểm)`
                            : `Toàn bộ (${ev.totalCriterionCount} tiêu chí · ${ev.scopeMaxScore} điểm)`}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${ev.status === 'SUBMITTED' ? 'completed' : 'draft'}`}
                          >
                            {ev.status === 'SUBMITTED' ? 'Đã nộp' : 'Bản nháp'}
                          </span>
                        </td>
                        <td>
                          {ev.submittedAt
                            ? new Date(ev.submittedAt).toLocaleString('vi-VN')
                            : 'Chưa nộp'}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <strong>
                            {ev.total !== null
                              ? `${formatExactScore(ev.total)} / ${ev.scopeMaxScore} điểm`
                              : '—'}
                          </strong>
                          {ev.isPartialScope && (
                            <div className='text-xs text-muted'>Phạm vi một phần</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className='admin-actions justify-end'>
                            <Link
                              className='button button-secondary button-sm'
                              to='/print/evaluations/$id'
                              params={{ id: ev.id }}
                            >
                              In phiếu chấm
                            </Link>
                            {canView && (
                              <Link
                                className='button button-secondary button-sm'
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

                <div className='table-footer'>
                  <div className='page-info'>
                    Hiển thị <strong>{evaluations.length}</strong> /{' '}
                    <strong>{evalsMeta?.total ?? evaluations.length}</strong> phiếu chấm
                  </div>
                  <div className='pagination-actions'>
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      disabled={(appliedSearch.page ?? 1) <= 1}
                      onClick={() =>
                        applySearch({
                          ...appliedSearch,
                          page: (appliedSearch.page ?? 1) - 1,
                        })
                      }
                    >
                      Trước
                    </Button>
                    <span className='text-xs font-semibold px-2'>
                      Trang {evalsMeta?.page ?? appliedSearch.page ?? 1} /{' '}
                      {Math.max(1, evalsMeta?.totalPages ?? 1)}
                    </span>
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      disabled={
                        (appliedSearch.page ?? 1) >= (evalsMeta?.totalPages ?? 1)
                      }
                      onClick={() =>
                        applySearch({
                          ...appliedSearch,
                          page: (appliedSearch.page ?? 1) + 1,
                        })
                      }
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={criteriaDialogOpen} onOpenChange={changeCriteriaDialogOpen}>
        <DialogContent className='admin-dialog max-w-3xl' data-admin-ui='true'>
          <DialogHeader>
            <DialogTitle>Cấu trúc bộ phiếu</DialogTitle>
            <DialogDescription>
              {selectedSet
                ? `${selectedSet.groupCode} · ${selectedSet.groupName} — ${selectedSet.categoryName}`
                : 'Đang tải cấu trúc chi tiết bộ phiếu tiêu chí.'}
            </DialogDescription>
          </DialogHeader>

          {setDetailQuery.isPending && <p>Đang tải cấu trúc bộ phiếu…</p>}
          {setDetailError && (
            <div className='form-note' role='alert'>
              <p>{setDetailError}</p>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => void setDetailQuery.refetch()}
              >
                Thử lại
              </Button>
            </div>
          )}

          {selectedSet && (
            <div className='grid gap-4'>
              <div className='admin-actions justify-between'>
                <p className='text-sm text-muted'>
                  {selectedSet.source ?? 'Quyết định 26/2026/QĐ-TTg'} · Phiên bản v
                  {selectedSet.version} · {selectedSet.criterionCount} tiêu chí · Tổng tối đa{' '}
                  {selectedSet.maxScore} điểm
                </p>
                <Link
                  className='button button-primary button-sm'
                  to='/print/criteria-sets/$id'
                  params={{ id: selectedSet.id }}
                >
                  In mẫu trắng A4
                </Link>
              </div>
              {selectedSet.criteria.map((criterion) => (
                <article className='score-card' key={criterion.id}>
                  <h3>
                    Phần {criterion.sectionCode} ({criterion.sectionName}) — {criterion.code}.{' '}
                    {criterion.name} (Tối đa {criterion.maxScore} điểm)
                  </h3>
                  {criterion.subCriteria.map((sub) => (
                    <div key={sub.id} className='mt-2'>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
