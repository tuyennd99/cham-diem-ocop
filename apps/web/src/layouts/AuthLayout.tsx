import { Link, Outlet } from "@tanstack/react-router";

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <a className="skip-link" href="#content">Bỏ qua biểu mẫu</a>
      <Link className="auth-brand" to="/">OCOP Đánh Giá</Link>
      <Outlet />
    </div>
  );
}
