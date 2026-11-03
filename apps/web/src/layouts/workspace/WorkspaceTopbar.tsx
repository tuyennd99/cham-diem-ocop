import { memo, useCallback, useState } from 'react';
import type { Role } from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WorkspaceNav } from './WorkspaceNav';

export interface WorkspaceTopbarProps {
  fullName?: string;
  email?: string;
  role?: Role;
  canView: boolean;
  canManage: boolean;
  canScore: boolean;
  onLogout: () => void;
}

export const WorkspaceTopbar = memo(function WorkspaceTopbar({
  fullName,
  email,
  role,
  canView,
  canManage,
  canScore,
  onLogout,
}: WorkspaceTopbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleMobileLogout = useCallback(() => {
    setMobileMenuOpen(false);
    onLogout();
  }, [onLogout]);

  return (
    <header className='application-topbar'>
      <div className='application-topbar-lead'>
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
                Chọn phân hệ làm việc trong hệ thống đánh giá OCOP.
              </DialogDescription>
            </DialogHeader>
            <nav aria-label='Điều hướng di động'>
              <WorkspaceNav
                role={role}
                canView={canView}
                canManage={canManage}
                canScore={canScore}
                tooltipEnabled={false}
                onNavigate={closeMobileMenu}
                onLogout={handleMobileLogout}
              />
            </nav>
          </DialogContent>
        </Dialog>
        <span className='application-user-summary'>
          <strong className='application-user-name'>{fullName}</strong>
          {email && <span className='application-user-email'> · {email}</span>}
        </span>
      </div>
      <div className='application-topbar-actions'>
        <Link to='/'>Trang công khai</Link>
        <Button type='button' variant='ghost' size='sm' onClick={onLogout}>
          Đăng xuất
        </Button>
      </div>
    </header>
  );
});
