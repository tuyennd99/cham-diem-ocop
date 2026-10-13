import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "../components/RoutePlaceholder";

export const Route = createFileRoute("/_app/account")({
  component: () => <RoutePlaceholder title="Tài khoản cá nhân" />,
});
