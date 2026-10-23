import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { SiteHeader } from '../layouts/PublicLayout';
import { NotFoundPage } from '../pages/errors/NotFoundPage';
import type { RouterContext } from '../types/router-context';

export const Route = createRootRouteWithContext<RouterContext>()({
  shellComponent: ({ children }) => (
    <>
      <a className='skip-link' href='#content'>
        Bỏ qua điều hướng
      </a>
      <SiteHeader />
      {children}
    </>
  ),
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
});
