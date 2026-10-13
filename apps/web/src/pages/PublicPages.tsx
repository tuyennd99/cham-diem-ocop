import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, messageOf, type ApiResult } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Category { id: string; name: string; groupName: string }
interface Attachment { id: string; fileName: string }
interface PublicProduct {
  id: string; name: string; description: string | null; status: "SUBMITTED" | "SCORING" | "COMPLETED";
  finalScore: number | null; starRating: number | null; createdAt: string;
  category: Category; attachments: Attachment[];
}

const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const statusLabel: Record<PublicProduct["status"], string> = { SUBMITTED: "Đã tiếp nhận", SCORING: "Đang đánh giá", COMPLETED: "Đã xếp hạng" };

export function PublicCatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<PublicProduct[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { let active = true;
    api<Category[]>("/categories").then(({ data }) => { if (active) setCategories(data); }).catch((e) => { if (active) setError(messageOf(e)); });
    return () => { active = false; };
  }, []);

  useEffect(() => { let active = true; setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (categoryId) params.set("categoryId", categoryId);
    api<PublicProduct[]>(`/products?${params}`).then((result: ApiResult<PublicProduct[]>) => {
      if (!active) return;
      setRows(result.data); setMeta(result.meta ?? { page, limit: 20, total: result.data.length, totalPages: 1 });
    }).catch((e) => { if (active) setError(messageOf(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [categoryId, page]);

  const visible = rows.filter((product) => !query || `${product.name} ${product.id} ${product.category.name} ${product.category.groupName}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  return <main className="route-main" id="content"><div className="container route-container">
    <div className="section-heading"><div><p className="eyebrow">TRA CỨU CÔNG KHAI</p><h1>Danh sách sản phẩm OCOP</h1></div><p className="section-intro">Hồ sơ được hiển thị sau khi chủ thể nộp đăng ký.</p></div>
    <div className="lookup-controls">
      <div className="field search-field"><label htmlFor="product-search">Tìm trong trang này</label><Input id="product-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên sản phẩm hoặc nhóm" /></div>
      <div className="field status-field"><label htmlFor="product-category">Nhóm sản phẩm</label><select id="product-category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}><option value="">Tất cả nhóm</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.groupName} · {item.name}</option>)}</select></div>
    </div>
    <p className="result-count" aria-live="polite">{loading ? "Đang tải hồ sơ…" : `${meta.total} hồ sơ`}</p>
    {error && <p role="alert" className="form-note">{error}</p>}
    {!loading && !error && visible.length === 0 && <div className="empty-state"><h2>Chưa có hồ sơ phù hợp</h2><p>Thử đổi từ khóa hoặc nhóm sản phẩm.</p></div>}
    <div className="record-list">{visible.map((product) => <article className="record-row" key={product.id}>
      <div className="record-media">{product.attachments[0] ? <img src={`${apiBase}/products/${product.id}/attachments/${product.attachments[0].id}`} alt={product.name} loading="lazy" /> : <span className="empty-media" aria-label="Chưa có ảnh sản phẩm">OCOP</span>}</div>
      <div className="record-main"><div className="record-badges"><span className="badge badge-category">{product.category.groupName}</span><span className={`badge status-badge status-${product.status.toLowerCase()}`}>{statusLabel[product.status]}</span></div><h2>{product.name}</h2><p className="record-origin">{product.category.name}</p><dl className="record-facts"><div><dt>Mã hồ sơ</dt><dd>{product.id}</dd></div><div><dt>Ngày tạo</dt><dd>{new Date(product.createdAt).toLocaleDateString("vi-VN")}</dd></div></dl></div>
      <div className="record-result">{product.starRating ? <div className="rating-block"><strong>{product.starRating} sao</strong><span className="stars" aria-label={`${product.starRating} sao`}>★{product.starRating > 1 ? ` × ${product.starRating}` : ""}</span></div> : <p className="no-rating">Chưa có kết quả</p>}<Link className="button button-secondary detail-link" to="/products/$id" params={{ id: product.id }}>Xem hồ sơ</Link></div>
    </article>)}</div>
    {meta.totalPages > 1 && <nav className="pagination" aria-label="Phân trang"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</Button><span className="page-count">Trang {page} / {meta.totalPages}</span><Button variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Trang sau</Button></nav>}
  </div></main>;
}

export function PublicProductDetailPage({ id }: { id: string }) {
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; api<PublicProduct>(`/products/${encodeURIComponent(id)}`).then(({ data }) => { if (active) setProduct(data); }).catch((e) => { if (active) setError(messageOf(e)); }); return () => { active = false; }; }, [id]);
  if (error) return <main className="route-main" id="content"><div className="container route-container"><p role="alert" className="form-note">{error}</p><Link className="text-link" to="/products">Quay lại danh sách</Link></div></main>;
  if (!product) return <main className="route-main" id="content"><div className="container route-container"><p>Đang tải hồ sơ…</p></div></main>;
  return <main className="route-main" id="content"><div className="container route-container"><Link className="text-link" to="/products">← Danh sách hồ sơ</Link><section className="route-panel" aria-labelledby="route-title"><p className="eyebrow">CHI TIẾT HỒ SƠ CÔNG KHAI · {statusLabel[product.status]}</p><h1 id="route-title">{product.name}</h1><p>{product.category.groupName} · {product.category.name}</p>{product.description && <p>{product.description}</p>}{product.finalScore !== null && <p><strong>{product.finalScore} điểm · {product.starRating} sao</strong></p>}<h2>Tài liệu hình ảnh</h2><div className="record-list">{product.attachments.map((attachment) => <figure key={attachment.id}><img className="public-attachment" src={`${apiBase}/products/${product.id}/attachments/${attachment.id}`} alt={attachment.fileName} /><figcaption>{attachment.fileName}</figcaption></figure>)}</div></section></div></main>;
}
