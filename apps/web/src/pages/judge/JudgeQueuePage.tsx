import { useEffect, useMemo, useState } from 'react';
import { PageContainer, PageHeader } from '@/layouts/PageLayout';
import { JUDGE_QUEUE_SORT_BY, SORT_DIRECTION, type EvaluationRecordStatus } from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Archive, CheckCircle2, Clock, Inbox, Paperclip, RotateCcw } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
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
import { ALL, DEFAULT_PAGE_SIZE, PRODUCT_STATUS } from '../../constants/consts';
import { ADMIN_DASHBOARD_STATUS_LABEL, EVALUATION_STATUS } from '../../constants/product-status';
import { usePaginatedList } from '../../hooks/use-paginated-list';
import { formatDateTime } from '../../lib/admin-date';
import {
  parseJudgeQueueSearch,
  toJudgeQueueApiQuery,
  type JudgeQueueSearch,
} from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { displayProductCode } from '../../lib/print-format';
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

function productStatusDotClass(status: string): string {
  if (status === PRODUCT_STATUS.COMPLETED) return 'is-completed';
  if (status === PRODUCT_STATUS.SCORING || status === PRODUCT_STATUS.APPROVED) return 'is-scoring';
  return 'is-neutral';
}

export function JudgeQueuePage({
  search: controlledSearch,
  onSearchChange,
}: JudgeQueuePageProps = {}) {
  const {
    appliedSearch,
    applySearch,
    page: requestedPage,
    pageSize,
    setPage,
    setPageSize,
    sorting,
    setSorting,
  } = usePaginatedList<JudgeQueueSearch>({
    search: controlledSearch,
    onSearchChange,
    parseSearch: parseJudgeQueueSearch,
    defaultSearch: DEFAULT_SEARCH,
    defaultPageSize: DEFAULT_PAGE_SIZE,
    defaultSortBy: JUDGE_QUEUE_SORT_BY.UPDATED_AT,
    defaultSortDirection: SORT_DIRECTION.DESC,
  });

  const apiQuery = toJudgeQueueApiQuery(appliedSearch);
  const {
    data: queueResult,
    error: loadError,
    isPending: loading,
    isFetching,
    refetch,
  } = useJudgeQueue(apiQuery);
  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data ?? [];
  const error = errorText(loadError);

  const rows = queueResult?.data ?? [];
  const meta = queueResult?.meta;
  const counts = meta?.counts ?? {
    total: meta?.total ?? rows.length,
    open: 0,
    submitted: 0,
    excluded: 0,
  };
  const showExcludedCard =
    counts.excluded > 0 || appliedSearch.evaluationStatus === EVALUATION_STATUS.EXCLUDED;

  const [draftQ, setDraftQ] = useState(appliedSearch.q ?? '');
  const [draftCategoryId, setDraftCategoryId] = useState(appliedSearch.categoryId ?? '');

  useEffect(() => {
    setDraftQ(appliedSearch.q ?? '');
    setDraftCategoryId(appliedSearch.categoryId ?? '');
  }, [appliedSearch.q, appliedSearch.categoryId]);

  useEffect(() => {
    if (loading || !meta) return;
    const maxPage = Math.max(1, meta.totalPages);
    if (requestedPage > maxPage) {
      setPage(maxPage);
    }
  }, [loading, meta, requestedPage, setPage]);

  function selectStatus(evaluationStatus?: EvaluationRecordStatus) {
    applySearch({
      ...appliedSearch,
      page: 1,
      q: draftQ.trim() || undefined,
      categoryId: draftCategoryId || undefined,
      evaluationStatus,
    });
  }

  const columns = useMemo<DataTableColumnDef<QueueProduct>[]>(
    () => [
      {
        id: JUDGE_QUEUE_SORT_BY.NAME,
        accessorKey: 'name',
        header: 'Hồ sơ sản phẩm',
        meta: { isRowHeader: true },
        cell: ({ row }) => {
          const item = row.original;
          const updatedLabel = item.updatedAt
            ? formatDateTime(item.updatedAt, 'dd/MM/yyyy HH:mm')
            : '';
          return (
            <div className='min-w-[14rem]'>
              <Link
                to='/judge/products/$id'
                params={{ id: item.id }}
                className='judge-product-link'
              >
                {item.name}
              </Link>
              <div className='text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs'>
                <span className='whitespace-nowrap' title={item.id}>
                  {displayProductCode(item)}
                </span>
                {updatedLabel && (
                  <span className='whitespace-nowrap tabular-nums'>Cập nhật {updatedLabel}</span>
                )}
              </div>
              {item.description && (
                <p className='text-muted mt-1 line-clamp-2 text-xs'>{item.description}</p>
              )}
            </div>
          );
        },
      },
      {
        id: JUDGE_QUEUE_SORT_BY.CATEGORY,
        accessorFn: (row) => row.category.name,
        header: 'Danh mục sản phẩm',
        cell: ({ row }) => (
          <span className='judge-category-text' title={row.original.category.name}>
            {row.original.category.name}
          </span>
        ),
      },
      {
        id: JUDGE_QUEUE_SORT_BY.STATUS,
        accessorKey: 'status',
        header: 'Trạng thái hồ sơ',
        meta: { cellClassName: 'whitespace-nowrap' },
        cell: ({ row }) => (
          <span className='judge-product-status'>
            <span
              className={`judge-status-dot ${productStatusDotClass(row.original.status)}`}
              aria-hidden='true'
            />
            <span>{ADMIN_DASHBOARD_STATUS_LABEL[row.original.status]}</span>
          </span>
        ),
      },
      {
        id: JUDGE_QUEUE_SORT_BY.EVAL_STATUS,
        accessorFn: (row) => row.evaluations[0]?.status ?? EVALUATION_STATUS.IN_PROGRESS,
        header: 'Trạng thái phiếu chấm',
        meta: { cellClassName: 'whitespace-nowrap' },
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
              <span className='judge-eval-status-pill is-excluded'>
                <Archive className='size-3.5 shrink-0' aria-hidden='true' />
                <span>Đã gỡ khỏi hồ sơ</span>
              </span>
            );
          }
          return (
            <span className='judge-eval-status-pill is-open'>
              <Clock className='size-3.5 shrink-0' aria-hidden='true' />
              <span>Cần chấm</span>
            </span>
          );
        },
      },
      {
        id: JUDGE_QUEUE_SORT_BY.TOTAL_SCORE,
        accessorFn: (row) => row.evaluations[0]?.total ?? -1,
        header: 'Điểm phiếu',
        meta: {
          align: 'right',
          cellClassName: 'whitespace-nowrap tabular-nums',
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
        id: JUDGE_QUEUE_SORT_BY.ATTACHMENTS,
        accessorFn: (row) => row.attachmentCount ?? row.attachments.length,
        header: 'Đính kèm',
        meta: { align: 'right', cellClassName: 'whitespace-nowrap tabular-nums' },
        cell: ({ row }) => {
          const count = row.original.attachmentCount ?? row.original.attachments.length;
          return (
            <span className='judge-attachment-count'>
              <Paperclip className='size-3.5 shrink-0' aria-hidden='true' />
              <span>{count} tệp</span>
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Thao tác',
        enableSorting: false,
        meta: { align: 'right', cellClassName: 'whitespace-nowrap' },
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
        description='Danh sách hồ sơ sản phẩm được phân công chấm điểm cho hội đồng, ưu tiên hồ sơ cập nhật mới nhất.'
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
          aria-label='Lọc theo trạng thái phiếu chấm'
        >
          <button
            type='button'
            className='judge-summary-card'
            aria-pressed={!appliedSearch.evaluationStatus}
            onClick={() => selectStatus(undefined)}
          >
            <span className='judge-summary-label'>Tất cả hồ sơ</span>
            <strong>{counts.total}</strong>
          </button>
          <button
            type='button'
            className='judge-summary-card is-open-tone'
            aria-pressed={appliedSearch.evaluationStatus === EVALUATION_STATUS.IN_PROGRESS}
            onClick={() => selectStatus(EVALUATION_STATUS.IN_PROGRESS)}
          >
            <span className='judge-summary-label'>
              <span className='judge-status-dot is-scoring' aria-hidden='true' />
              <span>Cần chấm</span>
            </span>
            <strong>{counts.open}</strong>
          </button>
          <button
            type='button'
            className='judge-summary-card is-submitted-tone'
            aria-pressed={appliedSearch.evaluationStatus === EVALUATION_STATUS.SUBMITTED}
            onClick={() => selectStatus(EVALUATION_STATUS.SUBMITTED)}
          >
            <span className='judge-summary-label'>
              <span className='judge-status-dot is-completed' aria-hidden='true' />
              <span>Đã nộp phiếu</span>
            </span>
            <strong>{counts.submitted}</strong>
          </button>
          {showExcludedCard && (
            <button
              type='button'
              className='judge-summary-card is-excluded-tone'
              aria-pressed={appliedSearch.evaluationStatus === EVALUATION_STATUS.EXCLUDED}
              onClick={() => selectStatus(EVALUATION_STATUS.EXCLUDED)}
            >
              <span className='judge-summary-label'>
                <span className='judge-status-dot is-neutral' aria-hidden='true' />
                <span>Đã gỡ khỏi hồ sơ</span>
              </span>
              <strong>{counts.excluded}</strong>
            </button>
          )}
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
      {!loading && !error && rows.length === 0 && (
        <Card className='admin-table-region empty-card'>
          <Inbox className='empty-icon mx-auto' aria-hidden='true' />
          <h2 className='text-fg mb-1 text-lg font-semibold'>
            {hasActiveFilters ? 'Không có hồ sơ phù hợp bộ lọc' : 'Chưa có hồ sơ được phân công'}
          </h2>
          <p className='text-muted text-sm'>
            {hasActiveFilters
              ? 'Thử điều chỉnh từ khóa, danh mục hoặc chọn trạng thái khác.'
              : 'Các hồ sơ sẽ xuất hiện tại đây khi được nộp và phân công.'}
          </p>
        </Card>
      )}
      {!loading && !error && rows.length > 0 && (
        <div className='admin-table-region' role='region' aria-label='Bảng hàng chờ chấm điểm'>
          <DataTable
            columns={columns}
            data={rows}
            total={meta?.total ?? rows.length}
            page={meta?.page ?? requestedPage}
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
