import { createFileRoute } from "@tanstack/react-router";
import { VerifyOtpPage } from "../pages/AuthPages";

export const Route = createFileRoute("/_auth/verify-otp")({
  component: VerifyOtpPage,
});
