import { createFileRoute } from "@tanstack/react-router";
import { AdminAssignmentsPage } from "../pages/admin/AdminAssignmentsPage";
import { requireRole } from "../lib/route-guards";

export const Route = createFileRoute("/_app/admin/assignments")({
  beforeLoad: requireRole("ADMIN"),
  component: AdminAssignmentsPage,
});
