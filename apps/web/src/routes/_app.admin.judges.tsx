import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "../components/RoutePlaceholder";
import { requireRole } from "../route-guards";

export const Route = createFileRoute("/_app/admin/judges")({
  beforeLoad: requireRole("ADMIN"),
  component: () => <RoutePlaceholder title="Quản lý giám khảo" />,
});
