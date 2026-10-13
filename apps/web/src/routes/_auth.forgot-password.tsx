import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "../pages/AuthPages";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
});
