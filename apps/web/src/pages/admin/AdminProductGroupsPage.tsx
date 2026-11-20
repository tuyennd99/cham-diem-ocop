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
import { ALL, DEFAULT_PAGE_SIZE, STAFF_PERMISSION } from '../../constants/consts';
import { usePaginatedList } from '../../hooks/use-paginated-list';
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
  useManagingAgencies,
} from '../../queries/admin-catalogs';
import { CategoryEditorDialog } from './CategoryEditorDialog';
import { CriteriaSetDetailView } from './CriteriaSetDetailView';

interface AdminProductGroupsPageProps {
  search?: AdminCatalogSearch;
  onSearchChange?: (next: AdminCatalogSearch) => void;
}

export function AdminProductGroupsPage({
  search: controlledSearch,
  onSearchChange,
}: AdminProductGroupsPageProps) {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, STAFF_PERMISSION.MANAGE);
  const mutations = useAdminCatalogMutations();

  const { appliedSearch, applySearch, sorting, setSorting } = usePaginatedList<AdminCatalogSearch>({
    search: controlledSearch,
    onSearchChange,
    parseSearch: parseAdminCatalogSearch,
    defaultSearch: {
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
    },
    defaultSortBy: 'order',
    defaultSortDirection: 'asc',
  });

  const [searchText, setSearchText] = useState(appliedSearch.q ?? '');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(appliedSearch.isActive);
  const [managingAgencyIdFilter, setManagingAgencyIdFilter] = useState<string | undefined>(
    appliedSearch.managingAgencyId,
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategoryRecord | null>(null);

  useEffect(() => {
    setSearchText(appliedSearch.q ?? '');
    setStatusFilter(appliedSearch.isActive);
    setManagingAgencyIdFilter(appliedSearch.managingAgencyId);
  }, [appliedSearch.q, appliedSearch.isActive, appliedSearch.managingAgencyId]);

  const categoryApiQuery = toAdminCategoryApiQuery(appliedSearch);

  const categoriesQuery = useAdminCategories(categoryApiQuery);
  const agenciesQuery = useManagingAgencies();
  const detailQuery = useAdminCategoryDetail(selectedCategoryId);
  const agencies = agenciesQuery.data ?? [];

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
          cellClassName: 'text-muted tabular-nums',
        },
      },
      {
        accessorKey: 'name',
        header: 'Danh mục sản phẩm',
        meta: { isRowHeader: true, cellClassName: 'font-normal' },
        cell: ({ row }) => (
          <div className='text-fg min-w-[14rem] leading-snug font-semibold'>
            {row.original.name}
          </div>
        ),
      },
      {
        id: 'managingAgencies',
        header: 'Cơ quan chủ trì',
        enableSorting: false,
        cell: ({ row }) => {
          const agencies = row.original.managingAgencies ?? [];
          if (!agencies.length) {
            return <span className='text-muted text-xs'>Chưa liên kết cơ quan</span>;
          }
          return (
            <div className='flex flex-wrap gap-1'>
              {agencies.map((agency) => (
                <Badge key={agency.id} variant='outline' title={agency.name}>
                  {agency.name}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: 'criteriaSet',
        accessorFn: (row) => row.criteriaSet?.maxScore ?? -1,
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
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const cat = row.original;
          return (
            <div className='admin-table-actions admin-table-actions--icons admin-table-actions--end min-w-24'>
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

  const hasActiveFilters = Boolean(
    appliedSearch.q || appliedSearch.isActive !== undefined || appliedSearch.managingAgencyId,
  );

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
            managingAgencyId: managingAgencyIdFilter,
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
            onValueChange={(value) => setStatusFilter(value === ALL ? undefined : value === 'true')}
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
        <FormField
          label='Cơ quan chủ trì'
          htmlFor='catalog-search-agency'
          className='admin-filter-field'
          data-filter-width='group'
        >
          <Combobox
            value={managingAgencyIdFilter ?? ALL}
            onValueChange={(value) => setManagingAgencyIdFilter(value === ALL ? undefined : value)}
          >
            <ComboboxAnchor>
              <ComboboxInput id='catalog-search-agency' placeholder='Tất cả' />
              <ComboboxTrigger aria-label='Mở danh sách cơ quan chủ trì' />
            </ComboboxAnchor>
            <ComboboxContent>
              <ComboboxEmpty>Không tìm thấy cơ quan chủ trì.</ComboboxEmpty>
              <ComboboxItem value={ALL}>Tất cả</ComboboxItem>
              {agencies.map((agency) => (
                <ComboboxItem key={agency.id} value={agency.id}>
                  {agency.name}
                </ComboboxItem>
              ))}
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
            paginated={false}
            enableSorting
            sorting={sorting}
            onSortingChange={setSorting}
            getRowId={(row) => row.id}
          />
        </div>
      )}

      <Dialog
        open={selectedCategoryId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCategoryId(null);
        }}
      >
        <DialogContent
          className='admin-dialog max-w-[min(64rem,calc(100vw-2rem))]'
          data-admin-ui='true'
        >
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

              {selectedDetail.criteriaSet && (
                <CriteriaSetDetailView
                  key={selectedDetail.criteriaSet.id}
                  criteria={selectedDetail.criteriaSet.criteria}
                />
              )}
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
