import { redirect } from "@tanstack/react-router";
import type { AppRole } from "../types/auth";
import type { RouterContext } from "../types/router-context";

export function requireRole(role: AppRole) {
  return ({ context }: { context: RouterContext }) => {
    const session = context.getSession();
    if (!session) throw redirect({ to: "/login" });
    if (session.user.role !== role) {
      throw redirect({ to: "/403" });
    }
  };
}
