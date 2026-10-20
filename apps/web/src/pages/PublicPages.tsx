import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi } from "../lib/use-api";
import type { Category } from "../types/product";
import type { PublicProduct } from "../types/public";

const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const statusLabel: Record<PublicProduct["status"], string> = { SUBMITTED: "Đã tiếp nhận", SCORING: "Đang đánh giá", COMPLETED: "Đã xếp hạng" };

export function PublicCatalogPage() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (categoryId) params.set("categoryId", categoryId);
  if (appliedQuery) params.set("q", appliedQuery);
  const categoryRequest = useApi<Category[]>("/categories");
  const productRequest = useApi<PublicProduct[]>(`/products?${params}`);
  const categories = categoryRequest.result?.data ?? [];
  const rows = productRequest.result?.data ?? [];
  const meta = productRequest.result?.meta ?? { page, limit: 20, total: rows.length, totalPages: productRequest.result ? 1 : 0 };
  const error = categoryRequest.error || productRequest.error;
  const loading = productRequest.loading;

  return <main className="route-main" id="content"><div className="container route-container">
    <div className="section-heading"><div><p className="eyebrow">TRA CỨU CÔNG KHAI</p><h1>Danh sách sản phẩm OCOP</h1></div><p className="section-intro">Hồ sơ được hiển thị sau khi chủ thể nộp đăng ký.</p></div>
    <form className="lookup-controls" onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedQuery(query.trim()); }}>
      <div className="field search-field"><label htmlFor="product-search">Tìm trong toàn danh mục</label><div className="search-row"><Input id="product-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên sản phẩm, mã hoặc nhóm" />{query && <Button type="button" variant="secondary" onClick={() => { setQuery(""); setAppliedQuery(""); setPage(1); }}>Xóa từ khóa</Button>}</div></div>
      <div className="field status-field"><label htmlFor="product-category">Nhóm sản phẩm</label><select id="product-category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}><option value="">Tất cả nhóm</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.groupName} · {item.name}</option>)}</select></div>
      <Button type="submit" disabled={loading}>Tìm kiếm</Button>
    </form>
    <p className="result-count" aria-live="polite">{loading ? "Đang tải hồ sơ…" : error ? "Tạm thời chưa tải được dữ liệu" : `${meta.total} hồ sơ`}</p>
    {!loading && error && (
      <div className="state-panel state-panel-error" role="alert">
        <div className="state-panel-copy">
          <p className="state-eyebrow">TẠM THỜI GIÁN ĐOẠN KẾT NỐI</p>
          <h2>Chưa tải được danh sách sản phẩm OCOP</h2>
          <p>Hệ thống tra cứu đang tạm thời không phản hồi ({error}). Vui lòng thử tải lại.</p>
        </div>
        <div className="state-actions">
          <button type="button" className="button button-primary" onClick={() => { categoryRequest.reload(); productRequest.reload(); }}>Thử lại</button>
        </div>
      </div>
    )}
    {loading && <div className="record-list-skeleton" aria-busy="true" aria-label="Đang tải danh sách">{Array.from({ length: 4 }, (_, index) => <div className="record-row skeleton-record" key={index}><div className="skeleton-media" /><div className="skeleton-copy"><div className="skeleton-line" /><div className="skeleton-line short" /><div className="skeleton-line" /></div></div>)}</div>}
    {!loading && !error && rows.length === 0 && <div className="empty-state"><h2>Chưa có hồ sơ phù hợp</h2><p>Thử đổi từ khóa hoặc nhóm sản phẩm.</p></div>}
    {!loading && !error && <div className="record-list">{rows.map((product) => <article className="record-row" key={product.id}>
      <div className="record-media">{product.attachments[0] ? <img src={`${apiBase}/products/${product.id}/attachments/${product.attachments[0].id}`} alt={product.name} loading="lazy" /> : <span className="empty-media" aria-label="Chưa có ảnh sản phẩm">OCOP</span>}</div>
      <div className="record-main"><div className="record-badges"><span className="badge badge-category">{product.category.groupName}</span><span className={`badge status-badge status-${product.status.toLowerCase()}`}>{statusLabel[product.status]}</span></div><h2>{product.name}</h2><p className="record-origin">{product.category.name}</p><dl className="record-facts"><div><dt>Mã hồ sơ</dt><dd>{product.id}</dd></div><div><dt>Ngày tạo</dt><dd>{new Date(product.createdAt).toLocaleDateString("vi-VN")}</dd></div></dl></div>
      <div className="record-result">{product.starRating ? <div className="rating-block"><strong>{product.starRating} sao</strong><span className="stars" aria-label={`${product.starRating} sao`}>★{product.starRating > 1 ? ` × ${product.starRating}` : ""}</span></div> : <p className="no-rating">Chưa có kết quả</p>}<Link className="button button-secondary detail-link" to="/products/$id" params={{ id: product.id }}>Xem hồ sơ</Link></div>
    </article>)}</div>}
    {!error && <nav className="pagination" aria-label="Phân trang"><Button variant="secondary" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Trang trước</Button><span className="page-count">Trang {page} / {Math.max(1, meta.totalPages)}</span><Button variant="secondary" disabled={loading || page >= meta.totalPages || meta.totalPages === 0} onClick={() => setPage(page + 1)}>Trang sau</Button></nav>}
  </div></main>;
}

export function PublicProductDetailPage({ id }: { id: string }) {
  const { result, error } = useApi<PublicProduct>(`/products/${encodeURIComponent(id)}`);
  const product = result?.data ?? null;
  if (error) return <main className="route-main" id="content"><div className="container route-container"><div className="empty-state" role="alert"><h1>Chưa tải được sản phẩm</h1><p>{error}</p><Link className="text-link" to="/products">Quay lại danh sách</Link></div></div></main>;
  if (!product) return <main className="route-main" id="content"><div className="container route-container"><div className="detail-skeleton" aria-busy="true" aria-label="Đang tải sản phẩm"><div className="skeleton-media" /><div className="skeleton-line" /><div className="skeleton-line short" /></div></div></main>;
  return <main className="route-main" id="content"><div className="container route-container"><Link className="text-link" to="/products">← Danh sách sản phẩm</Link><section className="route-panel public-product-detail" aria-labelledby="route-title"><div className="public-product-heading"><div><p className="eyebrow">SẢN PHẨM OCOP · {statusLabel[product.status]}</p><h1 id="route-title">{product.name}</h1><p>{product.category.groupName} · {product.category.name}</p></div>{product.finalScore !== null && <strong className="public-product-rating">{product.finalScore} điểm · {product.starRating} sao</strong>}</div>{product.description && <p className="public-product-description">{product.description}</p>}<h2>Hình ảnh sản phẩm</h2>{product.attachments.length ? <div className="public-image-gallery">{product.attachments.map((attachment, index) => <figure key={attachment.id}><img src={`${apiBase}/products/${product.id}/attachments/${attachment.id}`} alt={`${product.name} — ảnh ${index + 1}`} loading="lazy" /></figure>)}</div> : <div className="empty-state"><p>Chưa có hình ảnh công khai cho sản phẩm này.</p></div>}</section></div></main>;
}
