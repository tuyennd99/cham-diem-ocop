import { useEffect, useMemo, useState } from 'react';
import type { AdminUserRecord, OrganizationUnitQuery, StaffPermission } from '@ocop/shared';
import { Filter, RotateCcw } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ALL, DEFAULT_PAGE_SIZE } from '../../constants/consts';
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

export function AdminUsersPage({ search: controlledSearch, onSearchChange }: AdminUsersPageProps) {
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

  const userColumns = useMemo<DataTableColumnDef<AdminUserRecord>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Người dùng',
        meta: { isRowHeader: true, cellClassName: 'font-normal' },
        cell: ({ row }) => {
          const user = row.original;
          return (
            <>
              <div className='text-fg font-semibold'>{user.fullName}</div>
              <div className='text-muted text-xs'>
                {user.email}
                {user.phone ? ` · ${user.phone}` : ''}
              </div>
            </>
          );
        },
      },
      {
        id: 'access',
        header: 'Loại / Quyền',
        cell: ({ row }) => {
          const user = row.original;
          if (user.role === 'REGISTRANT') {
            return <Badge variant='secondary'>Người đăng ký</Badge>;
          }
          if (user.staffPermissions.length > 0) {
            return (
              <div className='flex flex-wrap gap-1'>
                {user.staffPermissions.map((permission) => (
                  <Badge key={permission} variant='outline'>
                    {STAFF_PERMISSION_LABELS[permission]}
                  </Badge>
                ))}
              </div>
            );
          }
          return <span className='text-muted text-xs'>Chưa cấp quyền</span>;
        },
      },
      {
        id: 'unit',
        header: 'Đơn vị',
        cell: ({ row }) => {
          const user = row.original;
          return user.organizationUnitId === null
            ? 'Chưa gán đơn vị'
            : (user.organizationUnit?.name ?? 'Đơn vị hiện tại');
        },
      },
      {
        accessorKey: 'verified',
        header: 'Xác thực',
        cell: ({ row }) => (row.original.verified ? 'Đã xác thực' : 'Chưa xác thực'),
      },
      {
        accessorKey: 'isActive',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Đang hoạt động' : 'Đã khóa'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={() => {
              setCreateOpen(false);
              setSelectedUser(row.original);
            }}
          >
            Sửa
          </Button>
        ),
      },
    ],
    [],
  );

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
            Quản lý tài khoản nội bộ, tài khoản người đăng ký và đơn vị công tác.
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
                <FormField
                  label='Tìm họ tên, email hoặc số điện thoại'
                  htmlFor='admin-users-q'
                  className='admin-filter-field'
                  data-filter-width='search'
                >
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
                </FormField>

                <FormField
                  label='Loại tài khoản'
                  htmlFor='admin-users-kind'
                  className='admin-filter-field'
                  data-filter-width='status'
                >
                  <Combobox
                    value={draftFilters.kind ?? ALL}
                    onValueChange={(value) =>
                      setDraftFilters((old) => ({
                        ...old,
                        kind: value === ALL ? undefined : (value as 'STAFF' | 'REGISTRANT'),
                      }))
                    }
                  >
                    <ComboboxAnchor>
                      <ComboboxInput id='admin-users-kind' placeholder='Tất cả loại tài khoản' />
                      <ComboboxTrigger aria-label='Mở danh sách loại tài khoản' />
                    </ComboboxAnchor>
                    <ComboboxContent>
                      <ComboboxEmpty>Không tìm thấy loại tài khoản.</ComboboxEmpty>
                      <ComboboxItem value={ALL}>Tất cả loại tài khoản</ComboboxItem>
                      <ComboboxItem value='STAFF'>Nội bộ (cán bộ / giám khảo)</ComboboxItem>
                      <ComboboxItem value='REGISTRANT'>Người đăng ký</ComboboxItem>
                    </ComboboxContent>
                  </Combobox>
                </FormField>

                <FormField
                  label='Trạng thái hoạt động'
                  htmlFor='admin-users-status'
                  className='admin-filter-field'
                  data-filter-width='status'
                >
                  <Combobox
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
                    <ComboboxAnchor>
                      <ComboboxInput id='admin-users-status' placeholder='Tất cả trạng thái' />
                      <ComboboxTrigger aria-label='Mở danh sách trạng thái hoạt động' />
                    </ComboboxAnchor>
                    <ComboboxContent>
                      <ComboboxEmpty>Không tìm thấy trạng thái.</ComboboxEmpty>
                      <ComboboxItem value={ALL}>Tất cả trạng thái</ComboboxItem>
                      <ComboboxItem value='true'>Đang hoạt động</ComboboxItem>
                      <ComboboxItem value='false'>Đã khóa</ComboboxItem>
                    </ComboboxContent>
                  </Combobox>
                </FormField>

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
                    loading={usersQuery.isFetching}
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
                <FormField label='Quyền nội bộ' htmlFor='admin-users-permission'>
                  <Combobox
                    value={draftFilters.permission ?? ALL}
                    onValueChange={(value) =>
                      setDraftFilters((old) => ({
                        ...old,
                        permission: value === ALL ? undefined : (value as StaffPermission),
                      }))
                    }
                  >
                    <ComboboxAnchor>
                      <ComboboxInput id='admin-users-permission' placeholder='Tất cả quyền' />
                      <ComboboxTrigger aria-label='Mở danh sách quyền nội bộ' />
                    </ComboboxAnchor>
                    <ComboboxContent>
                      <ComboboxEmpty>Không tìm thấy quyền phù hợp.</ComboboxEmpty>
                      <ComboboxItem value={ALL}>Tất cả quyền</ComboboxItem>
                      {permissions.map((permission) => (
                        <ComboboxItem key={permission} value={permission}>
                          {STAFF_PERMISSION_LABELS[permission]} ({permission})
                        </ComboboxItem>
                      ))}
                    </ComboboxContent>
                  </Combobox>
                </FormField>

                <FormField label='Đơn vị công tác' htmlFor='admin-users-unit'>
                  <Combobox
                    value={draftFilters.organizationUnitId ?? ALL}
                    onValueChange={(value) =>
                      setDraftFilters((old) => ({
                        ...old,
                        organizationUnitId: value === ALL ? undefined : value,
                      }))
                    }
                  >
                    <ComboboxAnchor>
                      <ComboboxInput id='admin-users-unit' placeholder='Tất cả đơn vị' />
                      <ComboboxTrigger aria-label='Mở danh sách đơn vị công tác' />
                    </ComboboxAnchor>
                    <ComboboxContent>
                      <ComboboxEmpty>Không tìm thấy đơn vị phù hợp.</ComboboxEmpty>
                      <ComboboxItem value={ALL}>Tất cả đơn vị</ComboboxItem>
                      {missingSelectedUnit && draftFilters.organizationUnitId && (
                        <ComboboxItem value={draftFilters.organizationUnitId}>
                          Mã đơn vị: {draftFilters.organizationUnitId}
                        </ComboboxItem>
                      )}
                      {units.map((unit) => (
                        <ComboboxItem key={unit.id} value={unit.id}>
                          {unit.name}
                          {unit.isActive ? '' : ' (ngừng nhận tài khoản mới)'}
                        </ComboboxItem>
                      ))}
                    </ComboboxContent>
                  </Combobox>
                </FormField>

                <FormField label='Trạng thái xác thực' htmlFor='admin-users-verified'>
                  <Combobox
                    value={
                      draftFilters.verified === undefined ? ALL : String(draftFilters.verified)
                    }
                    onValueChange={(value) =>
                      setDraftFilters((old) => ({
                        ...old,
                        verified: value === ALL ? undefined : value === 'true',
                      }))
                    }
                  >
                    <ComboboxAnchor>
                      <ComboboxInput id='admin-users-verified' placeholder='Tất cả' />
                      <ComboboxTrigger aria-label='Mở danh sách trạng thái xác thực' />
                    </ComboboxAnchor>
                    <ComboboxContent>
                      <ComboboxEmpty>Không tìm thấy trạng thái xác thực.</ComboboxEmpty>
                      <ComboboxItem value={ALL}>Tất cả</ComboboxItem>
                      <ComboboxItem value='true'>Đã xác thực</ComboboxItem>
                      <ComboboxItem value='false'>Chưa xác thực</ComboboxItem>
                    </ComboboxContent>
                  </Combobox>
                </FormField>
              </div>
            </form>

            {unitError && (
              <AlertError title='Chưa tải được danh sách đơn vị' errors={[unitError]} />
            )}
            {userError && (
              <div className='space-y-2'>
                <AlertError title='Không thể tải danh sách người dùng' errors={[userError]} />
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

            {usersQuery.isPending && <PageSpin />}
            {!usersQuery.isPending && !usersQuery.error && users.length === 0 && (
              <Card className='admin-table-region empty-card'>
                <h2>Chưa có người dùng phù hợp</h2>
                <p className='text-muted text-sm'>
                  Thử điều chỉnh bộ lọc hoặc tạo tài khoản nội bộ mới.
                </p>
              </Card>
            )}

            {!usersQuery.isPending && !usersQuery.error && users.length > 0 && (
              <div
                className='admin-table-region'
                role='region'
                aria-label='Bảng danh sách người dùng'
                tabIndex={0}
              >
                <DataTable
                  columns={userColumns}
                  data={users}
                  total={usersMeta?.total ?? users.length}
                  page={usersMeta?.page ?? appliedSearch.page ?? 1}
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
