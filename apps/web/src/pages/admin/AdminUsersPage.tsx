import { useEffect, useState } from 'react';
import type {
  AdminUserRecord,
  OrganizationUnitQuery,
  StaffPermission,
} from '@ocop/shared';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_PAGE_SIZE } from '../../constants/consts';
import {
  parseAdminUsersSearch,
  toAdminUnitsApiQuery,
  toAdminUsersApiQuery,
  type AdminUsersSearch,
  type AdminUsersTab,
} from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import {
  useAdminUserMutations,
  useAdminUsers,
  useOrganizationUnits,
} from '../../queries/admin-users';
import { OrganizationUnitsPanel } from './OrganizationUnitsPanel';
import { STAFF_PERMISSION_LABELS, UserEditorDialog } from './UserEditorDialog';

const permissions: StaffPermission[] = ['MANAGE', 'VIEW', 'SCORE'];

interface AdminUsersPageProps {
  search?: AdminUsersSearch;
  onSearchChange?: (next: AdminUsersSearch) => void;
}

function UserRow({
  user,
  onEdit,
}: {
  user: AdminUserRecord;
  onEdit: (user: AdminUserRecord) => void;
}) {
  const unit =
    user.organizationUnitId === null
      ? 'Chưa gán đơn vị'
      : (user.organizationUnit?.name ?? 'Đơn vị hiện tại');
  return (
    <tr>
      <th scope='row'>
        <div className='font-semibold text-fg'>{user.fullName}</div>
        <div className='text-xs text-muted'>
          {user.email}
          {user.phone ? ` · ${user.phone}` : ''}
        </div>
      </th>
      <td>
        {user.role === 'REGISTRANT' ? (
          <span className='status-badge draft'>Chủ thể</span>
        ) : user.staffPermissions.length > 0 ? (
          <div className='flex flex-wrap gap-1'>
            {user.staffPermissions.map((permission) => (
              <span key={permission} className='cat-tag'>
                {STAFF_PERMISSION_LABELS[permission]}
              </span>
            ))}
          </div>
        ) : (
          <span className='text-xs text-muted'>Chưa cấp quyền</span>
        )}
      </td>
      <td>{unit}</td>
      <td>{user.verified ? 'Đã xác thực' : 'Chưa xác thực'}</td>
      <td>
        <span className={`status-badge ${user.isActive ? 'completed' : 'draft'}`}>
          {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
        </span>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Button type='button' variant='secondary' size='sm' onClick={() => onEdit(user)}>
          Sửa
        </Button>
      </td>
    </tr>
  );
}

export function AdminUsersPage({
  search: controlledSearch,
  onSearchChange,
}: AdminUsersPageProps) {
  const [fallbackSearch, setFallbackSearch] = useState<AdminUsersSearch>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const appliedSearch = controlledSearch ?? fallbackSearch;
  const selectedTab: AdminUsersTab = appliedSearch.tab ?? 'users';

  function applySearch(next: AdminUsersSearch) {
    const normalized = parseAdminUsersSearch(next as Record<string, unknown>);
    if (onSearchChange) {
      onSearchChange(normalized);
    } else {
      setFallbackSearch(normalized);
    }
  }

  const [draftFilters, setDraftFilters] = useState<AdminUsersSearch>(appliedSearch);
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      appliedSearch.permission ||
        appliedSearch.organizationUnitId ||
        appliedSearch.verified !== undefined,
    ),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);

  useEffect(() => {
    setDraftFilters(appliedSearch);
  }, [appliedSearch]);

  const usersApiQuery = toAdminUsersApiQuery(appliedSearch);
  const unitsApiQuery = toAdminUnitsApiQuery(appliedSearch);

  const mutations = useAdminUserMutations();
  const usersQuery = useAdminUsers(usersApiQuery);
  const unitsQuery = useOrganizationUnits({ page: 1, limit: 100 });

  const users = usersQuery.data?.data ?? [];
  const usersMeta = usersQuery.data?.meta;
  const units = unitsQuery.data?.data ?? [];
  const userError = errorText(usersQuery.error);
  const unitError = errorText(unitsQuery.error);

  function changeTab(value: string) {
    const nextTab: AdminUsersTab = value === 'units' ? 'units' : 'users';
    applySearch({
      page: 1,
      limit: appliedSearch.limit ?? DEFAULT_PAGE_SIZE,
      tab: nextTab,
    });
  }

  function handleUnitsQueryChange(nextUnitsQuery: OrganizationUnitQuery) {
    applySearch({
      tab: 'units',
      page: nextUnitsQuery.page ?? 1,
      limit: nextUnitsQuery.limit ?? DEFAULT_PAGE_SIZE,
      q: nextUnitsQuery.q,
      isActive: nextUnitsQuery.isActive,
    });
  }

  const activeFiltersCount = [
    appliedSearch.q,
    appliedSearch.kind,
    appliedSearch.isActive,
    appliedSearch.permission,
    appliedSearch.organizationUnitId,
    appliedSearch.verified,
  ].filter((val) => val !== undefined).length;

  const missingSelectedUnit =
    Boolean(draftFilters.organizationUnitId) &&
    !units.some((unit) => unit.id === draftFilters.organizationUnitId);

  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div>
          <h1>Người dùng &amp; đơn vị</h1>
          <p className='route-intro'>
            Quản lý tài khoản nội bộ, tài khoản chủ thể đăng ký và đơn vị công tác.
          </p>
        </div>
        {selectedTab === 'users' && (
          <div className='admin-actions'>
            <Button
              type='button'
              onClick={() => {
                setSelectedUser(null);
                setCreateOpen(true);
              }}
            >
              Tạo tài khoản nội bộ
            </Button>
          </div>
        )}
      </div>

      <Tabs value={selectedTab} onValueChange={changeTab}>
        <TabsList aria-label='Phân hệ quản lý người dùng và đơn vị'>
          <TabsTrigger value='users'>Người dùng</TabsTrigger>
          <TabsTrigger value='units'>Đơn vị</TabsTrigger>
        </TabsList>

        <TabsContent value='users'>
          <div className='admin-page'>
            <form
              className='admin-form filter-card admin-filter-panel'
              onSubmit={(event) => {
                event.preventDefault();
                applySearch({
                  ...draftFilters,
                  tab: 'users',
                  page: 1,
                });
              }}
            >
              <div className='admin-filters'>
                <label
                  className='admin-filter-field'
                  data-filter-width='search'
                  htmlFor='admin-users-q'
                >
                  Tìm họ tên, email hoặc số điện thoại
                  <Input
                    id='admin-users-q'
                    value={draftFilters.q ?? ''}
                    placeholder='Nhập tên, email hoặc điện thoại…'
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
                  data-filter-width='status'
                  htmlFor='admin-users-kind'
                >
                  Loại tài khoản
                  <select
                    id='admin-users-kind'
                    value={draftFilters.kind ?? ''}
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
                        kind: event.target.value
                          ? (event.target.value as 'STAFF' | 'REGISTRANT')
                          : undefined,
                      }))
                    }
                  >
                    <option value=''>Tất cả loại tài khoản</option>
                    <option value='STAFF'>Nội bộ (cán bộ / giám khảo)</option>
                    <option value='REGISTRANT'>Chủ thể sản xuất</option>
                  </select>
                </label>

                <label
                  className='admin-filter-field'
                  data-filter-width='status'
                  htmlFor='admin-users-status'
                >
                  Trạng thái hoạt động
                  <select
                    id='admin-users-status'
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
                    <option value=''>Tất cả trạng thái</option>
                    <option value='true'>Đang hoạt động</option>
                    <option value='false'>Đã khóa</option>
                  </select>
                </label>

                <div className='admin-actions admin-filter-actions'>
                  <Button type='submit'>Áp dụng</Button>
                  <Button
                    type='button'
                    variant='secondary'
                    aria-expanded={showAdvanced}
                    aria-controls='admin-users-advanced'
                    onClick={() => setShowAdvanced((open) => !open)}
                  >
                    <Filter className='size-4' aria-hidden='true' />
                    <span>Bộ lọc khác</span>
                    {activeFiltersCount > 0 && (
                      <span className='admin-filter-count'>{activeFiltersCount}</span>
                    )}
                  </Button>
                  {activeFiltersCount > 0 && (
                    <Button
                      type='button'
                      variant='secondary'
                      onClick={() =>
                        applySearch({
                          tab: 'users',
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
                    disabled={usersQuery.isFetching}
                    onClick={() => void usersQuery.refetch()}
                  >
                    Tải lại
                  </Button>
                </div>
              </div>

              <div
                id='admin-users-advanced'
                hidden={!showAdvanced}
                className='advanced-filter-grid'
              >
                <label htmlFor='admin-users-permission'>
                  Quyền nội bộ
                  <select
                    id='admin-users-permission'
                    value={draftFilters.permission ?? ''}
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
                        permission: event.target.value
                          ? (event.target.value as StaffPermission)
                          : undefined,
                      }))
                    }
                  >
                    <option value=''>Tất cả quyền</option>
                    {permissions.map((permission) => (
                      <option key={permission} value={permission}>
                        {STAFF_PERMISSION_LABELS[permission]} ({permission})
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor='admin-users-unit'>
                  Đơn vị công tác
                  <select
                    id='admin-users-unit'
                    value={draftFilters.organizationUnitId ?? ''}
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
                        organizationUnitId: event.target.value || undefined,
                      }))
                    }
                  >
                    <option value=''>Tất cả đơn vị</option>
                    {missingSelectedUnit && draftFilters.organizationUnitId && (
                      <option value={draftFilters.organizationUnitId}>
                        Mã đơn vị: {draftFilters.organizationUnitId}
                      </option>
                    )}
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                        {unit.isActive ? '' : ' (ngừng nhận tài khoản mới)'}
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor='admin-users-verified'>
                  Trạng thái xác thực
                  <select
                    id='admin-users-verified'
                    value={
                      draftFilters.verified === undefined ? '' : String(draftFilters.verified)
                    }
                    onChange={(event) =>
                      setDraftFilters((old) => ({
                        ...old,
                        verified:
                          event.target.value === ''
                            ? undefined
                            : event.target.value === 'true',
                      }))
                    }
                  >
                    <option value=''>Tất cả</option>
                    <option value='true'>Đã xác thực</option>
                    <option value='false'>Chưa xác thực</option>
                  </select>
                </label>
              </div>
            </form>

            {unitError && (
              <p className='form-note' role='alert'>
                Chưa tải được danh sách đơn vị: {unitError}
              </p>
            )}
            {userError && (
              <div className='form-note' role='alert'>
                <p>{userError}</p>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={usersQuery.isFetching}
                  onClick={() => void usersQuery.refetch()}
                >
                  Thử lại
                </Button>
              </div>
            )}

            {usersQuery.isPending && <p aria-live='polite'>Đang tải người dùng…</p>}
            {!usersQuery.isPending && !usersQuery.error && users.length === 0 && (
              <div className='admin-table-region empty-card'>
                <h2>Chưa có người dùng phù hợp</h2>
                <p className='text-sm text-muted'>
                  Thử điều chỉnh bộ lọc hoặc tạo tài khoản nội bộ mới.
                </p>
              </div>
            )}

            {!usersQuery.isPending && !usersQuery.error && users.length > 0 && (
              <div
                className='admin-table-region'
                role='region'
                aria-label='Bảng danh sách người dùng'
                tabIndex={0}
              >
                <table className='admin-data-table'>
                  <thead>
                    <tr>
                      <th scope='col'>Người dùng</th>
                      <th scope='col'>Loại / Quyền</th>
                      <th scope='col'>Đơn vị</th>
                      <th scope='col'>Xác thực</th>
                      <th scope='col'>Trạng thái</th>
                      <th scope='col' style={{ textAlign: 'right' }}>
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        onEdit={(item) => {
                          setCreateOpen(false);
                          setSelectedUser(item);
                        }}
                      />
                    ))}
                  </tbody>
                </table>

                <div className='table-footer'>
                  <div className='page-info'>
                    Hiển thị <strong>{users.length}</strong> /{' '}
                    <strong>{usersMeta?.total ?? users.length}</strong> người dùng
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
                      Trang {usersMeta?.page ?? appliedSearch.page ?? 1} /{' '}
                      {Math.max(1, usersMeta?.totalPages ?? 1)}
                    </span>
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      disabled={
                        (appliedSearch.page ?? 1) >= (usersMeta?.totalPages ?? 1)
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

        <TabsContent value='units'>
          <OrganizationUnitsPanel
            query={unitsApiQuery}
            onQueryChange={handleUnitsQueryChange}
            onCreate={mutations.createUnit}
            onUpdate={mutations.updateUnit}
          />
        </TabsContent>
      </Tabs>

      <UserEditorDialog
        key={selectedUser?.id ?? (createOpen ? 'new-user' : 'closed-user')}
        open={createOpen || selectedUser !== null}
        user={selectedUser}
        units={units}
        onOpenChange={(open) => {
          if (open) return;
          setCreateOpen(false);
          setSelectedUser(null);
        }}
        onManageUnits={() => changeTab('units')}
        onCreate={mutations.createUser}
        onUpdateProfile={mutations.updateProfile}
        onUpdateAccess={mutations.updateAccess}
        onUpdateStatus={mutations.updateStatus}
        onResetPassword={mutations.resetUserPassword}
      />
    </section>
  );
}
