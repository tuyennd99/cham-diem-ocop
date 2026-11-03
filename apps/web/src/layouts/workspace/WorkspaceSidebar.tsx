import { memo } from 'react';
import type { Role } from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceNav } from './WorkspaceNav';

export interface WorkspaceSidebarProps {
  homePath: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  role?: Role;
  canView: boolean;
  canManage: boolean;
  canScore: boolean;
  onLogout: () => void;
}

export const WorkspaceSidebar = memo(function WorkspaceSidebar({
  homePath,
  collapsed,
  onToggleCollapse,
  role,
  canView,
  canManage,
  canScore,
  onLogout,
}: WorkspaceSidebarProps) {
  return (
    <aside className='application-sidebar' aria-label='Khu vực làm việc'>
      <div className='application-sidebar-header'>
        <Link className='application-brand' to={homePath}>
          {collapsed ? 'OCOP' : 'OCOP Đánh Giá'}
        </Link>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='admin-sidebar-toggle-btn'
          aria-expanded={!collapsed}
          aria-controls='admin-desktop-navigation'
          aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          title={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          onClick={onToggleCollapse}
        >
          {collapsed ? (
            <ChevronRight className='size-4' aria-hidden='true' />
          ) : (
            <ChevronLeft className='size-4' aria-hidden='true' />
          )}
        </Button>
      </div>
      <nav id='admin-desktop-navigation' aria-label='Điều hướng khu vực làm việc'>
        <WorkspaceNav
          role={role}
          canView={canView}
          canManage={canManage}
          canScore={canScore}
          tooltipEnabled={collapsed}
          onLogout={onLogout}
        />
      </nav>
    </aside>
  );
});
