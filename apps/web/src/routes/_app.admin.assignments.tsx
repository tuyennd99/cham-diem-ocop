import { createFileRoute } from "@tanstack/react-router";
import { AdminAssignmentsPage } from "../pages/AdminPages";
import { requireRole } from "../route-guards";

export const Route = createFileRoute("/_app/admin/assignments")({
  beforeLoad: requireRole("ADMIN"),
  component: AdminAssignmentsPage,
});
