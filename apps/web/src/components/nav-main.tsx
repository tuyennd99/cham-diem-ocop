import type { NavItem } from '@/types';
import { Link, useLocation } from '@/components/navigation';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function NavMain({ items = [] }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const isCurrentUrl = (href: string) => pathname === href;

  return (
    <SidebarGroup className='px-2 py-0'>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              isActive={isCurrentUrl(item.href)}
              tooltip={{ children: item.title }}
            >
              <Link to={item.href}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
