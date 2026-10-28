import { useAdminDashboard } from '@/queries/admin';
import { Bell } from 'lucide-react';
import { useSession } from '@/lib/auth';
import { hasStaffPermission } from '@/lib/session-contract';
import { Link } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function NotificationBell() {
  const session = useSession();
  const canView = hasStaffPermission(session?.user, 'VIEW');
  const dashboardQuery = useAdminDashboard({}, canView);

  if (!session?.user || !canView) return null;

  const items = dashboardQuery.data?.needsAttention ?? [];
  const count = items.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon-sm'
          className='relative'
          aria-label={count > 0 ? `Hồ sơ cần xử lý, ${count} hồ sơ` : 'Thông báo hồ sơ'}
        >
          <Bell className='size-4' />
          {count > 0 && (
            <span className='absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white'>
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-80 gap-0 p-0'>
        <div className='flex items-center justify-between border-b px-3 py-2'>
          <span className='text-sm font-medium'>Hồ sơ cần xử lý</span>
          <Link to='/admin/products' className='text-accent text-xs font-medium hover:underline'>
            Xem tất cả
          </Link>
        </div>
        <div className='max-h-80 overflow-y-auto'>
          {items.length === 0 ? (
            <div className='text-muted-foreground px-3 py-6 text-center text-sm'>
              Không có hồ sơ tồn đọng cần xử lý
            </div>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                to={`/admin/products/${item.id}`}
                className='hover:bg-accent-soft/60 flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0'
              >
                <span className='mt-1.5 size-2 shrink-0 rounded-full bg-amber-500' />
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-sm font-medium'>{item.name}</span>
                  <span className='text-muted-foreground block truncate text-xs'>
                    {item.category.name}
                  </span>
                  <span className='text-muted-foreground block text-xs'>
                    {item.assignedJudgeCount === 0 || item.missingCriteriaCount > 0
                      ? 'Thiếu phân công phủ tiêu chí'
                      : `${item.pendingEvaluationCount} phiếu chưa hoàn tất`}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
