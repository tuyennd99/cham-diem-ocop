import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "../route-guards";
import { RoutePlaceholder } from "../components/RoutePlaceholder";

export const Route = createFileRoute("/_app/judge/")({
  beforeLoad: requireRole("JUDGE"),
  component: () => <RoutePlaceholder title="Hàng chờ chấm" />,
});
