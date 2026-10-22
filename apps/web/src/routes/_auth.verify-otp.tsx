import { createFileRoute } from "@tanstack/react-router";
import { VerifyOtpPage } from "../pages/auth/VerifyOtpPage";

export const Route = createFileRoute("/_auth/verify-otp")({
  component: VerifyOtpPage,
});
