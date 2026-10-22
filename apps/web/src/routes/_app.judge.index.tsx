import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "../lib/route-guards";
import { JudgeQueuePage } from "../pages/judge/JudgeQueuePage";

export const Route = createFileRoute("/_app/judge/")({
  beforeLoad: requireRole("JUDGE"),
  component: JudgeQueuePage,
});
