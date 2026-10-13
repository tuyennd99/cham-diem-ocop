import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { getSession } from "../auth";

export function AppLayout({ children }: { children: ReactNode }) {
  const role = getSession()?.role;
  return (
    <div className="application-shell">
      <a className="skip-link" href="#content">Bỏ qua điều hướng</a>
      <aside className="application-sidebar" aria-label="Khu vực làm việc">
        <Link className="application-brand" to="/my/products">OCOP Đánh Giá</Link>
        <nav aria-label="Điều hướng khu vực làm việc">
          <Link to="/my/products">Hồ sơ của tôi</Link>
          <Link to="/my/products/new">Tạo hồ sơ</Link>
          <Link to="/account">Tài khoản</Link>
          {role === "JUDGE" && <Link to="/judge">Hàng chờ chấm</Link>}
          {role === "ADMIN" && <Link to="/admin/products">Quản trị hồ sơ</Link>}
        </nav>
      </aside>
      <div className="application-main">
        <header className="application-topbar">
          <span>Khu vực làm việc</span>
          <Link to="/">Trang công khai</Link>
        </header>
        <main className="application-content" id="content">{children}</main>
      </div>
    </div>
  );
}
