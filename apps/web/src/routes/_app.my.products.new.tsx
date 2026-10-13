import { createFileRoute } from "@tanstack/react-router";
import { ProductEditorPage } from "../pages/RegistrantPages";
import { requireRole } from "../route-guards";

export const Route = createFileRoute("/_app/my/products/new")({
  beforeLoad: requireRole("REGISTRANT"),
  component: () => <ProductEditorPage />,
});
