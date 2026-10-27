import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AdminCategoryRecord,
  LocalityQuery,
  ProductGroupRecord,
} from '@ocop/shared';
import { Link, useBlocker } from '@tanstack/react-router';
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
  parseAdminCatalogSearch,
  toAdminCategoryApiQuery,
  toAdminLocalityApiQuery,
  type AdminCatalogSearch,
  type AdminCatalogTab,
} from '../../lib/admin-search';
import { errorText, messageOf } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { hasStaffPermission } from '../../lib/session-contract';
import {
  useAdminCatalogMutations,
  useAdminCategories,
  useAdminCategoryDetail,
  useAdminProductGroups,
} from '../../queries/admin-catalogs';
import { CategoryEditorDialog } from './CategoryEditorDialog';
import { LocalitiesPanel } from './LocalitiesPanel';

interface AdminProductGroupsPageProps {
  search?: AdminCatalogSearch;
  onSearchChange?: (next: AdminCatalogSearch) => void;
}

interface GroupFormDialogProps {
  open: boolean;
  group: ProductGroupRecord | null;
  defaultOrder: number;
  onOpenChange: (open: boolean) => void;
  onCreate: ReturnType<typeof useAdminCatalogMutations>['createGroup'];
  onUpdate: ReturnType<typeof useAdminCatalogMutations>['updateGroup'];
  onSaved: (message: string) => void;
}

function GroupFormDialog({
  open,
  group,
  defaultOrder,
  onOpenChange,
  onCreate,
  onUpdate,
  onSaved,
}: GroupFormDialogProps) {
  const isEdit = group !== null;
  const initialCode = group?.code ?? '';
  const initialName = group?.name ?? '';
  const initialDescription = group?.description ?? '';
  const initialOrder = String(group?.order ?? defaultOrder);
  const initialIsActive = group?.isActive ?? true;

  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [order, setOrder] = useState(initialOrder);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty =
    open &&
    (code !== initialCode ||
      name !== initialName ||
      description !== initialDescription ||
      order !== initialOrder ||
      isActive !== initialIsActive ||
      reason.trim().length > 0);

  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm('Biểu mẫu nhóm sản phẩm có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
    enableBeforeUnload: () => dirty,
  });

  function requestOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (busy) return;
    if (
      dirty &&
      !window.confirm('Biểu mẫu nhóm sản phẩm có thay đổi chưa lưu. Đóng hộp thoại và bỏ thay đổi?')
    ) {
      return;
    }
    onOpenChange(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (isEdit) {
        await onUpdate(group.id, {
          name,
          description: description.trim() || null,
          order: Number(order),
          isActive,
          reason,
        });
        onSaved(`Đã cập nhật nhóm lớn ${name}.`);
      } else {
        await onCreate({
          code,
          name,
          description: description.trim() || null,
          order: Number(order),
          isActive: true,
          reason,
        });
        onSaved(`Đã tạo nhóm lớn ${name}.`);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent className='admin-dialog' data-admin-ui='true'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Cập nhật nhóm lớn: ${group.name}` : 'Thêm nhóm sản phẩm lớn'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Mã nhóm cố định: ${group.code}.`
              : 'Nhóm lớn phân loại các ngành sản phẩm OCOP.'}
          </DialogDescription>
        </DialogHeader>
        <form className='admin-form account-form' onSubmit={(event) => void submit(event)}>
          {!isEdit && (
            <label htmlFor='group-code'>
              Mã nhóm (bất biến)
              <Input
                id='group-code'
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={50}
                required
              />
            </label>
          )}
          <label htmlFor='group-name'>
            Tên nhóm sản phẩm lớn
            <Input
              id='group-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
            />
          </label>
          <label htmlFor='group-description'>
            Mô tả (tùy chọn)
            <Input
              id='group-description'
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label htmlFor='group-order'>
            Thứ tự hiển thị
            <Input
              id='group-order'
              type='number'
              min={0}
              step={1}
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              required
            />
          </label>
          {isEdit && (
            <label className='inline-flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={isActive}
                disabled={busy}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span>Đang sử dụng</span>
            </label>
          )}
          <label htmlFor='group-reason'>
            Lý do {isEdit ? 'thay đổi' : 'tạo nhóm'}
            <Input
              id='group-reason'
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={255}
              required
            />
          </label>
          {error && (
            <p className='form-note' role='alert'>
              {error}
            </p>
          )}
          <div className='admin-actions'>
            <Button type='submit' disabled={busy}>
              {busy ? 'Đang lưu…' : isEdit ? 'Lưu nhóm sản phẩm' : 'Tạo nhóm sản phẩm'}
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={busy}
              onClick={() => requestOpenChange(false)}
            >
              Đóng
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
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
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProductGroupRecord | null>(null);
  const [groupNotice, setGroupNotice] = useState('');

  useEffect(() => {
    setSearchText(appliedSearch.q ?? '');
    setStatusFilter(appliedSearch.isActive);
  }, [appliedSearch.q, appliedSearch.isActive]);

  const categoryApiQuery = toAdminCategoryApiQuery(appliedSearch);
  const localityApiQuery = toAdminLocalityApiQuery(appliedSearch);

  const groupsQuery = useAdminProductGroups({ page: 1, limit: 100 });
  const categoriesQuery = useAdminCategories(categoryApiQuery);
  const detailQuery = useAdminCategoryDetail(selectedCategoryId);

  const groups = groupsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const categoryMeta = categoriesQuery.data?.meta;
  const selectedDetail = detailQuery.data?.data ?? null;
  const groupsError = errorText(groupsQuery.error);
  const categoriesError = errorText(categoriesQuery.error);
  const detailError = errorText(detailQuery.error);

  function changeTab(value: string) {
    const nextTab = (
      value === 'groups' || value === 'localities' ? value : 'catalog'
    ) as AdminCatalogTab;
    applySearch({
      page: 1,
      limit: appliedSearch.limit ?? DEFAULT_PAGE_SIZE,
      tab: nextTab,
    });
  }

  function updateCategoryGroup(groupId: string | undefined) {
    applySearch({
      ...appliedSearch,
      tab: 'catalog',
      page: 1,
      groupId,
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
          <h1>Nhóm sản phẩm &amp; địa bàn</h1>
          <p className='route-intro'>
            Quản lý phân loại sản phẩm gắn bộ tiêu chí, nhóm sản phẩm lớn và danh mục Xã/Phường.
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
              Thêm phân loại sản phẩm
            </Button>
          </div>
        )}
      </div>

      <Tabs value={selectedTab} onValueChange={changeTab}>
        <TabsList aria-label='Phân hệ danh mục sản phẩm và địa bàn'>
          <TabsTrigger value='catalog'>Phân loại sản phẩm</TabsTrigger>
          <TabsTrigger value='groups'>Nhóm lớn</TabsTrigger>
          <TabsTrigger value='localities'>Địa bàn</TabsTrigger>
        </TabsList>

        <TabsContent value='catalog'>
          <div className='admin-catalog-layout'>
            <aside className='admin-catalog-sidebar' aria-label='Cây nhóm sản phẩm'>
              <div className='admin-catalog-mobile-group'>
                <label htmlFor='catalog-mobile-group-select'>
                  Nhóm sản phẩm lớn
                  <select
                    id='catalog-mobile-group-select'
                    value={appliedSearch.groupId ?? ''}
                    onChange={(event) => updateCategoryGroup(event.target.value || undefined)}
                  >
                    <option value=''>Tất cả nhóm sản phẩm</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.code} · {group.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className='admin-catalog-desktop-tree admin-table-region p-4'>
                <h2 className='mb-3'>Nhóm lớn</h2>
                <div className='criteria-nav-group'>
                  <button
                    type='button'
                    className={`criterion-nav-item${!appliedSearch.groupId ? ' is-current' : ''}`}
                    onClick={() => updateCategoryGroup(undefined)}
                  >
                    <span className='criterion-nav-name'>Tất cả nhóm sản phẩm</span>
                  </button>
                  {groups.map((group) => (
                    <button
                      type='button'
                      key={group.id}
                      className={`criterion-nav-item${appliedSearch.groupId === group.id ? ' is-current' : ''}`}
                      onClick={() => updateCategoryGroup(group.id)}
                    >
                      <span className='criterion-nav-name'>
                        {group.code} · {group.name}
                      </span>
                      <span className='criterion-nav-meta'>
                        <span>{group.isActive ? 'Đang dùng' : 'Đã ngừng'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

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
                <label
                  className='admin-filter-field'
                  data-filter-width='search'
                  htmlFor='catalog-search-q'
                >
                  Tìm mã hoặc tên phân loại
                  <Input
                    id='catalog-search-q'
                    value={searchText}
                    placeholder='Nhập tên hoặc mã phân loại…'
                    onChange={(event) => setSearchText(event.target.value)}
                  />
                </label>
                <label
                  className='admin-filter-field'
                  data-filter-width='status'
                  htmlFor='catalog-search-status'
                >
                  Trạng thái mở đăng ký
                  <select
                    id='catalog-search-status'
                    value={statusFilter === undefined ? '' : String(statusFilter)}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value === ''
                          ? undefined
                          : event.target.value === 'true',
                      )
                    }
                  >
                    <option value=''>Tất cả</option>
                    <option value='true'>Đang mở đăng ký</option>
                    <option value='false'>Ngừng mở đăng ký</option>
                  </select>
                </label>
                <div className='admin-actions admin-filter-actions items-end'>
                  <Button type='submit'>Áp dụng</Button>
                  <Button
                    type='button'
                    variant='secondary'
                    disabled={categoriesQuery.isFetching}
                    onClick={() => void categoriesQuery.refetch()}
                  >
                    Tải lại
                  </Button>
                </div>
              </form>

              {(groupsError || categoriesError) && (
                <p className='form-note' role='alert'>
                  {groupsError || categoriesError}
                </p>
              )}

              {categoriesQuery.isPending && <p>Đang tải danh mục phân loại…</p>}
              {!categoriesQuery.isPending && categories.length === 0 && (
                <div className='admin-table-region empty-card'>
                  <h2>Chưa có phân loại phù hợp</h2>
                </div>
              )}

              {!categoriesQuery.isPending && categories.length > 0 && (
                <div
                  className='admin-table-region'
                  role='region'
                  aria-label='Bảng phân loại sản phẩm OCOP'
                  tabIndex={0}
                >
                  <table className='admin-data-table'>
                    <thead>
                      <tr>
                        <th scope='col'>Phân loại sản phẩm</th>
                        <th scope='col'>Nhóm lớn</th>
                        <th scope='col'>Bộ tiêu chí &amp; Điểm</th>
                        <th scope='col' style={{ textAlign: 'right' }}>
                          Hồ sơ tham chiếu
                        </th>
                        <th scope='col'>Trạng thái</th>
                        <th scope='col' style={{ textAlign: 'right' }}>
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr key={cat.id}>
                          <th scope='row'>
                            <div className='font-semibold text-fg'>{cat.name}</div>
                            <div className='text-xs text-muted mt-0.5'>
                              {cat.classificationGroup}
                              {cat.classificationSubgroup
                                ? ` / ${cat.classificationSubgroup}`
                                : ''}
                            </div>
                          </th>
                          <td>
                            {cat.groupCode} · {cat.groupName}
                          </td>
                          <td>
                            {cat.criteriaSet ? (
                              <div>
                                <div className='font-medium'>
                                  {cat.criteriaSet.maxScore} điểm ({cat.criteriaSet.criterionCount}{' '}
                                  tiêu chí)
                                </div>
                                <div className='text-xs text-muted'>
                                  v{cat.criteriaSet.version} ·{' '}
                                  {cat.criteriaSet.source ?? 'QĐ 26/2026/QĐ-TTg'}
                                </div>
                              </div>
                            ) : (
                              <span className='text-xs text-muted'>Chưa nạp bộ tiêu chí</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {cat.referenceCount} hồ sơ ({cat.submittedReferenceCount} đã nộp)
                          </td>
                          <td>
                            <span
                              className={`status-badge ${cat.isActive ? 'completed' : 'draft'}`}
                            >
                              {cat.isActive ? 'Đang mở đăng ký' : 'Ngừng mở đăng ký'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
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
                                <Link
                                  className='button button-secondary button-sm'
                                  to='/print/criteria-sets/$id'
                                  params={{ id: cat.criteriaSet.id }}
                                >
                                  In mẫu trắng
                                </Link>
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className='table-footer'>
                    <div className='page-info'>
                      Hiển thị <strong>{categories.length}</strong> /{' '}
                      <strong>{categoryMeta?.total ?? categories.length}</strong> phân loại
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
                        Trang {categoryMeta?.page ?? appliedSearch.page ?? 1} /{' '}
                        {Math.max(1, categoryMeta?.totalPages ?? 1)}
                      </span>
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        disabled={
                          (appliedSearch.page ?? 1) >= (categoryMeta?.totalPages ?? 1)
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
          </div>
        </TabsContent>

        <TabsContent value='groups'>
          <div className='admin-page'>
            <div className='admin-page-heading'>
              <div>
                <h2>Danh mục nhóm sản phẩm lớn</h2>
                <p className='route-intro'>
                  {groups.length} nhóm sản phẩm lớn trong hệ thống.
                </p>
              </div>
              {canManage && (
                <div className='admin-actions'>
                  <Button
                    type='button'
                    onClick={() => {
                      setEditingGroup(null);
                      setCreateGroupOpen(true);
                    }}
                  >
                    Thêm nhóm sản phẩm lớn
                  </Button>
                </div>
              )}
            </div>

            {groupNotice && (
              <p className='form-message' role='status'>
                {groupNotice}
              </p>
            )}

            <div
              className='admin-table-region'
              role='region'
              aria-label='Bảng nhóm sản phẩm lớn'
              tabIndex={0}
            >
              <table className='admin-data-table'>
                <thead>
                  <tr>
                    <th scope='col'>Mã nhóm</th>
                    <th scope='col'>Tên nhóm sản phẩm lớn</th>
                    <th scope='col'>Mô tả</th>
                    <th scope='col' style={{ textAlign: 'right' }}>
                      Thứ tự
                    </th>
                    <th scope='col'>Trạng thái</th>
                    {canManage && (
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Thao tác
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.id}>
                      <td className='font-mono text-xs'>{group.code}</td>
                      <th scope='row' className='font-semibold'>
                        {group.name}
                      </th>
                      <td className='text-sm text-muted'>
                        {group.description ?? 'Không có mô tả.'}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {group.order}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${group.isActive ? 'completed' : 'draft'}`}
                        >
                          {group.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            type='button'
                            variant='secondary'
                            size='sm'
                            onClick={() => {
                              setCreateGroupOpen(false);
                              setEditingGroup(group);
                            }}
                          >
                            Sửa
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canManage && (
              <GroupFormDialog
                key={editingGroup?.id ?? (createGroupOpen ? 'create-group' : 'closed-group')}
                open={createGroupOpen || editingGroup !== null}
                group={editingGroup}
                defaultOrder={groups.length + 1}
                onOpenChange={(open) => {
                  if (open) return;
                  setCreateGroupOpen(false);
                  setEditingGroup(null);
                }}
                onCreate={mutations.createGroup}
                onUpdate={mutations.updateGroup}
                onSaved={(msg) => setGroupNotice(msg)}
              />
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
                ? `Mã phân loại: ${selectedDetail.id} · Nhóm: ${selectedDetail.groupCode} · ${selectedDetail.groupName}`
                : 'Đang tải cấu trúc tiêu chí và điểm số của phân loại.'}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isPending && <p>Đang tải chi tiết bộ tiêu chí…</p>}
          {detailError && (
            <div className='form-note' role='alert'>
              <p>{detailError}</p>
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
                <p className='text-sm text-muted'>
                  {selectedDetail.criteriaSet
                    ? `Mã bộ phiếu: ${selectedDetail.criteriaSet.id} · Phiên bản v${selectedDetail.criteriaSet.version} · Nguồn: ${selectedDetail.criteriaSet.source ?? 'QĐ 26/2026/QĐ-TTg'} · ${selectedDetail.criteriaSet.criterionCount} tiêu chí · Tổng tối đa ${selectedDetail.criteriaSet.maxScore} điểm`
                    : 'Phân loại này chưa có bộ tiêu chí được nạp.'}
                </p>
                {selectedDetail.criteriaSet && (
                  <Link
                    className='button button-primary button-sm'
                    to='/print/criteria-sets/$id'
                    params={{ id: selectedDetail.criteriaSet.id }}
                  >
                    In mẫu trắng A4
                  </Link>
                )}
              </div>

              {selectedDetail.criteriaSet?.criteria.map((criterion) => (
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

      <CategoryEditorDialog
        key={editingCategory?.id ?? (createCategoryOpen ? 'new-category' : 'closed-category')}
        open={createCategoryOpen || editingCategory !== null}
        category={editingCategory}
        groups={groups}
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
