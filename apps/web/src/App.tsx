import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Product } from "@ocop/shared";
import { getSession, homeFor } from "./auth";
import { useApi } from "./use-api";
import type { Category } from "./types";

type FeaturedProduct = Pick<Product, "id" | "name" | "description" | "status" | "finalScore" | "starRating" | "category" | "attachments"> & { category: Category };
const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const publicStatus = { SUBMITTED: "Đã tiếp nhận", SCORING: "Đang đánh giá", COMPLETED: "Đã xếp hạng" } as const;

export default function App() {
  const session = getSession();
  const workPath = homeFor(session?.user.role ?? "REGISTRANT");
  const [categoryId, setCategoryId] = useState("");
  const categoryRequest = useApi<Category[]>("/categories");
  const params = new URLSearchParams({ page: "1", limit: "8" });
  if (categoryId) params.set("categoryId", categoryId);
  const productRequest = useApi<FeaturedProduct[]>(`/products?${params}`);
  const categories = categoryRequest.result?.data ?? [];
  const products = productRequest.result?.data ?? [];
  const loading = productRequest.loading;
  const error = categoryRequest.error || productRequest.error;
  return <main id="content">
    <section className="hero section" id="home" aria-labelledby="hero-title"><div className="container hero-grid"><div className="hero-copy"><p className="eyebrow">ĐĂNG KÝ · CHẤM ĐIỂM · XẾP HẠNG</p><h1 id="hero-title">Theo dõi hồ sơ OCOP trong một nơi</h1><p className="lead">Tra cứu sản phẩm, gửi hồ sơ đăng ký và theo dõi kết quả đánh giá trên cùng một hệ thống.</p><div className="hero-actions"><Link className="button button-primary" to={session ? workPath : "/register"}>{session ? "Vào khu vực làm việc" : "Đăng ký sản phẩm"}</Link><Link className="button button-secondary" to="/products">Tra cứu sản phẩm</Link></div></div><aside className="hero-aside"><p className="eyebrow">DÀNH CHO CHỦ THỂ</p><h2>Hồ sơ và tiến độ trong một tài khoản</h2><p>Lưu bản nháp, bổ sung tài liệu, nộp hồ sơ và xem kết quả khi hội đồng hoàn tất đánh giá.</p><Link className="text-link" to={session ? workPath : "/register"}>Mở khu vực hồ sơ →</Link></aside></div></section>
    <section className="section workflow-section" id="workflow" aria-labelledby="workflow-title"><div className="container"><div className="section-heading section-heading-narrow"><div><p className="eyebrow">QUY TRÌNH TRÊN HỆ THỐNG</p><h2 id="workflow-title">Từ hồ sơ đến kết quả xếp hạng</h2></div><p className="section-intro">Các bước xử lý được ghi nhận trên hồ sơ để chủ thể và giám khảo theo dõi.</p></div><div className="steps-grid"><article className="step-item"><span className="step-number">01</span><h3>Gửi hồ sơ</h3><p>Chủ thể đăng ký nhập thông tin sản phẩm và tải tài liệu minh chứng.</p></article><article className="step-item"><span className="step-number">02</span><h3>Đánh giá</h3><p>Giám khảo chấm các tiểu tiêu chí theo bộ tiêu chí của nhóm sản phẩm.</p></article><article className="step-item"><span className="step-number">03</span><h3>Tổng hợp kết quả</h3><p>Hệ thống ghi nhận kết quả sau khi các phiếu đánh giá được nộp.</p></article></div></div></section>
    <section className="section criteria-section" id="criteria" aria-labelledby="criteria-title"><div className="container"><div className="section-heading section-heading-narrow"><div><p className="eyebrow">QUYẾT ĐỊNH 26/2026/QĐ-TTg</p><h2 id="criteria-title">Thang điểm tối đa 100 điểm</h2></div><p className="section-intro">Bộ tiêu chí cụ thể được áp dụng theo nhóm sản phẩm và dữ liệu do hệ thống quản lý.</p></div><div className="star-bands"><div><strong>5 sao</strong><span>90–100 điểm</span></div><div><strong>4 sao</strong><span>70–89 điểm</span></div><div><strong>3 sao</strong><span>50–69 điểm</span></div><div><strong>2 sao</strong><span>30–49 điểm</span></div><div><strong>1 sao</strong><span>Dưới 30 điểm</span></div></div><Link className="text-link source-link" to="/products">Xem sản phẩm công khai →</Link></div></section>
    <section className="section featured-section" aria-labelledby="featured-title"><div className="container"><div className="section-heading"><div><p className="eyebrow">TRA CỨU SẢN PHẨM</p><h2 id="featured-title">Sản phẩm công khai</h2></div><label className="field featured-filter">Nhóm sản phẩm<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Tất cả nhóm</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.groupName} · {category.name}</option>)}</select></label></div>
      {loading && <div className="featured-grid" aria-busy="true" aria-label="Đang tải sản phẩm">{Array.from({ length: 4 }, (_, index) => <div className="featured-card skeleton-card" key={index}><div className="skeleton-media" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div>}
      {error && <p className="form-note" role="alert">Chưa tải được sản phẩm: {error}</p>}
      {!loading && !error && !products.length && <div className="empty-state"><h3>Chưa có sản phẩm trong nhóm này</h3><p>Chọn nhóm khác hoặc mở danh mục để tra cứu toàn bộ sản phẩm.</p></div>}
      {!loading && !error && products.length > 0 && <div className="featured-grid">{products.map((product) => <article className="featured-card" key={product.id}><Link to="/products/$id" params={{ id: product.id }} className="featured-image">{product.attachments[0] ? <img src={`${apiBase}/products/${product.id}/attachments/${product.attachments[0].id}`} alt={product.name} loading="lazy" /> : <span>Chưa có ảnh</span>}</Link><div className="featured-card-body"><span className="badge badge-category">{product.category.groupName} · {product.category.name}</span><h3><Link to="/products/$id" params={{ id: product.id }}>{product.name}</Link></h3>{publicStatus[product.status as keyof typeof publicStatus] && <p>{publicStatus[product.status as keyof typeof publicStatus]}</p>}{product.finalScore !== null && product.finalScore !== undefined && <strong>{product.finalScore} điểm · {product.starRating} sao</strong>}</div></article>)}</div>}
      <Link className="button button-secondary" to="/products">Xem tất cả sản phẩm</Link>
    </div></section>
  </main>;
}
