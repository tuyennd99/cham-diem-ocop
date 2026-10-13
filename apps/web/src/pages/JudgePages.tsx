import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { api, apiBlob, jsonBody, messageOf } from "../api";
import { Button } from "@/components/ui/button";

interface Category { id: string; name: string; groupName: string }
interface QueueProduct { id: string; name: string; description: string | null; status: string; createdAt: string; category: Category; attachments: { id: string; fileName: string }[]; evaluations: { status: string; total: number | null }[] }
interface Option { id: string; label: string; points: number }
interface Subcriterion { id: string; content: string; order: number; options: Option[] }
interface Criterion { id: string; code: string; name: string; maxScore: number; order: number; subCriteria: Subcriterion[] }
interface EvaluationData { product: QueueProduct & { formData: Record<string, unknown>; attachments: { id: string; type: string; fileName: string }[] }; criteria: Criterion[]; evaluation: { id: string | null; status: string; total: number | null; scores: { subCriterionId: string; optionId: string; note: string | null }[] } }

export function JudgeQueuePage() {
  const [rows, setRows] = useState<QueueProduct[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; api<QueueProduct[]>("/judge/products").then(({ data }) => { if (active) setRows(data); }).catch((e) => { if (active) setError(messageOf(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  return <section><div className="section-heading"><div><p className="eyebrow">KHU VỰC GIÁM KHẢO</p><h1>Hàng chờ chấm</h1></div></div>{loading && <p>Đang tải hồ sơ…</p>}{error && <p className="form-note" role="alert">{error}</p>}{!loading && !rows.length && <div className="empty-state"><h2>Chưa có hồ sơ được phân công</h2><p>Các hồ sơ sẽ xuất hiện tại đây khi được nộp và phân công.</p></div>}<div className="record-list">{rows.map((row) => <article className="record-row" key={row.id}><div className="record-main"><div className="record-badges"><span className="badge badge-category">{row.category.groupName} · {row.category.name}</span><span className="badge">{row.status}</span></div><h2>{row.name}</h2><p>{row.description}</p><p>{row.evaluations[0]?.status === "SUBMITTED" ? `Đã nộp phiếu · ${row.evaluations[0].total ?? 0} điểm` : "Phiếu chấm đang mở"}</p></div><div className="record-result"><span>{row.attachments.length} ảnh</span><Link className="button button-secondary" to="/judge/products/$id" params={{ id: row.id }}>Mở phiếu</Link></div></article>)}</div></section>;
}

export function JudgeEvaluationPage({ productId }: { productId: string }) {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api<EvaluationData>(`/judge/products/${productId}/evaluation`).then(({ data: result }) => {
    if (!active) return; setData(result);
    const selectedOptions: Record<string, string> = {}; const savedNotes: Record<string, string> = {};
    for (const score of result.evaluation.scores) { selectedOptions[score.subCriterionId] = score.optionId; savedNotes[score.subCriterionId] = score.note ?? ""; }
    setSelected(selectedOptions); setNotes(savedNotes);
  }).catch((e) => { if (active) setError(messageOf(e)); }); return () => { active = false; }; }, [productId]);
  const subcriteria = useMemo(() => data?.criteria.flatMap((criterion) => criterion.subCriteria) ?? [], [data]);
  const total = subcriteria.reduce((sum, sub) => sum + (sub.options.find((item) => item.id === selected[sub.id])?.points ?? 0), 0);
  async function save() {
    if (!data) return; setBusy(true); setError(""); setNotice("");
    try {
      const scores = Object.entries(selected).map(([subCriterionId, optionId]) => ({ subCriterionId, optionId, ...(notes[subCriterionId] ? { note: notes[subCriterionId] } : {}) }));
      await api(`/judge/products/${productId}/evaluation`, { method: "PUT", body: jsonBody({ scores }) }); setNotice("Đã lưu bản chấm.");
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (Object.keys(selected).length !== subcriteria.length) { setError("Chọn mức điểm cho mọi tiểu tiêu chí trước khi nộp."); return; }
    setBusy(true); setError(""); try {
      const scores = Object.entries(selected).map(([subCriterionId, optionId]) => ({ subCriterionId, optionId, ...(notes[subCriterionId] ? { note: notes[subCriterionId] } : {}) }));
      await api(`/judge/products/${productId}/evaluation`, { method: "PUT", body: jsonBody({ scores }) });
      const { data: result } = await api<{ status: string; total: number }>(`/judge/products/${productId}/evaluation/submit`, { method: "POST" }); setData((current) => current ? { ...current, evaluation: { ...current.evaluation, status: result.status, total: result.total } } : current); setNotice("Đã nộp phiếu chấm.");
    }
    catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  if (error && !data) return <section><h1>Phiếu chấm</h1><p role="alert" className="form-note">{error}</p><Link to="/judge">Quay lại hàng chờ</Link></section>;
  if (!data) return <p>Đang tải phiếu chấm…</p>;
  const locked = data.evaluation.status === "SUBMITTED";
  return <section><Link className="text-link" to="/judge">← Hàng chờ chấm</Link><div className="section-heading"><div><p className="eyebrow">{data.product.category.groupName} · {data.product.category.name}</p><h1>{data.product.name}</h1></div><strong>{data.evaluation.status === "SUBMITTED" ? "Đã nộp" : "Bản nháp"}</strong></div>
    {data.product.description && <p>{data.product.description}</p>}<h2>Thông tin hồ sơ đăng ký</h2><pre>{JSON.stringify(data.product.formData, null, 2)}</pre>
    <h2>Tiêu chí được phân công</h2>{data.criteria.map((criterion) => <section className="route-panel" key={criterion.id}><h3>{criterion.code} · {criterion.name} <small>(tối đa {criterion.maxScore} điểm)</small></h3>{criterion.subCriteria.map((sub) => <fieldset className="account-form" key={sub.id} disabled={locked}><legend>{sub.content}</legend><label>Mức điểm<select value={selected[sub.id] ?? ""} onChange={(e) => setSelected((current) => ({ ...current, [sub.id]: e.target.value }))} required><option value="">Chọn mức đánh giá</option>{sub.options.map((option) => <option key={option.id} value={option.id}>{option.points} điểm · {option.label}</option>)}</select></label><label>Ghi chú (không bắt buộc)<textarea rows={2} maxLength={2000} value={notes[sub.id] ?? ""} onChange={(e) => setNotes((current) => ({ ...current, [sub.id]: e.target.value }))} /></label></fieldset>)}</section>)}
    <h2>Minh chứng</h2><ul>{data.product.attachments.map((file) => <li key={file.id}><JudgeAttachmentLink productId={productId} attachmentId={file.id} fileName={file.fileName} /></li>)}</ul>
    <p aria-live="polite">Tạm tính theo các mức đã chọn: <strong>{total} điểm</strong></p>{error && <p className="form-note" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{!locked && <div className="hero-actions"><Button variant="secondary" disabled={busy} onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu nháp"}</Button><Button disabled={busy} onClick={() => void submit()}>Nộp phiếu chấm</Button></div>}
  </section>;
}

function JudgeAttachmentLink({ productId, attachmentId, fileName }: { productId: string; attachmentId: string; fileName: string }) {
  async function open() { try { const blob = await apiBlob(`/judge/products/${productId}/attachments/${attachmentId}`); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noreferrer"; link.download = fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000); } catch (e) { window.alert(messageOf(e)); } }
  return <button type="button" className="text-link" onClick={() => void open()}>{fileName}</button>;
}
