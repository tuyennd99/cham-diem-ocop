import { memo } from 'react';
import { Plus } from 'lucide-react';
import { Link } from '@/components/navigation';
import { homeFor, useSession } from '@/lib/auth';
import { hasStaffPermission } from '@/lib/session-contract';
import {
  accountNavItems,
  adminGroup,
  evaluationNavItems,
  judgeNavItem,
  mainNavItems,
  registrantNavItems,
} from '@/config/menu-nav';
import AppLogo from '@/components/app-logo';
import { NavMainCollapsible } from '@/components/nav-main-collapsible';
import { NavUser } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export const AppSidebar = memo(function AppSidebar() {
  const session = useSession();
  const role = session?.user.role;
  const permissions = session?.user.staffPermissions ?? [];
  const canView = hasStaffPermission(session?.user, 'VIEW');
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const canScore = hasStaffPermission(session?.user, 'SCORE');
  const homePath = role ? homeFor(role, permissions) : '/';

  const evalItems = [
    ...(canView ? evaluationNavItems : evaluationNavItems.filter((i) => i.href === '/admin/scoring-forms')),
    ...(canScore ? [judgeNavItem] : []),
  ];

  const adminItems = adminGroup.items.filter((item) => {
    if (item.href === '/admin/users') return canManage;
    return canView || canManage;
  });

  return (
    <Sidebar collapsible='icon' variant='inset' id='admin-desktop-navigation'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <Link to={homePath}>
                <AppLogo />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {canManage && (
          <div className='px-2 pb-2'>
            <Button asChild className='w-full justify-start'>
              <Link to='/admin/registrations/new'>
                <Plus className='size-4' />
                <span>Nhập phiếu đăng ký</span>
              </Link>
            </Button>
          </div>
        )}
        {role === 'REGISTRANT' && (
          <NavMainCollapsible label='Chủ thể OCOP' items={registrantNavItems} groups={[]} />
        )}
        {canView && <NavMainCollapsible label='Làm việc' items={mainNavItems} groups={[]} />}
        {evalItems.length > 0 && (
          <NavMainCollapsible label='Đánh giá' items={evalItems} groups={[]} />
        )}
        {adminItems.length > 0 && (
          <NavMainCollapsible label='Quản trị' items={adminItems} groups={[]} />
        )}
        <NavMainCollapsible label='Tài khoản' items={accountNavItems} groups={[]} />
      </SidebarContent>

      <SidebarFooter className='p-0'>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
});
