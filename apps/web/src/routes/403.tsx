import { createFileRoute } from "@tanstack/react-router";
import { ForbiddenPage } from "../pages/RoutePages";

export const Route = createFileRoute("/403")({
  component: ForbiddenPage,
});
