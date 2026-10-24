import { useEffect, useRef, useState } from 'react';
import type {
  AdminUserRecord,
  CreateAdminUserInput,
  OrganizationUnitRecord,
  StaffPermission,
  UpdateAdminUserProfileInput,
  UpdateAdminUserStatusInput,
} from '@ocop/shared';
import { useBlocker } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { staffAccessPayloadForForm, staffPermissionsForForm } from '../../lib/admin-user-form';
import { messageOf } from '../../lib/api-error';
import { getSession, validatePasswordBytes } from '../../lib/auth';
import type { UpdateAdminUserStaffAccessInput } from '../../types/admin';

export const STAFF_PERMISSION_LABELS: Record<StaffPermission, string> = {
  MANAGE: 'Quản lý',
  VIEW: 'Xem dữ liệu',
  SCORE: 'Chấm điểm',
};

interface UserEditorDialogProps {
  open: boolean;
  user: AdminUserRecord | null;
  units: OrganizationUnitRecord[];
  onOpenChange: (open: boolean) => void;
  onManageUnits?: () => void;
  onCreate: (input: CreateAdminUserInput) => Promise<unknown>;
  onUpdateProfile: (id: string, input: UpdateAdminUserProfileInput) => Promise<unknown>;
  onUpdateAccess: (id: string, input: UpdateAdminUserStaffAccessInput) => Promise<unknown>;
  onUpdateStatus: (id: string, input: UpdateAdminUserStatusInput) => Promise<unknown>;
  onResetPassword: (id: string, input: { password: string; reason: string }) => Promise<unknown>;
}

const emptyStaffForm = {
  email: '',
  fullName: '',
  phone: '',
  password: '',
  organizationUnitId: '',
  staffPermissions: [] as StaffPermission[],
  reason: '',
};

function samePermissionSet(a: StaffPermission[], b: StaffPermission[]): boolean {
  const normA = [...staffPermissionsForForm(a)].sort().join(',');
  const normB = [...staffPermissionsForForm(b)].sort().join(',');
  return normA === normB;
}

function formatPermissionsList(perms: StaffPermission[]): string {
  const normalized = staffPermissionsForForm(perms);
  if (normalized.length === 0) return 'Chưa cấp quyền';
  return normalized.map((p) => `${STAFF_PERMISSION_LABELS[p]} (${p})`).join(', ');
}

export function UserEditorDialog(props: UserEditorDialogProps) {
  const { open, user } = props;
  const isStaff = Boolean(user && user.role !== 'REGISTRANT');

  const [createForm, setCreateForm] = useState(emptyStaffForm);
  const [profileBaseline, setProfileBaseline] = useState(() => ({
    fullName: user?.fullName ?? '',
    phone: user?.phone ?? '',
  }));
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [profileReason, setProfileReason] = useState('');
  const [profileNotice, setProfileNotice] = useState('');

  const [accessBaseline, setAccessBaseline] = useState(() => ({
    permissions: staffPermissionsForForm(user?.staffPermissions ?? []),
    organizationUnitId: user?.organizationUnitId ?? '',
  }));
  const [permissions, setPermissions] = useState<StaffPermission[]>(
    staffPermissionsForForm(user?.staffPermissions ?? []),
  );
  const [organizationUnitId, setOrganizationUnitId] = useState(user?.organizationUnitId ?? '');
  const [accessReason, setAccessReason] = useState('');
  const [accessNotice, setAccessNotice] = useState('');

  const [statusBaseline, setStatusBaseline] = useState(user?.isActive ?? true);
  const [statusIsActive, setStatusIsActive] = useState(user?.isActive ?? true);
  const [statusReason, setStatusReason] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  const [password, setPassword] = useState('');
  const [passwordReason, setPasswordReason] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bypassBlockerRef = useRef(false);

  useEffect(() => {
    if (!open) setPassword('');
  }, [open]);

  const createDirty =
    open &&
    !user &&
    (createForm.email.trim().length > 0 ||
      createForm.fullName.trim().length > 0 ||
      createForm.phone.trim().length > 0 ||
      createForm.password.length > 0 ||
      createForm.organizationUnitId.length > 0 ||
      createForm.staffPermissions.length > 0 ||
      createForm.reason.trim().length > 0);

  const profileDirty =
    open &&
    Boolean(user) &&
    (fullName !== profileBaseline.fullName ||
      phone !== profileBaseline.phone ||
      profileReason.trim().length > 0);

  const accessDirty =
    open &&
    isStaff &&
    (!samePermissionSet(permissions, accessBaseline.permissions) ||
      organizationUnitId !== accessBaseline.organizationUnitId ||
      accessReason.trim().length > 0);

  const statusDirty =
    open &&
    Boolean(user) &&
    (statusIsActive !== statusBaseline || statusReason.trim().length > 0);

  const passwordDirty =
    open && Boolean(user) && (password.length > 0 || passwordReason.trim().length > 0);

  const dirty = createDirty || profileDirty || accessDirty || statusDirty || passwordDirty;

  useBlocker({
    shouldBlockFn: () =>
      !bypassBlockerRef.current &&
      getSession() !== null &&
      dirty &&
      !window.confirm('Biểu mẫu người dùng có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
    enableBeforeUnload: () => !bypassBlockerRef.current && getSession() !== null && dirty,
  });

  async function perform(action: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false;
    setError('');
    setBusy(true);
    try {
      await action();
      if (getSession() === null) {
        bypassBlockerRef.current = true;
      }
      return true;
    } catch (cause) {
      setError(messageOf(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen && busy) return;
    if (
      !nextOpen &&
      !bypassBlockerRef.current &&
      dirty &&
      !window.confirm('Biểu mẫu người dùng có thay đổi chưa lưu. Đóng hộp thoại và bỏ thay đổi?')
    ) {
      return;
    }
    if (!nextOpen) {
      setPassword('');
      setPasswordReason('');
      if (!user) setCreateForm(emptyStaffForm);
      setError('');
    }
    props.onOpenChange(nextOpen);
  }

  function handleManageUnitsClick() {
    if (busy) return;
    if (
      dirty &&
      !window.confirm(
        'Bạn đã nhập thông tin tài khoản. Bỏ nội dung đang nhập để chuyển sang Quản lý đơn vị?',
      )
    ) {
      return;
    }
    bypassBlockerRef.current = true;
    setCreateForm(emptyStaffForm);
    setPassword('');
    setError('');
    props.onOpenChange(false);
    props.onManageUnits?.();
    setTimeout(() => {
      bypassBlockerRef.current = false;
    }, 0);
  }

  function togglePermission(permission: StaffPermission, checked: boolean) {
    setPermissions((current) =>
      staffPermissionsForForm(
        checked ? [...current, permission] : current.filter((item) => item !== permission),
      ),
    );
  }

  const noActiveUnit = props.units.every((unit) => !unit.isActive);

  const content = user ? (
    <>
      <DialogHeader>
        <DialogTitle>Thông tin người dùng: {user.fullName}</DialogTitle>
        <DialogDescription>
          {user.email} · {user.role === 'REGISTRANT' ? 'Tài khoản chủ thể' : 'Tài khoản nội bộ'} ·{' '}
          {user.verified ? 'Đã xác thực' : 'Chưa xác thực'}
        </DialogDescription>
      </DialogHeader>
      {error && (
        <p className='form-note' role='alert'>
          {error}
        </p>
      )}
      <form
        className='admin-form account-form filter-card'
        onSubmit={(event) => {
          event.preventDefault();
          setProfileNotice('');
          void perform(async () => {
            await props.onUpdateProfile(user.id, {
              fullName,
              phone: phone || null,
              reason: profileReason,
            });
            setProfileBaseline({ fullName, phone });
            setProfileReason('');
            setProfileNotice('Đã lưu thông tin hồ sơ người dùng.');
          });
        }}
      >
        <h3>Hồ sơ</h3>
        <label>
          Email
          <Input value={user.email} readOnly disabled />
        </label>
        <label>
          Họ tên
          <Input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={255}
            required
          />
        </label>
        <label>
          Số điện thoại
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} />
        </label>
        <label>
          Lý do cập nhật hồ sơ
          <Input
            value={profileReason}
            onChange={(event) => setProfileReason(event.target.value)}
            maxLength={255}
            required
          />
        </label>
        {profileNotice && (
          <p className='form-message' role='status'>
            {profileNotice}
          </p>
        )}
        <div className='admin-actions'>
          <Button type='submit' variant='secondary' disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </Button>
        </div>
      </form>

      {isStaff && (
        <form
          className='admin-form account-form filter-card'
          onSubmit={(event) => {
            event.preventDefault();
            setAccessNotice('');
            const payload = staffAccessPayloadForForm({
              staffPermissions: permissions,
              organizationUnitId: organizationUnitId || null,
              reason: accessReason,
            });
            const beforeText = formatPermissionsList(accessBaseline.permissions);
            const afterText = formatPermissionsList(payload.staffPermissions);
            if (
              !window.confirm(
                `Xác nhận cập nhật quyền cho ${user.email}?\nTrước: ${beforeText}\nSau: ${afterText}`,
              )
            ) {
              return;
            }
            void perform(async () => {
              await props.onUpdateAccess(user.id, payload);
              setAccessBaseline({
                permissions: payload.staffPermissions,
                organizationUnitId: payload.organizationUnitId ?? '',
              });
              setAccessReason('');
              setAccessNotice('Đã lưu quyền và đơn vị công tác.');
            });
          }}
        >
          <h3>Quyền và đơn vị</h3>
          <p className='text-xs text-muted'>
            Quyền Quản lý (MANAGE) tự bao hàm Xem dữ liệu (VIEW), không tự bao hàm Chấm điểm
            (SCORE).
          </p>
          <div role='group' aria-label='Quyền nội bộ' className='grid gap-2'>
            {(['MANAGE', 'VIEW', 'SCORE'] as const).map((permission) => (
              <label key={permission} className='inline-flex items-center gap-2 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={permissions.includes(permission)}
                  disabled={busy || (permission === 'VIEW' && permissions.includes('MANAGE'))}
                  onChange={(event) => togglePermission(permission, event.target.checked)}
                />
                <span>
                  {STAFF_PERMISSION_LABELS[permission]} ({permission})
                  {permission === 'VIEW' && permissions.includes('MANAGE')
                    ? ' — được bao hàm bởi Quản lý'
                    : ''}
                </span>
              </label>
            ))}
          </div>
          <label>
            Đơn vị công tác
            <select
              value={organizationUnitId}
              onChange={(event) => setOrganizationUnitId(event.target.value)}
              disabled={busy}
            >
              <option value='' disabled={Boolean(user.organizationUnitId)}>
                Chưa gán đơn vị
              </option>
              {props.units.map((unit) => (
                <option key={unit.id} value={unit.id} disabled={!unit.isActive}>
                  {unit.name}
                  {unit.isActive ? '' : ' (ngừng nhận tài khoản mới)'}
                </option>
              ))}
              {user.organizationUnitId &&
                !props.units.some((unit) => unit.id === user.organizationUnitId) && (
                  <option value={user.organizationUnitId} disabled>
                    {user.organizationUnit?.name ?? 'Đơn vị hiện tại'} (đang được giữ trên tài
                    khoản)
                  </option>
                )}
            </select>
          </label>
          <label>
            Lý do thay đổi quyền/đơn vị
            <Input
              value={accessReason}
              onChange={(event) => setAccessReason(event.target.value)}
              maxLength={255}
              required
            />
          </label>
          {accessNotice && (
            <p className='form-message' role='status'>
              {accessNotice}
            </p>
          )}
          <div className='admin-actions'>
            <Button type='submit' variant='secondary' disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu quyền và đơn vị'}
            </Button>
          </div>
        </form>
      )}

      <form
        className='admin-form account-form filter-card'
        onSubmit={(event) => {
          event.preventDefault();
          setStatusNotice('');
          if (!statusIsActive && !window.confirm(`Khóa tài khoản ${user.email}?`)) return;
          void perform(async () => {
            const ok = await props.onUpdateStatus(user.id, {
              isActive: statusIsActive,
              reason: statusReason,
            });
            if (ok) {
              setStatusBaseline(statusIsActive);
              setStatusReason('');
              setStatusNotice('Đã lưu trạng thái hoạt động của tài khoản.');
            }
          });
        }}
      >
        <h3>Trạng thái</h3>
        <label className='inline-flex items-center gap-2 cursor-pointer'>
          <input
            type='checkbox'
            checked={statusIsActive}
            onChange={(event) => setStatusIsActive(event.target.checked)}
            disabled={busy}
          />
          <span>Đang hoạt động</span>
        </label>
        <label>
          Lý do thay đổi trạng thái
          <Input
            value={statusReason}
            onChange={(event) => setStatusReason(event.target.value)}
            maxLength={255}
            required
          />
        </label>
        {statusNotice && (
          <p className='form-message' role='status'>
            {statusNotice}
          </p>
        )}
        <div className='admin-actions'>
          <Button type='submit' variant='secondary' disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu trạng thái'}
          </Button>
        </div>
      </form>

      <form
        className='admin-form account-form filter-card'
        onSubmit={(event) => {
          event.preventDefault();
          setPasswordNotice('');
          if (!window.confirm(`Đặt lại mật khẩu cho ${user.email}?`)) return;
          void perform(async () => {
            validatePasswordBytes(password);
            await props.onResetPassword(user.id, { password, reason: passwordReason });
            setPassword('');
            setPasswordReason('');
            setPasswordNotice('Đã đặt lại mật khẩu tài khoản.');
          });
        }}
      >
        <h3>Đặt lại mật khẩu</h3>
        <label>
          Mật khẩu mới ({isStaff ? 'tối thiểu 12 ký tự' : 'tối thiểu 8 ký tự'})
          <Input
            type='password'
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={isStaff ? 12 : 8}
            maxLength={72}
            autoComplete='new-password'
            required
          />
        </label>
        <label>
          Lý do đặt lại mật khẩu
          <Input
            value={passwordReason}
            onChange={(event) => setPasswordReason(event.target.value)}
            maxLength={255}
            required
          />
        </label>
        {passwordNotice && (
          <p className='form-message' role='status'>
            {passwordNotice}
          </p>
        )}
        <div className='admin-actions'>
          <Button type='submit' variant='secondary' disabled={busy}>
            {busy ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
          </Button>
        </div>
      </form>
    </>
  ) : (
    <>
      <DialogHeader>
        <DialogTitle>Tạo tài khoản nội bộ</DialogTitle>
        <DialogDescription>Chọn đơn vị đang hoạt động và ít nhất một quyền.</DialogDescription>
      </DialogHeader>
      {error && (
        <p className='form-note' role='alert'>
          {error}
        </p>
      )}
      <form
        className='admin-form account-form'
        onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            if (!createForm.staffPermissions.length) throw new Error('Chọn ít nhất một quyền.');
            validatePasswordBytes(createForm.password);
            await props.onCreate({
              email: createForm.email,
              fullName: createForm.fullName,
              phone: createForm.phone || null,
              password: createForm.password,
              organizationUnitId: createForm.organizationUnitId,
              staffPermissions: staffPermissionsForForm(createForm.staffPermissions),
              reason: createForm.reason,
            });
            bypassBlockerRef.current = true;
            setCreateForm(emptyStaffForm);
            setPassword('');
            props.onOpenChange(false);
            setTimeout(() => {
              bypassBlockerRef.current = false;
            }, 0);
          });
        }}
      >
        <label>
          Email
          <Input
            type='email'
            value={createForm.email}
            onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
            maxLength={320}
            autoComplete='off'
            required
          />
        </label>
        <label>
          Họ tên
          <Input
            value={createForm.fullName}
            onChange={(event) => setCreateForm({ ...createForm, fullName: event.target.value })}
            maxLength={255}
            required
          />
        </label>
        <label>
          Số điện thoại
          <Input
            type='tel'
            value={createForm.phone}
            onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value })}
            maxLength={30}
          />
        </label>
        <label>
          Mật khẩu tạm thời (tối thiểu 12 ký tự)
          <Input
            type='password'
            value={createForm.password}
            onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
            minLength={12}
            maxLength={72}
            autoComplete='new-password'
            required
          />
        </label>
        <label>
          Đơn vị công tác
          <select
            value={createForm.organizationUnitId}
            onChange={(event) =>
              setCreateForm({ ...createForm, organizationUnitId: event.target.value })
            }
            required
          >
            <option value=''>Chọn đơn vị</option>
            {props.units
              .filter((unit) => unit.isActive)
              .map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
          </select>
        </label>
        <fieldset className='account-form'>
          <legend className='font-semibold text-sm'>Quyền nội bộ</legend>
          {(['MANAGE', 'VIEW', 'SCORE'] as const).map((permission) => (
            <label key={permission} className='inline-flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={createForm.staffPermissions.includes(permission)}
                disabled={
                  busy || (permission === 'VIEW' && createForm.staffPermissions.includes('MANAGE'))
                }
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    staffPermissions: staffPermissionsForForm(
                      event.target.checked
                        ? [...createForm.staffPermissions, permission]
                        : createForm.staffPermissions.filter((item) => item !== permission),
                    ),
                  })
                }
              />
              <span>
                {STAFF_PERMISSION_LABELS[permission]} ({permission})
                {permission === 'VIEW' && createForm.staffPermissions.includes('MANAGE')
                  ? ' — được bao hàm bởi Quản lý'
                  : ''}
              </span>
            </label>
          ))}
        </fieldset>
        <label>
          Lý do tạo tài khoản
          <Input
            value={createForm.reason}
            onChange={(event) => setCreateForm({ ...createForm, reason: event.target.value })}
            maxLength={255}
            required
          />
        </label>
        {noActiveUnit && (
          <div className='form-note' role='alert'>
            <p>Cần có đơn vị đang hoạt động trước khi tạo tài khoản nội bộ.</p>
            {props.onManageUnits && (
              <Button
                type='button'
                variant='secondary'
                size='sm'
                className='mt-2'
                onClick={handleManageUnitsClick}
              >
                Quản lý đơn vị
              </Button>
            )}
          </div>
        )}
        <div className='admin-actions'>
          <Button type='submit' disabled={busy || noActiveUnit}>
            {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
          </Button>
          <Button
            type='button'
            variant='secondary'
            disabled={busy}
            onClick={() => changeOpen(false)}
          >
            Đóng
          </Button>
        </div>
      </form>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className='admin-dialog max-h-[90vh] max-w-3xl overflow-y-auto'
        data-admin-ui='true'
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
