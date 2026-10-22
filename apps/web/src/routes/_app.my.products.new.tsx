import { createFileRoute } from "@tanstack/react-router";
import { ProductEditorPage } from "../pages/registrant/ProductEditorPage";
import { requireRole } from "../lib/route-guards";

export const Route = createFileRoute("/_app/my/products/new")({
  beforeLoad: requireRole("REGISTRANT"),
  component: () => <ProductEditorPage />,
});
