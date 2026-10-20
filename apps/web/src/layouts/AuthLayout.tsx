import { Outlet } from "@tanstack/react-router";
import { SiteFooter } from "./PublicLayout";

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <Outlet />
      <SiteFooter />
    </div>
  );
}
