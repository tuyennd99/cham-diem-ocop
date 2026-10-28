import type { BreadcrumbItem } from '@/types';
import { Menu } from 'lucide-react';
import { Link } from '@/components/navigation';
import AppLogo from '@/components/app-logo';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { NotificationBell } from '@/components/notification-bell';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

type Props = {
  breadcrumbs?: BreadcrumbItem[];
};

export function AppHeader({ breadcrumbs = [] }: Props) {
  return (
    <>
      <div className='border-border bg-background/95 border-b backdrop-blur'>
        <div className='flex h-14 items-center gap-3 px-4'>
          <div className='lg:hidden'>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant='ghost' size='icon-sm'>
                  <Menu className='size-5' />
                </Button>
              </SheetTrigger>
              <SheetContent side='left' className='w-72'>
                <SheetHeader>
                  <SheetTitle className='sr-only'>Điều hướng</SheetTitle>
                  <AppLogo />
                </SheetHeader>
              </SheetContent>
            </Sheet>
          </div>
          <Link to='/' className='lg:hidden'>
            <AppLogo />
          </Link>
          <div className='hidden lg:block'>
            <div className='text-sm font-medium'>
              Hệ thống Đánh giá và Phân hạng Sản phẩm OCOP
            </div>
            <div className='text-muted-foreground text-xs'>
              Chương trình Mỗi xã một sản phẩm · Quyết định 26/2026/QĐ-TTg
            </div>
          </div>
          <div className='ml-auto flex items-center gap-1'>
            <NotificationBell />
          </div>
        </div>
      </div>
      {breadcrumbs.length > 1 && (
        <div className='border-border flex w-full border-b'>
          <div className='flex h-10 w-full items-center px-4 text-neutral-500'>
            <Breadcrumbs breadcrumbs={breadcrumbs} />
          </div>
        </div>
      )}
    </>
  );
}
