import { createFileRoute } from "@tanstack/react-router";
import { MyProductsPage } from "../pages/RegistrantPages";
import { requireRole } from "../route-guards";

export const Route = createFileRoute("/_app/my/products/")({
  beforeLoad: requireRole("REGISTRANT"),
  component: MyProductsPage,
});
