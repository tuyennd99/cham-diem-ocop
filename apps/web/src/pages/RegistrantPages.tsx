import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { Product as SharedProduct, ProductApplicationForm, ProductRegistrationType } from "@ocop/shared";
import { api, messageOf } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openAttachment } from "../attachments";
import { useApi } from "../use-api";
import type { Category as ProductCategoryView, ProductAttachmentRecord } from "../types";

type Category = ProductCategoryView & { classificationGroup: string; classificationSubgroup: string | null };
type Attachment = ProductAttachmentRecord;
type Product = Omit<SharedProduct, "formData" | "finalScore" | "starRating" | "submittedAt" | "updatedAt" | "category" | "attachments"> & {
  formData: Record<string, unknown>; finalScore: number | null; starRating: number | null;
  submittedAt: string | null; updatedAt: string; category: Category; attachments: Attachment[];
};
type RegistrationFormData = Omit<ProductApplicationForm, "sampleQuantity" | "assessmentYear" | "registrationType"> & {
  registrationType: ProductRegistrationType | "";
  sampleQuantity: string;
  assessmentYear: string;
};
const emptyRegistrationForm: RegistrationFormData = {
  entityName: "", representativeName: "", representativeTitle: "", contactAddress: "",
  provinceName: "", phone: "", email: "", registrationType: "", sampleQuantity: "",
  assessmentYear: String(new Date().getFullYear()), declarationAccepted: false,
};
const applicationSteps = ["Đơn vị đăng ký", "Thông tin sản phẩm", "Cam kết và tệp"];
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
    <div className="record-list">{products.map((product) => <article className="record-row" key={product.id}><div className="record-main"><div className="record-badges"><span className="badge badge-category">{product.category.groupName} · {product.category.name}</span><span className="badge">{product.status}</span></div><h2>{product.name}</h2><p className="record-origin">{product.submittedAt ? `Đã nộp ${new Date(product.submittedAt).toLocaleString("vi-VN")}` : `Cập nhật ${new Date(product.updatedAt).toLocaleString("vi-VN")}`}</p><p>{product.attachments.length} tệp đính kèm</p></div><div className="record-result">{product.finalScore !== null && <strong>{product.finalScore} điểm · {product.starRating} sao</strong>}<Link className="button button-secondary" to="/my/products/$id" params={{ id: product.id }}>Mở hồ sơ</Link>{product.status === "DRAFT" && <><Link className="text-link" to="/my/products/$id/edit" params={{ id: product.id }}>Sửa bản nháp</Link><Button variant="secondary" onClick={() => void submit(product.id)}>Nộp hồ sơ</Button><Button variant="secondary" onClick={() => void remove(product.id)}>Xóa</Button></>}</div></article>)}</div>
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
  const [registration, setRegistration] = useState<RegistrationFormData>(emptyRegistrationForm);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true;
    Promise.all([api<Category[]>("/categories"), productId ? api<Product[]>("/my/products") : Promise.resolve({ data: [] as Product[] })]).then(([categoryResult, productResult]) => {
      if (!active) return; setCategories(categoryResult.data);
      const current = productId ? productResult.data.find((item) => item.id === productId) : undefined;
      if (current) {
        const saved = current.formData ?? {};
        setProduct(current); setName(current.name); setDescription(current.description ?? ""); setCategoryId(current.category.id);
        setRegistration({
          entityName: String(saved.entityName ?? ""),
          representativeName: String(saved.representativeName ?? ""),
          representativeTitle: String(saved.representativeTitle ?? ""),
          contactAddress: String(saved.contactAddress ?? ""),
          provinceName: String(saved.provinceName ?? ""),
          phone: String(saved.phone ?? ""),
          email: String(saved.email ?? ""),
          registrationType: saved.registrationType === "FIRST" || saved.registrationType === "UPGRADE" || saved.registrationType === "REASSESSMENT" ? saved.registrationType : "",
          sampleQuantity: saved.sampleQuantity == null ? "" : String(saved.sampleQuantity),
          assessmentYear: saved.assessmentYear == null ? String(new Date().getFullYear()) : String(saved.assessmentYear),
          declarationAccepted: saved.declarationAccepted === true,
        });
      }
      else if (!productId) setCategoryId(categoryResult.data[0]?.id ?? "");
    }).catch((e) => { if (active) setError(messageOf(e)); }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [productId]);
  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setError(""); setBusy(true);
    try {
      const sampleQuantity = registration.sampleQuantity === "" ? 0 : Number(registration.sampleQuantity);
      if (!Number.isInteger(sampleQuantity) || sampleQuantity < 0) throw new Error("Số lượng mẫu phải là số nguyên không âm.");
      const formData = { ...registration, sampleQuantity, assessmentYear: registration.assessmentYear === "" ? undefined : Number(registration.assessmentYear) };
      const payload = { name, description, categoryId, formData };
      const existingId = productId ?? product?.id;
      const { data } = existingId ? await api<Product>(`/my/products/${existingId}`, { method: "PUT", body: JSON.stringify(payload) }) : await api<Product>("/my/products", { method: "POST", body: JSON.stringify(payload) });
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
  return <section className="route-panel"><p className="eyebrow">KHU VỰC CHỦ THỂ · MẪU 01</p><h1>{productId ? "Sửa hồ sơ nháp" : "Tạo hồ sơ sản phẩm"}</h1><p>Hoàn thành phiếu đăng ký theo từng bước. Ảnh và tài liệu minh chứng là tùy chọn; mỗi tệp tối đa 10 MB.</p>
    <ol className="form-steps" aria-label="Các bước đăng ký">{applicationSteps.map((label, index) => <li key={label}><button type="button" aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)}><span>{index + 1}</span>{label}</button></li>)}</ol>
    <form className="account-form" onSubmit={save}>
      <h2>Bước {step + 1} · {applicationSteps[step]}</h2>
      {step === 0 && <>
        <label>Tỉnh/thành phố đăng ký<Input value={registration.provinceName} onChange={(e) => setRegistration({ ...registration, provinceName: e.target.value })} maxLength={100} /></label>
        <label>Năm đăng ký<Input type="number" min={2020} max={2100} step={1} value={registration.assessmentYear} onChange={(e) => setRegistration({ ...registration, assessmentYear: e.target.value })} /></label>
        <label>Tên chủ thể đăng ký<Input value={registration.entityName} onChange={(e) => setRegistration({ ...registration, entityName: e.target.value })} maxLength={255} /></label>
        <label>Người đại diện theo pháp luật<Input value={registration.representativeName} onChange={(e) => setRegistration({ ...registration, representativeName: e.target.value })} maxLength={255} /></label>
        <label>Chức danh người đại diện<Input value={registration.representativeTitle} onChange={(e) => setRegistration({ ...registration, representativeTitle: e.target.value })} maxLength={255} /></label>
        <label>Địa chỉ liên hệ<textarea rows={3} value={registration.contactAddress} onChange={(e) => setRegistration({ ...registration, contactAddress: e.target.value })} maxLength={1000} /></label>
        <label>Số điện thoại<Input type="tel" autoComplete="tel" value={registration.phone} onChange={(e) => setRegistration({ ...registration, phone: e.target.value })} maxLength={30} /></label>
        <label>Email liên hệ<Input type="email" autoComplete="email" value={registration.email} onChange={(e) => setRegistration({ ...registration, email: e.target.value })} maxLength={320} /></label>
      </>}
      {step === 1 && <>
        <label>Tên sản phẩm<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} /></label>
        <label>Ngành, nhóm, phân nhóm sản phẩm<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Chọn phân loại sản phẩm</option>{categories.map((item) => <option key={item.id} value={item.id}>{[item.groupName, item.classificationGroup, item.classificationSubgroup].filter(Boolean).join(" · ")}</option>)}</select></label>
        <label>Mô tả<textarea rows={4} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label>Lần đăng ký đánh giá<select value={registration.registrationType} onChange={(e) => setRegistration({ ...registration, registrationType: e.target.value as RegistrationFormData["registrationType"] })}><option value="">Chọn lần đăng ký</option><option value="FIRST">Lần đầu</option><option value="UPGRADE">Nâng hạng</option><option value="REASSESSMENT">Đánh giá lại</option></select></label>
        <label>Số lượng sản phẩm mẫu<Input type="number" min={1} step={1} value={registration.sampleQuantity} onChange={(e) => setRegistration({ ...registration, sampleQuantity: e.target.value })} /></label>
      </>}
      {step === 2 && <>
        <label className="declaration-field" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}><input type="checkbox" style={{ width: "auto", minHeight: "auto", padding: 0, marginTop: 4 }} checked={registration.declarationAccepted} onChange={(e) => setRegistration({ ...registration, declarationAccepted: e.target.checked })} /><span>Tôi cam đoan thông tin kê khai là đúng sự thật, tuân thủ quy định đánh giá, phân hạng OCOP và chịu trách nhiệm về hồ sơ.</span></label>
        <label>Ảnh sản phẩm hoặc tài liệu minh chứng (không bắt buộc)<Input type="file" accept="image/*,application/pdf" multiple onChange={(e) => setFiles(e.target.files)} /></label>
        {files && Array.from(files).map((file) => <p key={`${file.name}:${file.lastModified}`}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>)}
      </>}
      {error && <p role="alert" className="form-note">{error}</p>}
      <div className="hero-actions">
        {step > 0 && <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>Quay lại</Button>}
        {step < applicationSteps.length - 1 && <Button type="button" onClick={() => setStep(step + 1)}>Tiếp tục</Button>}
        <Button type="submit" variant="secondary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu bản nháp"}</Button>
      </div>
    </form>
  </section>;
}

export function MyProductDetailPage({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const { result, error: loadError } = useApi<Product>(`/my/products/${encodeURIComponent(productId)}`);
  const visibleError = error || loadError;
  useEffect(() => { if (result) setProduct(result.data); }, [result]);
  async function submit() { try { const { data } = await api<Product>(`/my/products/${productId}/submit`, { method: "POST" }); setProduct(data); } catch (e) { setError(messageOf(e)); } }
  async function removeAttachment(attachmentId: string) { try { await api(attachmentUrl(productId, attachmentId), { method: "DELETE" }); setProduct((current) => current ? { ...current, attachments: current.attachments.filter((file) => file.id !== attachmentId) } : current); } catch (e) { setError(messageOf(e)); } }
  if (!product) return visibleError ? <section><h1>Hồ sơ và kết quả</h1><p role="alert" className="form-note">{visibleError}</p></section> : <section className="detail-skeleton" aria-busy="true" aria-label="Đang tải hồ sơ"><div className="skeleton-line" /><div className="skeleton-line short" /><div className="skeleton-block" /></section>;
  const statusLabel = { DRAFT: "Bản nháp", SUBMITTED: "Đã nộp", SCORING: "Đang đánh giá", COMPLETED: "Đã hoàn tất" }[product.status];
  const resultReady = product.status === "COMPLETED" && typeof product.finalScore === "number";
  return <section className="route-panel registrant-result-page"><Link className="text-link" to="/my/products">← Hồ sơ của tôi</Link><p className="eyebrow">HỒ SƠ CHỦ THỂ · {statusLabel}</p><h1>{product.name}</h1><p>{product.category.groupName} · {product.category.name}</p>{product.submittedAt && <p className="submitted-at">Đã nộp: <time dateTime={product.submittedAt}>{new Date(product.submittedAt).toLocaleString("vi-VN", { dateStyle: "long", timeStyle: "short" })}</time></p>}
    <section className="result-summary" aria-labelledby="result-title"><h2 id="result-title">Kết quả đánh giá</h2>{resultReady ? <p className="result-score"><strong>{product.finalScore} điểm</strong><span>{product.starRating} sao</span></p> : <p role="status">{product.status === "DRAFT" ? "Hồ sơ chưa được nộp để đánh giá." : "Hồ sơ đang chờ hội đồng hoàn tất đánh giá. Kết quả sẽ hiển thị tại đây khi được tổng hợp."}</p>}</section>
    {product.description && <p>{product.description}</p>}{visibleError && <p role="alert" className="form-note">{visibleError}</p>}
    <div className="record-result">{product.status === "DRAFT" && <><Link className="button button-secondary" to="/my/products/$id/edit" params={{ id: product.id }}>Sửa bản nháp</Link><Button onClick={() => void submit()}>Nộp hồ sơ</Button></>}</div>
    <h2>Tệp đính kèm</h2><ul>{product.attachments.map((file) => <li key={file.id}><AttachmentLink path={attachmentUrl(productId, file.id)} name={file.fileName} /> · {file.type}{product.status === "DRAFT" && <Button variant="secondary" onClick={() => void removeAttachment(file.id)}>Xóa</Button>}</li>)}</ul>
    <h2>Thông tin hồ sơ</h2><pre>{JSON.stringify(product.formData, null, 2)}</pre>
  </section>;
}

function AttachmentLink({ path, name }: { path: string; name: string }) {
  async function open() { try { await openAttachment(path, name, true); } catch (e) { window.alert(messageOf(e)); } }
  return <button type="button" className="text-link" onClick={() => void open()}>{name}</button>;
}
