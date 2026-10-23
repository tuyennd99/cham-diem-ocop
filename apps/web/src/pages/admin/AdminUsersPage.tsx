import { useEffect, useState } from 'react';
import type { AdminUserQuery, AdminUserRecord, StaffPermission } from '@ocop/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_PAGE_SIZE } from '../../constants/consts';
import { errorText } from '../../lib/api-error';
import {
  useAdminUserMutations,
  useAdminUsers,
  useOrganizationUnits,
} from '../../queries/admin-users';
import { Route } from '../../routes/_app.admin.users';
import { OrganizationUnitsPanel } from './OrganizationUnitsPanel';
import { UserEditorDialog } from './UserEditorDialog';

const permissions: StaffPermission[] = ['MANAGE', 'VIEW', 'SCORE'];

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
        {user.fullName}
        <br />
        <small>{user.email}</small>
      </th>
      <td>
        {user.role === 'REGISTRANT'
          ? 'Chủ thể'
          : user.staffPermissions.join(', ') || 'Chưa cấp quyền'}
      </td>
      <td>{unit}</td>
      <td>{user.verified ? 'Đã xác thực' : 'Chưa xác thực'}</td>
      <td>{user.isActive ? 'Đang hoạt động' : 'Đã khóa'}</td>
      <td>
        <Button type='button' variant='secondary' onClick={() => onEdit(user)}>
          Sửa
        </Button>
      </td>
    </tr>
  );
}

export function AdminUsersPage() {
  const routeSearch = Route.useSearch();
  const initialPermission = routeSearch.permission;
  const [filters, setFilters] = useState<AdminUserQuery>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    permission: initialPermission,
  });
  const [queryText, setQueryText] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const mutations = useAdminUserMutations();
  const usersQuery = useAdminUsers(filters);
  const unitsQuery = useOrganizationUnits({ page: 1, limit: 100 });
  const users = usersQuery.data?.data ?? [];
  const units = unitsQuery.data?.data ?? [];
  const userError = errorText(usersQuery.error);
  const unitError = errorText(unitsQuery.error);

  useEffect(() => {
    setFilters((current) => ({ ...current, page: 1, permission: initialPermission }));
  }, [initialPermission]);

  function updateFilter<K extends keyof AdminUserQuery>(key: K, value: AdminUserQuery[K]) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  return (
    <section className='admin-users-page'>
      <div className='section-heading'>
        <div>
          <p className='eyebrow'>QUẢN TRỊ</p>
          <h1>Người dùng</h1>
          <p className='section-intro'>Tài khoản nội bộ, chủ thể và đơn vị quản lý.</p>
        </div>
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

      <Tabs defaultValue='users'>
        <TabsList aria-label='Phân hệ quản trị'>
          <TabsTrigger value='users'>Người dùng</TabsTrigger>
          <TabsTrigger value='units'>Đơn vị</TabsTrigger>
        </TabsList>
        <TabsContent value='users'>
          <form
            className='admin-user-filters'
            onSubmit={(event) => {
              event.preventDefault();
              updateFilter('q', queryText.trim() || undefined);
            }}
          >
            <label>
              Tìm email, họ tên hoặc điện thoại
              <Input value={queryText} onChange={(event) => setQueryText(event.target.value)} />
            </label>
            <label>
              Loại tài khoản
              <select
                value={filters.kind ?? ''}
                onChange={(event) =>
                  updateFilter(
                    'kind',
                    event.target.value ? (event.target.value as 'STAFF' | 'REGISTRANT') : undefined,
                  )
                }
              >
                <option value=''>Tất cả</option>
                <option value='STAFF'>Nội bộ</option>
                <option value='REGISTRANT'>Chủ thể</option>
              </select>
            </label>
            <label>
              Quyền
              <select
                value={filters.permission ?? ''}
                onChange={(event) =>
                  updateFilter(
                    'permission',
                    event.target.value ? (event.target.value as StaffPermission) : undefined,
                  )
                }
              >
                <option value=''>Tất cả</option>
                {permissions.map((permission) => (
                  <option key={permission} value={permission}>
                    {permission}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Đơn vị
              <select
                value={filters.organizationUnitId ?? ''}
                onChange={(event) =>
                  updateFilter('organizationUnitId', event.target.value || undefined)
                }
              >
                <option value=''>Tất cả đơn vị</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                    {unit.isActive ? '' : ' (đã ngừng)'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select
                value={filters.isActive === undefined ? '' : String(filters.isActive)}
                onChange={(event) =>
                  updateFilter(
                    'isActive',
                    event.target.value === '' ? undefined : event.target.value === 'true',
                  )
                }
              >
                <option value=''>Tất cả</option>
                <option value='true'>Đang hoạt động</option>
                <option value='false'>Đã khóa</option>
              </select>
            </label>
            <label>
              Xác thực
              <select
                value={filters.verified === undefined ? '' : String(filters.verified)}
                onChange={(event) =>
                  updateFilter(
                    'verified',
                    event.target.value === '' ? undefined : event.target.value === 'true',
                  )
                }
              >
                <option value=''>Tất cả</option>
                <option value='true'>Đã xác thực</option>
                <option value='false'>Chưa xác thực</option>
              </select>
            </label>
            <Button type='submit' variant='secondary'>
              Tìm kiếm
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={usersQuery.isFetching}
              onClick={() => void usersQuery.refetch()}
            >
              Tải lại
            </Button>
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
            <div className='empty-state'>
              <h2>Chưa có người dùng phù hợp</h2>
              <p>Thử đổi bộ lọc hoặc tạo tài khoản nội bộ.</p>
            </div>
          )}
          {!usersQuery.isPending && !usersQuery.error && users.length > 0 && (
            <>
              <div className='table-wrap'>
                <table className='data-table'>
                  <thead>
                    <tr>
                      <th scope='col'>Người dùng</th>
                      <th scope='col'>Loại / quyền</th>
                      <th scope='col'>Đơn vị</th>
                      <th scope='col'>Xác thực</th>
                      <th scope='col'>Trạng thái</th>
                      <th scope='col'>Thao tác</th>
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
              </div>
              <div className='hero-actions'>
                <span>
                  {usersQuery.data?.meta?.total ?? users.length} người dùng · Trang{' '}
                  {filters.page ?? 1} / {usersQuery.data?.meta?.totalPages ?? 1}
                </span>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={(filters.page ?? 1) <= 1}
                  onClick={() =>
                    setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }))
                  }
                >
                  Trước
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={(filters.page ?? 1) >= (usersQuery.data?.meta?.totalPages ?? 1)}
                  onClick={() =>
                    setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))
                  }
                >
                  Sau
                </Button>
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value='units'>
          <OrganizationUnitsPanel onCreate={mutations.createUnit} onUpdate={mutations.updateUnit} />
        </TabsContent>
      </Tabs>

      <UserEditorDialog
        key={selectedUser?.id ?? 'new'}
        open={createOpen || selectedUser !== null}
        user={selectedUser}
        units={units}
        onOpenChange={(open) => {
          if (open) return;
          setCreateOpen(false);
          setSelectedUser(null);
        }}
        onCreate={mutations.createUser}
        onUpdateProfile={mutations.updateProfile}
        onUpdateAccess={mutations.updateAccess}
        onUpdateStatus={mutations.updateStatus}
        onResetPassword={mutations.resetUserPassword}
      />
    </section>
  );
}
