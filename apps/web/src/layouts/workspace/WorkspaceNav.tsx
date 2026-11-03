import { memo } from 'react';
import type { ReactElement } from 'react';
import type { Role } from '@ocop/shared';
import { Link, useLocation } from '@tanstack/react-router';
import {
  BarChart3,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Globe,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { Tooltip } from 'radix-ui';

export function NavItemTooltip({
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

export interface WorkspaceNavProps {
  role?: Role;
  canView: boolean;
  canManage: boolean;
  canScore: boolean;
  tooltipEnabled: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
}

export const WorkspaceNav = memo(function WorkspaceNav({
  role,
  canView,
  canManage,
  canScore,
  tooltipEnabled,
  onNavigate,
  onLogout,
}: WorkspaceNavProps) {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <div className='admin-nav-groups'>
      {role === 'REGISTRANT' && (
        <div className='admin-nav-group'>
          <span className='admin-nav-group-label'>Người đăng ký</span>
          <NavItemTooltip label='Hồ sơ của tôi' enabled={tooltipEnabled}>
            <Link
              to='/my/products'
              title='Hồ sơ của tôi'
              activeOptions={{ exact: pathname === '/my/products/new', includeSearch: false }}
              onClick={onNavigate}
            >
              <Package className='size-4' aria-hidden='true' />
              <span>Hồ sơ của tôi</span>
            </Link>
          </NavItemTooltip>
          <NavItemTooltip label='Tạo hồ sơ' enabled={tooltipEnabled}>
            <Link to='/my/products/new' title='Tạo hồ sơ' onClick={onNavigate}>
              <FileText className='size-4' aria-hidden='true' />
              <span>Tạo hồ sơ</span>
            </Link>
          </NavItemTooltip>
        </div>
      )}
      {canView && (
        <div className='admin-nav-group'>
          <span className='admin-nav-group-label'>Làm việc</span>
          <NavItemTooltip label='Tổng quan' enabled={tooltipEnabled}>
            <Link
              to='/admin'
              title='Tổng quan'
              activeOptions={{ exact: true, includeSearch: false }}
              onClick={onNavigate}
            >
              <LayoutDashboard className='size-4' aria-hidden='true' />
              <span>Tổng quan</span>
            </Link>
          </NavItemTooltip>
          <NavItemTooltip label='Danh mục sản phẩm' enabled={tooltipEnabled}>
            <Link to='/admin/product-groups' title='Danh mục sản phẩm' onClick={onNavigate}>
              <FolderTree className='size-4' aria-hidden='true' />
              <span>Danh mục sản phẩm</span>
            </Link>
          </NavItemTooltip>
          <NavItemTooltip label='Sự kiện' enabled={tooltipEnabled}>
            <Link to='/admin/localities' title='Sự kiện' onClick={onNavigate}>
              <MapPin className='size-4' aria-hidden='true' />
              <span>Sự kiện</span>
            </Link>
          </NavItemTooltip>
          <NavItemTooltip label='Sản phẩm' enabled={tooltipEnabled}>
            <Link to='/admin/products' title='Sản phẩm' onClick={onNavigate}>
              <Package className='size-4' aria-hidden='true' />
              <span>Sản phẩm</span>
            </Link>
          </NavItemTooltip>
          <NavItemTooltip label='Phiếu đăng ký' enabled={tooltipEnabled}>
            <Link to='/admin/registrations' title='Phiếu đăng ký' onClick={onNavigate}>
              <FileText className='size-4' aria-hidden='true' />
              <span>Phiếu đăng ký</span>
            </Link>
          </NavItemTooltip>
        </div>
      )}
      {(canView || canScore) && (
        <div className='admin-nav-group'>
          <span className='admin-nav-group-label'>Đánh giá</span>
          {canView && (
            <NavItemTooltip label='Phân công' enabled={tooltipEnabled}>
              <Link to='/admin/assignments' title='Phân công' onClick={onNavigate}>
                <UserCheck className='size-4' aria-hidden='true' />
                <span>Phân công</span>
              </Link>
            </NavItemTooltip>
          )}
          <NavItemTooltip label='Phiếu chấm OCOP' enabled={tooltipEnabled}>
            <Link to='/admin/scoring-forms' title='Phiếu chấm OCOP' onClick={onNavigate}>
              <ClipboardCheck className='size-4' aria-hidden='true' />
              <span>Phiếu chấm OCOP</span>
            </Link>
          </NavItemTooltip>
          {canView && (
            <NavItemTooltip label='Báo cáo thống kê' enabled={tooltipEnabled}>
              <Link to='/admin/reports' title='Báo cáo thống kê' onClick={onNavigate}>
                <BarChart3 className='size-4' aria-hidden='true' />
                <span>Báo cáo thống kê</span>
              </Link>
            </NavItemTooltip>
          )}
          {canScore && (
            <NavItemTooltip label='Hồ sơ được phân công' enabled={tooltipEnabled}>
              <Link to='/judge' title='Hồ sơ được phân công' onClick={onNavigate}>
                <FileSpreadsheet className='size-4' aria-hidden='true' />
                <span>Hồ sơ được phân công</span>
              </Link>
            </NavItemTooltip>
          )}
        </div>
      )}
      {canManage && (
        <div className='admin-nav-group'>
          <span className='admin-nav-group-label'>Quản trị</span>
          <NavItemTooltip label='Người dùng' enabled={tooltipEnabled}>
            <Link
              to='/admin/users'
              title='Người dùng'
              search={{ permission: undefined }}
              activeOptions={{ includeSearch: false }}
              onClick={onNavigate}
            >
              <Users className='size-4' aria-hidden='true' />
              <span>Người dùng</span>
            </Link>
          </NavItemTooltip>
        </div>
      )}
      <div className='admin-nav-group'>
        <span className='admin-nav-group-label'>Tài khoản</span>
        <NavItemTooltip label='Tài khoản' enabled={tooltipEnabled}>
          <Link to='/account' title='Tài khoản' onClick={onNavigate}>
            <UserCog className='size-4' aria-hidden='true' />
            <span>Tài khoản</span>
          </Link>
        </NavItemTooltip>
        <NavItemTooltip label='Trang công khai' enabled={tooltipEnabled}>
          <Link to='/' title='Trang công khai' onClick={onNavigate}>
            <Globe className='size-4' aria-hidden='true' />
            <span>Trang công khai</span>
          </Link>
        </NavItemTooltip>
        <NavItemTooltip label='Đăng xuất' enabled={tooltipEnabled}>
          <button type='button' className='admin-nav-logout' title='Đăng xuất' onClick={onLogout}>
            <LogOut className='size-4' aria-hidden='true' />
            <span>Đăng xuất</span>
          </button>
        </NavItemTooltip>
      </div>
    </div>
  );
});
