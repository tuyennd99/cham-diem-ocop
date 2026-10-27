import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { NotFoundPage } from '../pages/errors/NotFoundPage';
import type { RouterContext } from '../types/router-context';

export const Route = createRootRouteWithContext<RouterContext>()({
  shellComponent: ({ children }) => (
    <>
      <a className='skip-link' href='#content'>
        Bỏ qua điều hướng
      </a>
      {children}
    </>
  ),
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
});
