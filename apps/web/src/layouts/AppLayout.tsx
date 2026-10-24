import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { homeFor, setSession, useSession } from '../lib/auth';
import { hasStaffPermission } from '../lib/session-contract';

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const session = useSession();
  const role = session?.user.role;
  const permissions = session?.user.staffPermissions ?? [];
  const canView = hasStaffPermission(session?.user, 'VIEW');
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const canScore = hasStaffPermission(session?.user, 'SCORE');
  const homePath = role ? homeFor(role, permissions) : '/';
  return (
    <div className='application-shell'>
      <aside className='application-sidebar' aria-label='Khu vực làm việc'>
        <Link className='application-brand' to={homePath}>
          OCOP Đánh Giá
        </Link>
        <nav aria-label='Điều hướng khu vực làm việc'>
          {role === 'REGISTRANT' && (
            <>
              <Link to='/my/products'>Hồ sơ của tôi</Link>
              <Link to='/my/products/new'>Tạo hồ sơ</Link>
            </>
          )}
          {canView && (
            <>
              <Link to='/admin'>Tổng quan</Link>
              <Link to='/admin/product-groups'>Nhóm sản phẩm</Link>
              <Link to='/admin/products'>Sản phẩm</Link>
              <Link to='/admin/registrations'>Phiếu đăng ký</Link>
              <Link to='/admin/scoring-forms'>Phiếu chấm OCOP</Link>
              <Link to='/admin/reports'>Báo cáo thống kê</Link>
              <Link to='/admin/assignments'>Phân công</Link>
            </>
          )}
          {!canView && canScore && <Link to='/admin/scoring-forms'>Phiếu chấm OCOP</Link>}
          {canManage && (
            <Link to='/admin/users' search={{ permission: undefined }}>
              Người dùng
            </Link>
          )}
          {canScore && <Link to='/judge'>Hồ sơ được phân công</Link>}
          <Link to='/account'>Tài khoản</Link>
        </nav>
      </aside>
      <div className='application-main'>
        <header className='application-topbar'>
          <span>
            {session?.user.fullName} · {session?.user.email}
          </span>
          <Link to='/'>Trang công khai</Link>
          <button
            type='button'
            onClick={() => {
              setSession(null);
              void navigate({ to: '/login' });
            }}
          >
            Đăng xuất
          </button>
        </header>
        <main className='application-content' id='content'>
          {children}
        </main>
      </div>
    </div>
  );
}
