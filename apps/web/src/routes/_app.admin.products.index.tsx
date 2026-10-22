import { createFileRoute } from "@tanstack/react-router";
import { AdminProductsPage } from "../pages/admin/AdminProductsPage";
import { requirePermission } from "../lib/route-guards";

export const Route = createFileRoute("/_app/admin/products/")({
  beforeLoad: requirePermission("VIEW"),
  component: AdminProductsPage,
});
