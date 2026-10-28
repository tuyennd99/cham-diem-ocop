import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { NavigationLoadingBar } from '@/components/navigation-bar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NotFoundPage } from '../pages/errors/NotFoundPage';
import type { RouterContext } from '../types/router-context';

export const Route = createRootRouteWithContext<RouterContext>()({
  shellComponent: ({ children }) => (
    <TooltipProvider delayDuration={200}>
      <a className='skip-link' href='#content'>Bỏ qua điều hướng</a>
      <NavigationLoadingBar />
      <Toaster richColors closeButton />
      {children}
    </TooltipProvider>
  ),
  component: Outlet,
  notFoundComponent: NotFoundPage,
});
