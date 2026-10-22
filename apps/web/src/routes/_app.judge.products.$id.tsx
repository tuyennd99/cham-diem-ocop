import { createFileRoute } from "@tanstack/react-router";
import { JudgeEvaluationPage } from "../pages/judge/JudgeEvaluationPage";
import { requirePermission } from "../lib/route-guards";

export const Route = createFileRoute("/_app/judge/products/$id")({
  beforeLoad: requirePermission("SCORE"),
  component: JudgeProductPage,
});

function JudgeProductPage() {
  const { id } = Route.useParams();
  return <JudgeEvaluationPage productId={id} />;
}
