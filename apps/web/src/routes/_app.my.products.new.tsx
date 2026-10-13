import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "../components/RoutePlaceholder";

export const Route = createFileRoute("/_app/my/products/new")({
  component: () => <RoutePlaceholder title="Tạo hồ sơ sản phẩm" />,
});
