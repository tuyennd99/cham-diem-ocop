import { Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { getSession } from "../auth";

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const signedIn = Boolean(getSession());

  return (
    <>
      <a className="skip-link" href="#content">Bỏ qua điều hướng</a>
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
            <Link className="mobile-login" to="/login" onClick={() => setMenuOpen(false)}>Đăng nhập</Link>
          </nav>
          <div className="header-actions">
            <Link className="header-login" to="/login">Đăng nhập</Link>
            <Link className="button button-primary header-cta" to={signedIn ? "/my/products/new" : "/register"}>Đăng ký sản phẩm</Link>
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand"><strong>OCOP Đánh Giá</strong><p>Hệ thống đăng ký, chấm điểm và xếp hạng sản phẩm OCOP.</p></div>
          <div><h2>Điều hướng</h2><Link to="/products">Tra cứu hồ sơ</Link><Link to="/" hash="workflow">Quy trình</Link><Link to="/" hash="criteria">Tiêu chí đánh giá</Link></div>
          <div><h2>Căn cứ tham khảo</h2><a href="https://vanban.chinhphu.vn/?docid=218267&amp;orggroupid=3&amp;pageid=27160" target="_blank" rel="noreferrer">Quyết định 26/2026/QĐ-TTg</a><p>Dữ liệu hiển thị trên trang là minh họa, không gửi hoặc lưu hồ sơ thật.</p></div>
        </div>
        <div className="container footer-bottom"><span>© OCOP Đánh Giá</span><span>Ảnh tham khảo được lưu cục bộ; nguồn được ghi tại danh sách hồ sơ.</span></div>
      </footer>
    </>
  );
}
