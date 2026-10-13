import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "../components/RoutePlaceholder";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <main className="route-main" id="content">
      <div className="container route-container">
        <RoutePlaceholder title="Quên mật khẩu" />
      </div>
    </main>
  );
}
