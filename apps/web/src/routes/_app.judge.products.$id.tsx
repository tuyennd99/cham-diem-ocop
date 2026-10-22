import { createFileRoute } from "@tanstack/react-router";
import { JudgeEvaluationPage } from "../pages/judge/JudgeEvaluationPage";
import { requireRole } from "../lib/route-guards";

export const Route = createFileRoute("/_app/judge/products/$id")({
  beforeLoad: requireRole("JUDGE"),
  component: JudgeProductPage,
});

function JudgeProductPage() {
  const { id } = Route.useParams();
  return <JudgeEvaluationPage productId={id} />;
}
