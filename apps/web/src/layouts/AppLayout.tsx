import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  BarChart3,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { homeFor, setSession, useSession } from '../lib/auth';
import { hasStaffPermission } from '../lib/session-contract';

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const session = useSession();
  const role = session?.user.role;
  const permissions = session?.user.staffPermissions ?? [];
  const canView = hasStaffPermission(session?.user, 'VIEW');
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const canScore = hasStaffPermission(session?.user, 'SCORE');
  const homePath = role ? homeFor(role, permissions) : '/';

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function handleLogout() {
    closeMobileMenu();
    setSession(null);
    void navigate({ to: '/login' });
  }

  const navContent = isAdmin ? (
    <div className='admin-nav-groups'>
      {canView && (
        <div className='admin-nav-group'>
          <span className='admin-nav-group-label'>Làm việc</span>
          <Link
            to='/admin'
            activeOptions={{ exact: true, includeSearch: false }}
            onClick={closeMobileMenu}
          >
            <LayoutDashboard className='size-4' aria-hidden='true' />
            <span>Tổng quan</span>
          </Link>
          <Link to='/admin/products' onClick={closeMobileMenu}>
            <Package className='size-4' aria-hidden='true' />
            <span>Sản phẩm</span>
          </Link>
          <Link to='/admin/registrations' onClick={closeMobileMenu}>
            <FileText className='size-4' aria-hidden='true' />
            <span>Phiếu đăng ký</span>
          </Link>
        </div>
      )}
      {(canView || canScore) && (
        <div className='admin-nav-group'>
          <span className='admin-nav-group-label'>Đánh giá</span>
          {canView && (
            <Link to='/admin/assignments' onClick={closeMobileMenu}>
              <UserCheck className='size-4' aria-hidden='true' />
              <span>Phân công</span>
            </Link>
          )}
          <Link to='/admin/scoring-forms' onClick={closeMobileMenu}>
            <ClipboardCheck className='size-4' aria-hidden='true' />
            <span>Phiếu chấm OCOP</span>
          </Link>
          {canView && (
            <Link to='/admin/reports' onClick={closeMobileMenu}>
              <BarChart3 className='size-4' aria-hidden='true' />
              <span>Báo cáo thống kê</span>
            </Link>
          )}
          {canScore && (
            <Link to='/judge' onClick={closeMobileMenu}>
              <FileSpreadsheet className='size-4' aria-hidden='true' />
              <span>Hồ sơ được phân công</span>
            </Link>
          )}
        </div>
      )}
      {(canView || canManage) && (
        <div className='admin-nav-group'>
          <span className='admin-nav-group-label'>Quản trị</span>
          {canView && (
            <Link to='/admin/product-groups' onClick={closeMobileMenu}>
              <FolderTree className='size-4' aria-hidden='true' />
              <span>Nhóm sản phẩm & địa bàn</span>
            </Link>
          )}
          {canManage && (
            <Link
              to='/admin/users'
              search={{ permission: undefined }}
              activeOptions={{ includeSearch: false }}
              onClick={closeMobileMenu}
            >
              <Users className='size-4' aria-hidden='true' />
              <span>Người dùng</span>
            </Link>
          )}
        </div>
      )}
      <div className='admin-nav-group'>
        <span className='admin-nav-group-label'>Tài khoản</span>
        <Link to='/account' onClick={closeMobileMenu}>
          <UserCog className='size-4' aria-hidden='true' />
          <span>Tài khoản</span>
        </Link>
        <Link to='/' onClick={closeMobileMenu}>
          <Globe className='size-4' aria-hidden='true' />
          <span>Trang công khai</span>
        </Link>
        <button type='button' className='admin-nav-logout' onClick={handleLogout}>
          <LogOut className='size-4' aria-hidden='true' />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  ) : (
    <>
      {role === 'REGISTRANT' && (
        <>
          <Link to='/my/products'>Hồ sơ của tôi</Link>
          <Link to='/my/products/new'>Tạo hồ sơ</Link>
        </>
      )}
      {canView && (
        <>
          <Link to='/admin' activeOptions={{ exact: true, includeSearch: false }}>
            Tổng quan
          </Link>
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
    </>
  );

  return (
    <div className='application-shell' data-admin-ui={isAdmin ? 'true' : undefined}>
      <aside className='application-sidebar' aria-label='Khu vực làm việc'>
        <Link className='application-brand' to={homePath}>
          OCOP Đánh Giá
        </Link>
        <nav aria-label='Điều hướng khu vực làm việc'>{navContent}</nav>
      </aside>
      <div className='application-main'>
        <header className='application-topbar'>
          <div className='application-topbar-lead'>
            {isAdmin && (
              <>
                <Button
                  type='button'
                  variant='secondary'
                  className='admin-mobile-menu-trigger'
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu className='size-4' aria-hidden='true' />
                  <span>Điều hướng</span>
                </Button>
                <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <DialogContent className='admin-dialog admin-mobile-nav-dialog' data-admin-ui='true'>
                    <DialogHeader>
                      <DialogTitle>Điều hướng</DialogTitle>
                      <DialogDescription>
                        Chọn phân hệ làm việc trong khu vực quản trị OCOP.
                      </DialogDescription>
                    </DialogHeader>
                    <nav aria-label='Điều hướng di động'>{navContent}</nav>
                  </DialogContent>
                </Dialog>
              </>
            )}
            <span className='application-user-summary'>
              <strong className='application-user-name'>{session?.user.fullName}</strong>
              {session?.user.email && (
                <span className='application-user-email'> · {session.user.email}</span>
              )}
            </span>
          </div>
          <div className='application-topbar-actions'>
            <Link to='/'>Trang công khai</Link>
            <button type='button' onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </header>
        <main className='application-content' id='content'>
          {children}
        </main>
      </div>
    </div>
  );
}
