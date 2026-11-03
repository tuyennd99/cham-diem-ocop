import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Tooltip } from 'radix-ui';
import { homeFor, setSession, useSession } from '../lib/auth';
import { hasStaffPermission } from '../lib/session-contract';
import { WorkspaceSidebar } from './workspace/WorkspaceSidebar';
import { WorkspaceTopbar } from './workspace/WorkspaceTopbar';

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
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

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_sidebar_collapsed', String(next));
      }
      return next;
    });
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
    void navigate({ to: '/login' });
  }, [navigate]);

  return (
    <Tooltip.Provider delayDuration={200}>
      <div
        className='application-shell'
        data-admin-ui='true'
        data-sidebar-collapsed={sidebarCollapsed ? 'true' : undefined}
      >
        <WorkspaceSidebar
          homePath={homePath}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          role={role}
          canView={canView}
          canManage={canManage}
          canScore={canScore}
          onLogout={handleLogout}
        />
        <div className='application-main'>
          <WorkspaceTopbar
            fullName={session?.user.fullName}
            email={session?.user.email}
            role={role}
            canView={canView}
            canManage={canManage}
            canScore={canScore}
            onLogout={handleLogout}
          />
          <main className='application-content' id='content'>
            {children}
          </main>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
