import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { myProductsApi, productsApi } from "../../api";
import { ApiError, messageOf } from "../../lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRODUCT_FILE_ACCEPT, validateProductFile } from "../../lib/attachments";
import { queryKeys } from "../../constants/query-key";
import type { RegistrantCategory as Category, RegistrantFormData as RegistrationFormData, RegistrantProduct as Product } from "../../types/registrant";
import { AttachmentLink } from "./AttachmentLink";

const emptyRegistrationForm: RegistrationFormData = {
  entityName: "", representativeName: "", representativeTitle: "", contactAddress: "",
  provinceName: "", phone: "", email: "", registrationType: "", sampleQuantity: "",
  assessmentYear: String(new Date().getFullYear()), declarationAccepted: false,
};
const applicationSteps = ["Đơn vị đăng ký", "Thông tin sản phẩm", "Cam kết và tệp"];

export function ProductEditorPage({ productId }: { productId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [registration, setRegistration] = useState<RegistrationFormData>(emptyRegistrationForm);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<FileList | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true;
    setLoaded(false); setError(""); setProduct(null);
    Promise.all([productsApi.categories(), productId ? myProductsApi.detail(productId) : Promise.resolve({ data: null })]).then(([categoryResult, productResult]) => {
      if (!active) return; setCategories(categoryResult.data);
      const current = productResult.data;
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
    event?.preventDefault();
    if (busy) return;
    setError(""); setBusy(true);
    try {
      const selectedFiles = Array.from(files ?? []);
      for (const file of selectedFiles) validateProductFile(file);
      const sampleQuantity = registration.sampleQuantity === "" ? 0 : Number(registration.sampleQuantity);
      if (!Number.isInteger(sampleQuantity) || sampleQuantity < 0 || sampleQuantity > 100000) {
        throw new Error("Số lượng mẫu phải là số nguyên từ 0 đến 100000.");
      }
      const assessmentYear = registration.assessmentYear === "" ? undefined : Number(registration.assessmentYear);
      if (assessmentYear !== undefined && (!Number.isInteger(assessmentYear) || assessmentYear < 2020 || assessmentYear > 2100)) {
        throw new Error("Năm đánh giá phải là số nguyên từ 2020 đến 2100.");
      }
      const formData = { ...registration, registrationType: registration.registrationType || undefined, sampleQuantity, assessmentYear };
      const payload = { name, description, categoryId, formData };
      const existingId = productId ?? product?.id;
      const { data } = existingId ? await myProductsApi.update(existingId, payload) : await myProductsApi.create(payload);
      const targetId = existingId ?? data.id;
      setProduct(data);
      const uploaded = new Set(uploadedFiles);
      for (const file of selectedFiles) {
        const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
        if (uploaded.has(fileKey)) continue;
        try {
          const { data: attachment } = await myProductsApi.upload(targetId, file);
          uploaded.add(fileKey); setUploadedFiles(new Set(uploaded));
          setProduct((current) => current ? { ...current, attachments: [...current.attachments, attachment] } : current);
        } catch (cause) {
          if (!(cause instanceof ApiError) || cause.status >= 500) {
            setFiles(null);
            if (fileInput.current) fileInput.current.value = "";
            try {
              const { data: latest } = await myProductsApi.detail(targetId);
              setProduct(latest);
            } catch (refreshCause) {
              throw new Error(`Chưa xác nhận tải tệp ${file.name}; chưa tải lại được hồ sơ. ${messageOf(refreshCause)} Hãy mở hồ sơ kiểm tra trước khi chọn lại tệp.`);
            }
            throw new Error(`Chưa xác nhận tải tệp ${file.name}. Đã tải lại danh sách tệp đã lưu; hãy kiểm tra trước khi chọn lại tệp.`);
          }
          throw cause;
        }
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.all });
      await navigate({ to: "/my/products/$id", params: { id: targetId } });
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }
  if (productId && !loaded && !error) return <p>Đang tải bản nháp…</p>;
  if (productId && loaded && !product) return <section><h1>Không tìm thấy bản nháp</h1><p role="alert">{error || "Hồ sơ không tồn tại hoặc bạn không có quyền truy cập."}</p><Link to="/my/products">Quay lại danh sách</Link></section>;
  if (product && product.status !== "DRAFT") return <section><h1>Hồ sơ đã nộp</h1><p>Hồ sơ không còn ở trạng thái bản nháp nên không thể sửa.</p><Link to="/my/products/$id" params={{ id: product.id }}>Quay lại hồ sơ</Link></section>;
  return <section className="route-panel"><p className="eyebrow">KHU VỰC CHỦ THỂ · MẪU 01</p><h1>{productId ? "Sửa hồ sơ nháp" : "Tạo hồ sơ sản phẩm"}</h1><p>Hoàn thành phiếu đăng ký theo từng bước. Ảnh và tài liệu minh chứng là tùy chọn; mỗi tệp tối đa 10 MiB.</p>
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
        <label>Số lượng sản phẩm mẫu<Input type="number" min={0} step={1} value={registration.sampleQuantity} onChange={(e) => setRegistration({ ...registration, sampleQuantity: e.target.value })} /></label>
      </>}
      {step === 2 && <>
        <label className="declaration-field" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}><input type="checkbox" style={{ width: "auto", minHeight: "auto", padding: 0, marginTop: 4 }} checked={registration.declarationAccepted} onChange={(e) => setRegistration({ ...registration, declarationAccepted: e.target.checked })} /><span>Tôi cam đoan thông tin kê khai là đúng sự thật, tuân thủ quy định đánh giá, phân hạng OCOP và chịu trách nhiệm về hồ sơ.</span></label>
        <label>Ảnh sản phẩm hoặc tài liệu minh chứng (không bắt buộc)<Input ref={fileInput} type="file" accept={PRODUCT_FILE_ACCEPT} multiple disabled={busy} onChange={(e) => setFiles(e.target.files)} /></label>
        {files && Array.from(files).map((file) => <p key={`${file.name}:${file.lastModified}`}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB</p>)}
      </>}
      {error && <p role="alert" className="form-note">{error}</p>}
      <div className="hero-actions">
        {step > 0 && <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>Quay lại</Button>}
        {step < applicationSteps.length - 1 && <Button type="button" onClick={() => setStep(step + 1)}>Tiếp tục</Button>}
        <Button type="submit" variant="secondary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu bản nháp"}</Button>
      </div>
    </form>
    {product && <section aria-label="Tệp đã lưu"><p>Hồ sơ đã lưu: {product.id}</p><ul>{product.attachments.map((file) => <li key={file.id}><AttachmentLink productId={product.id} attachmentId={file.id} name={file.fileName} /></li>)}</ul></section>}
  </section>;
}
