import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageContainer, PageHeader, PageSection } from '@/layouts/PageLayout';
import type { Role, StaffPermission } from '@ocop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, KeyRound, Pencil, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '../../api';
import { queryKeys } from '../../constants/query-key';
import { errorText, messageOf } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { useMe } from '../../queries/common';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Quản trị viên (ADMIN)',
  VIEWER: 'Cán bộ tra cứu & báo cáo (VIEWER)',
  JUDGE: 'Giám khảo hội đồng (JUDGE)',
  REGISTRANT: 'Người đăng ký (REGISTRANT)',
};

const PERMISSION_LABELS: Record<StaffPermission, string> = {
  MANAGE: 'Quản lý',
  VIEW: 'Xem dữ liệu',
  SCORE: 'Chấm điểm',
};

export function AccountPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const { data: meUser, error: loadError, isPending, isFetching, refetch } = useMe();
  const user = meUser ?? session?.user ?? null;
  const error = errorText(loadError);

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function startEditing() {
    if (!user) return;
    setFullName(user.fullName);
    setPhone(user.phone ?? '');
    setFormError('');
    setIsEditing(true);
  }

  function cancelEditing() {
    if (saving) return;
    setIsEditing(false);
    setFormError('');
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      setFormError('Vui lòng nhập họ và tên.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const { data: updatedUser } = await authApi.updateProfile({
        fullName: trimmedName,
        phone: trimmedPhone || null,
      });
      queryClient.setQueryData(queryKeys.me, updatedUser);
      setIsEditing(false);
      toast.success('Đã cập nhật thông tin tài khoản.');
    } catch (cause) {
      const msg = messageOf(cause);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title='Thông tin tài khoản'
        description='Thông tin định danh, đơn vị công tác, phân quyền làm việc và bảo mật tài khoản.'
        actions={
          <>
            <Button
              type='button'
              variant='secondary'
              loading={isFetching}
              disabled={isFetching || saving}
              onClick={() => void refetch()}
            >
              <RotateCcw className='size-4' aria-hidden='true' />
              <span>{isFetching ? 'Đang làm mới…' : 'Làm mới'}</span>
            </Button>
            {user && !isEditing ? (
              <Button type='button' variant='secondary' onClick={startEditing}>
                <Pencil className='size-4' aria-hidden='true' />
                <span>Chỉnh sửa</span>
              </Button>
            ) : null}
            <Button asChild>
              <Link to='/account/password'>
                <KeyRound className='size-4' aria-hidden='true' />
                <span>Đổi mật khẩu</span>
              </Link>
            </Button>
          </>
        }
      />

      {error && !user ? (
        <div className='space-y-2'>
          <AlertError title='Không tải được thông tin tài khoản' errors={[error]} />
          <Button type='button' variant='secondary' size='sm' onClick={() => void refetch()}>
            <RotateCcw className='size-4' aria-hidden='true' />
            <span>Thử lại</span>
          </Button>
        </div>
      ) : null}

      {isPending && !user ? <PageSpin /> : null}

      {user ? (
        <PageSection>
          <form onSubmit={(event) => void handleSaveProfile(event)}>
            <div className='admin-page-heading' style={{ marginBottom: '16px' }}>
              <div>
                <h2>{isEditing ? fullName.trim() || user.fullName : user.fullName}</h2>
                <p className='text-muted text-sm'>{user.email}</p>
              </div>
              <Badge variant={user.verified ? 'default' : 'outline'}>
                {user.verified ? 'Đã xác thực' : 'Chưa xác thực'}
              </Badge>
            </div>

            {formError ? (
              <div className='mb-4'>
                <AlertError title='Không thể cập nhật thông tin' errors={[formError]} />
              </div>
            ) : null}

            <dl className='detail-facts'>
              <div>
                {isEditing ? (
                  <FormField label='Họ và tên' htmlFor='account-full-name' required>
                    <Input
                      id='account-full-name'
                      value={fullName}
                      maxLength={255}
                      required
                      autoFocus
                      disabled={saving}
                      placeholder='Nhập họ và tên hoặc tên đơn vị'
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </FormField>
                ) : (
                  <>
                    <dt>Họ và tên</dt>
                    <dd>{user.fullName}</dd>
                  </>
                )}
              </div>
              <div>
                {isEditing ? (
                  <FormField label='Email đăng nhập' htmlFor='account-email'>
                    <Input id='account-email' type='email' value={user.email} readOnly disabled />
                  </FormField>
                ) : (
                  <>
                    <dt>Email đăng nhập</dt>
                    <dd>{user.email}</dd>
                  </>
                )}
              </div>
              <div>
                {isEditing ? (
                  <FormField label='Số điện thoại' htmlFor='account-phone'>
                    <Input
                      id='account-phone'
                      type='tel'
                      value={phone}
                      maxLength={30}
                      disabled={saving}
                      placeholder='Nhập số điện thoại liên hệ'
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </FormField>
                ) : (
                  <>
                    <dt>Số điện thoại</dt>
                    <dd>{user.phone || 'Chưa cập nhật'}</dd>
                  </>
                )}
              </div>
              <div>
                <dt>Vai trò hệ thống</dt>
                <dd>{ROLE_LABELS[user.role] ?? user.role}</dd>
              </div>
              <div>
                <dt>Quyền làm việc</dt>
                <dd>
                  {user.role === 'REGISTRANT' ? (
                    <Badge variant='secondary'>Người đăng ký hồ sơ</Badge>
                  ) : user.staffPermissions.length > 0 ? (
                    <span className='mt-1 flex flex-wrap gap-1.5'>
                      {user.staffPermissions.map((permission) => (
                        <Badge key={permission} variant='secondary'>
                          {PERMISSION_LABELS[permission]} ({permission})
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    'Chưa cấp quyền nội bộ'
                  )}
                </dd>
              </div>
              <div>
                <dt>Đơn vị công tác</dt>
                <dd>
                  {user.organizationUnit
                    ? `${user.organizationUnit.code} · ${user.organizationUnit.name}`
                    : user.role === 'REGISTRANT'
                      ? 'Tài khoản người đăng ký độc lập'
                      : 'Chưa gán đơn vị'}
                </dd>
              </div>
              <div>
                <dt>Trạng thái xác thực</dt>
                <dd>{user.verified ? 'Đã xác thực' : 'Chưa xác thực'}</dd>
              </div>
              <div>
                <dt>Mã tài khoản</dt>
                <dd className='font-mono text-xs'>{user.id}</dd>
              </div>
            </dl>

            {isEditing ? (
              <div className='border-border mt-6 flex items-center justify-end gap-2 border-t pt-4'>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={saving}
                  onClick={cancelEditing}
                >
                  <X className='size-4' aria-hidden='true' />
                  <span>Hủy</span>
                </Button>
                <Button type='submit' loading={saving} disabled={saving}>
                  <Check className='size-4' aria-hidden='true' />
                  <span>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</span>
                </Button>
              </div>
            ) : null}
          </form>

          {error ? (
            <p className='form-note mt-4' role='status'>
              Đang hiển thị thông tin từ phiên đăng nhập hiện tại ({error}).
            </p>
          ) : null}
        </PageSection>
      ) : null}
    </PageContainer>
  );
}
