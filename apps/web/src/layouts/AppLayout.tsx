import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
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
import { Tooltip } from 'radix-ui';
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

function AdminNavTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: ReactElement;
}) {
  if (!enabled) return children;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className='admin-nav-tooltip' side='right' sideOffset={8}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const isAccount = pathname === '/account' || pathname.startsWith('/account/');
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/') || isAccount;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const session = useSession();
  const role = session?.user.role;
  const permissions = session?.user.staffPermissions ?? [];
  const canView = hasStaffPermission(session?.user, 'VIEW');
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const canScore = hasStaffPermission(session?.user, 'SCORE');
  const homePath = role ? homeFor(role, permissions) : '/';

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_sidebar_collapsed', String(next));
      }
      return next;
    });
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function handleLogout() {
    closeMobileMenu();
    setSession(null);
    void navigate({ to: '/login' });
  }

  function renderAdminNav(tooltipEnabled: boolean) {
    return (
      <div className='admin-nav-groups'>
        {role === 'REGISTRANT' && (
          <div className='admin-nav-group'>
            <span className='admin-nav-group-label'>Chủ thể OCOP</span>
            <AdminNavTooltip label='Hồ sơ của tôi' enabled={tooltipEnabled}>
              <Link to='/my/products' title='Hồ sơ của tôi' onClick={closeMobileMenu}>
                <Package className='size-4' aria-hidden='true' />
                <span>Hồ sơ của tôi</span>
              </Link>
            </AdminNavTooltip>
            <AdminNavTooltip label='Tạo hồ sơ' enabled={tooltipEnabled}>
              <Link to='/my/products/new' title='Tạo hồ sơ' onClick={closeMobileMenu}>
                <FileText className='size-4' aria-hidden='true' />
                <span>Tạo hồ sơ</span>
              </Link>
            </AdminNavTooltip>
          </div>
        )}
        {canView && (
          <div className='admin-nav-group'>
            <span className='admin-nav-group-label'>Làm việc</span>
            <AdminNavTooltip label='Tổng quan' enabled={tooltipEnabled}>
              <Link
                to='/admin'
                title='Tổng quan'
                activeOptions={{ exact: true, includeSearch: false }}
                onClick={closeMobileMenu}
              >
                <LayoutDashboard className='size-4' aria-hidden='true' />
                <span>Tổng quan</span>
              </Link>
            </AdminNavTooltip>
            <AdminNavTooltip label='Sản phẩm' enabled={tooltipEnabled}>
              <Link to='/admin/products' title='Sản phẩm' onClick={closeMobileMenu}>
                <Package className='size-4' aria-hidden='true' />
                <span>Sản phẩm</span>
              </Link>
            </AdminNavTooltip>
            <AdminNavTooltip label='Phiếu đăng ký' enabled={tooltipEnabled}>
              <Link to='/admin/registrations' title='Phiếu đăng ký' onClick={closeMobileMenu}>
                <FileText className='size-4' aria-hidden='true' />
                <span>Phiếu đăng ký</span>
              </Link>
            </AdminNavTooltip>
          </div>
        )}
        {(canView || canScore) && (
          <div className='admin-nav-group'>
            <span className='admin-nav-group-label'>Đánh giá</span>
            {canView && (
              <AdminNavTooltip label='Phân công' enabled={tooltipEnabled}>
                <Link to='/admin/assignments' title='Phân công' onClick={closeMobileMenu}>
                  <UserCheck className='size-4' aria-hidden='true' />
                  <span>Phân công</span>
                </Link>
              </AdminNavTooltip>
            )}
            <AdminNavTooltip label='Phiếu chấm OCOP' enabled={tooltipEnabled}>
              <Link to='/admin/scoring-forms' title='Phiếu chấm OCOP' onClick={closeMobileMenu}>
                <ClipboardCheck className='size-4' aria-hidden='true' />
                <span>Phiếu chấm OCOP</span>
              </Link>
            </AdminNavTooltip>
            {canView && (
              <AdminNavTooltip label='Báo cáo thống kê' enabled={tooltipEnabled}>
                <Link to='/admin/reports' title='Báo cáo thống kê' onClick={closeMobileMenu}>
                  <BarChart3 className='size-4' aria-hidden='true' />
                  <span>Báo cáo thống kê</span>
                </Link>
              </AdminNavTooltip>
            )}
            {canScore && (
              <AdminNavTooltip label='Hồ sơ được phân công' enabled={tooltipEnabled}>
                <Link to='/judge' title='Hồ sơ được phân công' onClick={closeMobileMenu}>
                  <FileSpreadsheet className='size-4' aria-hidden='true' />
                  <span>Hồ sơ được phân công</span>
                </Link>
              </AdminNavTooltip>
            )}
          </div>
        )}
        {(canView || canManage) && (
          <div className='admin-nav-group'>
            <span className='admin-nav-group-label'>Quản trị</span>
            {canView && (
              <AdminNavTooltip label='Nhóm sản phẩm & địa bàn' enabled={tooltipEnabled}>
                <Link
                  to='/admin/product-groups'
                  title='Nhóm sản phẩm & địa bàn'
                  onClick={closeMobileMenu}
                >
                  <FolderTree className='size-4' aria-hidden='true' />
                  <span>Nhóm sản phẩm & địa bàn</span>
                </Link>
              </AdminNavTooltip>
            )}
            {canManage && (
              <AdminNavTooltip label='Người dùng' enabled={tooltipEnabled}>
                <Link
                  to='/admin/users'
                  title='Người dùng'
                  search={{ permission: undefined }}
                  activeOptions={{ includeSearch: false }}
                  onClick={closeMobileMenu}
                >
                  <Users className='size-4' aria-hidden='true' />
                  <span>Người dùng</span>
                </Link>
              </AdminNavTooltip>
            )}
          </div>
        )}
        <div className='admin-nav-group'>
          <span className='admin-nav-group-label'>Tài khoản</span>
          <AdminNavTooltip label='Tài khoản' enabled={tooltipEnabled}>
            <Link to='/account' title='Tài khoản' onClick={closeMobileMenu}>
              <UserCog className='size-4' aria-hidden='true' />
              <span>Tài khoản</span>
            </Link>
          </AdminNavTooltip>
          <AdminNavTooltip label='Trang công khai' enabled={tooltipEnabled}>
            <Link to='/' title='Trang công khai' onClick={closeMobileMenu}>
              <Globe className='size-4' aria-hidden='true' />
              <span>Trang công khai</span>
            </Link>
          </AdminNavTooltip>
          <AdminNavTooltip label='Đăng xuất' enabled={tooltipEnabled}>
            <button
              type='button'
              className='admin-nav-logout'
              title='Đăng xuất'
              onClick={handleLogout}
            >
              <LogOut className='size-4' aria-hidden='true' />
              <span>Đăng xuất</span>
            </button>
          </AdminNavTooltip>
        </div>
      </div>
    );
  }

  const defaultNavContent = (
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
    <Tooltip.Provider delayDuration={200}>
      <div
        className='application-shell'
        data-admin-ui={isAdmin ? 'true' : undefined}
        data-sidebar-collapsed={isAdmin && sidebarCollapsed ? 'true' : undefined}
      >
        <aside className='application-sidebar' aria-label='Khu vực làm việc'>
          <div className='application-sidebar-header'>
            <Link className='application-brand' to={homePath}>
              {isAdmin && sidebarCollapsed ? 'OCOP' : 'OCOP Đánh Giá'}
            </Link>
            {isAdmin && (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='admin-sidebar-toggle-btn'
                aria-expanded={!sidebarCollapsed}
                aria-controls='admin-desktop-navigation'
                aria-label={
                  sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'
                }
                title={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
                onClick={toggleSidebar}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className='size-4' aria-hidden='true' />
                ) : (
                  <ChevronLeft className='size-4' aria-hidden='true' />
                )}
              </Button>
            )}
          </div>
          <nav id='admin-desktop-navigation' aria-label='Điều hướng khu vực làm việc'>
            {isAdmin ? renderAdminNav(sidebarCollapsed && !mobileMenuOpen) : defaultNavContent}
          </nav>
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
                    <DialogContent
                      className='admin-dialog admin-mobile-nav-dialog'
                      data-admin-ui='true'
                    >
                      <DialogHeader>
                        <DialogTitle>Điều hướng</DialogTitle>
                        <DialogDescription>
                          Chọn phân hệ làm việc trong khu vực quản trị OCOP.
                        </DialogDescription>
                      </DialogHeader>
                      <nav aria-label='Điều hướng di động'>{renderAdminNav(false)}</nav>
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
    </Tooltip.Provider>
  );
}
