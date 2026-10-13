import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { api, apiBlob, jsonBody, messageOf } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Category { id: string; name: string; groupName: string }
interface Attachment { id: string; type: "IMAGE" | "EVIDENCE"; fileName: string; createdAt: string }
interface Product {
  id: string; name: string; description: string | null; formData: Record<string, unknown>; status: string;
  finalScore: number | null; starRating: number | null; updatedAt: string; category: Category; attachments: Attachment[];
}
const attachmentUrl = (productId: string, attachmentId: string) => `/my/products/${productId}/attachments/${attachmentId}`;

export function MyProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = () => api<Product[]>("/my/products").then(({ data }) => setProducts(data)).catch((e) => setError(messageOf(e))).finally(() => setLoading(false));
  useEffect(() => { void refresh(); }, []);
  async function remove(id: string) { if (!window.confirm("Xóa bản nháp này?")) return; try { await api(`/my/products/${id}`, { method: "DELETE" }); setProducts((rows) => rows.filter((item) => item.id !== id)); } catch (e) { setError(messageOf(e)); } }
  async function submit(id: string) { if (!window.confirm("Nộp hồ sơ này để bắt đầu đánh giá? Sau khi nộp, không thể sửa bản nháp.")) return; try { const { data } = await api<Product>(`/my/products/${id}/submit`, { method: "POST" }); setProducts((rows) => rows.map((item) => item.id === id ? { ...item, ...data } : item)); } catch (e) { setError(messageOf(e)); } }
  return <section><div className="section-heading"><div><p className="eyebrow">KHU VỰC CHỦ THỂ</p><h1>Hồ sơ của tôi</h1></div><Link className="button button-primary" to="/my/products/new">Tạo hồ sơ</Link></div>
    {error && <p className="form-note" role="alert">{error}</p>}{loading && <p>Đang tải hồ sơ…</p>}
    {!loading && !products.length && <div className="empty-state"><h2>Chưa có hồ sơ</h2><p>Tạo bản nháp để bắt đầu đăng ký sản phẩm.</p><Link className="button button-primary" to="/my/products/new">Tạo hồ sơ</Link></div>}
    <div className="record-list">{products.map((product) => <article className="record-row" key={product.id}><div className="record-main"><div className="record-badges"><span className="badge badge-category">{product.category.groupName} · {product.category.name}</span><span className="badge">{product.status}</span></div><h2>{product.name}</h2><p className="record-origin">Cập nhật {new Date(product.updatedAt).toLocaleString("vi-VN")}</p><p>{product.attachments.length} tệp đính kèm</p></div><div className="record-result">{product.finalScore !== null && <strong>{product.finalScore} điểm · {product.starRating} sao</strong>}<Link className="button button-secondary" to="/my/products/$id" params={{ id: product.id }}>Mở hồ sơ</Link>{product.status === "DRAFT" && <><Link className="text-link" to="/my/products/$id/edit" params={{ id: product.id }}>Sửa bản nháp</Link><Button variant="secondary" onClick={() => void submit(product.id)}>Nộp hồ sơ</Button><Button variant="secondary" onClick={() => void remove(product.id)}>Xóa</Button></>}</div></article>)}</div>
  </section>;
}

export function ProductEditorPage({ productId }: { productId?: string }) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [formData, setFormData] = useState("{}");
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true;
    Promise.all([api<Category[]>("/categories"), productId ? api<Product[]>("/my/products") : Promise.resolve({ data: [] as Product[] })]).then(([categoryResult, productResult]) => {
      if (!active) return; setCategories(categoryResult.data);
      const current = productId ? productResult.data.find((item) => item.id === productId) : undefined;
      if (current) { setProduct(current); setName(current.name); setDescription(current.description ?? ""); setCategoryId(current.category.id); setFormData(JSON.stringify(current.formData ?? {}, null, 2)); }
      else if (!productId) setCategoryId(categoryResult.data[0]?.id ?? "");
    }).catch((e) => { if (active) setError(messageOf(e)); }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [productId]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    let parsed: unknown; try { parsed = JSON.parse(formData); if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error(); } catch { setError("Dữ liệu hồ sơ phải là một đối tượng JSON hợp lệ."); setBusy(false); return; }
    try {
      const payload = { name, description, categoryId, formData: parsed };
      const existingId = productId ?? product?.id;
      const { data } = existingId ? await api<Product>(`/my/products/${existingId}`, { method: "PUT", body: jsonBody(payload) }) : await api<Product>("/my/products", { method: "POST", body: jsonBody(payload) });
      const targetId = existingId ?? data.id;
      setProduct(data);
      const uploaded = new Set(uploadedFiles);
      for (const file of Array.from(files ?? [])) {
        const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
        if (uploaded.has(fileKey)) continue;
        const body = new FormData(); body.append("file", file);
        const { data: attachment } = await api<Attachment>(`/my/products/${targetId}/attachments`, { method: "POST", body });
        uploaded.add(fileKey); setUploadedFiles(new Set(uploaded));
        setProduct((current) => current ? { ...current, attachments: [...current.attachments, attachment] } : current);
      }
      await navigate({ to: "/my/products/$id", params: { id: targetId } });
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }
  if (productId && !loaded && !error) return <p>Đang tải bản nháp…</p>;
  if (productId && loaded && !product) return <section><h1>Không tìm thấy bản nháp</h1><p role="alert">{error || "Hồ sơ không tồn tại hoặc bạn không có quyền truy cập."}</p><Link to="/my/products">Quay lại danh sách</Link></section>;
  if (product && product.status !== "DRAFT") return <section><h1>Hồ sơ đã nộp</h1><p>Hồ sơ không còn ở trạng thái bản nháp nên không thể sửa.</p><Link to="/my/products/$id" params={{ id: product.id }}>Quay lại hồ sơ</Link></section>;
  return <section className="route-panel"><p className="eyebrow">KHU VỰC CHỦ THỂ</p><h1>{productId ? "Sửa hồ sơ nháp" : "Tạo hồ sơ sản phẩm"}</h1><p>Nhập dữ liệu đăng ký và đính kèm ảnh hoặc tài liệu PDF. Mỗi tệp tối đa 10 MB.</p>
    <form className="account-form" onSubmit={save}><label>Tên sản phẩm<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} required /></label><label>Nhóm sản phẩm<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required><option value="">Chọn nhóm</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.groupName} · {item.name}</option>)}</select></label><label>Mô tả<textarea rows={4} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} /></label><label>Thông tin biểu mẫu (JSON)<textarea rows={10} value={formData} onChange={(e) => setFormData(e.target.value)} spellCheck={false} /></label><label>Ảnh và tài liệu<Input type="file" accept="image/*,application/pdf" multiple onChange={(e) => setFiles(e.target.files)} /></label>{files && Array.from(files).map((file) => <p key={`${file.name}:${file.lastModified}`}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>)}{error && <p role="alert" className="form-note">{error}</p>}<Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu bản nháp"}</Button></form>
  </section>;
}

export function MyProductDetailPage({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; api<Product[]>("/my/products").then(({ data }) => { const found = data.find((item) => item.id === productId); if (!found) throw new Error("Không tìm thấy hồ sơ."); if (active) setProduct(found); }).catch((e) => { if (active) setError(messageOf(e)); }); return () => { active = false; }; }, [productId]);
  async function submit() { try { const { data } = await api<Product>(`/my/products/${productId}/submit`, { method: "POST" }); setProduct(data); } catch (e) { setError(messageOf(e)); } }
  async function removeAttachment(attachmentId: string) { try { await api(attachmentUrl(productId, attachmentId), { method: "DELETE" }); setProduct((current) => current ? { ...current, attachments: current.attachments.filter((file) => file.id !== attachmentId) } : current); } catch (e) { setError(messageOf(e)); } }
  if (!product) return <section><h1>Hồ sơ và kết quả</h1>{error ? <p role="alert">{error}</p> : <p>Đang tải…</p>}</section>;
  return <section className="route-panel"><Link className="text-link" to="/my/products">← Hồ sơ của tôi</Link><p className="eyebrow">{product.status}</p><h1>{product.name}</h1><p>{product.category.groupName} · {product.category.name}</p>{product.description && <p>{product.description}</p>}{product.finalScore !== null && <p><strong>{product.finalScore} điểm · {product.starRating} sao</strong></p>}{error && <p role="alert" className="form-note">{error}</p>}
    <div className="record-result">{product.status === "DRAFT" && <><Link className="button button-secondary" to="/my/products/$id/edit" params={{ id: product.id }}>Sửa bản nháp</Link><Button onClick={() => void submit()}>Nộp hồ sơ</Button></>}</div>
    <h2>Tệp đính kèm</h2><ul>{product.attachments.map((file) => <li key={file.id}><AttachmentLink path={attachmentUrl(productId, file.id)} name={file.fileName} /> · {file.type}{product.status === "DRAFT" && <Button variant="secondary" onClick={() => void removeAttachment(file.id)}>Xóa</Button>}</li>)}</ul>
    <h2>Thông tin hồ sơ</h2><pre>{JSON.stringify(product.formData, null, 2)}</pre>
  </section>;
}

function AttachmentLink({ path, name }: { path: string; name: string }) {
  async function open() { try { const blob = await apiBlob(path); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noreferrer"; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000); } catch (e) { window.alert(messageOf(e)); } }
  return <button type="button" className="text-link" onClick={() => void open()}>{name}</button>;
}
