import { createFileRoute } from "@tanstack/react-router";
import { AdminProductsPage } from "../pages/admin/AdminProductsPage";
import { requireRole } from "../lib/route-guards";

export const Route = createFileRoute("/_app/admin/products/")({
  beforeLoad: requireRole("ADMIN"),
  component: AdminProductsPage,
});
