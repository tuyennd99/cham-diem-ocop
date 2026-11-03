import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '../../layouts/PublicLayout';

export function AuthFrame({
  eyebrow,
  title,
  intro,
  mode,
  backTo,
  backLabel = 'Quay lại trang đăng nhập',
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  mode?: 'login' | 'register';
  backTo?: '/login' | '/register' | '/';
  backLabel?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const panel = (
    <section
      className={cn('route-panel auth-panel', !aside && 'auth-panel-standalone')}
      aria-labelledby='route-title'
    >
      {mode && (
        <div className='auth-tabs' aria-label='Chuyển đổi đăng nhập và đăng ký'>
          <Link
            className={cn('auth-tab', mode === 'login' && 'is-active')}
            to='/login'
            aria-current={mode === 'login' ? 'page' : undefined}
          >
            Đăng nhập
          </Link>
          <Link
            className={cn('auth-tab', mode === 'register' && 'is-active')}
            to='/register'
            aria-current={mode === 'register' ? 'page' : undefined}
          >
            Đăng ký tài khoản
          </Link>
        </div>
      )}
      {backTo ? (
        <div className='auth-panel-top'>
          <Button asChild variant='outline' size='icon' className='auth-back-icon-btn'>
            <Link to={backTo} aria-label={backLabel} title={backLabel}>
              <ArrowLeft className='size-4' aria-hidden='true' />
            </Link>
          </Button>
          <p className='eyebrow'>{eyebrow}</p>
        </div>
      ) : (
        <p className='eyebrow'>{eyebrow}</p>
      )}
      <h1 id='route-title'>{title}</h1>
      <p className='route-intro'>{intro}</p>
      {children}
    </section>
  );

  return (
    <>
      {mode && <SiteHeader />}
      <main className='route-main' id='content'>
        <div className='route-container container'>
          {aside ? (
            <div className='auth-grid'>
              {panel}
              {aside}
            </div>
          ) : (
            panel
          )}
        </div>
      </main>
    </>
  );
}
