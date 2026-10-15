import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { RouterContext } from "../router-context";
import { NotFoundPage } from "../pages/RoutePages";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
});
