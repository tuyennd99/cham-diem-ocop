import { createFileRoute } from "@tanstack/react-router";
import { MyProductDetailPage } from "../pages/RegistrantPages";
import { requireRole } from "../route-guards";

export const Route = createFileRoute("/_app/my/products/$id")({
  beforeLoad: requireRole("REGISTRANT"),
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { id } = Route.useParams();
  return <MyProductDetailPage productId={id} />;
}
