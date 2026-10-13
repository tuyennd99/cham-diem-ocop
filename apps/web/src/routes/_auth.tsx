import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthLayout } from "../layouts/AuthLayout";

export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ context }) => {
    const session = context.getSession();
    if (session) throw redirect({ to: session.role === "ADMIN" ? "/admin/products" : session.role === "JUDGE" ? "/judge" : "/my/products" });
  },
  component: AuthLayout,
});
