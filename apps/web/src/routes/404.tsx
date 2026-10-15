import { createFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "../pages/RoutePages";

export const Route = createFileRoute("/404")({
  component: NotFoundPage,
});
