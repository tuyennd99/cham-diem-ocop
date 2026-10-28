import { useRef, useState } from 'react';
import type { NavGroup, NavItem } from '@/types';
import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from '@/components/navigation';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';

type IsCurrentUrlFn = (href: string) => boolean;

/**
 * Hover-activated dropdown for collapsed sidebar groups.
 * Uses a plain button (NOT SidebarMenuButton) to avoid tooltip conflicts.
 * The DropdownMenu portal ensures content isn't clipped by overflow-hidden.
 */
function CollapsedGroupDropdown({
  group,
  isGroupActive,
  isCurrentUrl,
}: {
  group: NavGroup;
  isGroupActive: boolean;
  isCurrentUrl: IsCurrentUrlFn;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleClose = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className={cn(
            'flex w-full items-center justify-center rounded-md p-2 outline-hidden transition-colors',
            'hover:bg-primary-bg hover:text-primary-text',
            'focus-visible:ring-sidebar-ring focus-visible:ring-2',
            isGroupActive ? 'text-primary-text' : 'text-sidebar-foreground',
          )}
          onPointerEnter={handleOpen}
          onPointerLeave={handleClose}
        >
          {group.icon && <group.icon className='size-4 shrink-0' />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side='right'
        align='start'
        sideOffset={8}
        className='min-w-56'
        onPointerEnter={handleOpen}
        onPointerLeave={handleClose}
      >
        <DropdownMenuLabel>{group.title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {group.items.map((item) => (
          <DropdownMenuItem
            key={item.title}
            asChild
            className={isCurrentUrl(item.href) ? 'bg-primary-bg text-primary-text font-medium' : ''}
          >
            <Link to={item.href} className='flex w-full items-center gap-2'>
              {item.icon && <item.icon className='size-4' />}
              <span className='line-clamp-2' title={item.title}>
                {item.title}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NavMainCollapsible({
  label = 'Menu',
  groups = [],
  items = [],
}: {
  label?: string;
  groups?: NavGroup[];
  items?: NavItem[];
}) {
  const { pathname } = useLocation();
  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === 'collapsed';
  // Chỉ item khớp cụ thể nhất được active (tránh /tasks active khi ở /tasks/report-history).
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const activeHref = [...items, ...groups.flatMap((group) => group.items)]
    .map((item) => item.href)
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  const isCurrentUrl = (href: string) => href === activeHref;

  const isFullyCollapsed = isCollapsed;

  return (
    <SidebarGroup className='px-2 py-0'>
      {!isFullyCollapsed && (
        <SidebarGroupLabel
          className={
            isCollapsed
              ? 'pointer-events-none truncate opacity-0 transition-opacity duration-200'
              : ''
          }
        >
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarMenu>
        {/* Flat items — tooltip handled by SidebarMenuButton */}
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

        {/* Groups */}
        {groups.map((group) => {
          const isGroupActive = group.items.some((item) => isCurrentUrl(item.href));

          /* Collapsed: hover dropdown (portal, no tooltip) */
          if (isFullyCollapsed) {
            return (
              <SidebarMenuItem key={group.title}>
                <CollapsedGroupDropdown
                  group={group}
                  isGroupActive={isGroupActive}
                  isCurrentUrl={isCurrentUrl}
                />
              </SidebarMenuItem>
            );
          }

          /* Expanded: normal collapsible */
          return (
            <Collapsible
              key={group.title}
              asChild
              defaultOpen={isGroupActive}
              className='group/collapsible'
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={{ children: group.title }}
                    className={`cursor-pointer ${isGroupActive ? 'text-primary-text' : ''}`}
                  >
                    {group.icon && <group.icon />}
                    <span className='truncate'>{group.title}</span>
                    <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {group.items.map((item) => (
                      <SidebarMenuSubItem key={item.title}>
                        <SidebarMenuSubButton asChild isActive={isCurrentUrl(item.href)}>
                          <Link to={item.href}>
                            <span title={item.title}>{item.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
