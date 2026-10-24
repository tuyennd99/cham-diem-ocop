import { useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AdminCategoryQuery,
  AdminCategoryRecord,
  ProductGroupRecord,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_PAGE_SIZE } from '../../constants/consts';
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

function GroupEditorCard({
  group,
  canManage,
  onUpdate,
}: {
  group: ProductGroupRecord;
  canManage: boolean;
  onUpdate: ReturnType<typeof useAdminCatalogMutations>['updateGroup'];
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [order, setOrder] = useState(String(group.order));
  const [isActive, setIsActive] = useState(group.isActive);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!canManage) {
    return (
      <article className='route-panel'>
        <h3>
          {group.code} · {group.name}
        </h3>
        <p>{group.description ?? 'Không có mô tả.'}</p>
        <p>
          Thứ tự: {group.order} · {group.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
        </p>
      </article>
    );
  }

  return (
    <form
      className='route-panel account-form'
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        void onUpdate(group.id, {
          name,
          description: description.trim() || null,
          order: Number(order),
          isActive,
          reason,
        })
          .then(
            () => setReason(''),
            (cause: unknown) => setError(messageOf(cause)),
          )
          .finally(() => setBusy(false));
      }}
    >
      <h3>
        {group.code} · {group.name}{' '}
        <small>· {group.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}</small>
      </h3>
      <label>
        Tên nhóm lớn
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={255}
          required
        />
      </label>
      <label>
        Mô tả
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        Thứ tự
        <Input
          type='number'
          min={0}
          step={1}
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          required
        />
      </label>
      <label>
        <input
          type='checkbox'
          checked={isActive}
          disabled={busy}
          onChange={(event) => setIsActive(event.target.checked)}
        />{' '}
        Đang sử dụng
      </label>
      <label>
        Lý do thay đổi
        <Input
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
      <Button type='submit' variant='secondary' disabled={busy}>
        {busy ? 'Đang lưu…' : 'Lưu nhóm sản phẩm'}
      </Button>
    </form>
  );
}

export function AdminProductGroupsPage() {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const mutations = useAdminCatalogMutations();

  const [categoryFilters, setCategoryFilters] = useState<AdminCategoryQuery>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const [searchText, setSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategoryRecord | null>(null);

  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupOrder, setNewGroupOrder] = useState('7');
  const [newGroupReason, setNewGroupReason] = useState('');
  const [newGroupError, setNewGroupError] = useState('');
  const [newGroupBusy, setNewGroupBusy] = useState(false);

  const groupsQuery = useAdminProductGroups({ page: 1, limit: 100 });
  const categoriesQuery = useAdminCategories(categoryFilters);
  const detailQuery = useAdminCategoryDetail(selectedCategoryId);

  const groups = groupsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const selectedDetail = detailQuery.data?.data ?? null;
  const groupsError = errorText(groupsQuery.error);
  const categoriesError = errorText(categoriesQuery.error);
  const detailError = errorText(detailQuery.error);

  function updateCategoryFilter<K extends keyof AdminCategoryQuery>(
    key: K,
    value: AdminCategoryQuery[K],
  ) {
    setCategoryFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newGroupBusy) return;
    setNewGroupBusy(true);
    setNewGroupError('');
    try {
      await mutations.createGroup({
        code: newGroupCode,
        name: newGroupName,
        description: newGroupDescription.trim() || null,
        order: Number(newGroupOrder),
        isActive: true,
        reason: newGroupReason,
      });
      setNewGroupCode('');
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupReason('');
    } catch (cause) {
      setNewGroupError(messageOf(cause));
    } finally {
      setNewGroupBusy(false);
    }
  }

  return (
    <section className='admin-users-page'>
      <div className='section-heading'>
        <div>
          <p className='eyebrow'>QUẢN TRỊ DANH MỤC</p>
          <h1>Nhóm sản phẩm &amp; Địa bàn</h1>
          <p className='section-intro'>
            Quản lý 6 nhóm lớn, 26 phân loại sản phẩm gắn bộ tiêu chí và danh mục Xã/Phường.
          </p>
        </div>
        {canManage && (
          <Button
            type='button'
            onClick={() => {
              setEditingCategory(null);
              setCreateCategoryOpen(true);
            }}
          >
            Thêm phân loại sản phẩm
          </Button>
        )}
      </div>

      <Tabs defaultValue='catalog'>
        <TabsList aria-label='Phân hệ danh mục sản phẩm và địa bàn'>
          <TabsTrigger value='catalog'>Nhóm &amp; Phân loại (26 bộ)</TabsTrigger>
          <TabsTrigger value='groups'>Quản lý Nhóm lớn</TabsTrigger>
          <TabsTrigger value='localities'>Địa bàn (Xã / Phường)</TabsTrigger>
        </TabsList>

        <TabsContent value='catalog'>
          <div className='catalog-split-layout'>
            <aside className='route-panel' aria-label='Cây nhóm sản phẩm'>
              <h2>Nhóm lớn ({groups.length})</h2>
              <div className='criteria-nav-group'>
                <button
                  type='button'
                  className={`criterion-nav-item${!categoryFilters.groupId ? ' is-current' : ''}`}
                  onClick={() => updateCategoryFilter('groupId', undefined)}
                >
                  <span className='criterion-nav-name'>Tất cả nhóm sản phẩm</span>
                </button>
                {groups.map((group) => (
                  <button
                    type='button'
                    key={group.id}
                    className={`criterion-nav-item${categoryFilters.groupId === group.id ? ' is-current' : ''}`}
                    onClick={() => updateCategoryFilter('groupId', group.id)}
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
            </aside>

            <div>
              <form
                className='admin-user-filters'
                onSubmit={(event) => {
                  event.preventDefault();
                  updateCategoryFilter('q', searchText.trim() || undefined);
                }}
              >
                <label>
                  Tìm mã hoặc tên phân loại
                  <Input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                  />
                </label>
                <label>
                  Trạng thái
                  <select
                    value={
                      categoryFilters.isActive === undefined
                        ? ''
                        : String(categoryFilters.isActive)
                    }
                    onChange={(event) =>
                      updateCategoryFilter(
                        'isActive',
                        event.target.value === ''
                          ? undefined
                          : event.target.value === 'true',
                      )
                    }
                  >
                    <option value=''>Tất cả</option>
                    <option value='true'>Đang sử dụng</option>
                    <option value='false'>Ngừng sử dụng</option>
                  </select>
                </label>
                <Button type='submit' variant='secondary'>
                  Tìm kiếm
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={categoriesQuery.isFetching}
                  onClick={() => void categoriesQuery.refetch()}
                >
                  Tải lại
                </Button>
              </form>

              {(groupsError || categoriesError) && (
                <p className='form-note' role='alert'>
                  {groupsError || categoriesError}
                </p>
              )}

              {categoriesQuery.isPending && <p>Đang tải danh mục phân loại…</p>}
              {!categoriesQuery.isPending && categories.length === 0 && (
                <div className='empty-state'>
                  <h2>Chưa có phân loại phù hợp</h2>
                </div>
              )}

              {!categoriesQuery.isPending && categories.length > 0 && (
                <>
                  <div className='table-wrap'>
                    <table className='data-table'>
                      <thead>
                        <tr>
                          <th scope='col'>Nhóm lớn</th>
                          <th scope='col'>Phân loại / Mã</th>
                          <th scope='col'>Mã bộ phiếu &amp; Nguồn</th>
                          <th scope='col'>Điểm tối đa</th>
                          <th scope='col'>Hồ sơ tham chiếu</th>
                          <th scope='col'>Trạng thái</th>
                          <th scope='col'>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((cat) => (
                          <tr key={cat.id}>
                            <td>
                              {cat.groupCode} · {cat.groupName}
                            </td>
                            <th scope='row'>
                              {cat.name}
                              <br />
                              <small>
                                <code>{cat.id}</code> · {cat.classificationGroup}
                                {cat.classificationSubgroup
                                  ? ` / ${cat.classificationSubgroup}`
                                  : ''}
                              </small>
                            </th>
                            <td>
                              {cat.criteriaSet ? (
                                <>
                                  <code>{cat.criteriaSet.id}</code> · v{cat.criteriaSet.version}
                                  <br />
                                  <small>{cat.criteriaSet.source ?? 'QĐ 26/2026/QĐ-TTg'}</small>
                                </>
                              ) : (
                                'Chưa nạp bộ phiếu'
                              )}
                            </td>
                            <td>
                              {cat.criteriaSet
                                ? `${cat.criteriaSet.maxScore} điểm (${cat.criteriaSet.criterionCount} tiêu chí)`
                                : '—'}
                            </td>
                            <td>
                              {cat.referenceCount} hồ sơ ({cat.submittedReferenceCount} đã nộp)
                            </td>
                            <td>{cat.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}</td>
                            <td>
                              <div className='hero-actions'>
                                <Button
                                  type='button'
                                  variant='secondary'
                                  onClick={() => setSelectedCategoryId(cat.id)}
                                >
                                  Xem tiêu chí
                                </Button>
                                {cat.criteriaSet && (
                                  <Link
                                    className='button button-secondary'
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
                  </div>
                  <div className='hero-actions'>
                    <span>
                      {categoriesQuery.data?.meta?.total ?? categories.length} phân loại · Trang{' '}
                      {categoryFilters.page ?? 1} /{' '}
                      {categoriesQuery.data?.meta?.totalPages ?? 1}
                    </span>
                    <Button
                      type='button'
                      variant='secondary'
                      disabled={(categoryFilters.page ?? 1) <= 1}
                      onClick={() =>
                        setCategoryFilters((current) => ({
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
                        (categoryFilters.page ?? 1) >=
                        (categoriesQuery.data?.meta?.totalPages ?? 1)
                      }
                      onClick={() =>
                        setCategoryFilters((current) => ({
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

              {selectedCategoryId && (
                <section className='route-panel' aria-label='Chi tiết bộ tiêu chí phân loại'>
                  {detailQuery.isPending && <p>Đang tải chi tiết bộ tiêu chí…</p>}
                  {detailError && (
                    <p className='form-note' role='alert'>
                      {detailError}
                    </p>
                  )}
                  {selectedDetail && (
                    <>
                      <div className='section-heading'>
                        <div>
                          <p className='eyebrow'>
                            {selectedDetail.groupCode} · {selectedDetail.groupName}
                          </p>
                          <h2>{selectedDetail.name}</h2>
                          <p>
                            {selectedDetail.criteriaSet
                              ? `Mã bộ phiếu: ${selectedDetail.criteriaSet.id} · Phiên bản v${selectedDetail.criteriaSet.version} · ${selectedDetail.criteriaSet.criterionCount} tiêu chí · Tổng tối đa ${selectedDetail.criteriaSet.maxScore} điểm`
                              : 'Phân loại này chưa có bộ tiêu chí được nạp.'}
                          </p>
                        </div>
                        <div className='hero-actions'>
                          {selectedDetail.criteriaSet && (
                            <Link
                              className='button button-primary'
                              to='/print/criteria-sets/$id'
                              params={{ id: selectedDetail.criteriaSet.id }}
                            >
                              In mẫu trắng A4
                            </Link>
                          )}
                          <Button
                            type='button'
                            variant='secondary'
                            onClick={() => setSelectedCategoryId(null)}
                          >
                            Đóng xem trước
                          </Button>
                        </div>
                      </div>
                      {selectedDetail.criteriaSet?.criteria.map((criterion) => (
                        <article className='score-card' key={criterion.id}>
                          <h3>
                            Phần {criterion.sectionCode} ({criterion.sectionName}) —{' '}
                            {criterion.code}. {criterion.name} (Tối đa {criterion.maxScore} điểm)
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
            </div>
          </div>
        </TabsContent>

        <TabsContent value='groups'>
          {canManage && (
            <section className='route-panel'>
              <h2>Thêm nhóm sản phẩm lớn</h2>
              <form className='account-form' onSubmit={(event) => void handleCreateGroup(event)}>
                <label>
                  Mã nhóm (bất biến)
                  <Input
                    value={newGroupCode}
                    onChange={(event) => setNewGroupCode(event.target.value)}
                    maxLength={50}
                    required
                  />
                </label>
                <label>
                  Tên nhóm sản phẩm
                  <Input
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    maxLength={255}
                    required
                  />
                </label>
                <label>
                  Mô tả
                  <Input
                    value={newGroupDescription}
                    onChange={(event) => setNewGroupDescription(event.target.value)}
                  />
                </label>
                <label>
                  Thứ tự
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    value={newGroupOrder}
                    onChange={(event) => setNewGroupOrder(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Lý do tạo nhóm
                  <Input
                    value={newGroupReason}
                    onChange={(event) => setNewGroupReason(event.target.value)}
                    maxLength={255}
                    required
                  />
                </label>
                {newGroupError && (
                  <p className='form-note' role='alert'>
                    {newGroupError}
                  </p>
                )}
                <Button type='submit' disabled={newGroupBusy}>
                  {newGroupBusy ? 'Đang tạo…' : 'Tạo nhóm sản phẩm'}
                </Button>
              </form>
            </section>
          )}
          <div className='record-list'>
            {groups.map((group) => (
              <GroupEditorCard
                key={group.id}
                group={group}
                canManage={canManage}
                onUpdate={mutations.updateGroup}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value='localities'>
          <LocalitiesPanel
            canManage={canManage}
            onCreate={mutations.createLocality}
            onUpdate={mutations.updateLocality}
          />
        </TabsContent>
      </Tabs>

      <CategoryEditorDialog
        key={editingCategory?.id ?? 'new-category'}
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
