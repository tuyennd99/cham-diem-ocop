import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { RouterContext } from "../types/router-context";
import { SiteHeader } from "../layouts/PublicLayout";
import { NotFoundPage } from "../pages/errors/NotFoundPage";

export const Route = createRootRouteWithContext<RouterContext>()({
  shellComponent: ({ children }) => (
    <>
      <a className="skip-link" href="#content">Bỏ qua điều hướng</a>
      <SiteHeader />
      {children}
    </>
  ),
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
});
