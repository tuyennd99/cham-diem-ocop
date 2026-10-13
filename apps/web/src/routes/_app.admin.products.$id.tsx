import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "../components/RoutePlaceholder";
import { requireRole } from "../route-guards";

export const Route = createFileRoute("/_app/admin/products/$id")({
  beforeLoad: requireRole("ADMIN"),
  component: () => <RoutePlaceholder title="Bảng điểm chi tiết" />,
});
