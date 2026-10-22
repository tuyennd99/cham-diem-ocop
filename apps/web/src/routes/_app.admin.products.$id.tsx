import { createFileRoute } from "@tanstack/react-router";
import { AdminProductResultsPage } from "../pages/admin/AdminProductResultsPage";
import { requirePermission } from "../lib/route-guards";

export const Route = createFileRoute("/_app/admin/products/$id")({
  beforeLoad: requirePermission("VIEW"),
  component: ResultsRoute,
});

function ResultsRoute() {
  const { id } = Route.useParams();
  return <AdminProductResultsPage productId={id} />;
}
