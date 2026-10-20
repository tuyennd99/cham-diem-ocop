import { Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { getSession, homeFor } from "../lib/auth";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const session = getSession();
  const signedIn = Boolean(session);
  const workPath = session ? homeFor(session.user.role, "/my/products/new") : "/my/products/new";

  return (
    <header className="site-header">
      <div className={`container header-inner${menuOpen ? " menu-open" : ""}`}>
        <Link className="brand" to="/" hash="home" aria-label="OCOP Đánh Giá — Trang chủ">
          <span className="brand-mark" aria-hidden="true">★</span>
          <span className="brand-copy">
            <strong>OCOP Đánh Giá</strong>
            <span>Hệ thống đăng ký, chấm điểm và xếp hạng sản phẩm OCOP</span>
          </span>
        </Link>
        <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-nav" onClick={() => setMenuOpen((open) => !open)}>
          <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span><span className="sr-only">{menuOpen ? "Đóng menu" : "Mở menu"}</span>
        </button>
        <nav className="primary-nav" id="primary-nav" aria-label="Điều hướng chính">
          <Link to="/" hash="home" onClick={() => setMenuOpen(false)}>Trang chủ</Link>
          <Link to="/products" onClick={() => setMenuOpen(false)}>Tra cứu</Link>
          <Link to="/" hash="workflow" onClick={() => setMenuOpen(false)}>Quy trình</Link>
          <Link to="/" hash="criteria" onClick={() => setMenuOpen(false)}>Tiêu chí đánh giá</Link>
          <div className="mobile-nav-actions">
            <Link className="button button-secondary mobile-login" to={signedIn ? workPath : "/login"} onClick={() => setMenuOpen(false)}>{signedIn ? "Khu vực làm việc" : "Đăng nhập"}</Link>
            <Link className="button button-primary mobile-cta" to={signedIn ? workPath : "/register"} onClick={() => setMenuOpen(false)}>{signedIn ? "Mở hồ sơ" : "Đăng ký sản phẩm"}</Link>
          </div>
        </nav>
        <div className="header-actions">
          <Link className="header-login" to={signedIn ? workPath : "/login"}>{signedIn ? session?.user.fullName : "Đăng nhập"}</Link>
          <Link className="button button-primary header-cta" to={signedIn ? workPath : "/register"}>{signedIn ? "Khu vực làm việc" : "Đăng ký sản phẩm"}</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand"><strong>OCOP Đánh Giá</strong><p>Hệ thống đăng ký, chấm điểm và xếp hạng sản phẩm OCOP.</p></div>
        <div><h2>Điều hướng</h2><Link to="/products">Tra cứu hồ sơ</Link><Link to="/" hash="workflow">Quy trình</Link><Link to="/" hash="criteria">Tiêu chí đánh giá</Link></div>
        <div><h2>Căn cứ tham khảo</h2><a href="https://xaydungchinhsach.chinhphu.vn/quyet-dinh-so-26-2026-qd-ttg-bo-tieu-chi-va-quy-trinh-danh-gia-phan-hang-san-pham-ocop-119260529164111182.htm" target="_blank" rel="noreferrer">Quyết định 26/2026/QĐ-TTg</a><p>Hồ sơ công khai chỉ hiển thị thông tin được phép công bố.</p></div>
      </div>
      <div className="container footer-bottom"><span>© OCOP Đánh Giá</span><span>Thông tin hồ sơ được tải từ hệ thống.</span></div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <>
      <Outlet />
      <SiteFooter />
    </>
  );
}
