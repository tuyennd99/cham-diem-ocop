import type { Role, StaffPermission } from '@ocop/shared';
import { Link, Outlet, useLocation } from '@tanstack/react-router';
import { KeyRound, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { useMe } from '../../queries/common';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Quản trị viên (ADMIN)',
  VIEWER: 'Cán bộ tra cứu & báo cáo (VIEWER)',
  JUDGE: 'Giám khảo hội đồng (JUDGE)',
  REGISTRANT: 'Chủ thể sản xuất (REGISTRANT)',
};

const PERMISSION_LABELS: Record<StaffPermission, string> = {
  MANAGE: 'Quản lý',
  VIEW: 'Xem dữ liệu',
  SCORE: 'Chấm điểm',
};

export function AccountPage() {
  const pathname = useLocation({ select: (loc) => loc.pathname });
  const session = useSession();
  const { data: meUser, error: loadError, isPending, isFetching, refetch } = useMe();
  const user = meUser ?? session?.user ?? null;
  const error = errorText(loadError);

  if (pathname !== '/account') {
    return <Outlet />;
  }

  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div>
          <h1>Thông tin tài khoản</h1>
          <p className='route-intro'>
            Thông tin định danh, đơn vị công tác, phân quyền làm việc và bảo mật tài khoản.
          </p>
        </div>
        <div className='admin-actions'>
          <Button
            type='button'
            variant='secondary'
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RotateCcw className='size-4' aria-hidden='true' />
            <span>{isFetching ? 'Đang làm mới…' : 'Làm mới'}</span>
          </Button>
          <Link className='button button-primary' to='/account/password'>
            <KeyRound className='size-4' aria-hidden='true' />
            <span>Đổi mật khẩu</span>
          </Link>
        </div>
      </div>

      {error && !user && (
        <div className='form-alert' role='alert'>
          <div>
            <p className='font-semibold text-red-900'>Không tải được thông tin tài khoản</p>
            <p className='text-sm text-red-800 mt-0.5'>{error}</p>
          </div>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            className='ml-auto'
            onClick={() => void refetch()}
          >
            <RotateCcw className='size-4' aria-hidden='true' />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {isPending && !user && (
        <div className='admin-table-region p-6' aria-busy='true'>
          <p role='status' className='text-sm text-muted'>
            Đang tải thông tin tài khoản…
          </p>
        </div>
      )}

      {user && (
        <div className='admin-table-region p-6'>
          <div className='admin-page-heading' style={{ marginBottom: '16px' }}>
            <div>
              <h2>{user.fullName}</h2>
              <p className='text-sm text-muted'>{user.email}</p>
            </div>
            <span className={`status-badge ${user.verified ? 'completed' : 'scoring'}`}>
              {user.verified ? 'Đã xác thực' : 'Chưa xác thực'}
            </span>
          </div>

          <dl className='detail-facts'>
            <div>
              <dt>Họ và tên</dt>
              <dd>{user.fullName}</dd>
            </div>
            <div>
              <dt>Email đăng nhập</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Số điện thoại</dt>
              <dd>{user.phone || 'Chưa cập nhật'}</dd>
            </div>
            <div>
              <dt>Vai trò hệ thống</dt>
              <dd>{ROLE_LABELS[user.role] ?? user.role}</dd>
            </div>
            <div>
              <dt>Quyền làm việc</dt>
              <dd>
                {user.role === 'REGISTRANT' ? (
                  <span className='status-badge draft'>Chủ thể đăng ký hồ sơ</span>
                ) : user.staffPermissions.length > 0 ? (
                  <span className='flex flex-wrap gap-1.5 mt-1'>
                    {user.staffPermissions.map((permission) => (
                      <span key={permission} className='cat-tag'>
                        {PERMISSION_LABELS[permission]} ({permission})
                      </span>
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
                    ? 'Tài khoản chủ thể độc lập'
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

          {error && (
            <p className='form-note mt-4' role='status'>
              Đang hiển thị thông tin từ phiên đăng nhập hiện tại ({error}).
            </p>
          )}
        </div>
      )}
    </section>
  );
}
