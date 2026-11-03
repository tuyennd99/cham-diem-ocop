import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { Button } from '@/components/ui/button';
import { homeFor, useSession } from '../../lib/auth';

export function ForbiddenPage() {
  const session = useSession();
  const home = session ? homeFor(session.user.role, session.user.staffPermissions) : '/';
  return (
    <main
      id='content'
      className='bg-bg flex min-h-screen min-h-svh items-center justify-center px-4 py-10 sm:px-6'
    >
      <section
        aria-labelledby='forbidden-title'
        className='border-border bg-surface w-full max-w-xl rounded-xl border'
      >
        <header className='border-border flex items-center justify-between gap-4 border-b px-6 py-4 sm:px-10'>
          <AppLogo />
          <span className='text-muted-foreground shrink-0 text-sm font-medium'>
            <span className='sr-only'>Mã lỗi </span>403
          </span>
        </header>
        <div className='flex flex-col items-start gap-6 px-6 py-8 sm:px-10 sm:py-10'>
          <div className='flex flex-col gap-4'>
            <h1 id='forbidden-title' className='mb-0! text-3xl! leading-tight! sm:text-4xl!'>
              Bạn không có quyền truy cập trang này
            </h1>
            <p className='text-muted-foreground text-base leading-relaxed'>
              Nếu bạn cần truy cập trang này, hãy liên hệ quản trị viên.
            </p>
          </div>
          <Button asChild className='w-full sm:w-auto'>
            <Link to={home}>
              <ArrowLeft aria-hidden='true' className='size-4' />
              {session ? 'Về khu vực của tôi' : 'Về trang chủ'}
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
