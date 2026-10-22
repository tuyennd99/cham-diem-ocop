import { createFileRoute } from "@tanstack/react-router";
import { ProductEditorPage } from "../pages/registrant/ProductEditorPage";
import { requireRole } from "../lib/route-guards";

export const Route = createFileRoute("/_app/my/products/$id/edit")({
  beforeLoad: requireRole("REGISTRANT"),
  component: EditRoute,
});

function EditRoute() {
  const { id } = Route.useParams();
  return <ProductEditorPage productId={id} />;
}
