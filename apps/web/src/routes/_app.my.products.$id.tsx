import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "../components/RoutePlaceholder";

export const Route = createFileRoute("/_app/my/products/$id")({
  component: () => <RoutePlaceholder title="Hồ sơ và kết quả" />,
});
