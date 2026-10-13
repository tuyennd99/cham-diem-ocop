import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppLayout } from "../layouts/AppLayout";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context }) => {
    if (!context.getSession()) throw redirect({ to: "/login" });
  },
  component: () => <AppLayout><Outlet /></AppLayout>,
});
