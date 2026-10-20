import { createFileRoute } from "@tanstack/react-router";
import { AdminJudgesPage } from "../pages/AdminPages";
import { requireRole } from "../lib/route-guards";

export const Route = createFileRoute("/_app/admin/judges")({
  beforeLoad: requireRole("ADMIN"),
  component: AdminJudgesPage,
});
