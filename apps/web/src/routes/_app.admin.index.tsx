import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "../lib/route-guards";
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";

export const Route = createFileRoute("/_app/admin/")({
  beforeLoad: requirePermission("VIEW"),
  component: AdminDashboardRoute,
});

function AdminDashboardRoute() {
  return <AdminDashboardPage />;
}
