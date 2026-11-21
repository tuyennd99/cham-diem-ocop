import { useCallback, useState } from 'react';
import { STAFF_PERMISSION, USER_ROLE } from '@ocop/shared';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  FileSpreadsheet,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  User,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { homeFor, setSession, useSession } from '../lib/auth';
import { hasStaffPermission } from '../lib/session-contract';

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = useSession();
  const signedIn = Boolean(session);
  const user = session?.user;
  const isRegistrant = user?.role === USER_ROLE.REGISTRANT;
  const canView = hasStaffPermission(user, STAFF_PERMISSION.VIEW);
  const canManage = hasStaffPermission(user, STAFF_PERMISSION.MANAGE);
  const canScore = hasStaffPermission(user, STAFF_PERMISSION.SCORE);
  const isCatalogRoute = pathname === '/products' || pathname.startsWith('/products/');
  const isHomeRoute = pathname === '/';
  const showPublicContextBadge = signedIn && !isRegistrant && (isHomeRoute || isCatalogRoute);
  const workPath = session
    ? homeFor(session.user.role, session.user.staffPermissions, '/my/products/new')
    : '/my/products/new';

  const handleLogout = useCallback(() => {
    setMenuOpen(false);
    setSession(null);
    void navigate({ to: '/login' });
  }, [navigate]);

  return (
    <header className='site-header'>
      <div className={`header-inner container ${menuOpen ? 'menu-open' : ''}`}>
        <Link className='brand' to='/' hash='home' aria-label='OCOP Đánh Giá — Trang chủ'>
          <span className='brand-mark' aria-hidden='true'>
            ★
          </span>
          <span className='brand-copy'>
            <strong>OCOP Đánh Giá</strong>
            <span>Hệ thống đăng ký, chấm điểm và xếp hạng sản phẩm OCOP</span>
          </span>
        </Link>
        <button
          className='menu-toggle'
          type='button'
          aria-expanded={menuOpen}
          aria-controls='primary-nav'
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden='true'>{menuOpen ? '×' : '☰'}</span>
          <span className='sr-only'>{menuOpen ? 'Đóng menu' : 'Mở menu'}</span>
        </button>
        <nav className='primary-nav' id='primary-nav' aria-label='Điều hướng chính'>
          <Link
            to='/'
            hash='home'
            className={isHomeRoute ? 'is-active' : undefined}
            aria-current={isHomeRoute ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Trang chủ
          </Link>
          <Link
            to='/products'
            className={isCatalogRoute ? 'is-active' : undefined}
            aria-current={isCatalogRoute ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Tra cứu
          </Link>
          <Link to='/' hash='workflow' onClick={() => setMenuOpen(false)}>
            Quy trình
          </Link>
          <Link to='/' hash='criteria' onClick={() => setMenuOpen(false)}>
            Tiêu chí đánh giá
          </Link>
          <div className='mobile-nav-actions'>
            <Button asChild variant='secondary' className='mobile-login'>
              <Link to={signedIn ? workPath : '/login'} onClick={() => setMenuOpen(false)}>
                {signedIn ? 'Khu vực làm việc' : 'Đăng nhập'}
              </Link>
            </Button>
            {signedIn && (
              <>
                <Button asChild variant='secondary' className='mobile-cta'>
                  <Link to='/account' onClick={() => setMenuOpen(false)}>
                    Thông tin tài khoản
                  </Link>
                </Button>
                <Button
                  type='button'
                  variant='destructive'
                  className='mobile-cta'
                  onClick={handleLogout}
                >
                  Đăng xuất
                </Button>
              </>
            )}
          </div>
        </nav>
        <div className='header-actions'>
          {!signedIn ? (
            <Link className='header-login' to='/login'>
              Đăng nhập
            </Link>
          ) : (
            <>
              {showPublicContextBadge && <span className='header-public-mode'>Xem công khai</span>}
              <span className='header-user-name'>{user?.fullName}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type='button'
                    variant='secondary'
                    size='icon'
                    className='header-user-trigger'
                    aria-label={`Tài khoản ${user?.fullName ?? ''}`}
                  >
                    <User className='size-5' aria-hidden='true' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' sideOffset={8} className='header-user-dropdown'>
                  <DropdownMenuLabel className='header-user-dropdown-label'>
                    <strong>{user?.fullName}</strong>
                    {user?.email && <span>{user.email}</span>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {isRegistrant && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to='/my/products' className='cursor-pointer'>
                            <Package className='size-4' aria-hidden='true' />
                            <span>Hồ sơ của tôi</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to='/my/products/new' className='cursor-pointer'>
                            <FileText className='size-4' aria-hidden='true' />
                            <span>Tạo hồ sơ mới</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {canView && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to='/admin' className='cursor-pointer'>
                            <LayoutDashboard className='size-4' aria-hidden='true' />
                            <span>Tổng quan quản trị</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            to={canManage ? '/admin/products' : '/admin/registrations'}
                            className='cursor-pointer'
                          >
                            {canManage ? (
                              <Package className='size-4' aria-hidden='true' />
                            ) : (
                              <FileText className='size-4' aria-hidden='true' />
                            )}
                            <span>{canManage ? 'Danh sách sản phẩm' : 'Phiếu đăng ký'}</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {canScore && (
                      <DropdownMenuItem asChild>
                        <Link to='/judge' className='cursor-pointer'>
                          <FileSpreadsheet className='size-4' aria-hidden='true' />
                          <span>Hồ sơ được phân công</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link to='/account' className='cursor-pointer'>
                        <UserCog className='size-4' aria-hidden='true' />
                        <span>Thông tin tài khoản</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to='/account/password' className='cursor-pointer'>
                        <KeyRound className='size-4' aria-hidden='true' />
                        <span>Đổi mật khẩu</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant='destructive' asChild>
                    <button
                      type='button'
                      onClick={handleLogout}
                      className='flex w-full cursor-pointer items-center gap-2'
                    >
                      <LogOut className='size-4' aria-hidden='true' />
                      <span>Đăng xuất</span>
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className='site-footer'>
      <div className='footer-grid container'>
        <div className='footer-brand'>
          <strong>OCOP Đánh Giá</strong>
          <p>Hệ thống đăng ký, chấm điểm và xếp hạng sản phẩm OCOP.</p>
        </div>
        <div>
          <h2>Điều hướng</h2>
          <Link to='/products'>Tra cứu hồ sơ</Link>
          <Link to='/' hash='workflow'>
            Quy trình
          </Link>
          <Link to='/' hash='criteria'>
            Tiêu chí đánh giá
          </Link>
        </div>
        <div>
          <h2>Căn cứ tham khảo</h2>
          <a
            href='https://xaydungchinhsach.chinhphu.vn/quyet-dinh-so-26-2026-qd-ttg-bo-tieu-chi-va-quy-trinh-danh-gia-phan-hang-san-pham-ocop-119260529164111182.htm'
            target='_blank'
            rel='noreferrer'
          >
            Quyết định 26/2026/QĐ-TTg
          </a>
          <p>Hồ sơ công khai chỉ hiển thị thông tin được phép công bố.</p>
        </div>
      </div>
      <div className='footer-bottom container'>
        <span>© OCOP Đánh Giá</span>
        <span>Thông tin hồ sơ được tải từ hệ thống.</span>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <>
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </>
  );
}
