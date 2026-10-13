import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "../route-guards";
import { JudgeQueuePage } from "../pages/JudgePages";

export const Route = createFileRoute("/_app/judge/")({
  beforeLoad: requireRole("JUDGE"),
  component: JudgeQueuePage,
});
