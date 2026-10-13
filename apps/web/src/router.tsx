import { createRouter } from "@tanstack/react-router";
import { getSession } from "./auth";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  context: { getSession },
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
