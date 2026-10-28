import { useEffect, useMemo, useState } from 'react';
import type { AdminCategoryRecord, LocalityQuery } from '@ocop/shared';
import { Link } from '@tanstack/react-router';
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
  parseAdminCatalogSearch,
  toAdminCategoryApiQuery,
  toAdminLocalityApiQuery,
  type AdminCatalogSearch,
  type AdminCatalogTab,
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
import { LocalitiesPanel } from './LocalitiesPanel';

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
  const selectedTab: AdminCatalogTab = appliedSearch.tab ?? 'catalog';

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
  const localityApiQuery = toAdminLocalityApiQuery(appliedSearch);

  const categoriesQuery = useAdminCategories(categoryApiQuery);
  const detailQuery = useAdminCategoryDetail(selectedCategoryId);

  const categories = categoriesQuery.data?.data ?? [];
  const categoryMeta = categoriesQuery.data?.meta;
  const selectedDetail = detailQuery.data?.data ?? null;
  const categoriesError = errorText(categoriesQuery.error);
  const detailError = errorText(detailQuery.error);

  const categoryColumns = useMemo<DataTableColumnDef<AdminCategoryRecord>[]>(
    () => [
      { accessorKey: 'order', header: 'STT', meta: { align: 'right', width: '5%' } },
      {
        accessorKey: 'name',
        header: 'Danh mục sản phẩm',
        meta: { isRowHeader: true, cellClassName: 'font-normal', width: '29%' },
        cell: ({ row }) => <div className='text-fg font-semibold'>{row.original.name}</div>,
      },
      {
        id: 'criteriaSet',
        header: 'Bộ tiêu chí & Điểm',
        meta: { width: '20%' },
        cell: ({ row }) => {
          const cat = row.original;
          return cat.criteriaSet ? (
            <div>
              <div className='font-medium'>
                {cat.criteriaSet.maxScore} điểm ({cat.criteriaSet.criterionCount} tiêu chí)
              </div>
              <div className='text-muted text-xs'>
                v{cat.criteriaSet.version} · {cat.criteriaSet.source ?? 'QĐ 26/2026/QĐ-TTg'}
              </div>
            </div>
          ) : (
            <span className='text-muted text-xs'>Chưa nạp bộ tiêu chí</span>
          );
        },
      },
      {
        accessorKey: 'referenceCount',
        header: 'Hồ sơ tham chiếu',
        meta: {
          width: '15%',
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) =>
          `${row.original.referenceCount} hồ sơ (${row.original.submittedReferenceCount} đã nộp)`,
      },
      {
        accessorKey: 'isActive',
        header: 'Trạng thái',
        meta: { width: '13%' },
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Đang mở đăng ký' : 'Ngừng mở đăng ký'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { align: 'right', width: '18%' },
        cell: ({ row }) => {
          const cat = row.original;
          return (
            <div className='admin-actions justify-end'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => setSelectedCategoryId(cat.id)}
              >
                Xem tiêu chí
              </Button>
              {cat.criteriaSet && (
                <Button asChild variant='secondary' size='sm'>
                  <Link to='/print/criteria-sets/$id' params={{ id: cat.criteriaSet.id }}>
                    In mẫu trắng
                  </Link>
                </Button>
              )}
              {canManage && (
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={() => {
                    setCreateCategoryOpen(false);
                    setEditingCategory(cat);
                  }}
                >
                  Sửa
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [canManage],
  );

  function changeTab(value: string) {
    const nextTab = (value === 'localities' ? value : 'catalog') as AdminCatalogTab;
    applySearch({
      page: 1,
      limit: appliedSearch.limit ?? DEFAULT_PAGE_SIZE,
      tab: nextTab,
    });
  }

  function handleLocalityQueryChange(nextLocalityQuery: LocalityQuery) {
    applySearch({
      tab: 'localities',
      page: nextLocalityQuery.page ?? 1,
      limit: nextLocalityQuery.limit ?? DEFAULT_PAGE_SIZE,
      q: nextLocalityQuery.q,
      isActive: nextLocalityQuery.isActive,
      type: nextLocalityQuery.type,
      provinceName: nextLocalityQuery.provinceName,
    });
  }

  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div>
          <h1>Danh mục sản phẩm &amp; địa bàn</h1>
          <p className='route-intro'>
            Quản lý danh mục sản phẩm gắn bộ tiêu chí và danh mục Xã/Phường.
          </p>
        </div>
        {canManage && selectedTab === 'catalog' && (
          <div className='admin-actions'>
            <Button
              type='button'
              onClick={() => {
                setEditingCategory(null);
                setCreateCategoryOpen(true);
              }}
            >
              Thêm danh mục sản phẩm
            </Button>
          </div>
        )}
      </div>

      <Tabs value={selectedTab} onValueChange={changeTab}>
        <TabsList aria-label='Phân hệ danh mục sản phẩm và địa bàn'>
          <TabsTrigger value='catalog'>Danh mục sản phẩm</TabsTrigger>
          <TabsTrigger value='localities'>Địa bàn</TabsTrigger>
        </TabsList>

        <TabsContent value='catalog'>
          <div className='admin-page'>
            <form
              className='admin-filters'
              onSubmit={(event) => {
                event.preventDefault();
                applySearch({
                  ...appliedSearch,
                  tab: 'catalog',
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
                <Select
                  value={statusFilter === undefined ? ALL : String(statusFilter)}
                  onValueChange={(value) =>
                    setStatusFilter(value === ALL ? undefined : value === 'true')
                  }
                >
                  <SelectTrigger id='catalog-search-status'>
                    <SelectValue placeholder='Tất cả' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Tất cả</SelectItem>
                    <SelectItem value='true'>Đang mở đăng ký</SelectItem>
                    <SelectItem value='false'>Ngừng mở đăng ký</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <div className='admin-actions admin-filter-actions items-end'>
                <Button type='submit'>Áp dụng</Button>
                <Button
                  type='button'
                  variant='secondary'
                  loading={categoriesQuery.isFetching}
                  disabled={categoriesQuery.isFetching}
                  onClick={() => void categoriesQuery.refetch()}
                >
                  Tải lại
                </Button>
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
                  tableClassName='min-w-[64rem]'
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
          </div>
        </TabsContent>

        <TabsContent value='localities'>
          <LocalitiesPanel
            canManage={canManage}
            query={localityApiQuery}
            onQueryChange={handleLocalityQueryChange}
            onCreate={mutations.createLocality}
            onUpdate={mutations.updateLocality}
          />
        </TabsContent>
      </Tabs>

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
