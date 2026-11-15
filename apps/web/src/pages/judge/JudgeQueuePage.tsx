import { useEffect, useMemo, useState } from 'react';
import { PageContainer, PageHeader } from '@/layouts/PageLayout';
import type { EvaluationRecordStatus } from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Clock, Inbox, Paperclip, RotateCcw } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
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
import { ALL, DEFAULT_PAGE_SIZE } from '../../constants/consts';
import {
  ADMIN_DASHBOARD_STATUS_LABEL,
  EVALUATION_STATUS,
  PRODUCT_STATUS_TONE,
} from '../../constants/product-status';
import { paginateAndSortClientRows, usePaginatedList } from '../../hooks/use-paginated-list';
import { parseJudgeQueueSearch, type JudgeQueueSearch } from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { displayProductCode, matchesProductSearchKeyword } from '../../lib/print-format';
import { useCategories } from '../../queries/common';
import { useJudgeQueue } from '../../queries/judge';
import type { QueueProduct } from '../../types/judge';

interface JudgeQueuePageProps {
  search?: JudgeQueueSearch;
  onSearchChange?: (next: JudgeQueueSearch) => void;
}

const DEFAULT_SEARCH: JudgeQueueSearch = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
};

export function JudgeQueuePage({
  search: controlledSearch,
  onSearchChange,
}: JudgeQueuePageProps = {}) {
  const {
    data: rows = [],
    error: loadError,
    isPending: loading,
    isFetching,
    refetch,
  } = useJudgeQueue();
  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data ?? [];
  const error = errorText(loadError);

  const { appliedSearch, applySearch, page, pageSize, setPage, setPageSize, sorting, setSorting } =
    usePaginatedList<JudgeQueueSearch>({
      search: controlledSearch,
      onSearchChange,
      parseSearch: parseJudgeQueueSearch,
      defaultSearch: DEFAULT_SEARCH,
      isLoading: loading,
      defaultPageSize: DEFAULT_PAGE_SIZE,
    });

  const [draftQ, setDraftQ] = useState(appliedSearch.q ?? '');
  const [draftCategoryId, setDraftCategoryId] = useState(appliedSearch.categoryId ?? '');
  const [draftEvalStatus, setDraftEvalStatus] = useState<EvaluationRecordStatus | undefined>(
    appliedSearch.evaluationStatus,
  );

  useEffect(() => {
    setDraftQ(appliedSearch.q ?? '');
    setDraftCategoryId(appliedSearch.categoryId ?? '');
    setDraftEvalStatus(appliedSearch.evaluationStatus);
  }, [appliedSearch.q, appliedSearch.categoryId, appliedSearch.evaluationStatus]);

  const queueCounts = useMemo(() => {
    let openCount = 0;
    let submittedCount = 0;
    for (const row of rows) {
      const status = row.evaluations[0]?.status ?? EVALUATION_STATUS.IN_PROGRESS;
      if (status === EVALUATION_STATUS.SUBMITTED) {
        submittedCount += 1;
      } else if (status === EVALUATION_STATUS.IN_PROGRESS) {
        openCount += 1;
      }
    }
    return {
      total: rows.length,
      openCount,
      submittedCount,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = appliedSearch.q?.trim().toLowerCase();
    return rows.filter((row) => {
      if (keyword && !matchesProductSearchKeyword(row, keyword)) {
        return false;
      }
      if (appliedSearch.categoryId && row.category.id !== appliedSearch.categoryId) {
        return false;
      }
      if (appliedSearch.evaluationStatus) {
        const evalStatus = row.evaluations[0]?.status ?? EVALUATION_STATUS.IN_PROGRESS;
        if (evalStatus !== appliedSearch.evaluationStatus) return false;
      }
      return true;
    });
  }, [appliedSearch.categoryId, appliedSearch.evaluationStatus, appliedSearch.q, rows]);

  const paginated = useMemo(
    () =>
      paginateAndSortClientRows(filteredRows, {
        page,
        pageSize,
        sorting,
        accessors: {
          name: (item) => item.name,
          category: (item) => item.category.name,
          status: (item) => item.status,
          evalStatus: (item) => item.evaluations[0]?.status ?? EVALUATION_STATUS.IN_PROGRESS,
          totalScore: (item) => item.evaluations[0]?.total ?? -1,
          attachments: (item) => item.attachments.length,
        },
      }),
    [filteredRows, page, pageSize, sorting],
  );

  useEffect(() => {
    if (loading) return;
    if (paginated.page !== page) {
      setPage(paginated.page);
    }
  }, [loading, page, paginated.page, setPage]);

  const columns = useMemo<DataTableColumnDef<QueueProduct>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Hồ sơ sản phẩm',
        meta: { isRowHeader: true },
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div>
              <div className='text-fg font-semibold'>{item.name}</div>
              <div className='text-muted mt-0.5 text-xs'>
                <code className='font-mono' title={item.id}>
                  {displayProductCode(item)}
                </code>
              </div>
              {item.description && (
                <p className='text-muted mt-1 line-clamp-2 text-xs'>{item.description}</p>
              )}
            </div>
          );
        },
      },
      {
        id: 'category',
        accessorFn: (row) => row.category.name,
        header: 'Danh mục sản phẩm',
        cell: ({ row }) => <Badge variant='secondary'>{row.original.category.name}</Badge>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Trạng thái hồ sơ',
        cell: ({ row }) => (
          <Badge variant='outline' className={PRODUCT_STATUS_TONE[row.original.status]}>
            {ADMIN_DASHBOARD_STATUS_LABEL[row.original.status]}
          </Badge>
        ),
      },
      {
        id: 'evalStatus',
        accessorFn: (row) => row.evaluations[0]?.status ?? EVALUATION_STATUS.IN_PROGRESS,
        header: 'Trạng thái phiếu chấm',
        cell: ({ row }) => {
          const evaluation = row.original.evaluations[0];
          const isSubmitted = evaluation?.status === EVALUATION_STATUS.SUBMITTED;
          const isExcluded = evaluation?.status === EVALUATION_STATUS.EXCLUDED;
          if (isSubmitted) {
            return (
              <span className='judge-eval-status-pill is-submitted'>
                <CheckCircle2 className='size-3.5 shrink-0' aria-hidden='true' />
                <span>Đã nộp phiếu</span>
              </span>
            );
          }
          if (isExcluded) {
            return (
              <span className='judge-eval-status-pill is-submitted'>
                <Clock className='size-3.5 shrink-0' aria-hidden='true' />
                <span>Đã gỡ khỏi hồ sơ (chỉ xem)</span>
              </span>
            );
          }
          return (
            <span className='judge-eval-status-pill is-open'>
              <Clock className='size-3.5 shrink-0' aria-hidden='true' />
              <span>Phiếu chấm đang mở</span>
            </span>
          );
        },
      },
      {
        id: 'totalScore',
        accessorFn: (row) => row.evaluations[0]?.total ?? -1,
        header: 'Điểm phiếu',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => {
          const evaluation = row.original.evaluations[0];
          return evaluation?.total !== null && evaluation?.total !== undefined ? (
            <strong>{evaluation.total} điểm</strong>
          ) : (
            <span className='text-muted text-xs'>—</span>
          );
        },
      },
      {
        id: 'attachments',
        accessorFn: (row) => row.attachments.length,
        header: 'Đính kèm',
        meta: { align: 'center' },
        cell: ({ row }) => (
          <span className='judge-attachment-pill'>
            <Paperclip className='size-3.5 shrink-0' aria-hidden='true' />
            <span>{row.original.attachments.length} tệp</span>
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Thao tác',
        enableSorting: false,
        meta: { align: 'center' },
        cell: ({ row }) => {
          const item = row.original;
          const evaluation = item.evaluations[0];
          const isSubmitted = evaluation?.status === EVALUATION_STATUS.SUBMITTED;
          const isExcluded = evaluation?.status === EVALUATION_STATUS.EXCLUDED;
          const isReadOnly = isSubmitted || isExcluded;
          return (
            <Button asChild size='sm' variant={isReadOnly ? 'secondary' : 'default'}>
              <Link
                to='/judge/products/$id'
                params={{ id: item.id }}
                aria-label={`${isExcluded ? 'Xem phiếu lịch sử' : isSubmitted ? 'Xem phiếu đã nộp' : 'Chấm điểm'} ${item.name}`}
              >
                {isExcluded ? 'Xem phiếu lịch sử' : isSubmitted ? 'Xem phiếu đã nộp' : 'Chấm điểm'}
              </Link>
            </Button>
          );
        },
      },
    ],
    [],
  );

  const hasActiveFilters = Boolean(
    appliedSearch.q || appliedSearch.categoryId || appliedSearch.evaluationStatus,
  );

  return (
    <PageContainer>
      <PageHeader
        title='Hàng chờ chấm'
        description='Danh sách hồ sơ sản phẩm được phân công chấm điểm cho hội đồng.'
        actions={
          <Button
            type='button'
            variant='secondary'
            loading={isFetching}
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RotateCcw className='size-4' aria-hidden='true' />
            <span>{isFetching ? 'Đang tải…' : 'Tải lại'}</span>
          </Button>
        }
      />

      {!loading && !error && (
        <div
          className='judge-summary-strip'
          role='group'
          aria-label='Tóm tắt trạng thái phiếu chấm'
        >
          <button
            type='button'
            className='judge-summary-card'
            aria-pressed={!appliedSearch.evaluationStatus}
            onClick={() =>
              applySearch({
                ...appliedSearch,
                page: 1,
                evaluationStatus: undefined,
              })
            }
          >
            <span>Phiếu được phân công</span>
            <strong>{queueCounts.total}</strong>
          </button>
          <button
            type='button'
            className='judge-summary-card is-open-tone'
            aria-pressed={appliedSearch.evaluationStatus === EVALUATION_STATUS.IN_PROGRESS}
            onClick={() =>
              applySearch({
                ...appliedSearch,
                page: 1,
                evaluationStatus: EVALUATION_STATUS.IN_PROGRESS,
              })
            }
          >
            <span>Cần chấm (Đang mở)</span>
            <strong>{queueCounts.openCount}</strong>
          </button>
          <button
            type='button'
            className='judge-summary-card is-submitted-tone'
            aria-pressed={appliedSearch.evaluationStatus === EVALUATION_STATUS.SUBMITTED}
            onClick={() =>
              applySearch({
                ...appliedSearch,
                page: 1,
                evaluationStatus: EVALUATION_STATUS.SUBMITTED,
              })
            }
          >
            <span>Đã nộp kết quả</span>
            <strong>{queueCounts.submittedCount}</strong>
          </button>
        </div>
      )}

      <form
        className='admin-form filter-card admin-filter-panel'
        onSubmit={(event) => {
          event.preventDefault();
          applySearch({
            ...appliedSearch,
            page: 1,
            q: draftQ.trim() || undefined,
            categoryId: draftCategoryId || undefined,
            evaluationStatus: draftEvalStatus,
          });
        }}
      >
        <div className='admin-filters'>
          <FormField
            label='Tìm sản phẩm hoặc mã hồ sơ'
            htmlFor='judge-queue-q'
            className='admin-filter-field'
            data-filter-width='search'
          >
            <Input
              id='judge-queue-q'
              value={draftQ}
              placeholder='Nhập tên sản phẩm hoặc mã hồ sơ…'
              onChange={(event) => setDraftQ(event.target.value)}
            />
          </FormField>

          <FormField
            label='Danh mục sản phẩm'
            htmlFor='judge-queue-category'
            className='admin-filter-field'
            data-filter-width='group'
          >
            <Combobox
              value={draftCategoryId || ALL}
              onValueChange={(value) => setDraftCategoryId(value === ALL ? '' : value)}
            >
              <ComboboxAnchor>
                <ComboboxInput id='judge-queue-category' placeholder='Tất cả danh mục' />
                <ComboboxTrigger aria-label='Mở danh sách danh mục' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy danh mục.</ComboboxEmpty>
                <ComboboxItem value={ALL}>Tất cả danh mục</ComboboxItem>
                {categories.map((cat) => (
                  <ComboboxItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </ComboboxItem>
                ))}
              </ComboboxContent>
            </Combobox>
          </FormField>

          <FormField
            label='Trạng thái phiếu chấm'
            htmlFor='judge-queue-eval-status'
            className='admin-filter-field'
            data-filter-width='status'
          >
            <Combobox
              value={draftEvalStatus ?? ALL}
              onValueChange={(value) =>
                setDraftEvalStatus(value === ALL ? undefined : (value as EvaluationRecordStatus))
              }
            >
              <ComboboxAnchor>
                <ComboboxInput id='judge-queue-eval-status' placeholder='Tất cả' />
                <ComboboxTrigger aria-label='Mở danh sách trạng thái phiếu' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy trạng thái.</ComboboxEmpty>
                <ComboboxItem value={ALL}>Tất cả</ComboboxItem>
                <ComboboxItem value={EVALUATION_STATUS.IN_PROGRESS}>
                  Phiếu chấm đang mở
                </ComboboxItem>
                <ComboboxItem value={EVALUATION_STATUS.SUBMITTED}>Đã nộp phiếu</ComboboxItem>
                <ComboboxItem value={EVALUATION_STATUS.EXCLUDED}>Đã gỡ khỏi hồ sơ</ComboboxItem>
              </ComboboxContent>
            </Combobox>
          </FormField>

          <div className='admin-actions admin-filter-actions'>
            <Button type='submit'>Áp dụng</Button>
            {hasActiveFilters && (
              <Button
                type='button'
                variant='secondary'
                onClick={() =>
                  applySearch({
                    page: 1,
                    limit: pageSize,
                  })
                }
              >
                <RotateCcw className='size-4' aria-hidden='true' />
                <span>Xóa bộ lọc</span>
              </Button>
            )}
          </div>
        </div>
      </form>

      {loading && <PageSpin />}
      {error && (
        <div className='space-y-2'>
          <AlertError title='Không thể tải hàng chờ chấm' errors={[error]} />
          <Button type='button' variant='secondary' size='sm' onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      )}
      {!loading && !error && paginated.rows.length === 0 && (
        <Card className='admin-table-region empty-card'>
          <Inbox className='empty-icon mx-auto' aria-hidden='true' />
          <h2 className='text-fg mb-1 text-lg font-semibold'>
            {hasActiveFilters ? 'Không có hồ sơ phù hợp bộ lọc' : 'Chưa có hồ sơ được phân công'}
          </h2>
          <p className='text-muted text-sm'>
            {hasActiveFilters
              ? 'Thử điều chỉnh từ khóa, danh mục hoặc trạng thái phiếu chấm.'
              : 'Các hồ sơ sẽ xuất hiện tại đây khi được nộp và phân công.'}
          </p>
        </Card>
      )}
      {!loading && !error && paginated.rows.length > 0 && (
        <div
          className='admin-table-region'
          role='region'
          aria-label='Bảng hàng chờ chấm điểm'
          tabIndex={0}
        >
          <DataTable
            columns={columns}
            data={paginated.rows}
            total={paginated.total}
            page={paginated.page}
            pageSize={pageSize}
            enableSorting
            sorting={sorting}
            onSortingChange={setSorting}
            getRowId={(row) => row.id}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </PageContainer>
  );
}
