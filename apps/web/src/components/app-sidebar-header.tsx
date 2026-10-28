import type { BreadcrumbItem } from '@/types';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { NotificationBell } from '@/components/notification-bell';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function AppSidebarHeader({
  breadcrumbs = [],
}: {
  breadcrumbs?: BreadcrumbItem[];
}) {
  return (
    <header className='border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur'>
      <div className='flex h-14 items-center gap-3 px-4'>
        <SidebarTrigger className='-ml-1' />
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium'>
            Hệ thống Đánh giá và Phân hạng Sản phẩm OCOP
          </div>
          <div className='text-muted-foreground truncate text-xs'>
            Chương trình Mỗi xã một sản phẩm · Quyết định 26/2026/QĐ-TTg
          </div>
        </div>
        <div className='ml-auto flex items-center gap-1'>
          <NotificationBell />
        </div>
      </div>
      {breadcrumbs.length > 1 && (
        <div className='flex h-10 items-center border-t px-4 text-neutral-500'>
          <Breadcrumbs breadcrumbs={breadcrumbs} />
        </div>
      )}
    </header>
  );
}
