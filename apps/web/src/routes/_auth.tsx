import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthLayout } from "../layouts/AuthLayout";
import { homeFor } from "../auth";

export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ context }) => {
    const session = context.getSession();
    if (session) throw redirect({ to: homeFor(session.user.role) });
  },
  component: AuthLayout,
});
