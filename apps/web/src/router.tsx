import { createRouter } from "@tanstack/react-router";
import { getSession } from "./lib/auth";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  context: { getSession },
  scrollRestoration: true,
});
