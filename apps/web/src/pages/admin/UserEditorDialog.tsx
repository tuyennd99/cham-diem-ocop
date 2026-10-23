import { useEffect, useState } from 'react';
import type {
  AdminUserRecord,
  CreateAdminUserInput,
  OrganizationUnitRecord,
  StaffPermission,
  UpdateAdminUserProfileInput,
  UpdateAdminUserStatusInput,
} from '@ocop/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { staffPermissionsForForm } from '../../lib/admin-user-form';
import { messageOf } from '../../lib/api-error';
import { validatePasswordBytes } from '../../lib/auth';
import type { UpdateAdminUserStaffAccessInput } from '../../types/admin';

interface UserEditorDialogProps {
  open: boolean;
  user: AdminUserRecord | null;
  units: OrganizationUnitRecord[];
  onOpenChange: (open: boolean) => void;
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

export function UserEditorDialog(props: UserEditorDialogProps) {
  const { open, user } = props;
  const isStaff = Boolean(user && user.role !== 'REGISTRANT');
  const [createForm, setCreateForm] = useState(emptyStaffForm);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [profileReason, setProfileReason] = useState('');
  const [permissions, setPermissions] = useState<StaffPermission[]>(
    staffPermissionsForForm(user?.staffPermissions ?? []),
  );
  const [organizationUnitId, setOrganizationUnitId] = useState(user?.organizationUnitId ?? '');
  const [accessReason, setAccessReason] = useState('');
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [statusReason, setStatusReason] = useState('');
  const [password, setPassword] = useState('');
  const [passwordReason, setPasswordReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setPassword('');
  }, [open]);

  async function perform(action: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false;
    setError('');
    setBusy(true);
    try {
      await action();
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
    if (!nextOpen) {
      setPassword('');
      setPasswordReason('');
      if (!user) setCreateForm(emptyStaffForm);
      setError('');
    }
    props.onOpenChange(nextOpen);
  }

  function togglePermission(permission: StaffPermission, checked: boolean) {
    setPermissions((current) =>
      staffPermissionsForForm(
        checked ? [...current, permission] : current.filter((item) => item !== permission),
      ),
    );
  }

  const content = user ? (
    <>
      <DialogHeader>
        <DialogTitle>Thông tin người dùng</DialogTitle>
        <DialogDescription>
          {user.email} · {user.verified ? 'Đã xác thực' : 'Chưa xác thực'}
        </DialogDescription>
      </DialogHeader>
      {error && (
        <p className='form-note' role='alert'>
          {error}
        </p>
      )}
      <form
        className='account-form route-panel'
        onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            await props.onUpdateProfile(user.id, {
              fullName,
              phone: phone || null,
              reason: profileReason,
            });
            setProfileReason('');
          });
        }}
      >
        <h3>Hồ sơ</h3>
        <label>
          Email
          <Input value={user.email} readOnly />
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
          Lý do cập nhật
          <Input
            value={profileReason}
            onChange={(event) => setProfileReason(event.target.value)}
            maxLength={255}
            required
          />
        </label>
        <Button type='submit' variant='secondary' disabled={busy}>
          Lưu hồ sơ
        </Button>
      </form>
      {isStaff && (
        <form
          className='account-form route-panel'
          onSubmit={(event) => {
            event.preventDefault();
            void perform(() =>
              props.onUpdateAccess(user.id, {
                staffPermissions: staffPermissionsForForm(permissions),
                organizationUnitId: organizationUnitId || null,
                isActive,
                reason: accessReason,
              }),
            );
          }}
        >
          <h3>Quyền và đơn vị</h3>
          <div role='group' aria-label='Quyền nội bộ' className='account-form'>
            {(['MANAGE', 'VIEW', 'SCORE'] as const).map((permission) => (
              <label key={permission}>
                <input
                  type='checkbox'
                  checked={permissions.includes(permission)}
                  disabled={busy || (permission === 'VIEW' && permissions.includes('MANAGE'))}
                  onChange={(event) => togglePermission(permission, event.target.checked)}
                />{' '}
                {permission === 'VIEW' && permissions.includes('MANAGE')
                  ? 'VIEW (được bao hàm bởi MANAGE)'
                  : permission}
              </label>
            ))}
          </div>
          <label>
            Đơn vị
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
          <Button type='submit' variant='secondary' disabled={busy}>
            Lưu quyền và đơn vị
          </Button>
        </form>
      )}
      <form
        className='account-form route-panel'
        onSubmit={(event) => {
          event.preventDefault();
          if (!isActive && !window.confirm(`Khóa tài khoản ${user.email}?`)) return;
          void perform(async () => {
            const ok = await props.onUpdateStatus(user.id, { isActive, reason: statusReason });
            if (ok) setStatusReason('');
          });
        }}
      >
        <h3>Trạng thái</h3>
        <label>
          <input
            type='checkbox'
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            disabled={busy}
          />{' '}
          Đang hoạt động
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
        <Button type='submit' variant='secondary' disabled={busy}>
          Lưu trạng thái
        </Button>
      </form>
      <form
        className='account-form route-panel'
        onSubmit={(event) => {
          event.preventDefault();
          if (!window.confirm(`Đặt lại mật khẩu cho ${user.email}?`)) return;
          void perform(async () => {
            validatePasswordBytes(password);
            await props.onResetPassword(user.id, { password, reason: passwordReason });
            setPassword('');
            setPasswordReason('');
          });
        }}
      >
        <h3>Đặt lại mật khẩu</h3>
        <label>
          Mật khẩu mới
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
        <Button type='submit' variant='secondary' disabled={busy}>
          Đặt lại mật khẩu
        </Button>
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
        className='account-form'
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
            setCreateForm(emptyStaffForm);
            setPassword('');
            props.onOpenChange(false);
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
          Mật khẩu tạm thời
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
          Đơn vị
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
          <legend>Quyền</legend>
          {(['MANAGE', 'VIEW', 'SCORE'] as const).map((permission) => (
            <label key={permission}>
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
              />{' '}
              {permission === 'VIEW' && createForm.staffPermissions.includes('MANAGE')
                ? 'VIEW (được bao hàm bởi MANAGE)'
                : permission}
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
        {props.units.every((unit) => !unit.isActive) && (
          <p role='alert'>Cần có đơn vị đang hoạt động trước khi tạo tài khoản.</p>
        )}
        <Button type='submit' disabled={busy || props.units.every((unit) => !unit.isActive)}>
          {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
        </Button>
      </form>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className='max-h-[90vh] max-w-3xl overflow-y-auto'>{content}</DialogContent>
    </Dialog>
  );
}
