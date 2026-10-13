import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "../components/RoutePlaceholder";

export const Route = createFileRoute("/_app/my/products/$id/edit")({
  component: () => <RoutePlaceholder title="Sửa hồ sơ nháp" />,
});
