import { createFileRoute } from "@tanstack/react-router";
import { AdminAssignmentsPage } from "../pages/admin/AdminAssignmentsPage";
import { requirePermission } from "../lib/route-guards";

export const Route = createFileRoute("/_app/admin/assignments")({
  beforeLoad: requirePermission("VIEW"),
  component: AdminAssignmentsPage,
});
