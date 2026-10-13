import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "../components/RoutePlaceholder";

export const Route = createFileRoute("/_app/my/products/")({
  component: () => <RoutePlaceholder title="Hồ sơ của tôi" />,
});
