import { createFileRoute } from "@tanstack/react-router";
import { AdminJudgesPage } from "../pages/admin/AdminJudgesPage";
import { requirePermission } from "../lib/route-guards";

export const Route = createFileRoute("/_app/admin/judges")({
  beforeLoad: requirePermission("MANAGE"),
  component: AdminJudgesPage,
});
