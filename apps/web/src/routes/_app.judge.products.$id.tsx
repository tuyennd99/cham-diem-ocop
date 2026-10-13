import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { JudgeScoring } from "../JudgeScoring";
import { RoutePlaceholder } from "../components/RoutePlaceholder";
import { requireRole } from "../route-guards";

export const Route = createFileRoute("/_app/judge/products/$id")({
  beforeLoad: requireRole("JUDGE"),
  component: JudgeProductPage,
});

function JudgeProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  return id === "HS-26-0012"
    ? <JudgeScoring onHome={() => void navigate({ to: "/" })} />
    : <RoutePlaceholder title="Phiếu chấm" />;
}
