import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "../components/RoutePlaceholder";
import { requireRole } from "../route-guards";

export const Route = createFileRoute("/_app/admin/assignments")({
  beforeLoad: requireRole("ADMIN"),
  component: () => <RoutePlaceholder title="Phân công giám khảo" />,
});
