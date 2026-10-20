import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "../lib/route-guards";
import { AdminDashboardPage } from "../pages/AdminPages";

export const Route = createFileRoute("/_app/admin/")({
  beforeLoad: requireRole("ADMIN"),
  component: AdminDashboardRoute,
});

function AdminDashboardRoute() {
  return <AdminDashboardPage />;
}
