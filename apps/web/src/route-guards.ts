import { redirect } from "@tanstack/react-router";
import type { AppRole } from "./auth";
import type { RouterContext } from "./router-context";

export function requireRole(role: AppRole) {
  return ({ context }: { context: RouterContext }) => {
    const session = context.getSession();
    if (!session) throw redirect({ to: "/login" });
    if (session.user.role !== role) {
      const destination = session.user.role === "ADMIN" ? "/admin/products" : session.user.role === "JUDGE" ? "/judge" : "/my/products";
      throw redirect({ to: destination });
    }
  };
}
