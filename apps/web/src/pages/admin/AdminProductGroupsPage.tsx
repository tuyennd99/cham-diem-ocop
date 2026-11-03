import { useEffect, useMemo, useState } from 'react';
import type { AdminCategoryRecord } from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Eye, Pencil, Plus, Printer, RotateCcw } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ALL, DEFAULT_PAGE_SIZE } from '../../constants/consts';
import {
  parseAdminCatalogSearch,
  toAdminCategoryApiQuery,
  type AdminCatalogSearch,
} from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { hasStaffPermission } from '../../lib/session-contract';
import {
  useAdminCatalogMutations,
  useAdminCategories,
  useAdminCategoryDetail,
} from '../../queries/admin-catalogs';
import { CategoryEditorDialog } from './CategoryEditorDialog';

interface AdminProductGroupsPageProps {
  search?: AdminCatalogSearch;
  onSearchChange?: (next: AdminCatalogSearch) => void;
}

export function AdminProductGroupsPage({
  search: controlledSearch,
  onSearchChange,
}: AdminProductGroupsPageProps) {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const mutations = useAdminCatalogMutations();

  const [fallbackSearch, setFallbackSearch] = useState<AdminCatalogSearch>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const appliedSearch = controlledSearch ?? fallbackSearch;

  function applySearch(next: AdminCatalogSearch) {
    const normalized = parseAdminCatalogSearch(next as Record<string, unknown>);
    if (onSearchChange) {
      onSearchChange(normalized);
    } else {
      setFallbackSearch(normalized);
    }
  }

  const [searchText, setSearchText] = useState(appliedSearch.q ?? '');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(appliedSearch.isActive);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategoryRecord | null>(null);

  useEffect(() => {
    setSearchText(appliedSearch.q ?? '');
    setStatusFilter(appliedSearch.isActive);
  }, [appliedSearch.q, appliedSearch.isActive]);

  const categoryApiQuery = toAdminCategoryApiQuery(appliedSearch);

  const categoriesQuery = useAdminCategories(categoryApiQuery);
  const detailQuery = useAdminCategoryDetail(selectedCategoryId);

  const categories = categoriesQuery.data?.data ?? [];
  const categoryMeta = categoriesQuery.data?.meta;
  const selectedDetail = detailQuery.data?.data ?? null;
  const categoriesError = errorText(categoriesQuery.error);
  const detailError = errorText(detailQuery.error);

  const categoryColumns = useMemo<DataTableColumnDef<AdminCategoryRecord>[]>(
    () => [
      {
        accessorKey: 'order',
        header: 'STT',
        meta: {
          align: 'right',
          width: '4rem',
          cellClassName: 'text-muted tabular-nums',
        },
      },
      {
        accessorKey: 'name',
        header: 'Danh mục sản phẩm',
        meta: { isRowHeader: true, width: '30%', cellClassName: 'font-normal' },
        cell: ({ row }) => (
          <div className='text-fg min-w-[14rem] font-semibold leading-snug'>
            {row.original.name}
          </div>
        ),
      },
      {
        id: 'criteriaSet',
        header: 'Bộ tiêu chí & Điểm',
        meta: { cellClassName: 'whitespace-nowrap tabular-nums' },
        cell: ({ row }) => {
          const cat = row.original;
          return cat.criteriaSet ? (
            <span className='font-medium'>
              {cat.criteriaSet.maxScore} điểm ({cat.criteriaSet.criterionCount} tiêu chí)
            </span>
          ) : (
            <span className='text-muted text-xs'>Chưa nạp bộ tiêu chí</span>
          );
        },
      },
      {
        accessorKey: 'referenceCount',
        header: 'Hồ sơ đã nộp',
        meta: {
          align: 'left',
          cellClassName: 'whitespace-nowrap tabular-nums',
        },
        cell: ({ row }) => (
          <div>
            <span className='font-medium'>{row.original.referenceCount} hồ sơ</span>
            <span className='text-muted ml-1 text-xs'>
              ({row.original.submittedReferenceCount} đã nộp)
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'isActive',
        header: 'Trạng thái',
        meta: { cellClassName: 'whitespace-nowrap' },
        cell: ({ row }) => (
          <Badge
            variant={row.original.isActive ? 'default' : 'secondary'}
            className='whitespace-nowrap'
          >
            {row.original.isActive ? 'Đang mở đăng ký' : 'Ngừng mở đăng ký'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { align: 'right', width: '8.5rem', cellClassName: 'whitespace-nowrap' },
        cell: ({ row }) => {
          const cat = row.original;
          return (
            <div className='flex items-center justify-end gap-1.5'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type='button'
                    variant='secondary'
                    size='icon-sm'
                    aria-label={`Xem tiêu chí ${cat.name}`}
                    onClick={() => setSelectedCategoryId(cat.id)}
                  >
                    <Eye className='size-4' aria-hidden='true' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Xem tiêu chí</TooltipContent>
              </Tooltip>

              {cat.criteriaSet && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant='secondary' size='icon-sm'>
                      <Link
                        to='/print/criteria-sets/$id'
                        params={{ id: cat.criteriaSet.id }}
                        aria-label={`In mẫu trắng ${cat.name}`}
                      >
                        <Printer className='size-4' aria-hidden='true' />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>In mẫu trắng</TooltipContent>
                </Tooltip>
              )}

              {canManage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type='button'
                      variant='secondary'
                      size='icon-sm'
                      aria-label={`Sửa danh mục ${cat.name}`}
                      onClick={() => {
                        setCreateCategoryOpen(false);
                        setEditingCategory(cat);
                      }}
                    >
                      <Pencil className='size-4' aria-hidden='true' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sửa danh mục</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [canManage],
  );

  const hasActiveFilters = Boolean(appliedSearch.q || appliedSearch.isActive !== undefined);

  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div>
          <h1>Danh mục sản phẩm</h1>
          <p className='route-intro'>
            Quản lý danh mục sản phẩm ({categoryMeta?.total ?? categories.length} phân loại) gắn bộ
            tiêu chí đánh giá OCOP.
          </p>
        </div>
        <div className='admin-actions'>
          <Button
            type='button'
            variant='secondary'
            loading={categoriesQuery.isFetching}
            disabled={categoriesQuery.isFetching}
            onClick={() => void categoriesQuery.refetch()}
          >
            Tải lại
          </Button>
          {canManage && (
            <Button
              type='button'
              onClick={() => {
                setEditingCategory(null);
                setCreateCategoryOpen(true);
              }}
            >
              <Plus className='size-4' aria-hidden='true' />
              <span>Thêm danh mục sản phẩm</span>
            </Button>
          )}
        </div>
      </div>

      <form
        className='admin-filters'
        onSubmit={(event) => {
          event.preventDefault();
          applySearch({
            ...appliedSearch,
            page: 1,
            q: searchText.trim() || undefined,
            isActive: statusFilter,
          });
        }}
      >
        <FormField
          label='Tìm mã hoặc tên danh mục'
          htmlFor='catalog-search-q'
          className='admin-filter-field'
          data-filter-width='search'
        >
          <Input
            id='catalog-search-q'
            value={searchText}
            placeholder='Nhập tên hoặc mã danh mục…'
            onChange={(event) => setSearchText(event.target.value)}
          />
        </FormField>
        <FormField
          label='Trạng thái mở đăng ký'
          htmlFor='catalog-search-status'
          className='admin-filter-field'
          data-filter-width='status'
        >
          <Combobox
            value={statusFilter === undefined ? ALL : String(statusFilter)}
            onValueChange={(value) =>
              setStatusFilter(value === ALL ? undefined : value === 'true')
            }
          >
            <ComboboxAnchor>
              <ComboboxInput id='catalog-search-status' placeholder='Tất cả' />
              <ComboboxTrigger aria-label='Mở danh sách trạng thái mở đăng ký' />
            </ComboboxAnchor>
            <ComboboxContent>
              <ComboboxEmpty>Không tìm thấy trạng thái.</ComboboxEmpty>
              <ComboboxItem value={ALL}>Tất cả</ComboboxItem>
              <ComboboxItem value='true'>Đang mở đăng ký</ComboboxItem>
              <ComboboxItem value='false'>Ngừng mở đăng ký</ComboboxItem>
            </ComboboxContent>
          </Combobox>
        </FormField>
        <div className='admin-actions admin-filter-actions items-end'>
          <Button type='submit'>Áp dụng</Button>
          {hasActiveFilters && (
            <Button
              type='button'
              variant='secondary'
              onClick={() =>
                applySearch({
                  page: 1,
                  limit: appliedSearch.limit ?? DEFAULT_PAGE_SIZE,
                })
              }
            >
              <RotateCcw className='size-4' aria-hidden='true' />
              <span>Xóa bộ lọc</span>
            </Button>
          )}
        </div>
      </form>

      {categoriesError && (
        <AlertError title='Không thể tải dữ liệu danh mục' errors={[categoriesError]} />
      )}

      {categoriesQuery.isPending && <PageSpin />}
      {!categoriesQuery.isPending && categories.length === 0 && (
        <Card className='admin-table-region empty-card'>
          <h2>Chưa có danh mục phù hợp</h2>
        </Card>
      )}

      {!categoriesQuery.isPending && categories.length > 0 && (
        <div
          className='admin-table-region'
          role='region'
          aria-label='Bảng danh mục sản phẩm OCOP'
          tabIndex={0}
        >
          <DataTable
            columns={categoryColumns}
            data={categories}
            total={categoryMeta?.total ?? categories.length}
            page={categoryMeta?.page ?? appliedSearch.page ?? 1}
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

      <Dialog
        open={selectedCategoryId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCategoryId(null);
        }}
      >
        <DialogContent className='admin-dialog max-w-3xl' data-admin-ui='true'>
          <DialogHeader>
            <DialogTitle>
              {selectedDetail ? `Bộ tiêu chí: ${selectedDetail.name}` : 'Chi tiết bộ tiêu chí'}
            </DialogTitle>
            <DialogDescription>
              {selectedDetail
                ? `Mã danh mục: ${selectedDetail.id}`
                : 'Đang tải cấu trúc tiêu chí và điểm số của danh mục.'}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isPending && <PageSpin />}
          {detailError && (
            <div className='space-y-2'>
              <AlertError title='Không thể tải bộ tiêu chí' errors={[detailError]} />
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => void detailQuery.refetch()}
              >
                Thử lại
              </Button>
            </div>
          )}
          {selectedDetail && (
            <div className='grid gap-4'>
              <div className='admin-actions justify-between'>
                <p className='text-muted text-sm'>
                  {selectedDetail.criteriaSet
                    ? `Mã bộ phiếu: ${selectedDetail.criteriaSet.id} · Phiên bản v${selectedDetail.criteriaSet.version} · Nguồn: ${selectedDetail.criteriaSet.source ?? 'QĐ 26/2026/QĐ-TTg'} · ${selectedDetail.criteriaSet.criterionCount} tiêu chí · Tổng tối đa ${selectedDetail.criteriaSet.maxScore} điểm`
                    : 'Danh mục này chưa có bộ tiêu chí được nạp.'}
                </p>
                {selectedDetail.criteriaSet && (
                  <Button asChild size='sm'>
                    <Link
                      to='/print/criteria-sets/$id'
                      params={{ id: selectedDetail.criteriaSet.id }}
                    >
                      In mẫu trắng A4
                    </Link>
                  </Button>
                )}
              </div>

              {selectedDetail.criteriaSet?.criteria.map((criterion) => (
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

      <CategoryEditorDialog
        key={editingCategory?.id ?? (createCategoryOpen ? 'new-category' : 'closed-category')}
        open={createCategoryOpen || editingCategory !== null}
        category={editingCategory}
        onOpenChange={(open) => {
          if (open) return;
          setCreateCategoryOpen(false);
          setEditingCategory(null);
        }}
        onCreate={mutations.createCategory}
        onUpdate={mutations.updateCategory}
      />
    </section>
  );
}
