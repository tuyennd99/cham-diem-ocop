import { useEffect, useMemo, useState } from 'react';
import type {
  AdminCriteriaSetRecord,
  AdminEvaluationRecord,
  EvaluationRecordStatus,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Filter, RotateCcw } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type DataTableColumnDef } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ALL, DEFAULT_PAGE_SIZE } from '../../constants/consts';
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
import { useAdminCategories } from '../../queries/admin-catalogs';
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

  const categoriesQuery = useAdminCategories({ page: 1, limit: 100 });
  const setsQuery = useAdminCriteriaSets(setsApiQuery);
  const setDetailQuery = useAdminCriteriaSetDetail(selectedSetId);
  const evaluationsQuery = useAdminEvaluations(evalsApiQuery);

  const categories = categoriesQuery.data?.data ?? [];
  const sets = setsQuery.data?.data ?? [];
  const setsMeta = setsQuery.data?.meta;
  const selectedSet = setDetailQuery.data?.data ?? null;
  const evaluations = evaluationsQuery.data?.data ?? [];
  const evalsMeta = evaluationsQuery.data?.meta;

  const setsError = errorText(setsQuery.error);
  const setDetailError = errorText(setDetailQuery.error);
  const evaluationsError = errorText(evaluationsQuery.error);

  const setColumns = useMemo<DataTableColumnDef<AdminCriteriaSetRecord>[]>(
    () => [
      {
        accessorKey: 'categoryName',
        header: 'Danh mục sản phẩm',
        meta: { isRowHeader: true, cellClassName: 'font-normal' },
        cell: ({ row }) => {
          const set = row.original;
          return (
            <>
              <div className='text-fg font-semibold'>{set.categoryName}</div>
              <div className='text-muted mt-0.5 text-xs'>
                <code className='font-mono'>{set.categoryId}</code>
              </div>
            </>
          );
        },
      },
      {
        id: 'source',
        header: 'Nguồn / Phiên bản',
        cell: ({ row }) => {
          const set = row.original;
          return (
            <div>
              <div>
                {set.source ?? 'Quyết định 26/2026/QĐ-TTg'} · v{set.version}
              </div>
              <div className='text-muted text-xs'>
                Mã bộ: <code className='font-mono'>{set.id}</code>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'criterionCount',
        header: 'Số tiêu chí',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => `${row.original.criterionCount} tiêu chí`,
      },
      {
        accessorKey: 'maxScore',
        header: 'Tổng điểm tối đa',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => <strong>{row.original.maxScore} điểm</strong>,
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { align: 'right' },
        cell: ({ row }) => {
          const set = row.original;
          return (
            <div className='admin-actions justify-end'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => setSelectedSetId(set.id)}
              >
                Xem cấu trúc
              </Button>
              <Button asChild variant='secondary' size='sm'>
                <Link to='/print/criteria-sets/$id' params={{ id: set.id }}>
                  In mẫu trắng
                </Link>
              </Button>
            </div>
          );
        },
      },
    ],
    [],
  );

  const evaluationColumns = useMemo<DataTableColumnDef<AdminEvaluationRecord>[]>(
    () => [
      {
        id: 'product',
        header: 'Sản phẩm / Nhóm',
        meta: { isRowHeader: true, cellClassName: 'font-normal' },
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <>
              <div className='text-fg font-semibold'>{ev.product.name}</div>
              <div className='text-muted mt-0.5 text-xs'>
                <code className='font-mono'>{ev.product.id}</code> · {ev.product.categoryName}
              </div>
            </>
          );
        },
      },
      {
        id: 'judge',
        header: 'Người chấm & Đơn vị (khi nộp)',
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <div>
              <div className='font-semibold'>{ev.judge.fullName}</div>
              <div className='text-muted text-xs'>
                {ev.judge.organizationUnitName ?? 'Chưa gán đơn vị'} · {ev.judge.email}
              </div>
            </div>
          );
        },
      },
      {
        id: 'scope',
        header: 'Phạm vi phân công',
        cell: ({ row }) => {
          const ev = row.original;
          return ev.isPartialScope
            ? `${ev.assignedCriterionCount}/${ev.totalCriterionCount} tiêu chí (Tối đa ${ev.scopeMaxScore} điểm)`
            : `Toàn bộ (${ev.totalCriterionCount} tiêu chí · ${ev.scopeMaxScore} điểm)`;
        },
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'SUBMITTED' ? 'default' : 'secondary'}>
            {row.original.status === 'SUBMITTED' ? 'Đã nộp' : 'Bản nháp'}
          </Badge>
        ),
      },
      {
        accessorKey: 'submittedAt',
        header: 'Ngày nộp',
        cell: ({ row }) =>
          row.original.submittedAt
            ? new Date(row.original.submittedAt).toLocaleString('vi-VN')
            : 'Chưa nộp',
      },
      {
        accessorKey: 'total',
        header: 'Tổng điểm trong phạm vi',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <div>
              <strong>
                {ev.total !== null
                  ? `${formatExactScore(ev.total)} / ${ev.scopeMaxScore} điểm`
                  : '—'}
              </strong>
              {ev.isPartialScope && <div className='text-muted text-xs'>Phạm vi một phần</div>}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { align: 'right' },
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <div className='admin-actions justify-end'>
              <Button asChild variant='secondary' size='sm'>
                <Link to='/print/evaluations/$id' params={{ id: ev.id }}>
                  In phiếu chấm
                </Link>
              </Button>
              {canView && (
                <Button asChild variant='secondary' size='sm'>
                  <Link to='/print/products/$id/results' params={{ id: ev.product.id }}>
                    In tổng hợp
                  </Link>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [canView],
  );

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
            <Button asChild variant='secondary'>
              <Link to='/admin/assignments'>Quản lý phân công giám khảo</Link>
            </Button>
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
                  categoryId: draftFilters.categoryId,
                  isActive: draftFilters.isActive,
                });
              }}
            >
              <div className='admin-filters'>
                <FormField
                  label='Tìm theo tên danh mục, mã bộ hoặc nguồn'
                  htmlFor='scoring-sets-q'
                  className='admin-filter-field'
                  data-filter-width='search'
                >
                  <Input
                    id='scoring-sets-q'
                    value={draftFilters.q ?? ''}
                    placeholder='Nhập tên danh mục, mã bộ phiếu hoặc nguồn…'
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
                        q: event.target.value || undefined,
                      }))
                    }
                  />
                </FormField>
                <FormField
                  label='Danh mục sản phẩm'
                  htmlFor='scoring-sets-category'
                  className='admin-filter-field'
                  data-filter-width='group'
                >
                  <Select
                    value={draftFilters.categoryId ?? ALL}
                    onValueChange={(value) =>
                      setDraftFilters((old) => ({
                        ...old,
                        categoryId: value === ALL ? undefined : value,
                      }))
                    }
                  >
                    <SelectTrigger id='scoring-sets-category'>
                      <SelectValue placeholder='Tất cả danh mục' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tất cả danh mục</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label='Trạng thái'
                  htmlFor='scoring-sets-status'
                  className='admin-filter-field'
                  data-filter-width='status'
                >
                  <Select
                    value={
                      draftFilters.isActive === undefined ? ALL : String(draftFilters.isActive)
                    }
                    onValueChange={(value) =>
                      setDraftFilters((old) => ({
                        ...old,
                        isActive: value === ALL ? undefined : value === 'true',
                      }))
                    }
                  >
                    <SelectTrigger id='scoring-sets-status'>
                      <SelectValue placeholder='Tất cả' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tất cả</SelectItem>
                      <SelectItem value='true'>Đang áp dụng</SelectItem>
                      <SelectItem value='false'>Ngừng áp dụng</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <div className='admin-actions admin-filter-actions'>
                  <Button type='submit'>Áp dụng</Button>
                  {(appliedSearch.q !== undefined ||
                    appliedSearch.categoryId !== undefined ||
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
                    loading={setsQuery.isFetching}
                    disabled={setsQuery.isFetching}
                    onClick={() => void setsQuery.refetch()}
                  >
                    Tải lại
                  </Button>
                </div>
              </div>
            </form>

            {setsError && <AlertError title='Không thể tải bộ phiếu' errors={[setsError]} />}
            {setsQuery.isPending && <PageSpin />}
            {!setsQuery.isPending && !setsError && sets.length === 0 && (
              <Card className='admin-table-region empty-card'>
                <h2>Không có bộ phiếu phù hợp</h2>
                <p className='text-muted text-sm'>
                  Kiểm tra bộ lọc hoặc phạm vi phân công hiện tại.
                </p>
              </Card>
            )}

            {!setsQuery.isPending && !setsError && sets.length > 0 && (
              <div
                className='admin-table-region'
                role='region'
                aria-label='Bảng danh mục bộ phiếu tiêu chí'
                tabIndex={0}
              >
                <DataTable
                  columns={setColumns}
                  data={sets}
                  total={setsMeta?.total ?? sets.length}
                  page={setsMeta?.page ?? appliedSearch.page ?? 1}
                  pageSize={appliedSearch.limit ?? DEFAULT_PAGE_SIZE}
                  getRowId={(row) => row.id}
                  onPageChange={(nextPage) =>
                    applySearch({
                      ...appliedSearch,
                      page: nextPage,
                    })
                  }
                  onPageSizeChange={(nextLimit) =>
                    applySearch({
                      ...appliedSearch,
                      page: 1,
                      limit: nextLimit,
                    })
                  }
                />
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
                  categoryId: draftFilters.categoryId,
                  status: draftFilters.status,
                  productId: draftFilters.productId,
                  judgeId: draftFilters.judgeId,
                });
              }}
            >
              <div className='admin-filters'>
                <FormField
                  label='Từ khóa (sản phẩm, người chấm, mã phiếu)'
                  htmlFor='scoring-evals-q'
                  className='admin-filter-field'
                  data-filter-width='search'
                >
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
                </FormField>

                <FormField
                  label='Danh mục sản phẩm'
                  htmlFor='scoring-evals-category'
                  className='admin-filter-field'
                  data-filter-width='group'
                >
                  <Select
                    value={draftFilters.categoryId ?? ALL}
                    onValueChange={(value) =>
                      setDraftFilters((old) => ({
                        ...old,
                        categoryId: value === ALL ? undefined : value,
                      }))
                    }
                  >
                    <SelectTrigger id='scoring-evals-category'>
                      <SelectValue placeholder='Tất cả danh mục' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tất cả danh mục</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  label='Trạng thái phiếu'
                  htmlFor='scoring-evals-status'
                  className='admin-filter-field'
                  data-filter-width='status'
                >
                  <Select
                    value={draftFilters.status ?? ALL}
                    onValueChange={(value) =>
                      setDraftFilters((old) => ({
                        ...old,
                        status: value === ALL ? undefined : (value as EvaluationRecordStatus),
                      }))
                    }
                  >
                    <SelectTrigger id='scoring-evals-status'>
                      <SelectValue placeholder='Tất cả' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tất cả</SelectItem>
                      <SelectItem value='SUBMITTED'>Đã nộp</SelectItem>
                      {canManage && <SelectItem value='IN_PROGRESS'>Đang chấm nháp</SelectItem>}
                    </SelectContent>
                  </Select>
                </FormField>

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
                    appliedSearch.categoryId !== undefined ||
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
                    loading={evaluationsQuery.isFetching}
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
                <FormField label='Mã sản phẩm' htmlFor='scoring-evals-product-id'>
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
                </FormField>
                <FormField label='Mã người chấm' htmlFor='scoring-evals-judge-id'>
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
                </FormField>
              </div>
            </form>

            {evaluationsError && (
              <AlertError title='Không thể tải phiếu chấm' errors={[evaluationsError]} />
            )}
            {evaluationsQuery.isPending && <PageSpin />}
            {!evaluationsQuery.isPending && !evaluationsError && evaluations.length === 0 && (
              <Card className='admin-table-region empty-card'>
                <h2>Chưa có phiếu chấm phù hợp</h2>
                <p className='text-muted text-sm'>
                  Chưa có phiếu chấm nào khớp với điều kiện lọc hiện tại.
                </p>
              </Card>
            )}

            {!evaluationsQuery.isPending && !evaluationsError && evaluations.length > 0 && (
              <div
                className='admin-table-region'
                role='region'
                aria-label='Bảng danh sách phiếu chấm thực tế'
                tabIndex={0}
              >
                <DataTable
                  columns={evaluationColumns}
                  data={evaluations}
                  total={evalsMeta?.total ?? evaluations.length}
                  page={evalsMeta?.page ?? appliedSearch.page ?? 1}
                  pageSize={appliedSearch.limit ?? DEFAULT_PAGE_SIZE}
                  getRowId={(row) => row.id}
                  onPageChange={(nextPage) =>
                    applySearch({
                      ...appliedSearch,
                      page: nextPage,
                    })
                  }
                  onPageSizeChange={(nextLimit) =>
                    applySearch({
                      ...appliedSearch,
                      page: 1,
                      limit: nextLimit,
                    })
                  }
                />
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
                ? selectedSet.categoryName
                : 'Đang tải cấu trúc chi tiết bộ phiếu tiêu chí.'}
            </DialogDescription>
          </DialogHeader>

          {setDetailQuery.isPending && <PageSpin />}
          {setDetailError && (
            <div className='space-y-2'>
              <AlertError title='Không thể tải cấu trúc bộ phiếu' errors={[setDetailError]} />
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
                <p className='text-muted text-sm'>
                  {selectedSet.source ?? 'Quyết định 26/2026/QĐ-TTg'} · Phiên bản v
                  {selectedSet.version} · {selectedSet.criterionCount} tiêu chí · Tổng tối đa{' '}
                  {selectedSet.maxScore} điểm
                </p>
                <Button asChild size='sm'>
                  <Link to='/print/criteria-sets/$id' params={{ id: selectedSet.id }}>
                    In mẫu trắng A4
                  </Link>
                </Button>
              </div>
              {selectedSet.criteria.map((criterion) => (
                <Card className='score-card p-4' key={criterion.id}>
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
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
