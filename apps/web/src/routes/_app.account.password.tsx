import { createFileRoute } from "@tanstack/react-router";
import { ChangePasswordPage } from "../pages/AuthPages";

export const Route = createFileRoute("/_app/account/password")({
  component: ChangePasswordPage,
});
