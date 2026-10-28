import { Activity } from 'react';
import { useSession } from '@/lib/auth';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';

export function NavUser() {
  const session = useSession();
  const { state } = useSidebar();
  const isMobile = useIsMobile();

  if (!session?.user) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem
        className={cn({
          'self-center': state === 'collapsed',
        })}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='group text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent cursor-pointer'
              data-test='sidebar-menu-button'
            >
              <UserInfo user={session.user} />
              <Activity mode={state === 'collapsed' ? 'hidden' : 'visible'}>
                <ChevronsUpDown className='ml-auto size-4' />
              </Activity>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            align='end'
            side={isMobile ? 'bottom' : state === 'collapsed' ? 'left' : 'bottom'}
          >
            <UserMenuContent user={session.user} />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
